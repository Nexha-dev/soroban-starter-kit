/**
 * Offline Module - Main Export Index
 * Centralizes all offline functionality exports
 */

// Cache Service
export { offlineCache } from './cache';
export type { CacheEntry, CacheStats, CachePolicy } from './cache';

// Advanced Transaction Queue
export { advancedTransactionQueue } from './advancedQueue';
export type { QueuedTransaction, TransactionBatch, QueueMetrics } from './advancedQueue';

// Background Sync Service
export { backgroundSyncService } from './backgroundSync';
export type { SyncConfig, SyncResult, SyncEvent } from './backgroundSync';

// Analytics Service
export { offlineAnalytics } from './analytics';
export type {
  OfflineSessionMetrics,
  SyncPerformanceMetrics,
  CachePerformanceMetrics,
  OfflineAnalytics,
} from './analytics';

// Cache Optimization
export { cacheOptimization } from './optimization';
export type { OptimizationStrategy, CompressionResult, PrefetchStrategy } from './optimization';

// Utilities
export {
  isDataAvailableOffline,
  getOfflineData,
  cacheForOffline,
  batchCacheOffline,
  queueOfflineTransaction,
  getPendingTransactionCount,
  triggerSync,
  isSyncInProgress,
  getSyncStatus,
  subscribeToSyncEvents,
  getCacheStatistics,
  clearCacheByTag,
  getOfflineAnalytics,
  exportOfflineData,
  initializeOfflineMode,
  cleanupOfflineMode,
  isOnline,
  waitForConnectivity,
  retryWithBackoff,
  createOfflineContext,
  monitorOfflinePerformance,
  getOptimizationRecommendations,
  applyCacheOptimization,
  prefetchCriticalData,
  getCacheSizeBreakdown,
} from './utils';
export type { OfflineContext } from './utils';

// React Hooks
export {
  useOfflineContext,
  useSync,
  useSyncEvents,
  useCache,
  useConnectivity,
  useOfflineTransactions,
  useOfflineAnalytics,
  useOfflineStorage,
  useNetworkAware,
  usePersistentState,
  useOfflineDebug,
} from './hooks';

// UI Components (re-exported from components)
export {
  OfflineIndicator,
  SyncStatus,
  CacheInfo,
  OfflineMode,
  OfflineTransaction,
  OfflineQueue,
  OfflineBanner,
  OfflineDebugPanel,
} from '../components/OfflineComponents';
export type { OfflineTransactionProps } from '../components/OfflineComponents';

/**
 * Initialize complete offline functionality
 */
export async function setupOfflineFunctionality(config?: {
  enableBackgroundSync?: boolean;
  syncInterval?: number;
  maxCacheSize?: number;
  maxRetries?: number;
  debug?: boolean;
}): Promise<void> {
  const { initializeOfflineMode } = await import('./utils');
  await initializeOfflineMode(config);

  if (config?.debug && process.env.NODE_ENV === 'development') {
    console.log('[Offline] Functionality initialized');
    console.log('[Offline] Services ready:');
    console.log('  - Cache Manager');
    console.log('  - Transaction Queue');
    console.log('  - Background Sync');
    console.log('  - Analytics');
    console.log('  - Optimization');
  }
}

/**
 * Cleanup offline functionality
 */
export function teardownOfflineFunctionality(): void {
  const { cleanupOfflineMode } = require('./utils');
  cleanupOfflineMode();
}
