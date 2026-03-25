/**
 * Optimized State Manager
 * Handles normalized state, selective updates, and performance monitoring
 */

export interface StateMetrics {
  updateCount: number;
  lastUpdateTime: number;
  averageUpdateTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface NormalizedState {
  balances: Record<string, any>;
  escrows: Record<string, any>;
  transactions: Record<string, any>;
  metadata: {
    balanceIds: string[];
    escrowIds: string[];
    transactionIds: string[];
  };
}

type StateListener = (state: NormalizedState) => void;
type StateSelector<T> = (state: NormalizedState) => T;

class StateManager {
  private state: NormalizedState = {
    balances: {},
    escrows: {},
    transactions: {},
    metadata: {
      balanceIds: [],
      escrowIds: [],
      transactionIds: [],
    },
  };

  private listeners: Set<StateListener> = new Set();
  private selectorCache: Map<StateSelector<any>, any> = new Map();
  private metrics: StateMetrics = {
    updateCount: 0,
    lastUpdateTime: 0,
    averageUpdateTime: 0,
    memoryUsage: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  private updateTimes: number[] = [];
  private maxMetricsHistory = 100;

  /**
   * Get current state
   */
  getState(): NormalizedState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Select and memoize state slice
   */
  useSelector<T>(selector: StateSelector<T>): T {
    if (this.selectorCache.has(selector)) {
      this.metrics.cacheHits++;
      return this.selectorCache.get(selector);
    }

    this.metrics.cacheMisses++;
    const result = selector(this.state);
    this.selectorCache.set(selector, result);
    return result;
  }

  /**
   * Update balances (normalized)
   */
  updateBalances(updates: Record<string, any>): void {
    const startTime = performance.now();

    const newIds = Object.keys(updates).filter(id => !this.state.metadata.balanceIds.includes(id));
    
    this.state.balances = { ...this.state.balances, ...updates };
    this.state.metadata.balanceIds = [...new Set([...this.state.metadata.balanceIds, ...newIds])];

    this.invalidateCache();
    this.recordUpdate(startTime);
  }

  /**
   * Update escrows (normalized)
   */
  updateEscrows(updates: Record<string, any>): void {
    const startTime = performance.now();

    const newIds = Object.keys(updates).filter(id => !this.state.metadata.escrowIds.includes(id));
    
    this.state.escrows = { ...this.state.escrows, ...updates };
    this.state.metadata.escrowIds = [...new Set([...this.state.metadata.escrowIds, ...newIds])];

    this.invalidateCache();
    this.recordUpdate(startTime);
  }

  /**
   * Update transactions (normalized)
   */
  updateTransactions(updates: Record<string, any>): void {
    const startTime = performance.now();

    const newIds = Object.keys(updates).filter(id => !this.state.metadata.transactionIds.includes(id));
    
    this.state.transactions = { ...this.state.transactions, ...updates };
    this.state.metadata.transactionIds = [...new Set([...this.state.metadata.transactionIds, ...newIds])];

    this.invalidateCache();
    this.recordUpdate(startTime);
  }

  /**
   * Batch update multiple state slices
   */
  batchUpdate(updates: Partial<NormalizedState>): void {
    const startTime = performance.now();

    if (updates.balances) {
      const newIds = Object.keys(updates.balances).filter(id => !this.state.metadata.balanceIds.includes(id));
      this.state.balances = { ...this.state.balances, ...updates.balances };
      this.state.metadata.balanceIds = [...new Set([...this.state.metadata.balanceIds, ...newIds])];
    }

    if (updates.escrows) {
      const newIds = Object.keys(updates.escrows).filter(id => !this.state.metadata.escrowIds.includes(id));
      this.state.escrows = { ...this.state.escrows, ...updates.escrows };
      this.state.metadata.escrowIds = [...new Set([...this.state.metadata.escrowIds, ...newIds])];
    }

    if (updates.transactions) {
      const newIds = Object.keys(updates.transactions).filter(id => !this.state.metadata.transactionIds.includes(id));
      this.state.transactions = { ...this.state.transactions, ...updates.transactions };
      this.state.metadata.transactionIds = [...new Set([...this.state.metadata.transactionIds, ...newIds])];
    }

    this.invalidateCache();
    this.recordUpdate(startTime);
    this.notifyListeners();
  }

  /**
   * Remove item from state
   */
  removeItem(type: 'balances' | 'escrows' | 'transactions', id: string): void {
    const startTime = performance.now();

    delete this.state[type][id];
    const metaKey = `${type}Ids` as keyof typeof this.state.metadata;
    this.state.metadata[metaKey] = this.state.metadata[metaKey].filter(itemId => itemId !== id);

    this.invalidateCache();
    this.recordUpdate(startTime);
    this.notifyListeners();
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.state = {
      balances: {},
      escrows: {},
      transactions: {},
      metadata: {
        balanceIds: [],
        escrowIds: [],
        transactionIds: [],
      },
    };
    this.invalidateCache();
    this.notifyListeners();
  }

  /**
   * Get metrics
   */
  getMetrics(): StateMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      updateCount: 0,
      lastUpdateTime: 0,
      averageUpdateTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.updateTimes = [];
  }

  private recordUpdate(startTime: number): void {
    const duration = performance.now() - startTime;
    this.metrics.updateCount++;
    this.metrics.lastUpdateTime = duration;
    this.updateTimes.push(duration);

    if (this.updateTimes.length > this.maxMetricsHistory) {
      this.updateTimes.shift();
    }

    this.metrics.averageUpdateTime = this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }

  private invalidateCache(): void {
    this.selectorCache.clear();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }
}

export const stateManager = new StateManager();
export default stateManager;
