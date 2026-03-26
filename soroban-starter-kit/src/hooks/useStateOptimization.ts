import { useOptimizedState } from '../context/OptimizedStateContext';
import { NormalizedState } from '../services/stateManager';
import { devTools } from '../services/devTools';
import { performanceMonitor } from '../services/performanceMonitor';
import { stateSynchronizer } from '../services/stateSynchronizer';
import { useEffect, useState } from 'react';

/**
 * Hook for optimized state selection with memoization
 */
export function useStateSelector<T>(selector: (state: NormalizedState) => T): T {
  const { useSelector } = useOptimizedState();
  return useSelector(selector);
}

/**
 * Hook for getting all balances
 */
export function useBalances() {
  return useStateSelector(state => Object.values(state.balances));
}

/**
 * Hook for getting specific balance
 */
export function useBalance(id: string) {
  return useStateSelector(state => state.balances[id]);
}

/**
 * Hook for getting all escrows
 */
export function useEscrows() {
  return useStateSelector(state => Object.values(state.escrows));
}

/**
 * Hook for getting specific escrow
 */
export function useEscrow(id: string) {
  return useStateSelector(state => state.escrows[id]);
}

/**
 * Hook for getting all transactions
 */
export function useTransactions() {
  return useStateSelector(state => Object.values(state.transactions));
}

/**
 * Hook for getting specific transaction
 */
export function useTransaction(id: string) {
  return useStateSelector(state => state.transactions[id]);
}

/**
 * Hook for getting state metrics
 */
export function useStateMetrics() {
  const { metrics } = useOptimizedState();
  return metrics;
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor(label: string) {
  return (fn: () => void) => {
    performanceMonitor.mark(label);
    fn();
    const duration = performanceMonitor.measure(label);
    devTools.logPerformance(label, duration);
  };
}

/**
 * Hook for batch updates
 */
export function useBatchUpdate() {
  const { batchUpdate } = useOptimizedState();
  return batchUpdate;
}

/**
 * Hook for state validation
 */
export function useStateValidation() {
  const { validateState } = useOptimizedState();
  const [validationResult, setValidationResult] = useState<any>(null);

  useEffect(() => {
    const result = validateState();
    setValidationResult(result);
  }, [validateState]);

  return validationResult;
}

/**
 * Hook for conflict resolution
 */
export function useConflictResolution() {
  const { resolveConflict } = useOptimizedState();
  return resolveConflict;
}

/**
 * Hook for sync events
 */
export function useSyncEvents() {
  const { getSyncEvents } = useOptimizedState();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = stateSynchronizer.subscribe(() => {
      setEvents(getSyncEvents());
    });

    return unsubscribe;
  }, [getSyncEvents]);

  return events;
}

/**
 * Hook for performance metrics
 */
export function usePerformanceMetrics() {
  const [summaries, setSummaries] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSummaries(performanceMonitor.getAllSummaries());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return summaries;
}
