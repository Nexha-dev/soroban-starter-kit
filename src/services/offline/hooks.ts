/**
 * Offline React Hooks
 * Custom hooks for offline functionality integration
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  isOnline,
  waitForConnectivity,
  getSyncStatus,
  subscribeToSyncEvents,
  getCacheStatistics,
  getOfflineAnalytics,
  createOfflineContext,
  OfflineContext,
} from './utils';
import { offlineAnalytics } from './analytics';
import { backgroundSyncService } from './backgroundSync';
import { SyncEvent } from './backgroundSync';

/**
 * useOfflineContext Hook
 * Provides current offline context and status
 */
export function useOfflineContext(): OfflineContext {
  const [context, setContext] = useState<OfflineContext>(() => createOfflineContext());

  useEffect(() => {
    const handleOnline = () => setContext(createOfflineContext());
    const handleOffline = () => setContext(createOfflineContext());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return context;
}

/**
 * useSync Hook
 * Monitor and control synchronization
 */
export function useSync() {
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((event: SyncEvent) => {
      setStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    await backgroundSyncService.forceSync();
  }, []);

  const clearRetries = useCallback(() => {
    backgroundSyncService.clearRetries();
  }, []);

  return {
    ...status,
    triggerSync,
    clearRetries,
  };
}

/**
 * useSyncEvents Hook
 * Subscribe to detailed sync events
 */
export function useSyncEvents(callback: (event: SyncEvent) => void) {
  useEffect(() => {
    return subscribeToSyncEvents(callback);
  }, [callback]);
}

/**
 * useCache Hook
 * Get cache statistics and perform cache operations
 */
export function useCache() {
  const [stats, setStats] = useState(getCacheStatistics());

  useEffect(() => {
    const unsubscribe = offlineAnalytics.subscribe(() => {
      setStats(getCacheStatistics());
    });

    return unsubscribe;
  }, []);

  return stats;
}

/**
 * useConnectivity Hook
 * Monitor connectivity changes
 */
export function useConnectivity() {
  const [isConnected, setIsConnected] = useState(() => isOnline());

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const waitForConnection = useCallback(
    (timeout?: number) => waitForConnectivity(timeout),
    []
  );

  return {
    isConnected,
    waitForConnection,
  };
}

/**
 * useOfflineTransactions Hook
 * Access pending transactions
 */
export function useOfflineTransactions() {
  const [pendingTx, setPendingTx] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSyncEvents((event: SyncEvent) => {
      // Update on sync events
      if (event.type === 'complete' || event.type === 'error') {
        // Re-fetch pending transactions
      }
    });

    return unsubscribe;
  }, []);

  return {
    pendingTransactions: pendingTx,
    metrics,
  };
}

/**
 * useOfflineAnalytics Hook
 * Monitor offline analytics
 */
export function useOfflineAnalytics() {
  const [analytics, setAnalytics] = useState(() => getOfflineAnalytics());

  useEffect(() => {
    const unsubscribe = offlineAnalytics.subscribe((data) => {
      setAnalytics(data);
    });

    return unsubscribe;
  }, []);

  return {
    analytics,
    syncStats: analytics && {
      totalSyncs: analytics.syncMetrics.length,
      successRate:
        analytics.syncMetrics.length > 0
          ? analytics.syncMetrics.reduce(
              (sum, m) => sum + (m.successCount / (m.transactionCount || 1)),
              0
            ) / analytics.syncMetrics.length
          : 0,
    },
    cacheStats: analytics?.cacheMetrics,
  };
}

/**
 * useOfflineStorage Hook
 * Interact with offline storage
 */
export function useOfflineStorage<T = any>(key: string, defaultValue?: T) {
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadValue = async () => {
      const { getOfflineData } = await import('./utils');
      const stored = await getOfflineData<T>(key, defaultValue);
      setValue(stored);
      setLoading(false);
    };

    loadValue();
  }, [key, defaultValue]);

  const setOfflineValue = useCallback(
    async (newValue: T | null) => {
      if (newValue === null) {
        const { clearCacheByTag } = await import('./utils');
        clearCacheByTag(key);
        setValue(undefined);
      } else {
        const { cacheForOffline } = await import('./utils');
        await cacheForOffline(key, newValue, {
          priority: 'medium',
          tags: [key],
        });
        setValue(newValue);
      }
    },
    [key]
  );

  return {
    value,
    setValue: setOfflineValue,
    loading,
  };
}

/**
 * useNetworkAware Hook
 * Execute function only when network is available
 */
export function useNetworkAware() {
  const { isConnected } = useConnectivity();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const executeWhenOnline = useCallback(
    async <T,>(fn: () => Promise<T>, timeout?: number): Promise<T | null> => {
      if (isConnected) {
        return fn();
      }

      try {
        await waitForConnectivity(timeout);
        return fn();
      } catch {
        return null;
      }
    },
    [isConnected]
  );

  const queueForSync = useCallback(async (fn: () => Promise<void>) => {
    try {
      await executeWhenOnline(fn);
    } catch (error) {
      console.error('Failed to queue for sync:', error);
    }
  }, [executeWhenOnline]);

  return {
    isConnected,
    executeWhenOnline,
    queueForSync,
  };
}

/**
 * usePersistentState Hook
 * State that persists across app reloads
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      const { getOfflineData } = await import('./utils');
      const stored = await getOfflineData<T>(key);
      if (stored !== undefined) {
        setState(stored);
      }
      setIsHydrated(true);
    };

    loadState();
  }, [key]);

  const setPersistentState = useCallback(
    async (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = typeof value === 'function' ? (value as any)(prev) : value;
        const { cacheForOffline } = require('./utils');
        cacheForOffline(key, newValue, { priority: 'high', tags: ['state'] });
        return newValue;
      });
    },
    [key]
  );

  return [state, setPersistentState, isHydrated];
}

/**
 * useOfflineDebug Hook
 * Debug offline functionality (development only)
 */
export function useOfflineDebug() {
  const cacheStats = useCache();
  const offlineContext = useOfflineContext();
  const { isConnected } = useConnectivity();
  const analytics = useOfflineAnalytics();

  const debugInfo = {
    connectivity: {
      isOnline: isConnected,
      offlineContext,
    },
    cache: cacheStats,
    analytics: analytics.analytics,
    syncStats: analytics.syncStats,
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Offline Debug]', debugInfo);
    }
  }, [debugInfo, isConnected]);

  return debugInfo;
}
