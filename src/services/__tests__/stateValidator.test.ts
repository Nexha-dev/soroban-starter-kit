/**
 * State Validator Tests
 */

import { stateValidator } from '../stateValidator';

describe('StateValidator', () => {
  beforeEach(() => {
    stateValidator.clearHistory();
  });
  describe('State Validation', () => {
    it('should validate correct state', () => {
      const state = {
        balances: { 'b1': { id: 'b1', amount: '100' } },
        escrows: { 'e1': { id: 'e1', status: 'funded' } },
        transactions: { 'tx1': { id: 'tx1', status: 'pending' } },
        metadata: {
          balanceIds: ['b1'],
          escrowIds: ['e1'],
          transactionIds: ['tx1'],
        },
      };

      const result = stateValidator.validate(state as any);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing id fields', () => {
      const state = {
        balances: { 'b1': { amount: '100' } },
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: ['b1'],
          escrowIds: [],
          transactionIds: [],
        },
      };

      const result = stateValidator.validate(state as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_data')).toBe(true);
    });

    it('should detect invalid amounts', () => {
      const state = {
        balances: { 'b1': { id: 'b1', amount: 'invalid' } },
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: ['b1'],
          escrowIds: [],
          transactionIds: [],
        },
      };

      const result = stateValidator.validate(state as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'type_mismatch')).toBe(true);
    });

    it('should detect unknown escrow status', () => {
      const state = {
        balances: {},
        escrows: { 'e1': { id: 'e1', status: 'unknown' } },
        transactions: {},
        metadata: {
          balanceIds: [],
          escrowIds: ['e1'],
          transactionIds: [],
        },
      };

      const result = stateValidator.validate(state as any);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect orphaned metadata', () => {
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

      const result = stateValidator.validate(state as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'orphaned_item')).toBe(true);
    });
  });

  describe('State Repair', () => {
    it('should repair state by removing orphaned references', () => {
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

      const repaired = stateValidator.repair(state as any);
      expect(repaired.metadata.balanceIds).toEqual(['b1']);
      expect(repaired.metadata.escrowIds).toEqual([]);
    });
  });

  describe('Validation History', () => {
    it('should record validation history', () => {
      const state = {
        balances: {},
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: [],
          escrowIds: [],
          transactionIds: [],
        },
      };

      stateValidator.validate(state as any);
      stateValidator.validate(state as any);

      const history = stateValidator.getHistory();
      expect(history.length).toBe(2);
    });

    it('should clear history', () => {
      const state = {
        balances: {},
        escrows: {},
        transactions: {},
        metadata: {
          balanceIds: [],
          escrowIds: [],
          transactionIds: [],
        },
      };

      stateValidator.validate(state as any);
      stateValidator.clearHistory();

      const history = stateValidator.getHistory();
      expect(history.length).toBe(0);
    });
  });
});
