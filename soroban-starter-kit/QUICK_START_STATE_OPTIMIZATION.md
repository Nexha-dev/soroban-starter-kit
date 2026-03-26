# Quick Start: State Management Optimization

## 5-Minute Setup

### 1. Wrap Your App

In `src/main.tsx`:

```typescript
import { OptimizedStateProvider } from './context/OptimizedStateContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptimizedStateProvider persistenceEnabled={true} devToolsEnabled={true}>
      <App />
    </OptimizedStateProvider>
  </React.StrictMode>,
);
```

### 2. Use Optimized Hooks

Replace direct state access:

```typescript
// Before
const { balances } = useStorage();

// After
import { useBalances } from './hooks/useStateOptimization';
const balances = useBalances();
```

### 3. Add Debugger (Optional)

In `src/App.tsx`:

```typescript
import { StateDebugger } from './components/StateDebugger';

function App() {
  return (
    <>
      <YourContent />
      {process.env.NODE_ENV === 'development' && <StateDebugger />}
    </>
  );
}
```

## Common Tasks

### Update State

```typescript
import { useOptimizedState } from './context/OptimizedStateContext';

function MyComponent() {
  const { updateBalances, batchUpdate } = useOptimizedState();

  // Single update
  updateBalances({ 'b1': { id: 'b1', amount: '100' } });

  // Batch update
  batchUpdate({
    balances: { 'b1': { ... } },
    transactions: { 'tx1': { ... } }
  });
}
```

### Select State

```typescript
import { useStateSelector, useBalances } from './hooks/useStateOptimization';

function MyComponent() {
  // Predefined selectors
  const balances = useBalances();

  // Custom selector
  const total = useStateSelector(state =>
    Object.values(state.balances).reduce((sum, b) => sum + parseFloat(b.amount), 0)
  );
}
```

### Monitor Performance

```typescript
import { usePerformanceMonitor } from './hooks/useStateOptimization';

function MyComponent() {
  const monitor = usePerformanceMonitor('my-operation');

  const handleClick = () => {
    monitor(() => {
      // Your code here
    });
  };
}
```

### Access Dev Tools

In browser console:

```javascript
// View state history
window.__SOROBAN_DEVTOOLS__.getHistory()

// View performance summary
window.__SOROBAN_DEVTOOLS__.getPerformanceSummary()

// Export state
const json = window.__SOROBAN_DEVTOOLS__.exportState(state)

// Clear history
window.__SOROBAN_DEVTOOLS__.clearHistory()
```

## Key Features

| Feature | Benefit |
|---------|---------|
| **Normalized State** | Faster lookups, easier updates |
| **Selector Memoization** | Prevents unnecessary re-renders |
| **Batch Updates** | Single re-render for multiple changes |
| **Persistence** | State survives page refresh |
| **Cross-Tab Sync** | State syncs across browser tabs |
| **Offline Support** | Works without internet connection |
| **Dev Tools** | Built-in debugging and monitoring |
| **Performance Metrics** | Real-time performance tracking |

## Files Created

```
src/
├── services/
│   ├── stateManager.ts              # Core state management
│   ├── persistenceManager.ts        # Persistence & sync
│   ├── devTools.ts                  # Developer tools
│   └── __tests__/
│       └── stateManager.test.ts     # Unit tests
├── context/
│   └── OptimizedStateContext.tsx    # React provider
├── hooks/
│   └── useStateOptimization.ts      # Optimized hooks
├── components/
│   └── StateDebugger.tsx            # Debugger UI
└── examples/
    └── StateOptimizationExamples.tsx # Usage examples

Documentation/
├── STATE_OPTIMIZATION.md            # Comprehensive guide
├── IMPLEMENTATION_GUIDE.md          # Detailed guide
└── QUICK_START_STATE_OPTIMIZATION.md # This file
```

## Troubleshooting

**State not persisting?**
- Check `persistenceEnabled={true}`
- Verify IndexedDB is available
- Check browser storage quota

**High memory usage?**
- Clear history: `devTools.clearHistory()`
- Reduce `maxHistorySize` in config
- Check selector complexity

**Slow updates?**
- Use batch updates instead of individual updates
- Check average update time in metrics
- Profile with performance monitoring

## Next Steps

1. ✅ Wrap app with OptimizedStateProvider
2. ✅ Replace state access with optimized hooks
3. ✅ Add StateDebugger component
4. ✅ Monitor performance metrics
5. ✅ Test offline functionality
6. ✅ Verify cross-tab sync

## Resources

- **Full Guide**: `STATE_OPTIMIZATION.md`
- **Implementation**: `IMPLEMENTATION_GUIDE.md`
- **Examples**: `src/examples/StateOptimizationExamples.tsx`
- **Tests**: `src/services/__tests__/stateManager.test.ts`

## Support

For detailed information, see:
- `STATE_OPTIMIZATION.md` - Architecture and concepts
- `IMPLEMENTATION_GUIDE.md` - Step-by-step integration
- `src/examples/StateOptimizationExamples.tsx` - Code examples
