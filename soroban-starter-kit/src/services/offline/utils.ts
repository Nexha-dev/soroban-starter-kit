/**
 * Offline Utilities and Helper Functions
 */

import { QueuedTransaction } from './advancedQueue';
import { offlineCache } from './cache';
import { backgroundSyncService, SyncEvent } from './backgroundSync';
import { offlineAnalytics } from './analytics';
import { cacheOptimization } from './optimization';

/**
 * Check if data is available offline
 */
export async function isDataAvailableOffline(key: string): Promise<boolean> {
  return offlineCache.has(key);
}

/**
 * Get offline data with fallback
 */
export async function getOfflineData<T>(
  key: string,
  fallback?: T
): Promise<T | undefined> {
  const data = offlineCache.get<T>(key);
  return data ?? fallback;
}

/**
 * Cache data for offline use
 */
export async function cacheForOffline<T>(
  key: string,
  data: T,
  options?: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }
): Promise<void> {
  await offlineCache.set(key, data, options);
}

/**
 * Batch cache multiple items
 */
export async function batchCacheOffline<T extends Record<string, any>>(
  items: T,
  prefix: string = '',
  options?: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }
): Promise<void> {
  const promises = Object.entries(items).map(([key, value]) => {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    return offlineCache.set(fullKey, value, options);
  });

  await Promise.all(promises);
}

/**
 * Queue transaction for offline processing
 */
export async function queueOfflineTransaction(
  type: any,
  contractId: string,
  method: string,
  params: Record<string, unknown>,
  priority?: number
): Promise<QueuedTransaction> {
  const { advancedTransactionQueue } = await import('./advancedQueue');
  return advancedTransactionQueue.add(type, contractId, method, params, { priority });
}

/**
 * Get pending transactions count
 */
export function getPendingTransactionCount(): number {
  const { advancedTransactionQueue } = require('./advancedQueue');
  return advancedTransactionQueue.getAll().length;
}

/**
 * Trigger sync now
 */
export async function triggerSync(
  submitTransaction?: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>,
  fetchServerData?: () => Promise<Record<string, any>>
): Promise<void> {
  await backgroundSyncService.sync(submitTransaction, fetchServerData);
}

/**
 * Check if sync is in progress
 */
export function isSyncInProgress(): boolean {
  return backgroundSyncService.isSyncing();
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  isSyncing: boolean;
  lastSyncTime: number;
  pendingCount: number;
  retryCount: number;
} {
  return backgroundSyncService.getStatus();
}

/**
 * Subscribe to sync events
 */
export function subscribeToSyncEvents(callback: (event: SyncEvent) => void): () => void {
  return backgroundSyncService.subscribe(callback);
}

/**
 * Get cache statistics
 */
export function getCacheStatistics() {
  return offlineCache.getStats();
}

/**
 * Clear cache by tag
 */
export function clearCacheByTag(tag: string): void {
  offlineCache.clear(tag);
}

/**
 * Get analytics data
 */
export function getOfflineAnalytics() {
  return offlineAnalytics.getAnalytics();
}

/**
 * Export all offline data for debugging
 */
export function exportOfflineData() {
  return {
    cache: offlineCache.export(),
    analytics: offlineAnalytics.export(),
    cacheStats: offlineCache.getStats(),
  };
}

/**
 * Initialize offline mode
 */
export async function initializeOfflineMode(config?: {
  enableBackgroundSync?: boolean;
  syncInterval?: number;
  maxCacheSize?: number;
  maxRetries?: number;
}): Promise<void> {
  const { advancedTransactionQueue } = await import('./advancedQueue');

  // Initialize services
  await advancedTransactionQueue.init();
  await offlineCache.init();
  await cacheOptimization.init();

  // Configure sync
  await backgroundSyncService.init({
    enableBackgroundSync: config?.enableBackgroundSync ?? true,
    syncInterval: config?.syncInterval ?? 30000,
    maxRetries: config?.maxRetries ?? 3,
  });

  // Start analytics session
  offlineAnalytics.startSession();
}

/**
 * Cleanup offline mode
 */
export function cleanupOfflineMode(): void {
  backgroundSyncService.destroy();
  offlineCache.destroy();
  offlineAnalytics.endSession();
}

/**
 * Check connectivity
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Wait for connectivity
 */
export function waitForConnectivity(timeout?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve();
      return;
    }

    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      resolve();
    };

    window.addEventListener('online', handleOnline);

    if (timeout) {
      setTimeout(() => {
        window.removeEventListener('online', handleOnline);
        reject(new Error('Connectivity timeout'));
      }, timeout);
    }
  });
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    multiplier?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const multiplier = options?.multiplier ?? 2;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(multiplier, attempt),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

/**
 * Create offline context
 */
export interface OfflineContext {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  cacheSize: number;
  lastSyncTime: number;
}

export function createOfflineContext(): OfflineContext {
  const syncStatus = backgroundSyncService.getStatus();
  const cacheStats = offlineCache.getStats();

  return {
    isOnline: isOnline(),
    isSyncing: syncStatus.isSyncing,
    pendingCount: syncStatus.pendingCount,
    cacheSize: cacheStats.totalSize,
    lastSyncTime: syncStatus.lastSyncTime || 0,
  };
}

/**
 * Monitor offline performance
 */
export function monitorOfflinePerformance(callback: (metrics: any) => void): () => void {
  const unsubscribe = offlineAnalytics.subscribe(() => {
    const metrics = {
      analytics: offlineAnalytics.getAnalytics(),
      cacheStats: offlineCache.getStats(),
      syncStatus: backgroundSyncService.getStatus(),
    };
    callback(metrics);
  });

  return unsubscribe;
}

/**
 * Get optimization recommendations
 */
export function getOptimizationRecommendations(): string[] {
  return cacheOptimization.getRecommendations();
}

/**
 * Apply cache optimization
 */
export async function applyCacheOptimization(): Promise<{
  entriesAnalyzed: number;
  entriesOptimized: number;
  spaceFreed: number;
}> {
  return cacheOptimization.runOptimization();
}

/**
 * Prefetch critical data
 */
export async function prefetchCriticalData(keys: string[]): Promise<void> {
  await offlineCache.prefetch(keys, 'high');
}

/**
 * Get cache size breakdown
 */
export function getCacheSizeBreakdown(): Record<string, number> {
  return offlineCache.getSizeBreakdown();
}
