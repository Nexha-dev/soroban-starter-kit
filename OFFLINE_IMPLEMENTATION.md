# Offline Functionality Implementation Guide

## Overview

This comprehensive offline functionality system provides a complete solution for working without network connectivity. It includes intelligent caching, transaction queuing, background synchronization, conflict resolution, analytics, and optimization strategies.

## Components

### 1. **Offline Cache Management** (`services/offline/cache.ts`)

Smart caching system with configurable eviction policies:

- **LRU (Least Recently Used)** - Evicts least recently accessed items
- **LFU (Least Frequently Used)** - Evicts least frequently accessed items
- **FIFO (First In First Out)** - Evicts oldest items first

**Features:**
- Automatic TTL management
- Priority-based caching (low, medium, high)
- Tag-based cache organization
- Size estimation and management
- Automatic cleanup routine
- Cache statistics tracking

**Usage:**
```typescript
import { offlineCache } from './services/offline';

// Set cache entry
await offlineCache.set('user-data', userData, {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  priority: 'high',
  tags: ['user'],
});

// Get cache entry
const cached = offlineCache.get('user-data');

// Get entries by tag
const userEntries = offlineCache.getByTag('user');

// Get statistics
const stats = offlineCache.getStats();
```

### 2. **Advanced Transaction Queue** (`services/offline/advancedQueue.ts`)

Multi-feature transaction queue with priority and batching:

**Features:**
- Priority-based queuing (1-10 scale)
- Duplicate detection within time window
- Batch processing support
- Automatic retry with exponential backoff
- Comprehensive metrics

**Usage:**
```typescript
import { advancedTransactionQueue } from './services/offline';

// Queue transaction
const tx = await advancedTransactionQueue.add(
  'transfer',
  contractId,
  'transfer',
  { to, amount },
  { priority: 8, deduplicatWindow: 60000 }
);

// Get pending transactions
const pending = advancedTransactionQueue.getAll();

// Create batch for processing
const batch = advancedTransactionQueue.createBatch();

// Get metrics
const metrics = advancedTransactionQueue.getMetrics();
```

### 3. **Background Sync Service** (`services/offline/backgroundSync.ts`)

Automatic synchronization with smart retry logic:

**Features:**
- Configurable background sync interval
- Exponential backoff retry strategy
- Conflict detection and resolution
- Sync event streaming
- Performance monitoring

**Configuration:**
```typescript
import { backgroundSyncService } from './services/offline';

// Initialize with custom config
await backgroundSyncService.init({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  enableConflictResolution: true,
  syncInterval: 30000,
  enableBackgroundSync: true,
});

// Subscribe to sync events
backgroundSyncService.subscribe((event) => {
  console.log(`Sync ${event.type}: ${event.message}`);
});

// Trigger immediate sync
await backgroundSyncService.sync();

// Check sync status
const status = backgroundSyncService.getStatus();
```

### 4. **Offline Analytics** (`services/offline/analytics.ts`)

Comprehensive analytics and performance tracking:

**Metrics Tracked:**
- Session duration and activity
- Sync performance metrics
- Cache hit/miss rates
- User action timeline
- Error tracking
- Performance summary

**Usage:**
```typescript
import { offlineAnalytics } from './services/offline';

// Start session
offlineAnalytics.startSession();

// Record sync performance
offlineAnalytics.recordSync({
  startTime: Date.now(),
  endTime: Date.now() + 1000,
  transactionCount: 5,
  successCount: 4,
  failureCount: 1,
  conflictCount: 0,
  retryAttempts: 0,
});

// Get analytics
const analytics = offlineAnalytics.getAnalytics();

// Get performance summary
const summary = offlineAnalytics.getPerformanceSummary();
```

### 5. **Cache Optimization** (`services/offline/optimization.ts`)

Intelligent cache optimization with pattern analysis:

**Features:**
- Data compression analysis
- Access pattern analysis
- Hot/cold data identification
- Intelligent prefching
- Automatic optimization recommendations

**Usage:**
```typescript
import { cacheOptimization } from './services/offline';

// Get recommendations
const recommendations = cacheOptimization.getRecommendations();

// Run optimization
const result = await cacheOptimization.runOptimization();

// Analyze access patterns
const patterns = cacheOptimization.analyzeAccessPatterns();

// Get compression stats
const compressionStats = cacheOptimization.getCompressionStats();
```

### 6. **React Hooks**

Custom hooks for offline functionality:

**Available Hooks:**
- `useOfflineContext()` - Current offline status and metrics
- `useSync()` - Control and monitor synchronization
- `useSyncEvents()` - Subscribe to detailed sync events
- `useCache()` - Cache statistics
- `useConnectivity()` - Network connectivity status
- `useOfflineTransactions()` - Pending transactions
- `useOfflineAnalytics()` - Analytics and performance
- `useOfflineStorage()` - Persistent offline storage
- `useNetworkAware()` - Execute on network availability
- `usePersistentState()` - Persist state across reloads
- `useOfflineDebug()` - Debug offline functionality

**Example:**
```typescript
import { useOfflineContext, useSync, useConnectivity } from './services/offline';

export function MyComponent() {
  const offlineContext = useOfflineContext();
  const { isSyncing, pendingCount, triggerSync } = useSync();
  const { isConnected } = useConnectivity();

  return (
    <div>
      <p>Online: {isConnected ? 'Yes' : 'No'}</p>
      <p>Pending: {pendingCount}</p>
      <p>Syncing: {isSyncing ? 'Yes' : 'No'}</p>
      <button onClick={triggerSync} disabled={isSyncing}>
        Sync Now
      </button>
    </div>
  );
}
```

### 7. **UI Components**

Ready-to-use React components:

- `OfflineIndicator` - Status indicator
- `SyncStatus` - Sync status and events
- `CacheInfo` - Cache statistics
- `OfflineMode` - Main offline mode panel
- `OfflineTransaction` - Transaction display
- `OfflineQueue` - Transaction queue list
- `OfflineBanner` - Compact status banner
- `OfflineDebugPanel` - Dev debugging panel

**Usage:**
```typescript
import {
  OfflineIndicator,
  SyncStatus,
  OfflineMode,
  OfflineBanner,
} from './services/offline';

export function App() {
  return (
    <>
      <OfflineBanner />
      <div className="app-content">
        <OfflineIndicator />
        <SyncStatus />
        <OfflineMode />
      </div>
    </>
  );
}
```

## Utility Functions

### Offline Operations

```typescript
import {
  isOnline,
  isDataAvailableOffline,
  getOfflineData,
  cacheForOffline,
  batchCacheOffline,
  waitForConnectivity,
  retryWithBackoff,
} from './services/offline';

// Check connectivity
if (!isOnline()) {
  console.log('Working offline');
}

// Check if data is cached
if (await isDataAvailableOffline('user-data')) {
  const data = await getOfflineData('user-data');
}

// Cache data
await cacheForOffline('key', data, {
  ttl: 60000,
  priority: 'high',
  tags: ['data'],
});

// Batch cache multiple items
await batchCacheOffline(
  { user: userData, settings: settingsData },
  'app',
  { ttl: 60000 }
);

// Wait for connection
await waitForConnectivity(30000); // 30 second timeout

// Retry with backoff
const data = await retryWithBackoff(
  () => fetchData(),
  { maxRetries: 3, initialDelay: 1000, maxDelay: 10000 }
);
```

### Queue Operations

```typescript
import {
  queueOfflineTransaction,
  getPendingTransactionCount,
  triggerSync,
  isSyncInProgress,
  getSyncStatus,
} from './services/offline';

// Queue transaction
await queueOfflineTransaction('transfer', contractId, 'transfer', params);

// Get pending count
const count = getPendingTransactionCount();

// Trigger sync
await triggerSync();

// Check sync status
const isSyncing = isSyncInProgress();
const status = getSyncStatus();
```

## Initialization

### Setup Offline Functionality

```typescript
import { setupOfflineFunctionality } from './services/offline';

// In App.tsx or main.tsx
useEffect(() => {
  setupOfflineFunctionality({
    enableBackgroundSync: true,
    syncInterval: 30000, // 30 seconds
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    maxRetries: 3,
    debug: true,
  });

  return () => {
    teardownOfflineFunctionality();
  };
}, []);
```

## Best Practices

### 1. **Cache Management**
- Use appropriate TTL values for different data types
- Set priority levels based on importance
- Use tags for organized cache management
- Monitor cache statistics regularly

### 2. **Transaction Queuing**
- Set appropriate priority levels
- Enable deduplication to avoid duplicate submissions
- Monitor queue metrics
- Implement proper error handling

### 3. **Synchronization**
- Configure appropriate retry strategies
- Subscribe to sync events for UI updates
- Handle conflicts properly
- Monitor sync performance

### 4. **Performance**
- Use cache optimization regularly
- Monitor analytics data
- Implement prefetching for critical data
- Clean up old analytics data periodically

### 5. **User Experience**
- Show offline status clearly
- Provide visual feedback for pending transactions
- Allow manual sync triggering
- Display sync progress to users

## Database Schema

The offline system uses IndexedDB with the following object stores:

```
balances
├── key: id
├── indexes:
│   ├── by-address
│   └── by-timestamp

escrows
├── key: id
├── indexes:
│   ├── by-status
│   └── by-address

pendingTransactions
├── key: id
├── indexes:
│   ├── by-status
│   └── by-timestamp

syncedTransactions
├── key: id
├── indexes:
│   └── by-timestamp

preferences
├── key: id

cache
├── key: key
```

## Event System

### Sync Events

```typescript
type SyncEventType = 'start' | 'progress' | 'complete' | 'error' | 'conflict';

interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  message?: string;
  data?: any;
}
```

### Subscribing to Events

```typescript
backgroundSyncService.subscribe((event) => {
  switch (event.type) {
    case 'start':
      console.log('Sync started');
      break;
    case 'progress':
      console.log(`Synced: ${event.message}`);
      break;
    case 'complete':
      console.log('Sync completed');
      break;
    case 'error':
      console.error(`Sync error: ${event.message}`);
      break;
    case 'conflict':
      console.warning(`Conflict: ${event.message}`);
      break;
  }
});
```

## Debugging

### Development Tools

Enable debug mode for detailed logging:

```typescript
setupOfflineFunctionality({ debug: true });
```

### Export Data for Analysis

```typescript
import { exportOfflineData } from './services/offline';

const data = exportOfflineData();
console.log(data);
// {
//   cache: { ... },
//   analytics: { ... },
//   cacheStats: { ... }
// }
```

### Use Debug Component

```typescript
import { OfflineDebugPanel } from './services/offline';

export function App() {
  return (
    <>
      <YourApp />
      <OfflineDebugPanel /> {/* Only shows in development */}
    </>
  );
}
```

## Performance Considerations

1. **Cache Size**: Default 50MB, adjustable via configuration
2. **Sync Interval**: Default 30s, can be adjusted based on needs
3. **Batch Size**: Default 5 transactions per batch
4. **Cleanup**: Automatic cleanup every 5 minutes

## Troubleshooting

### Cache Growing Too Large

```typescript
// Get cache breakdown
const breakdown = getCacheSizeBreakdown();

// Clear by tag
clearCacheByTag('old-data');

// Optimize
await applyCacheOptimization();
```

### Transactions Not Syncing

```typescript
// Check pending count
const count = getPendingTransactionCount();

// Check sync status
const status = getSyncStatus();

// Trigger manual sync
await triggerSync();
```

### High Cache Miss Rate

```typescript
// Get recommendations
const recommendations = getOptimizationRecommendations();

// Enable prefetching
await prefetchCriticalData(criticalKeys);
```

## Conclusion

This offline functionality system provides a complete solution for building robust offline-capable applications. Use the components, hooks, and utilities to seamlessly integrate offline support into your Soroban-based application.

For more information and examples, see the component files and test files in the `src/services/offline/` directory.
