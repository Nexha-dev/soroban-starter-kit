// Feature: token-management-dashboard, Property 10: Stellar address validator accepts exactly the correct format
// Feature: token-management-dashboard, Property 11: Insufficient-balance check rejects amount + fee > available balance
// Feature: token-management-dashboard, Property 12: Staking amount validator rejects out-of-range amounts
// Feature: token-management-dashboard, Property 1: Portfolio fiat total is the sum of individual token fiat values
// Feature: token-management-dashboard, Property 13: P&L per token equals (current − previous) × fiatRate
// Feature: token-management-dashboard, Property 14: Diversification score is in [0, 100] and reflects HHI
// Feature: token-management-dashboard, Property 15: Analytics time-range filter excludes out-of-range transactions

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidStellarAddress,
  validateTransferAmount,
  validateStakingAmount,
  ESTIMATED_FEE_STROOPS,
} from '../../utils/tokenValidation';
import {
  computeTotalFiat,
  computePnL,
  computeDiversificationScore,
  filterByTimeRange,
  toFloat,
  TimeRange,
} from '../../utils/analyticsCompute';
import { Balance, CachedTransaction } from '../../services/storage/types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a valid Stellar address: G + 55 base-32 chars [A-Z2-7] */
const validStellarAddress = fc.stringMatching(/^[A-Z2-7]{55}$/).map(suffix => `G${suffix}`);

/** Generates a Balance record with optional fiatRates and previousAmount */
const balanceArb = (currency: string = 'USD'): fc.Arbitrary<Balance> =>
  fc.record({
    id: fc.uuid(),
    address: fc.string({ minLength: 10, maxLength: 20 }),
    contractId: fc.string({ minLength: 10, maxLength: 20 }),
    tokenSymbol: fc.string({ minLength: 1, maxLength: 6 }),
    amount: fc.bigInt({ min: 0n, max: 1_000_000_000_000_000n }).map(n => n.toString()),
    lastUpdated: fc.integer({ min: 0 }),
    previousAmount: fc.option(
      fc.bigInt({ min: 0n, max: 1_000_000_000_000_000n }).map(n => n.toString()),
      { nil: undefined }
    ),
    fiatRates: fc.option(
      fc.float({ min: 0, max: 1000, noNaN: true }).map(rate => ({ [currency]: rate })),
      { nil: undefined }
    ),
  }) as fc.Arbitrary<Balance>;

/** Generates a CachedTransaction with a createdAt timestamp */
const txArb = (): fc.Arbitrary<CachedTransaction> =>
  fc.record({
    id: fc.uuid(),
    type: fc.constantFrom('transfer', 'mint', 'burn', 'approve') as fc.Arbitrary<CachedTransaction['type']>,
    contractId: fc.string({ minLength: 10, maxLength: 20 }),
    method: fc.string({ minLength: 1, maxLength: 20 }),
    params: fc.constant({}),
    status: fc.constantFrom('pending', 'syncing', 'synced', 'failed') as fc.Arbitrary<CachedTransaction['status']>,
    createdAt: fc.integer({ min: 0, max: Date.now() + 86_400_000 }),
    retryCount: fc.integer({ min: 0, max: 5 }),
    localVersion: fc.integer({ min: 0 }),
  }) as fc.Arbitrary<CachedTransaction>;

// ─── Property 10: isValidStellarAddress ──────────────────────────────────────

describe('Property 10: isValidStellarAddress', () => {
  /**
   * **Validates: Requirements 4.2, 4.5**
   * For any valid Stellar address (G + 55 base-32 chars), the validator returns true.
   */
  it('accepts all valid Stellar addresses', () => {
    fc.assert(
      fc.property(validStellarAddress, (addr) => {
        expect(isValidStellarAddress(addr)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.5**
   * Strings shorter than 56 chars are rejected.
   */
  it('rejects strings that are too short', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 55 }),
        (s) => {
          if (/^G[A-Z2-7]{55}$/.test(s)) return; // skip accidental matches
          expect(isValidStellarAddress(s)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects addresses with wrong prefix', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z2-7]{55}$/),
        fc.constantFrom('A', 'B', 'C', 'H', 'X', '1', ''),
        (suffix, prefix) => {
          const addr = `${prefix}${suffix}`;
          expect(isValidStellarAddress(addr)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects addresses with invalid characters (lowercase)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{55}$/),
        (suffix) => {
          expect(isValidStellarAddress(`G${suffix}`)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects addresses that are too long', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z2-7]{56,70}$/),
        (suffix) => {
          expect(isValidStellarAddress(`G${suffix}`)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: validateTransferAmount ─────────────────────────────────────

describe('Property 11: validateTransferAmount', () => {
  /**
   * **Validates: Requirements 4.3**
   * Returns an error iff amount + fee > availableBalance.
   */
  it('error iff amount + fee > available (exhaustive boundary check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        (available, amount) => {
          const fee = ESTIMATED_FEE_STROOPS;
          const result = validateTransferAmount(amount, available, fee);
          if (amount + fee > available) {
            expect(result).not.toBeNull();
          } else {
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects when amount + fee > available balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (available) => {
          const fee = ESTIMATED_FEE_STROOPS;
          const tooLarge = available + 1;
          const result = validateTransferAmount(tooLarge, available, fee);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts when amount + fee <= available balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: ESTIMATED_FEE_STROOPS + 1, max: 1_000_000_000 }),
        (available) => {
          const fee = ESTIMATED_FEE_STROOPS;
          const amount = available - fee; // exactly at boundary
          const result = validateTransferAmount(amount, available, fee);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: validateStakingAmount ──────────────────────────────────────

describe('Property 12: validateStakingAmount', () => {
  /**
   * **Validates: Requirements 7.2, 7.3**
   * Rejects amounts <= 0 or > ceiling; accepts amounts in (0, ceiling].
   */
  it('rejects amounts <= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: -1_000_000_000, max: 0 }),
        (ceiling, amount) => {
          const result = validateStakingAmount(amount, ceiling);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects amounts exceeding the ceiling', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (ceiling) => {
          const amount = ceiling + 1;
          const result = validateStakingAmount(amount, ceiling);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts amounts in (0, ceiling]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (ceiling, rawAmount) => {
          const amount = (rawAmount % ceiling) + 1; // in range [1, ceiling]
          const result = validateStakingAmount(amount, ceiling);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts exactly the ceiling value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (ceiling) => {
          const result = validateStakingAmount(ceiling, ceiling);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 1: computeTotalFiat ────────────────────────────────────────────

describe('Property 1: computeTotalFiat', () => {
  /**
   * **Validates: Requirements 1.2**
   * Total fiat equals sum of (toFloat(amount) * rate) for each balance.
   */
  it('equals the manual sum of individual token fiat values', () => {
    const currency = 'USD';
    fc.assert(
      fc.property(
        fc.array(balanceArb(currency), { minLength: 1, maxLength: 10 }),
        (balances) => {
          const result = computeTotalFiat(balances, currency);
          const expected = balances.reduce((sum, b) => {
            const rate = b.fiatRates?.[currency] ?? 0;
            return sum + toFloat(b.amount) * rate;
          }, 0);
          expect(result).toBeCloseTo(expected, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 for empty balances list', () => {
    expect(computeTotalFiat([], 'USD')).toBe(0);
  });
});

// ─── Property 13: computePnL ─────────────────────────────────────────────────

describe('Property 13: computePnL', () => {
  /**
   * **Validates: Requirements 6.2**
   * P&L = (toFloat(amount) - toFloat(previousAmount)) * fiatRates[currency]
   */
  it('equals (current - previous) * fiatRate', () => {
    const currency = 'USD';
    fc.assert(
      fc.property(balanceArb(currency), (balance) => {
        const result = computePnL(balance, currency);
        const current = toFloat(balance.amount);
        const previous = balance.previousAmount !== undefined
          ? toFloat(balance.previousAmount)
          : current;
        const rate = balance.fiatRates?.[currency] ?? 0;
        const expected = (current - previous) * rate;
        expect(result).toBeCloseTo(expected, 8);
      }),
      { numRuns: 100 }
    );
  });

  it('returns 0 when previousAmount equals amount', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1_000_000_000n }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (amountBig, rate) => {
          const amount = amountBig.toString();
          const balance = {
            id: 'test',
            address: 'addr',
            contractId: 'cid',
            tokenSymbol: 'TKN',
            amount,
            previousAmount: amount,
            lastUpdated: 0,
            fiatRates: { USD: rate },
          } as unknown as Balance;
          expect(computePnL(balance, 'USD')).toBeCloseTo(0, 8);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 14: computeDiversificationScore ────────────────────────────────

describe('Property 14: computeDiversificationScore', () => {
  /**
   * **Validates: Requirements 6.4**
   * Score is in [0, 100] and equals Math.round((1 - hhi) * 100).
   */
  it('is always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.array(balanceArb(), { minLength: 1, maxLength: 10 }),
        (balances) => {
          const score = computeDiversificationScore(balances);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('equals Math.round((1 - hhi) * 100)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.bigInt({ min: 1n, max: 1_000_000_000n }).map(n => n.toString()),
          { minLength: 1, maxLength: 10 }
        ),
        (amounts) => {
          const balances = amounts.map((amount, i) => ({
            id: `b${i}`,
            address: 'addr',
            contractId: `cid${i}`,
            tokenSymbol: `T${i}`,
            amount,
            lastUpdated: 0,
          } as unknown as Balance));

          const score = computeDiversificationScore(balances);
          const values = amounts.map(a => Number(a) / 10_000_000);
          const total = values.reduce((s, v) => s + v, 0);
          const hhi = total > 0
            ? values.reduce((s, v) => s + Math.pow(v / total, 2), 0)
            : 1;
          const expected = Math.round((1 - hhi) * 100);
          expect(score).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 for a single token (fully concentrated)', () => {
    const balance = {
      id: 'b1',
      address: 'addr',
      contractId: 'cid',
      tokenSymbol: 'TKN',
      amount: '1000000000',
      lastUpdated: 0,
    } as unknown as Balance;
    expect(computeDiversificationScore([balance])).toBe(0);
  });

  it('returns 0 for empty list', () => {
    expect(computeDiversificationScore([])).toBe(0);
  });
});

// ─── Property 15: filterByTimeRange ──────────────────────────────────────────

describe('Property 15: filterByTimeRange', () => {
  /**
   * **Validates: Requirements 6.5**
   * All results have createdAt >= cutoff; no in-range item is excluded.
   */
  it('excludes items outside the time range and includes all in-range items', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.constantFrom('7d', '30d', 'all') as fc.Arbitrary<TimeRange>,
        (txs, range) => {
          const result = filterByTimeRange(txs, range);
          const now = Date.now();
          const cutoff = range === '7d'
            ? now - 7 * 86_400_000
            : range === '30d'
            ? now - 30 * 86_400_000
            : 0;

          // All results must be within range
          for (const tx of result) {
            expect(tx.createdAt).toBeGreaterThanOrEqual(cutoff);
          }

          // No in-range item should be excluded
          const inRange = txs.filter(tx => tx.createdAt >= cutoff);
          expect(result.length).toBe(inRange.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns all items for range "all"', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        (txs) => {
          const result = filterByTimeRange(txs, 'all');
          expect(result.length).toBe(txs.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
