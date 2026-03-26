/**
 * Background Sync Service
 * Handles background synchronization with exponential backoff and conflict resolution
 */

import { advancedTransactionQueue, QueuedTransaction } from './advancedQueue';
import { offlineCache } from './cache';
import { CachedTransaction, ConflictData } from '../storage/types';

export interface SyncConfig {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  enableConflictResolution: boolean;
  syncInterval: number; // ms, 0 = manual only
  enableBackgroundSync: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  duration: number;
  error?: string;
}

export interface SyncEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'conflict';
  timestamp: number;
  message?: string;
  data?: any;
}

class BackgroundSyncService {
  private config: SyncConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    enableConflictResolution: true,
    syncInterval: 30000, // 30 seconds
    enableBackgroundSync: true,
  };

  private syncInProgress = false;
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private syncListeners: Set<(event: SyncEvent) => void> = new Set();
  private lastSyncTime = 0;
  private backgroundSyncInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize sync service
   */
  async init(config?: Partial<SyncConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    await advancedTransactionQueue.init();
    await offlineCache.init();

    this.setupBackgroundSync();
  }

  /**
   * Setup background synchronization
   */
  private setupBackgroundSync(): void {
    if (!this.config.enableBackgroundSync || !this.config.syncInterval) {
      return;
    }

    this.backgroundSyncInterval = setInterval(() => {
      this.sync().catch(err => {
        console.error('Background sync error:', err);
        this.emitEvent({
          type: 'error',
          timestamp: Date.now(),
          message: `Background sync failed: ${err.message}`,
        });
      });
    }, this.config.syncInterval);
  }

  /**
   * Perform synchronization
   */
  async sync(
    submitTransaction?: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>,
    fetchServerData?: () => Promise<Record<string, any>>
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflictCount: 0,
        duration: 0,
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    this.emitEvent({
      type: 'start',
      timestamp: Date.now(),
      message: 'Background sync started',
    });

    try {
      // Get pending transactions
      const pendingTx = advancedTransactionQueue.getAll();

      let syncedCount = 0;
      let failedCount = 0;
      let conflictCount = 0;

      // Process each transaction
      for (const tx of pendingTx) {
        try {
          const result = await this.syncTransaction(tx, submitTransaction);
          
          if (result.synced) {
            syncedCount++;
            this.emitEvent({
              type: 'progress',
              timestamp: Date.now(),
              message: `Synced transaction ${tx.id}`,
              data: { transactionId: tx.id },
            });
          } else if (result.conflict) {
            conflictCount++;
            this.emitEvent({
              type: 'conflict',
              timestamp: Date.now(),
              message: `Conflict detected for ${tx.id}`,
              data: { transactionId: tx.id, conflict: result.conflict },
            });
          } else {
            failedCount++;
            this.scheduleRetry(tx);
          }
        } catch (error) {
          failedCount++;
          this.scheduleRetry(tx);
        }
      }

      // Fetch and cache server data if provided
      if (fetchServerData) {
        try {
          const data = await fetchServerData();
          await offlineCache.set('server-data', data, {
            ttl: 60000,
            priority: 'high',
            tags: ['server-data'],
          });
        } catch (error) {
          console.error('Failed to fetch server data:', error);
        }
      }

      this.lastSyncTime = Date.now();

      const result: SyncResult = {
        success: failedCount === 0,
        syncedCount,
        failedCount,
        conflictCount,
        duration: Date.now() - startTime,
      };

      this.emitEvent({
        type: 'complete',
        timestamp: Date.now(),
        message: `Sync completed: ${syncedCount} synced, ${failedCount} failed`,
        data: result,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        message: `Sync failed: ${errorMsg}`,
      });

      return {
        success: false,
        syncedCount: 0,
        failedCount: pendingTx.length,
        conflictCount: 0,
        duration: Date.now() - startTime,
        error: errorMsg,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual transaction
   */
  private async syncTransaction(
    tx: QueuedTransaction,
    submitTransaction?: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>
  ): Promise<{ synced: boolean; conflict?: ConflictData; error?: string }> {
    if (!submitTransaction) {
      return { synced: false, error: 'No submitTransaction function provided' };
    }

    try {
      const result = await submitTransaction(tx);

      if (result.success) {
        await advancedTransactionQueue.updateStatus(tx.id, 'synced');
        return { synced: true };
      } else {
        // Check if it's a conflict
        if (result.error?.includes('conflict')) {
          return {
            synced: false,
            conflict: {
              localState: { id: tx.id },
              serverState: {},
              timestamp: Date.now(),
            },
          };
        }

        await advancedTransactionQueue.updateStatus(tx.id, 'failed', result.error);
        return { synced: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await advancedTransactionQueue.updateStatus(tx.id, 'failed', errorMsg);
      return { synced: false, error: errorMsg };
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(tx: QueuedTransaction): void {
    const attempts = this.retryAttempts.get(tx.id) || 0;

    if (attempts >= this.config.maxRetries) {
      return;
    }

    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempts),
      this.config.maxDelay
    );

    // Clear existing timer if any
    const existingTimer = this.retryTimers.get(tx.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule retry
    const timer = setTimeout(() => {
      this.retryAttempts.set(tx.id, attempts + 1);
      this.retryTimers.delete(tx.id);
    }, delay);

    this.retryTimers.set(tx.id, timer);
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * Get pending sync count
   */
  getPendingCount(): number {
    return advancedTransactionQueue.getAll().length;
  }

  /**
   * Subscribe to sync events
   */
  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private emitEvent(event: SyncEvent): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  /**
   * Force sync now
   */
  async forceSync(
    submitTransaction?: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>,
    fetchServerData?: () => Promise<Record<string, any>>
  ): Promise<SyncResult> {
    // Cancel pending retries
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();

    return this.sync(submitTransaction, fetchServerData);
  }

  /**
   * Clear all pending retries
   */
  clearRetries(): void {
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
    this.retryAttempts.clear();
  }

  /**
   * Update sync config
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart background sync if interval changed
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
    this.setupBackgroundSync();
  }

  /**
   * Get sync status summary
   */
  getStatus(): {
    isSyncing: boolean;
    lastSyncTime: number;
    pendingCount: number;
    retryCount: number;
  } {
    return {
      isSyncing: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      pendingCount: this.getPendingCount(),
      retryCount: this.retryTimers.size,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
    }
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
    this.syncListeners.clear();
  }
}

export const backgroundSyncService = new BackgroundSyncService();
