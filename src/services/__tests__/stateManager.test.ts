/**
 * State Manager Tests
 */

import { stateManager, NormalizedState } from '../stateManager';

describe('StateManager', () => {
  const unsubs: Array<() => void> = [];

  beforeEach(() => {
    stateManager.clear();
    stateManager.resetMetrics();
    unsubs.forEach(u => u());
    unsubs.length = 0;
  });

  describe('State Updates', () => {
    it('should update balances', () => {
      stateManager.updateBalances({ 'b1': { id: 'b1', amount: '100', tokenSymbol: 'USDC' } });
      const state = stateManager.getState();
      expect(state.balances['b1']).toBeDefined();
      expect(state.metadata.balanceIds).toContain('b1');
    });

    it('should update escrows', () => {
      stateManager.updateEscrows({ 'e1': { id: 'e1', status: 'funded', amount: '50' } });
      const state = stateManager.getState();
      expect(state.escrows['e1']).toBeDefined();
      expect(state.metadata.escrowIds).toContain('e1');
    });

    it('should update transactions', () => {
      stateManager.updateTransactions({ 'tx1': { id: 'tx1', status: 'pending', type: 'transfer' } });
      const state = stateManager.getState();
      expect(state.transactions['tx1']).toBeDefined();
      expect(state.metadata.transactionIds).toContain('tx1');
    });

    it('should batch update multiple slices', () => {
      stateManager.batchUpdate({
        balances: { 'b1': { id: 'b1', amount: '100' } },
        escrows: { 'e1': { id: 'e1', status: 'funded' } },
        transactions: { 'tx1': { id: 'tx1', status: 'pending' } },
      });
      const state = stateManager.getState();
      expect(Object.keys(state.balances)).toContain('b1');
      expect(Object.keys(state.escrows)).toContain('e1');
      expect(Object.keys(state.transactions)).toContain('tx1');
    });
  });

  describe('Selectors and Memoization', () => {
    it('should memoize selector results', () => {
      const selector = (state: NormalizedState) => Object.keys(state.balances).length;
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      const result1 = stateManager.useSelector(selector);
      const result2 = stateManager.useSelector(selector);
      expect(result1).toBe(result2);
      expect(stateManager.getMetrics().cacheHits).toBeGreaterThan(0);
    });

    it('should invalidate cache on updates', () => {
      const selector = (state: NormalizedState) => Object.keys(state.balances).length;
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      stateManager.useSelector(selector);
      stateManager.updateBalances({ 'b2': { id: 'b2' } });
      expect(stateManager.useSelector(selector)).toBe(2);
    });
  });

  describe('Metrics', () => {
    it('should track update count', () => {
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      stateManager.updateBalances({ 'b2': { id: 'b2' } });
      expect(stateManager.getMetrics().updateCount).toBe(2);
    });

    it('should track update times', () => {
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      const metrics = stateManager.getMetrics();
      expect(metrics.lastUpdateTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageUpdateTime).toBeGreaterThanOrEqual(0);
    });

    it('should track cache hits and misses', () => {
      const selector = (state: NormalizedState) => state.balances;
      stateManager.useSelector(selector);
      stateManager.useSelector(selector);
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      stateManager.useSelector(selector);
      const metrics = stateManager.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.cacheMisses).toBeGreaterThan(0);
    });
  });

  describe('Subscriptions', () => {
    it('should notify listeners on state change', () => {
      let notified = false;
      const unsub = stateManager.subscribe(() => { notified = true; });
      unsubs.push(unsub);
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      expect(notified).toBe(true);
    });

    it('should unsubscribe listeners', () => {
      let callCount = 0;
      const unsubscribe = stateManager.subscribe(() => callCount++);
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      expect(callCount).toBe(1);
      unsubscribe();
      stateManager.updateBalances({ 'b2': { id: 'b2' } });
      expect(callCount).toBe(1);
    });
  });

  describe('Item Removal', () => {
    it('should remove balance', () => {
      stateManager.updateBalances({ 'b1': { id: 'b1' } });
      stateManager.removeItem('balances', 'b1');
      const state = stateManager.getState();
      expect(state.balances['b1']).toBeUndefined();
      expect(state.metadata.balanceIds).not.toContain('b1');
    });

    it('should remove escrow', () => {
      stateManager.updateEscrows({ 'e1': { id: 'e1' } });
      stateManager.removeItem('escrows', 'e1');
      const state = stateManager.getState();
      expect(state.escrows['e1']).toBeUndefined();
      expect(state.metadata.escrowIds).not.toContain('e1');
    });
  });

  describe('Clear', () => {
    it('should clear all state', () => {
      stateManager.batchUpdate({
        balances: { 'b1': { id: 'b1' } },
        escrows: { 'e1': { id: 'e1' } },
        transactions: { 'tx1': { id: 'tx1' } },
      });
      stateManager.clear();
      const state = stateManager.getState();
      expect(Object.keys(state.balances)).toHaveLength(0);
      expect(Object.keys(state.escrows)).toHaveLength(0);
      expect(Object.keys(state.transactions)).toHaveLength(0);
    });
  });
});
