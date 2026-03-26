/**
 * Offline Functionality - Integration Tests
 * Comprehensive tests for offline module components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { offlineCache } from '../services/offline/cache';
import { advancedTransactionQueue } from '../services/offline/advancedQueue';
import { backgroundSyncService } from '../services/offline/backgroundSync';
import { offlineAnalytics } from '../services/offline/analytics';
import { cacheOptimization } from '../services/offline/optimization';

describe('Offline Functionality Integration', () => {
  beforeEach(async () => {
    // Reset all services
    await offlineCache.init();
    await advancedTransactionQueue.init();
    await backgroundSyncService.init();
  });

  afterEach(() => {
    // Cleanup
    offlineCache.destroy();
    backgroundSyncService.destroy();
  });

  describe('Cache Management', () => {
    it('should cache and retrieve data', async () => {
      const testData = { id: 1, name: 'Test' };
      await offlineCache.set('test-key', testData);

      const retrieved = offlineCache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should respect TTL expiration', async () => {
      const testData = { id: 1 };
      await offlineCache.set('test-key', testData, { ttl: 100 });

      // Should exist immediately
      expect(offlineCache.has('test-key')).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(offlineCache.has('test-key')).toBe(false);
    });

    it('should handle eviction based on policy', async () => {
      const stats = offlineCache.getStats();
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
      expect(stats).toHaveProperty('evictions');
    });

    it('should tag and retrieve cached items', async () => {
      await offlineCache.set('user-1', { id: 1 }, { tags: ['user'] });
      await offlineCache.set('user-2', { id: 2 }, { tags: ['user'] });

      const users = offlineCache.getByTag('user');
      expect(users).toHaveLength(2);
    });
  });

  describe('Transaction Queue', () => {
    it('should queue transactions', async () => {
      const tx = await advancedTransactionQueue.add(
        'transfer',
        'contract123',
        'transfer',
        { to: 'receiver', amount: '100' }
      );

      expect(tx).toHaveProperty('id');
      expect(tx.status).toBe('pending');
      expect(tx.type).toBe('transfer');
    });

    it('should detect duplicate transactions', async () => {
      const params = { to: 'receiver', amount: '100' };

      const tx1 = await advancedTransactionQueue.add(
        'transfer',
        'contract123',
        'transfer',
        params
      );

      const tx2 = await advancedTransactionQueue.add(
        'transfer',
        'contract123',
        'transfer',
        params,
        { deduplicatWindow: 60000 }
      );

      expect(tx2.isDuplicate).toBe(true);
      expect(tx2.duplicateOf).toBe(tx1.id);
    });

    it('should create transaction batches', async () => {
      // Add multiple transactions
      for (let i = 0; i < 10; i++) {
        await advancedTransactionQueue.add(
          'transfer',
          'contract123',
          'transfer',
          { to: `receiver${i}`, amount: '100' }
        );
      }

      const batch = advancedTransactionQueue.createBatch();
      expect(batch).toBeDefined();
      expect(batch?.transactions.length).toBeLessThanOrEqual(5); // Default batch size
    });

    it('should track queue metrics', async () => {
      await advancedTransactionQueue.add(
        'transfer',
        'contract123',
        'transfer',
        { to: 'receiver', amount: '100' }
      );

      const metrics = advancedTransactionQueue.getMetrics();
      expect(metrics.pendingCount).toBe(1);
      expect(metrics.totalQueued).toBeGreaterThan(0);
    });
  });

  describe('Background Sync', () => {
    it('should initialize with config', async () => {
      await backgroundSyncService.init({
        syncInterval: 10000,
        maxRetries: 3,
      });

      const status = backgroundSyncService.getStatus();
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('lastSyncTime');
    });

    it('should track sync status', async () => {
      const status = backgroundSyncService.getStatus();

      expect(status.isSyncing).toBe(false);
      expect(typeof status.lastSyncTime).toBe('number');
      expect(typeof status.pendingCount).toBe('number');
    });

    it('should emit sync events', (done) => {
      const events: any[] = [];

      backgroundSyncService.subscribe((event) => {
        events.push(event);

        if (events.length > 0) {
          expect(event).toHaveProperty('type');
          expect(event).toHaveProperty('timestamp');
          done();
        }
      });

      // Trigger a sync manually
      backgroundSyncService.forceSync().catch(() => {
        // Expected to fail without proper handlers
      });
    });
  });

  describe('Analytics', () => {
    it('should track offline sessions', () => {
      const sessionId = offlineAnalytics.startSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = offlineAnalytics.endSession();
      expect(session).toHaveProperty('duration');
      expect(session?.status).toBe('completed');
    });

    it('should record sync performance', () => {
      offlineAnalytics.recordSync({
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        transactionCount: 5,
        successCount: 4,
        failureCount: 1,
        conflictCount: 0,
        retryAttempts: 0,
      });

      const stats = offlineAnalytics.getSyncStats();
      expect(stats.totalSyncs).toBe(1);
      expect(stats.totalTransactionsSynced).toBe(5);
    });

    it('should update cache metrics', () => {
      offlineAnalytics.updateCacheMetrics({
        hitRate: 0.85,
        missRate: 0.15,
        evictionCount: 5,
        totalCacheSize: 1024000,
        averageResponseTime: 2.5,
      });

      const cacheStats = offlineAnalytics.getCacheStats();
      expect(cacheStats.hitRate).toBe(0.85);
      expect(cacheStats.totalEvictions).toBe(5);
    });

    it('should record user actions', () => {
      offlineAnalytics.recordAction('cache_clear', { reason: 'manual' });

      const timeline = offlineAnalytics.getActionTimeline(10);
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[timeline.length - 1].action).toBe('cache_clear');
    });

    it('should record errors', () => {
      const errorMsg = 'Test error';
      offlineAnalytics.recordError(errorMsg, 'stack trace');

      const errorTimeline = offlineAnalytics.getErrorTimeline(10);
      expect(errorTimeline.length).toBeGreaterThan(0);
      expect(errorTimeline[errorTimeline.length - 1].message).toBe(errorMsg);
    });

    it('should export analytics data', () => {
      const exported = offlineAnalytics.export();

      expect(exported).toHaveProperty('session');
      expect(exported).toHaveProperty('syncMetrics');
      expect(exported).toHaveProperty('cacheMetrics');
      expect(exported).toHaveProperty('userActions');
      expect(exported).toHaveProperty('errors');
      expect(exported).toHaveProperty('summary');
    });
  });

  describe('Cache Optimization', () => {
    it('should initialize strategies', async () => {
      await cacheOptimization.init();

      const strategies = cacheOptimization.getStrategies();
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('name');
      expect(strategies[0]).toHaveProperty('enabled');
    });

    it('should analyze access patterns', async () => {
      await cacheOptimization.init();
      cacheOptimization.recordAccess('key1');
      cacheOptimization.recordAccess('key1');
      cacheOptimization.recordAccess('key2');

      const analysis = cacheOptimization.analyzeAccessPatterns();
      expect(analysis.size).toBeGreaterThan(0);
    });

    it('should identify hot data', async () => {
      await cacheOptimization.init();

      for (let i = 0; i < 10; i++) {
        cacheOptimization.recordAccess('hot-key');
      }

      const hot = cacheOptimization.getHotDataKeys(5);
      expect(hot.includes('hot-key')).toBe(true);
    });

    it('should provide optimization recommendations', async () => {
      await cacheOptimization.init();

      const recommendations = cacheOptimization.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work together as a system', async () => {
      // Cache some data
      await offlineCache.set('user-data', { id: 1, name: 'User' }, {
        priority: 'high',
        tags: ['user'],
      });

      // Queue a transaction
      const tx = await advancedTransactionQueue.add(
        'transfer',
        'contract123',
        'transfer',
        { to: 'receiver', amount: '100' }
      );

      // Check sync status
      const status = backgroundSyncService.getStatus();

      // Record analytics
      offlineAnalytics.recordAction('test', { tx: tx.id });

      // Verify everything is working
      expect(offlineCache.has('user-data')).toBe(true);
      expect(advancedTransactionQueue.get(tx.id)).toBeDefined();
      expect(status.pendingCount).toBeGreaterThan(0);

      const analytics = offlineAnalytics.getAnalytics();
      expect(analytics.userActions.length).toBeGreaterThan(0);
    });

    it('should export complete offline state', async () => {
      // Setup some data
      await offlineCache.set('test', { data: true });
      await advancedTransactionQueue.add('transfer', 'contract', 'method', {});

      // Export everything
      const exported = {
        cache: offlineCache.export(),
        analytics: offlineAnalytics.export(),
        queue: advancedTransactionQueue.export(),
      };

      expect(exported.cache).toBeDefined();
      expect(exported.analytics).toBeDefined();
      expect(exported.queue).toBeDefined();
    });
  });

  describe('Utilities', () => {
    it('should provide helper functions', async () => {
      const {
        isOnline,
        isDataAvailableOffline,
        getOfflineData,
        cacheForOffline,
        getCacheStatistics,
      } = await import('../services/offline/utils');

      // isOnline should return boolean
      expect(typeof isOnline()).toBe('boolean');

      // Cache and retrieve
      await cacheForOffline('test-key', { test: true });
      const available = await isDataAvailableOffline('test-key');
      expect(available).toBe(true);

      const data = await getOfflineData('test-key');
      expect(data).toEqual({ test: true });

      // Get stats
      const stats = getCacheStatistics();
      expect(stats).toHaveProperty('hitRate');
    });
  });
});

describe('Offline Performance', () => {
  it('should handle large datasets', async () => {
    await offlineCache.init();

    // Cache many items
    for (let i = 0; i < 100; i++) {
      await offlineCache.set(`item-${i}`, { id: i, data: 'x'.repeat(1000) });
    }

    const stats = offlineCache.getStats();
    expect(stats.entryCount).toBeGreaterThanOrEqual(90); // Allow for some evictions
  });

  it('should handle frequent queue operations', async () => {
    await advancedTransactionQueue.init();

    // Queue many transactions
    for (let i = 0; i < 50; i++) {
      await advancedTransactionQueue.add(
        'transfer',
        'contract',
        'transfer',
        { amount: String(i) }
      );
    }

    const metrics = advancedTransactionQueue.getMetrics();
    expect(metrics.totalQueued).toBe(50);

    // Create batches
    const batch1 = advancedTransactionQueue.createBatch();
    const batch2 = advancedTransactionQueue.createBatch();

    expect(batch1?.transactions.length).toBeGreaterThan(0);
    expect(batch2?.transactions.length).toBeGreaterThan(0);
  });

  it('should maintain performance with continuous sync', async () => {
    await backgroundSyncService.init({ syncInterval: 0 }); // Manual sync

    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      const result = await backgroundSyncService.sync();
      expect(result).toHaveProperty('success');
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete quickly with no transactions
  });
});
