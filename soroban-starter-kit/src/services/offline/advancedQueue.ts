/**
 * Advanced Transaction Queue Service
 * Handles transaction queuing with priority, batching, and deduplication
 */

import { CachedTransaction, TransactionStatus, TransactionType } from '../storage/types';
import { storageService } from '../storage';

export interface QueuedTransaction extends CachedTransaction {
  priority: number; // 1-10, 10 is highest
  batchId?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  estimatedGas?: number;
}

export interface TransactionBatch {
  id: string;
  transactions: QueuedTransaction[];
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
}

export interface QueueMetrics {
  totalQueued: number;
  pendingCount: number;
  failedCount: number;
  averageWaitTime: number;
  batchSize: number;
  deduplicatedCount: number;
}

class AdvancedTransactionQueue {
  private queue: Map<string, QueuedTransaction> = new Map();
  private batches: Map<string, TransactionBatch> = new Map();
  private metrics = {
    totalQueued: 0,
    failedCount: 0,
    deduplicatedCount: 0,
    processedCount: 0,
  };

  private batchSize = 5;
  private maxRetries = 3;
  private listeners: Set<(metrics: QueueMetrics) => void> = new Set();

  /**
   * Initialize the queue
   */
  async init(): Promise<void> {
    await storageService.init();
    await this.loadFromStorage();
  }

  /**
   * Load persisted transactions from storage
   */
  private async loadFromStorage(): Promise<void> {
    const transactions = await storageService.getPendingTransactions();
    transactions.forEach(tx => {
      this.queue.set(tx.id, {
        ...tx,
        priority: 5,
      } as QueuedTransaction);
    });
  }

  /**
   * Add transaction to queue with deduplication
   */
  async add(
    type: TransactionType,
    contractId: string,
    method: string,
    params: Record<string, unknown>,
    options?: {
      priority?: number;
      deduplicatWindow?: number; // ms
    }
  ): Promise<QueuedTransaction> {
    // Check for duplicates
    const duplicate = this.findDuplicate(type, contractId, method, params, options?.deduplicatWindow);
    
    const tx: QueuedTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      contractId,
      method,
      params,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      localVersion: 1,
      priority: Math.min(10, options?.priority || 5),
      isDuplicate: !!duplicate,
      duplicateOf: duplicate?.id,
    };

    if (duplicate) {
      this.metrics.deduplicatedCount++;
    } else {
      this.queue.set(tx.id, tx);
      await storageService.savePendingTransaction(tx);
      this.metrics.totalQueued++;
    }

    this.notifyListeners();
    return tx;
  }

  /**
   * Find duplicate transaction in queue
   */
  private findDuplicate(
    type: TransactionType,
    contractId: string,
    method: string,
    params: Record<string, unknown>,
    window: number = 60 * 1000 // 1 minute
  ): QueuedTransaction | undefined {
    const now = Date.now();

    for (const tx of this.queue.values()) {
      if (
        tx.type === type &&
        tx.contractId === contractId &&
        tx.method === method &&
        now - tx.createdAt < window &&
        JSON.stringify(tx.params) === JSON.stringify(params)
      ) {
        return tx;
      }
    }

    return undefined;
  }

  /**
   * Get transaction by ID
   */
  get(id: string): QueuedTransaction | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all pending transactions
   */
  getAll(): QueuedTransaction[] {
    return Array.from(this.queue.values())
      .filter(tx => tx.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }

  /**
   * Get transactions by status
   */
  getByStatus(status: TransactionStatus): QueuedTransaction[] {
    return Array.from(this.queue.values()).filter(tx => tx.status === status);
  }

  /**
   * Update transaction status
   */
  async updateStatus(id: string, status: TransactionStatus, error?: string): Promise<void> {
    const tx = this.queue.get(id);
    if (!tx) return;

    tx.status = status;
    tx.error = error;
    tx.lastAttempt = Date.now();

    if (status === 'failed') {
      tx.retryCount++;
      if (tx.retryCount >= this.maxRetries) {
        this.metrics.failedCount++;
      }
    }

    await storageService.savePendingTransaction(tx);
    this.notifyListeners();
  }

  /**
   * Create batch of transactions for processing
   */
  createBatch(): TransactionBatch | null {
    const pending = this.getAll();
    
    if (pending.length === 0) {
      return null;
    }

    const batchTxs = pending.slice(0, this.batchSize);
    const batch: TransactionBatch = {
      id: `batch_${Date.now()}`,
      transactions: batchTxs,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    this.batches.set(batch.id, batch);

    // Mark transactions as in batch
    batchTxs.forEach(tx => {
      tx.batchId = batch.id;
    });

    this.notifyListeners();
    return batch;
  }

  /**
   * Get batch by ID
   */
  getBatch(id: string): TransactionBatch | undefined {
    return this.batches.get(id);
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(batchId: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    batch.status = status;

    if (status === 'completed') {
      // Mark all transactions as synced
      for (const tx of batch.transactions) {
        await storageService.markTransactionSynced(tx);
        this.queue.delete(tx.id);
        this.metrics.processedCount++;
      }
    } else if (status === 'failed') {
      batch.retryCount++;
      if (batch.retryCount >= this.maxRetries) {
        // Mark transactions as failed
        for (const tx of batch.transactions) {
          this.metrics.failedCount++;
        }
      }
    }

    this.notifyListeners();
  }

  /**
   * Process queue (submit transactions)
   */
  async processQueue(
    submit: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    const pending = this.getAll();

    for (const tx of pending) {
      try {
        const result = await submit(tx);
        if (result.success) {
          await this.updateStatus(tx.id, 'synced');
          this.queue.delete(tx.id);
          succeeded++;
        } else {
          await this.updateStatus(tx.id, 'failed', result.error);
          failed++;
        }
      } catch (error) {
        await this.updateStatus(tx.id, 'failed', String(error));
        failed++;
      }
    }

    this.notifyListeners();
    return { succeeded, failed };
  }

  /**
   * Remove transaction from queue
   */
  async remove(id: string): Promise<boolean> {
    const tx = this.queue.get(id);
    if (!tx) return false;

    this.queue.delete(id);
    await storageService.deletePendingTransaction(id);
    this.notifyListeners();
    return true;
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    this.queue.clear();
    this.batches.clear();
    this.notifyListeners();
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return {
      totalQueued: this.metrics.totalQueued,
      pendingCount: this.queue.size,
      failedCount: this.metrics.failedCount,
      averageWaitTime: this.calculateAverageWaitTime(),
      batchSize: this.batchSize,
      deduplicatedCount: this.metrics.deduplicatedCount,
    };
  }

  /**
   * Calculate average wait time for transactions
   */
  private calculateAverageWaitTime(): number {
    const transactions = Array.from(this.queue.values());
    if (transactions.length === 0) return 0;

    const totalWait = transactions.reduce((sum, tx) => {
      return sum + (Date.now() - tx.createdAt);
    }, 0);

    return Math.round(totalWait / transactions.length);
  }

  /**
   * Get retry count for transaction
   */
  getRetryCount(id: string): number {
    return this.queue.get(id)?.retryCount || 0;
  }

  /**
   * Check if transaction can be retried
   */
  canRetry(id: string): boolean {
    const tx = this.queue.get(id);
    return !!tx && tx.retryCount < this.maxRetries && tx.status === 'failed';
  }

  /**
   * Retry transaction
   */
  async retry(id: string): Promise<boolean> {
    if (!this.canRetry(id)) return false;

    const tx = this.queue.get(id);
    if (!tx) return false;

    tx.status = 'pending';
    tx.error = undefined;
    await storageService.savePendingTransaction(tx);
    this.notifyListeners();
    return true;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (metrics: QueueMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach(listener => listener(metrics));
  }

  /**
   * Set batch size
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, size);
  }

  /**
   * Set max retries
   */
  setMaxRetries(retries: number): void {
    this.maxRetries = Math.max(0, retries);
  }

  /**
   * Export queue for debugging
   */
  export(): Record<string, unknown> {
    return {
      queued: Array.from(this.queue.values()),
      batches: Array.from(this.batches.values()),
      metrics: this.getMetrics(),
    };
  }
}

export const advancedTransactionQueue = new AdvancedTransactionQueue();
