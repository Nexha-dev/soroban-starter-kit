/**
 * Offline Analytics Service
 * Tracks offline usage, sync performance, and user behavior
 */

export interface OfflineSessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  status: 'active' | 'paused' | 'completed';
  offlineTime: number;
  onlineTime: number;
}

export interface SyncPerformanceMetrics {
  syncId: string;
  startTime: number;
  endTime: number;
  duration: number;
  transactionCount: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  retryAttempts: number;
  averageTransactionTime: number;
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  evictionCount: number;
  totalCacheSize: number;
  averageResponseTime: number;
}

export interface OfflineAnalytics {
  sessionId: string;
  sessionMetrics: OfflineSessionMetrics;
  syncMetrics: SyncPerformanceMetrics[];
  cacheMetrics: CachePerformanceMetrics;
  userActions: {
    timestamp: number;
    action: string;
    details?: Record<string, any>;
  }[];
  errors: {
    timestamp: number;
    message: string;
    stack?: string;
  }[];
}

class OfflineAnalyticsService {
  private currentSession: OfflineSessionMetrics | null = null;
  private syncMetrics: SyncPerformanceMetrics[] = [];
  private userActions: OfflineAnalytics['userActions'] = [];
  private errors: OfflineAnalytics['errors'] = [];
  private cacheMetrics: CachePerformanceMetrics = {
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    totalCacheSize: 0,
    averageResponseTime: 0,
  };

  private maxMetricsHistory = 100;
  private listeners: Set<(analytics: OfflineAnalytics) => void> = new Set();

  /**
   * Start a new offline session
   */
  startSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      duration: 0,
      status: 'active',
      offlineTime: 0,
      onlineTime: 0,
    };

    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(): OfflineSessionMetrics | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.status = 'completed';

    const session = this.currentSession;
    this.currentSession = null;

    return session;
  }

  /**
   * Record sync performance
   */
  recordSync(syncData: {
    startTime: number;
    endTime: number;
    transactionCount: number;
    successCount: number;
    failureCount: number;
    conflictCount: number;
    retryAttempts: number;
  }): void {
    const syncMetric: SyncPerformanceMetrics = {
      syncId: `sync_${Date.now()}`,
      startTime: syncData.startTime,
      endTime: syncData.endTime,
      duration: syncData.endTime - syncData.startTime,
      transactionCount: syncData.transactionCount,
      successCount: syncData.successCount,
      failureCount: syncData.failureCount,
      conflictCount: syncData.conflictCount,
      retryAttempts: syncData.retryAttempts,
      averageTransactionTime:
        syncData.transactionCount > 0
          ? (syncData.endTime - syncData.startTime) / syncData.transactionCount
          : 0,
    };

    this.syncMetrics.push(syncMetric);

    // Keep only recent metrics
    if (this.syncMetrics.length > this.maxMetricsHistory) {
      this.syncMetrics = this.syncMetrics.slice(-this.maxMetricsHistory);
    }

    this.recordAction('sync', {
      syncId: syncMetric.syncId,
      successCount: syncMetric.successCount,
      failureCount: syncMetric.failureCount,
    });

    this.notifyListeners();
  }

  /**
   * Update cache performance metrics
   */
  updateCacheMetrics(metrics: {
    hitRate: number;
    missRate: number;
    evictionCount: number;
    totalCacheSize: number;
    averageResponseTime: number;
  }): void {
    this.cacheMetrics = {
      hitRate: metrics.hitRate,
      missRate: metrics.missRate,
      evictionCount: metrics.evictionCount,
      totalCacheSize: metrics.totalCacheSize,
      averageResponseTime: metrics.averageResponseTime,
    };

    this.notifyListeners();
  }

  /**
   * Record user action
   */
  recordAction(action: string, details?: Record<string, any>): void {
    this.userActions.push({
      timestamp: Date.now(),
      action,
      details,
    });

    // Keep only recent actions
    if (this.userActions.length > this.maxMetricsHistory) {
      this.userActions = this.userActions.slice(-this.maxMetricsHistory);
    }

    this.notifyListeners();
  }

  /**
   * Record error
   */
  recordError(message: string, stack?: string): void {
    this.errors.push({
      timestamp: Date.now(),
      message,
      stack,
    });

    // Keep only recent errors
    if (this.errors.length > this.maxMetricsHistory) {
      this.errors = this.errors.slice(-this.maxMetricsHistory);
    }

    this.notifyListeners();
  }

  /**
   * Get current analytics
   */
  getAnalytics(): OfflineAnalytics {
    return {
      sessionId: this.currentSession?.sessionId || 'unknown',
      sessionMetrics: this.currentSession || {
        sessionId: 'unknown',
        startTime: 0,
        duration: 0,
        status: 'completed',
        offlineTime: 0,
        onlineTime: 0,
      },
      syncMetrics: this.syncMetrics,
      cacheMetrics: this.cacheMetrics,
      userActions: this.userActions,
      errors: this.errors,
    };
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    totalSyncs: number;
    averageSyncDuration: number;
    averageSuccessRate: number;
    averageConflictRate: number;
    totalTransactionsSynced: number;
  } {
    if (this.syncMetrics.length === 0) {
      return {
        totalSyncs: 0,
        averageSyncDuration: 0,
        averageSuccessRate: 0,
        averageConflictRate: 0,
        totalTransactionsSynced: 0,
      };
    }

    const totalDuration = this.syncMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalSuccess = this.syncMetrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalConflict = this.syncMetrics.reduce((sum, m) => sum + m.conflictCount, 0);
    const totalTransactions = this.syncMetrics.reduce(
      (sum, m) => sum + m.transactionCount,
      0
    );

    return {
      totalSyncs: this.syncMetrics.length,
      averageSyncDuration: totalDuration / this.syncMetrics.length,
      averageSuccessRate:
        this.syncMetrics.reduce(
          (sum, m) => sum + (m.successCount / (m.transactionCount || 1)),
          0
        ) / this.syncMetrics.length,
      averageConflictRate:
        this.syncMetrics.reduce(
          (sum, m) => sum + (m.conflictCount / (m.transactionCount || 1)),
          0
        ) / this.syncMetrics.length,
      totalTransactionsSynced: totalTransactions,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hitRate: number;
    missRate: number;
    totalEvictions: number;
    currentCacheSize: number;
    averageResponseTime: number;
  } {
    return {
      hitRate: this.cacheMetrics.hitRate,
      missRate: this.cacheMetrics.missRate,
      totalEvictions: this.cacheMetrics.evictionCount,
      currentCacheSize: this.cacheMetrics.totalCacheSize,
      averageResponseTime: this.cacheMetrics.averageResponseTime,
    };
  }

  /**
   * Get action timeline
   */
  getActionTimeline(limit: number = 50): OfflineAnalytics['userActions'] {
    return this.userActions.slice(-limit);
  }

  /**
   * Get errors timeline
   */
  getErrorTimeline(limit: number = 50): OfflineAnalytics['errors'] {
    return this.errors.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    offlineTime: number;
    onlineTime: number;
    cacheHitRate: number;
    syncSuccessRate: number;
    averageLatency: number;
    errorCount: number;
  } {
    const syncStats = this.getSyncStats();
    const cacheStats = this.getCacheStats();
    const session = this.currentSession;

    return {
      offlineTime: session?.offlineTime || 0,
      onlineTime: session?.onlineTime || 0,
      cacheHitRate: cacheStats.hitRate,
      syncSuccessRate: syncStats.averageSuccessRate,
      averageLatency: cacheStats.averageResponseTime,
      errorCount: this.errors.length,
    };
  }

  /**
   * Export analytics for reporting
   */
  export(): Record<string, any> {
    return {
      session: this.currentSession,
      syncMetrics: this.syncMetrics,
      cacheMetrics: this.cacheMetrics,
      userActions: this.userActions,
      errors: this.errors,
      summary: this.getPerformanceSummary(),
      syncStats: this.getSyncStats(),
      cacheStats: this.getCacheStats(),
    };
  }

  /**
   * Subscribe to analytics updates
   */
  subscribe(listener: (analytics: OfflineAnalytics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const analytics = this.getAnalytics();
    this.listeners.forEach(listener => {
      try {
        listener(analytics);
      } catch (error) {
        console.error('Analytics listener error:', error);
      }
    });
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.syncMetrics = [];
    this.userActions = [];
    this.errors = [];
    this.cacheMetrics = {
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      totalCacheSize: 0,
      averageResponseTime: 0,
    };
  }

  /**
   * Set max history limit
   */
  setMaxHistoryLimit(limit: number): void {
    this.maxMetricsHistory = Math.max(1, limit);
    
    if (this.syncMetrics.length > limit) {
      this.syncMetrics = this.syncMetrics.slice(-limit);
    }
    if (this.userActions.length > limit) {
      this.userActions = this.userActions.slice(-limit);
    }
    if (this.errors.length > limit) {
      this.errors = this.errors.slice(-limit);
    }
  }
}

export const offlineAnalytics = new OfflineAnalyticsService();
