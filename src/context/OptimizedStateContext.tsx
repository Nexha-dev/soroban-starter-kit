import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { stateManager, NormalizedState, StateMetrics } from '../services/stateManager';
import { persistenceManager } from '../services/persistenceManager';
import { devTools } from '../services/devTools';
import { stateSynchronizer, SyncEvent } from '../services/stateSynchronizer';
import { conflictResolver, ConflictResolutionStrategy } from '../services/conflictResolver';
import { stateValidator, ValidationResult } from '../services/stateValidator';
import { performanceMonitor } from '../services/performanceMonitor';

interface OptimizedStateContextType {
  state: NormalizedState;
  metrics: StateMetrics;
  updateBalances: (updates: Record<string, any>) => void;
  updateEscrows: (updates: Record<string, any>) => void;
  updateTransactions: (updates: Record<string, any>) => void;
  batchUpdate: (updates: Partial<NormalizedState>) => void;
  removeItem: (type: 'balances' | 'escrows' | 'transactions', id: string) => void;
  clearState: () => void;
  useSelector: <T,>(selector: (state: NormalizedState) => T) => T;
  validateState: () => ValidationResult;
  resolveConflict: (localState: any, serverState: any, strategy?: ConflictResolutionStrategy) => any;
  getSyncEvents: () => SyncEvent[];
}

const OptimizedStateContext = createContext<OptimizedStateContextType | undefined>(undefined);

interface OptimizedStateProviderProps {
  children: ReactNode;
  persistenceEnabled?: boolean;
  devToolsEnabled?: boolean;
}

export function OptimizedStateProvider({
  children,
  persistenceEnabled = true,
  devToolsEnabled = import.meta.env.DEV,
}: OptimizedStateProviderProps): JSX.Element {
  const [state, setState] = useState<NormalizedState>(stateManager.getState());
  const [metrics, setMetrics] = useState<StateMetrics>(stateManager.getMetrics());

  // Initialize
  useEffect(() => {
    const init = async () => {
      performanceMonitor.mark('init');

      if (persistenceEnabled) {
        await persistenceManager.init();
        const persisted = await persistenceManager.hydrate();
        if (persisted) {
          const validation = stateValidator.validate(persisted);
          const toUpdate = validation.valid ? persisted : stateValidator.repair(persisted);
          stateManager.batchUpdate(toUpdate);
          setState(stateManager.getState());
        }
      }

      if (devToolsEnabled) {
        devTools.init({ enabled: true });
      }

      performanceMonitor.measure('init');
    };

    init();
  }, [persistenceEnabled, devToolsEnabled]);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateManager.subscribe((newState) => {
      setState(newState);
      setMetrics(stateManager.getMetrics());

      if (devToolsEnabled) {
        devTools.recordSnapshot(newState, stateManager.getMetrics());
      }

      if (persistenceEnabled) {
        persistenceManager.persist(newState);
      }

      // Emit sync event
      stateSynchronizer.emit({
        type: 'update',
        timestamp: Date.now(),
        source: 'state-manager',
        data: newState,
      });
    });

    return unsubscribe;
  }, [persistenceEnabled, devToolsEnabled]);

  // Setup cross-tab sync
  useEffect(() => {
    if (!persistenceEnabled) return;

    const unsubscribe = persistenceManager.setupCrossTabSync((newState) => {
      stateManager.batchUpdate(newState);
      setState(newState);
    });

    return unsubscribe;
  }, [persistenceEnabled]);

  // Setup sync event listener
  useEffect(() => {
    const unsubscribe = stateSynchronizer.subscribe((event) => {
      if (event.type === 'conflict' && event.data) {
        const resolved = conflictResolver.resolve(
          `conflict-${event.timestamp}`,
          event.data.local,
          event.data.server,
          'merged'
        );
        stateManager.batchUpdate(resolved.resolvedState);
      }
    });

    return unsubscribe;
  }, []);

  const updateBalances = useCallback((updates: Record<string, any>) => {
    stateManager.updateBalances(updates);
  }, []);

  const updateEscrows = useCallback((updates: Record<string, any>) => {
    stateManager.updateEscrows(updates);
  }, []);

  const updateTransactions = useCallback((updates: Record<string, any>) => {
    stateManager.updateTransactions(updates);
  }, []);

  const batchUpdate = useCallback((updates: Partial<NormalizedState>) => {
    stateManager.batchUpdate(updates);
  }, []);

  const removeItem = useCallback((type: 'balances' | 'escrows' | 'transactions', id: string) => {
    stateManager.removeItem(type, id);
  }, []);

  const clearState = useCallback(() => {
    stateManager.clear();
  }, []);

  const useSelector = useCallback(<T,>(selector: (state: NormalizedState) => T): T => {
    return stateManager.useSelector(selector);
  }, []);

  const validateState = useCallback((): ValidationResult => {
    return stateValidator.validate(state);
  }, [state]);

  const resolveConflict = useCallback(
    (localState: any, serverState: any, strategy: ConflictResolutionStrategy = 'merged'): any => {
      const resolution = conflictResolver.resolve(
        `conflict-${Date.now()}`,
        localState,
        serverState,
        strategy
      );
      return resolution.resolvedState;
    },
    []
  );

  const getSyncEvents = useCallback((): SyncEvent[] => {
    return stateSynchronizer.getEventHistory();
  }, []);

  return (
    <OptimizedStateContext.Provider
      value={{
        state,
        metrics,
        updateBalances,
        updateEscrows,
        updateTransactions,
        batchUpdate,
        removeItem,
        clearState,
        useSelector,
        validateState,
        resolveConflict,
        getSyncEvents,
      }}
    >
      {children}
    </OptimizedStateContext.Provider>
  );
}

export function useOptimizedState(): OptimizedStateContextType {
  const context = useContext(OptimizedStateContext);
  if (!context) {
    throw new Error('useOptimizedState must be used within OptimizedStateProvider');
  }
  return context;
}

export default OptimizedStateContext;
