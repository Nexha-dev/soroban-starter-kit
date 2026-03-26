/**
 * Conflict Resolver Tests
 */

import { conflictResolver } from '../conflictResolver';

describe('ConflictResolver', () => {
  beforeEach(() => {
    conflictResolver.clearHistory();
  });
  describe('Conflict Detection', () => {
    it('should detect conflicts', () => {
      const local = { id: '1', value: 'local' };
      const server = { id: '1', value: 'server' };

      const hasConflict = conflictResolver.detectConflict(local, server);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflicts when states match', () => {
      const local = { id: '1', value: 'same' };
      const server = { id: '1', value: 'same' };

      const hasConflict = conflictResolver.detectConflict(local, server);
      expect(hasConflict).toBe(false);
    });

    it('should detect conflicts with different keys', () => {
      const local = { id: '1', value: 'a' };
      const server = { id: '1', value: 'a', extra: 'field' };

      const hasConflict = conflictResolver.detectConflict(local, server);
      expect(hasConflict).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve with local strategy', () => {
      const local = { id: '1', value: 'local' };
      const server = { id: '1', value: 'server' };

      const resolution = conflictResolver.resolve('test', local, server, 'local');
      expect(resolution.resolvedState).toEqual(local);
      expect(resolution.strategy).toBe('local');
    });

    it('should resolve with server strategy', () => {
      const local = { id: '1', value: 'local' };
      const server = { id: '1', value: 'server' };

      const resolution = conflictResolver.resolve('test', local, server, 'server');
      expect(resolution.resolvedState).toEqual(server);
      expect(resolution.strategy).toBe('server');
    });

    it('should merge states', () => {
      const local = { id: '1', value: 'local', extra: 'local-only' };
      const server = { id: '1', value: 'server', other: 'server-only' };

      const resolution = conflictResolver.resolve('test', local, server, 'merged');
      expect(resolution.resolvedState.id).toBe('1');
      expect(resolution.resolvedState.value).toBe('server');
      expect(resolution.resolvedState.extra).toBe('local-only');
      expect(resolution.resolvedState.other).toBe('server-only');
    });

    it('should record resolution history', () => {
      const local = { id: '1', value: 'local' };
      const server = { id: '1', value: 'server' };

      conflictResolver.resolve('test1', local, server, 'local');
      conflictResolver.resolve('test2', local, server, 'server');

      const history = conflictResolver.getResolutionHistory();
      expect(history.size).toBe(2);
      expect(history.has('test1')).toBe(true);
      expect(history.has('test2')).toBe(true);
    });
  });

  describe('State Validation', () => {
    it('should validate consistent state', () => {
      const state = {
        balances: { 'b1': { id: 'b1' } },
        escrows: { 'e1': { id: 'e1' } },
        transactions: { 'tx1': { id: 'tx1' } },
        metadata: {
          balanceIds: ['b1'],
          escrowIds: ['e1'],
          transactionIds: ['tx1'],
        },
      };

      const result = conflictResolver.validateState(state as any);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing metadata', () => {
      const state = {
        balances: { 'b1': { id: 'b1' } },
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: [],
          escrowIds: [],
          transactionIds: [],
        },
      };

      const result = conflictResolver.validateState(state as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect orphaned references', () => {
      const state = {
        balances: {},
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: ['b1'],
          escrowIds: [],
          transactionIds: [],
        },
      };

      const result = conflictResolver.validateState(state as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'orphaned_item')).toBe(true);
    });
  });

  describe('State Recovery', () => {
    it('should recover state by removing orphaned references', () => {
      const state = {
        balances: { 'b1': { id: 'b1' } },
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: ['b1', 'b2'],
          escrowIds: ['e1'],
          transactionIds: [],
        },
      };

      const recovered = conflictResolver.recoverState(state as any);
      expect(recovered.metadata.balanceIds).toEqual(['b1']);
      expect(recovered.metadata.escrowIds).toEqual([]);
    });
  });
});
