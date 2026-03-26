# State Management Optimization Guide

## Overview

This implementation provides a comprehensive state management optimization system with:

- **State Normalization**: Flat, normalized state structure for efficient updates
- **Selective Updates**: Only affected components re-render
- **Memory Optimization**: Automatic cache management and cleanup
- **Offline Support**: State persistence and cross-tab synchronization
- **Developer Tools**: Built-in debugging and performance monitoring

## Architecture

### Core Components

#### 1. StateManager (`stateManager.ts`)
Handles normalized state and efficient updates.

```typescript
// Normalized state structure
{
  balances: { [id]: Balance },
  escrows: { [id]: Escrow },
  transactions: { [id]: Transaction },
  metadata: {
    balanceIds: string[],
    escrowIds: string[],
    transactionIds: string[]
  }
}
```

**Key Features:**
- Selector memoization with cache
- Batch updates for multiple slices
- Performance metrics tracking
- Listener subscription pattern

#### 2. PersistenceManager (`persistenceManager.ts`)
Manages state persistence and cross-tab synchronization.

**Features:**
- Throttled persistence to IndexedDB
- Cross-tab state synchronization via localStorage
- Configurable TTL and blacklist
- Automatic hydration on app start

#### 3. DevTools (`devTools.ts`)
Provides debugging and performance monitoring.

**Features:**
- State snapshot history
- Performance metrics logging
- Global dev tools API
- Export/import state for testing

#### 4. OptimizedStateContext (`OptimizedStateContext.tsx`)
React context provider integrating all services.

## Usage

### Setup

```typescript
import { OptimizedStateProvider } from './context/OptimizedStateContext';

function App() {
  return (
    <OptimizedStateProvider persistenceEnabled={true} devToolsEnabled={true}>
      <YourApp />
    </OptimizedStateProvider>
  );
}
```

### Using State

#### Direct Updates
```typescript
import { useOptimizedState } from './context/OptimizedStateContext';

function MyComponent() {
  const { updateBalances, updateTransactions } = useOptimizedState();

  // Update single slice
  updateBalances({
    'balance-1': { id: 'balance-1', amount: '100' }
  });

  // Update multiple slices
  batchUpdate({
    balances: { 'balance-1': { ... } },
    transactions: { 'tx-1': { ... } }
  });
}
```

#### Optimized Selectors
```typescript
import { useStateSelector, useBalances, useTransaction } from './hooks/useStateOptimization';

function MyComponent() {
  // Get all balances
  const balances = useBalances();

  // Get specific transaction
  const tx = useTransaction('tx-1');

  // Custom selector with memoization
  const totalBalance = useStateSelector(state => 
    Object.values(state.balances).reduce((sum, b) => sum + parseFloat(b.amount), 0)
  );
}
```

#### Performance Monitoring
```typescript
import { usePerformanceMonitor } from './hooks/useStateOptimization';

function MyComponent() {
  const monitor = usePerformanceMonitor('my-operation');

  const handleClick = () => {
    monitor(() => {
      // Your operation here
      expensiveOperation();
    });
  };
}
```

### Developer Tools

Access dev tools in browser console:

```javascript
// Get state history
window.__SOROBAN_DEVTOOLS__.getHistory()

// Get performance summary
window.__SOROBAN_DEVTOOLS__.getPerformanceSummary()

// Export state
const json = window.__SOROBAN_DEVTOOLS__.exportState(state)

// Import state for testing
window.__SOROBAN_DEVTOOLS__.importState(json)

// Clear history
window.__SOROBAN_DEVTOOLS__.clearHistory()
```

### State Debugger Component

```typescript
import { StateDebugger } from './components/StateDebugger';

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === 'development' && <StateDebugger />}
    </>
  );
}
```

## Performance Optimization Techniques

### 1. Selector Memoization
Selectors are automatically memoized to prevent unnecessary re-renders:

```typescript
// This selector is cached and only recomputed when state changes
const balances = useStateSelector(state => Object.values(state.balances));
```

### 2. Batch Updates
Update multiple state slices in a single operation:

```typescript
batchUpdate({
  balances: { ... },
  escrows: { ... },
  transactions: { ... }
});
```

### 3. Normalized State
Flat structure prevents deep nesting and improves lookup performance:

```typescript
// ❌ Avoid nested structures
{ users: { user1: { balances: { balance1: {} } } } }

// ✅ Use normalized structure
{ balances: { balance1: {} }, users: { user1: {} } }
```

### 4. Selective Updates
Only update affected items:

```typescript
// Update only changed balances
updateBalances({
  'balance-1': newBalance1,
  'balance-2': newBalance2
});
```

## Offline State Management

### Persistence
State is automatically persisted to IndexedDB with configurable TTL:

```typescript
// Persisted with 24-hour TTL
await persistenceManager.persist(state);

// Hydrate on app start
const persisted = await persistenceManager.hydrate();
```

### Cross-Tab Synchronization
State syncs across browser tabs automatically:

```typescript
// Setup in provider
persistenceManager.setupCrossTabSync((newState) => {
  stateManager.batchUpdate(newState);
});

// Broadcast to other tabs
persistenceManager.broadcastState(state);
```

## Metrics and Monitoring

### Available Metrics
```typescript
interface StateMetrics {
  updateCount: number;           // Total updates
  lastUpdateTime: number;        // Last update duration (ms)
  averageUpdateTime: number;     // Average update duration (ms)
  memoryUsage: number;           // Heap memory used (bytes)
  cacheHits: number;             // Selector cache hits
  cacheMisses: number;           // Selector cache misses
}
```

### Access Metrics
```typescript
const { metrics } = useOptimizedState();
console.log(`Cache hit rate: ${(metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2)}%`);
```

## Best Practices

### 1. Use Selectors for Derived Data
```typescript
// ✅ Good: Memoized selector
const activeTransactions = useStateSelector(state =>
  Object.values(state.transactions).filter(tx => tx.status === 'pending')
);

// ❌ Avoid: Computed in component
const activeTransactions = Object.values(state.transactions).filter(tx => tx.status === 'pending');
```

### 2. Batch Related Updates
```typescript
// ✅ Good: Single batch update
batchUpdate({
  balances: { 'b1': newBalance },
  transactions: { 'tx1': newTx }
});

// ❌ Avoid: Multiple separate updates
updateBalances({ 'b1': newBalance });
updateTransactions({ 'tx1': newTx });
```

### 3. Normalize Data
```typescript
// ✅ Good: Normalized
{ balances: { id1: {...}, id2: {...} } }

// ❌ Avoid: Nested
{ balances: [{ id: id1, ... }, { id: id2, ... }] }
```

### 4. Monitor Performance
```typescript
// Use performance monitoring in development
const monitor = usePerformanceMonitor('expensive-operation');
monitor(() => {
  // Your code
});
```

## Configuration

### OptimizedStateProvider Props
```typescript
interface OptimizedStateProviderProps {
  children: ReactNode;
  persistenceEnabled?: boolean;      // Default: true
  devToolsEnabled?: boolean;         // Default: process.env.NODE_ENV === 'development'
}
```

### PersistenceManager Config
```typescript
interface PersistenceConfig {
  key: string;                       // Storage key prefix
  version: number;                   // Schema version
  throttle: number;                  // Persist throttle (ms)
  blacklist: string[];               // Keys to exclude from persistence
}
```

### DevTools Config
```typescript
interface DevToolsConfig {
  enabled: boolean;                  // Enable dev tools
  logStateChanges: boolean;          // Log state changes to console
  logPerformance: boolean;           // Log performance metrics
  maxHistorySize: number;            // Max snapshots to keep
}
```

## Troubleshooting

### State Not Persisting
- Check if `persistenceEnabled={true}` in provider
- Verify IndexedDB is available in browser
- Check browser storage quota

### High Memory Usage
- Review selector complexity
- Clear history: `devTools.clearHistory()`
- Reduce `maxHistorySize` in dev tools config

### Slow Updates
- Check average update time in metrics
- Use batch updates instead of individual updates
- Profile with performance monitoring

## Integration with Existing Code

The optimization system works alongside existing contexts:

```typescript
function App() {
  return (
    <OptimizedStateProvider>
      <ConnectivityProvider>
        <StorageProvider>
          <TransactionQueueProvider>
            <YourApp />
          </TransactionQueueProvider>
        </StorageProvider>
      </ConnectivityProvider>
    </OptimizedStateProvider>
  );
}
```

## Future Enhancements

- Time-travel debugging
- State diff visualization
- Automatic performance optimization suggestions
- Redux DevTools integration
- State validation and schema enforcement
