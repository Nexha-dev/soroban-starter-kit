/**
 * Offline UI Components
 * React components for offline functionality UI
 */

import React, { useEffect, useState } from 'react';
import { useOfflineContext, useSync, useConnectivity, useOfflineAnalytics, useSyncEvents } from '../offline/hooks';
import { SyncEvent } from '../offline/backgroundSync';

/**
 * OfflineIndicator Component
 * Shows current offline/online status
 */
export function OfflineIndicator(): JSX.Element {
  const { isOnline } = useConnectivity();

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      <span className="status-dot"></span>
      <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}

/**
 * SyncStatus Component
 * Displays synchronization status and metrics
 */
export function SyncStatus(): JSX.Element {
  const { isSyncing, lastSyncTime, pendingCount } = useSync();
  const [events, setEvents] = useState<SyncEvent[]>([]);

  useSyncEvents((event) => {
    setEvents((prev) => [event, ...prev.slice(0, 9)]);
  });

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="sync-status-panel">
      <div className="sync-header">
        <h3>Sync Status</h3>
        {isSyncing && <span className="syncing-badge">Syncing...</span>}
      </div>

      <div className="sync-stats">
        <div className="stat">
          <label>Pending Transactions:</label>
          <span className="value">{pendingCount}</span>
        </div>
        <div className="stat">
          <label>Last Sync:</label>
          <span className="value">{formatTime(lastSyncTime)}</span>
        </div>
      </div>

      <div className="sync-events">
        <h4>Recent Events</h4>
        <div className="events-list">
          {events.map((event, idx) => (
            <div key={idx} className={`event event-${event.type}`}>
              <span className="event-type">{event.type}</span>
              <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
              {event.message && <span className="event-message">{event.message}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * CacheInfo Component
 * Displays cache statistics and information
 */
export function CacheInfo(): JSX.Element {
  const cacheStats = useOfflineAnalytics();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="cache-info-panel">
      <h3>Cache Information</h3>

      <div className="cache-stats">
        <div className="stat">
          <label>Hit Rate:</label>
          <span className="value">{(cacheStats.syncStats?.successRate || 0).toFixed(2)}%</span>
        </div>
        <div className="stat">
          <label>Cache Size:</label>
          <span className="value">{formatSize(cacheStats.cacheStats?.totalCacheSize || 0)}</span>
        </div>
        <div className="stat">
          <label>Entries:</label>
          <span className="value">{cacheStats.cacheStats?.entryCount || 0}</span>
        </div>
        <div className="stat">
          <label>Response Time:</label>
          <span className="value">{(cacheStats.cacheStats?.averageResponseTime || 0).toFixed(2)}ms</span>
        </div>
      </div>

      <div className="cache-breakdown">
        <h4>Cache Breakdown</h4>
        <div className="breakdown-list">
          {cacheStats.analytics?.syncMetrics?.slice(-5).map((metric, idx) => (
            <div key={idx} className="breakdown-item">
              <span>{metric.syncId}</span>
              <span className="count">{metric.transactionCount} txs</span>
              <span className={`success-rate ${metric.successCount === metric.transactionCount ? 'success' : 'partial'}`}>
                {metric.successCount}/{metric.transactionCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * OfflineMode Component
 * Main offline mode panel with actions
 */
export function OfflineMode(): JSX.Element {
  const offlineContext = useOfflineContext();
  const { triggerSync, isSyncing } = useSync();
  const { isConnected } = useConnectivity();

  const handleSync = async () => {
    await triggerSync();
  };

  return (
    <div className={`offline-mode-panel ${isConnected ? 'online' : 'offline'}`}>
      <div className="mode-header">
        <h2>{isConnected ? '🟢 Online' : '🔴 Offline'} Mode</h2>
        <p>
          {isConnected
            ? 'Connected to network - data syncing enabled'
            : 'No network connection - working offline'}
        </p>
      </div>

      <div className="mode-stats">
        <div className="stat-group">
          <h4>Connection Status</h4>
          <div className="stat">
            <span>Status:</span>
            <strong>{isConnected ? 'Online' : 'Offline'}</strong>
          </div>
        </div>

        <div className="stat-group">
          <h4>Queue Status</h4>
          <div className="stat">
            <span>Pending Transactions:</span>
            <strong>{offlineContext.pendingCount}</strong>
          </div>
          <div className="stat">
            <span>Cache Size:</span>
            <strong>
              {(offlineContext.cacheSize / 1024 / 1024).toFixed(2)} MB
            </strong>
          </div>
        </div>
      </div>

      <div className="mode-actions">
        <button
          onClick={handleSync}
          disabled={isSyncing || !isConnected}
          className="btn-primary"
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
    </div>
  );
}

/**
 * OfflineTransaction Component
 * Displays a single pending transaction
 */
export interface OfflineTransactionProps {
  transactionId: string;
  type: string;
  method: string;
  status: string;
  createdAt: number;
  retryCount?: number;
  onRetry?: () => void;
  onRemove?: () => void;
}

export function OfflineTransaction({
  transactionId,
  type,
  method,
  status,
  createdAt,
  retryCount = 0,
  onRetry,
  onRemove,
}: OfflineTransactionProps): JSX.Element {
  const elapsed = Date.now() - createdAt;
  const minutes = Math.floor(elapsed / 60000);

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return '#ffc107';
      case 'synced':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <div className="offline-transaction" style={{ borderLeftColor: getStatusColor() }}>
      <div className="tx-header">
        <span className="tx-id">{transactionId.substring(0, 12)}...</span>
        <span className={`tx-status status-${status}`}>{status}</span>
      </div>

      <div className="tx-details">
        <div className="detail">
          <label>Type:</label>
          <span>{type}</span>
        </div>
        <div className="detail">
          <label>Method:</label>
          <span>{method}</span>
        </div>
        <div className="detail">
          <label>Created:</label>
          <span>{minutes} minutes ago</span>
        </div>
        {retryCount > 0 && (
          <div className="detail">
            <label>Retries:</label>
            <span>{retryCount}</span>
          </div>
        )}
      </div>

      <div className="tx-actions">
        {status === 'failed' && onRetry && (
          <button onClick={onRetry} className="btn-sm btn-warning">
            Retry
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="btn-sm btn-danger">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * OfflineQueue Component
 * Lists all pending transactions
 */
export function OfflineQueue(): JSX.Element {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, fetch from transaction queue
    const loadTransactions = async () => {
      const { advancedTransactionQueue } = await import('../offline/advancedQueue');
      const txs = advancedTransactionQueue.getAll();
      setTransactions(txs);
    };

    loadTransactions();
  }, []);

  if (transactions.length === 0) {
    return (
      <div className="offline-queue-panel">
        <h3>Transaction Queue</h3>
        <div className="empty-state">
          <p>No pending transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="offline-queue-panel">
      <h3>Pending Transactions ({transactions.length})</h3>
      <div className="transactions-list">
        {transactions.map((tx) => (
          <OfflineTransaction
            key={tx.id}
            transactionId={tx.id}
            type={tx.type}
            method={tx.method}
            status={tx.status}
            createdAt={tx.createdAt}
            retryCount={tx.retryCount}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * OfflineBanner Component
 * Compact banner for showing offline status
 */
export function OfflineBanner(): JSX.Element | null {
  const { isOnline } = useConnectivity();
  const { pendingCount } = useSync();

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner">
      <div className="banner-content">
        <span className="banner-icon">📡</span>
        <span className="banner-text">
          Offline Mode - {pendingCount} pending {pendingCount === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>
    </div>
  );
}

/**
 * OfflineDebugPanel Component
 * Development debugging panel
 */
export function OfflineDebugPanel(): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className={`offline-debug-panel ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="debug-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '✕' : '⚙️'} Debug
      </button>

      {isExpanded && (
        <div className="debug-content">
          <OfflineIndicator />
          <SyncStatus />
          <CacheInfo />
          <OfflineMode />
        </div>
      )}
    </div>
  );
}
