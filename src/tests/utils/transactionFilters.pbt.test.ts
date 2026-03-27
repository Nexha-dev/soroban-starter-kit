// Feature: token-management-dashboard, Property 7: Transaction filter returns only matching transactions
// Feature: token-management-dashboard, Property 8: Transaction sort produces a correctly ordered list
// Feature: token-management-dashboard, Property 9: CSV export round-trip preserves transaction data
// Feature: token-management-dashboard, Property 18: Analytics CSV export contains required columns for all balances

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { filterTransactions, sortTransactions, SortField, SortDirection } from '../../utils/transactionFilters';
import { exportTransactionsCSV, exportAnalyticsCSV } from '../../utils/exportCSV';
import { Balance, CachedTransaction } from '../../services/storage/types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const txTypeArb = fc.constantFrom(
  'transfer', 'mint', 'burn', 'approve'
) as fc.Arbitrary<CachedTransaction['type']>;

const txStatusArb = fc.constantFrom(
  'pending', 'syncing', 'synced', 'failed'
) as fc.Arbitrary<CachedTransaction['status']>;

const txArb = (): fc.Arbitrary<CachedTransaction> =>
  fc.record({
    id: fc.uuid(),
    type: txTypeArb,
    contractId: fc.string({ minLength: 5, maxLength: 20 }),
    method: fc.string({ minLength: 1, maxLength: 20 }),
    params: fc.constant({}),
    status: txStatusArb,
    createdAt: fc.integer({ min: 0, max: Date.now() + 86_400_000 }),
    retryCount: fc.integer({ min: 0, max: 5 }),
    localVersion: fc.integer({ min: 0 }),
  }) as fc.Arbitrary<CachedTransaction>;

const balanceArb = (): fc.Arbitrary<Balance> =>
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
      fc.float({ min: 0, max: 1000, noNaN: true }).map(rate => ({ USD: rate })),
      { nil: undefined }
    ),
  }) as fc.Arbitrary<Balance>;

// ─── CSV parsing helper ───────────────────────────────────────────────────────

/**
 * Minimal CSV parser: splits on newlines, then parses each row respecting
 * quoted fields (RFC 4180 subset).
 */
function parseCSV(csv: string): string[][] {
  return csv.split('\n').filter(line => line.length > 0).map(line => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  });
}

// ─── Mock browser download ────────────────────────────────────────────────────

let capturedCSV = '';

beforeEach(() => {
  capturedCSV = '';
  // Mock URL.createObjectURL and related browser APIs
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();

  const mockAnchor = {
    href: '',
    download: '',
    click: vi.fn(() => {
      // The CSV content is captured via the Blob constructor mock
    }),
  };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return mockAnchor as unknown as HTMLElement;
    return document.createElement(tag);
  });

  // Capture CSV content from Blob constructor
  global.Blob = class MockBlob {
    constructor(parts: BlobPart[]) {
      capturedCSV = parts[0] as string;
    }
  } as unknown as typeof Blob;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Property 7: filterTransactions ──────────────────────────────────────────

describe('Property 7: Transaction filter returns only matching transactions', () => {
  /**
   * **Validates: Requirements 3.2, 3.3**
   * Every result satisfies all active predicates; no matching transaction is excluded.
   */
  it('all results satisfy the search predicate', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (txs, search) => {
          const result = filterTransactions(txs, { search });
          const term = search.trim().toLowerCase();
          for (const tx of result) {
            const haystack = [tx.id, tx.method, tx.error ?? ''].join(' ').toLowerCase();
            expect(haystack.includes(term)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no matching transaction is excluded by search', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (txs, search) => {
          const result = filterTransactions(txs, { search });
          const term = search.trim().toLowerCase();
          const expected = txs.filter(tx => {
            const haystack = [tx.id, tx.method, tx.error ?? ''].join(' ').toLowerCase();
            return haystack.includes(term);
          });
          expect(result.length).toBe(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all results satisfy the type filter', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.subarray(['transfer', 'mint', 'burn', 'approve'] as const, { minLength: 1 }),
        (txs, types) => {
          const typeSet = new Set(types) as Set<CachedTransaction['type']>;
          const result = filterTransactions(txs, { types: typeSet });
          for (const tx of result) {
            expect(typeSet.has(tx.type)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no matching transaction is excluded by type filter', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.subarray(['transfer', 'mint', 'burn', 'approve'] as const, { minLength: 1 }),
        (txs, types) => {
          const typeSet = new Set(types) as Set<CachedTransaction['type']>;
          const result = filterTransactions(txs, { types: typeSet });
          const expected = txs.filter(tx => typeSet.has(tx.type));
          expect(result.length).toBe(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all results satisfy the status filter', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.subarray(['pending', 'syncing', 'synced', 'failed'] as const, { minLength: 1 }),
        (txs, statuses) => {
          const statusSet = new Set(statuses) as Set<CachedTransaction['status']>;
          const result = filterTransactions(txs, { statuses: statusSet });
          for (const tx of result) {
            expect(statusSet.has(tx.status)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no matching transaction is excluded by status filter', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.subarray(['pending', 'syncing', 'synced', 'failed'] as const, { minLength: 1 }),
        (txs, statuses) => {
          const statusSet = new Set(statuses) as Set<CachedTransaction['status']>;
          const result = filterTransactions(txs, { statuses: statusSet });
          const expected = txs.filter(tx => statusSet.has(tx.status));
          expect(result.length).toBe(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty filter config returns all transactions', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        (txs) => {
          const result = filterTransactions(txs, {});
          expect(result.length).toBe(txs.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: sortTransactions ────────────────────────────────────────────

describe('Property 8: Transaction sort produces a correctly ordered list', () => {
  /**
   * **Validates: Requirements 3.4**
   * Sorted result is a permutation of the input where adjacent elements satisfy the ordering.
   */
  it('sorted result is a permutation of the input', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 0, maxLength: 20 }),
        fc.constantFrom('date', 'type', 'status') as fc.Arbitrary<SortField>,
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortDirection>,
        (txs, field, direction) => {
          const result = sortTransactions(txs, { field, direction });
          expect(result.length).toBe(txs.length);
          // Same IDs present
          const inputIds = txs.map(t => t.id).sort();
          const resultIds = result.map(t => t.id).sort();
          expect(resultIds).toEqual(inputIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adjacent elements satisfy the date ordering (asc)', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 2, maxLength: 20 }),
        (txs) => {
          const result = sortTransactions(txs, { field: 'date', direction: 'asc' });
          for (let i = 1; i < result.length; i++) {
            expect(result[i].createdAt).toBeGreaterThanOrEqual(result[i - 1].createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adjacent elements satisfy the date ordering (desc)', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 2, maxLength: 20 }),
        (txs) => {
          const result = sortTransactions(txs, { field: 'date', direction: 'desc' });
          for (let i = 1; i < result.length; i++) {
            expect(result[i].createdAt).toBeLessThanOrEqual(result[i - 1].createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adjacent elements satisfy the type ordering (asc)', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 2, maxLength: 20 }),
        (txs) => {
          const result = sortTransactions(txs, { field: 'type', direction: 'asc' });
          for (let i = 1; i < result.length; i++) {
            expect(result[i].type.localeCompare(result[i - 1].type)).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adjacent elements satisfy the status ordering (asc)', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 2, maxLength: 20 }),
        (txs) => {
          const result = sortTransactions(txs, { field: 'status', direction: 'asc' });
          for (let i = 1; i < result.length; i++) {
            expect(result[i].status.localeCompare(result[i - 1].status)).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not mutate the input array', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 1, maxLength: 10 }),
        (txs) => {
          const copy = [...txs];
          sortTransactions(txs, { field: 'date', direction: 'asc' });
          expect(txs.map(t => t.id)).toEqual(copy.map(t => t.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 9: CSV export round-trip ───────────────────────────────────────

describe('Property 9: CSV export round-trip preserves transaction data', () => {
  /**
   * **Validates: Requirements 3.6**
   * Parsing the CSV produced by exportTransactionsCSV yields rows matching the originals.
   */
  it('each row matches the original transaction fields', () => {
    fc.assert(
      fc.property(
        fc.array(txArb(), { minLength: 1, maxLength: 10 }),
        (txs) => {
          exportTransactionsCSV(txs, 'test.csv');
          const rows = parseCSV(capturedCSV);
          // rows[0] is the header
          expect(rows[0]).toEqual(['id', 'type', 'status', 'contractId', 'method']);
          expect(rows.length).toBe(txs.length + 1);

          for (let i = 0; i < txs.length; i++) {
            const tx = txs[i];
            const row = rows[i + 1];
            expect(row[0]).toBe(tx.id);
            expect(row[1]).toBe(tx.type);
            expect(row[2]).toBe(tx.status);
            expect(row[3]).toBe(tx.contractId);
            expect(row[4]).toBe(tx.method);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles transactions with commas or quotes in method field', () => {
    const tx: CachedTransaction = {
      id: 'abc-123',
      type: 'transfer',
      contractId: 'CTEST',
      method: 'transfer,with,commas',
      params: {},
      status: 'synced',
      createdAt: 1000,
      retryCount: 0,
      localVersion: 1,
    };
    exportTransactionsCSV([tx], 'test.csv');
    const rows = parseCSV(capturedCSV);
    expect(rows[1][4]).toBe('transfer,with,commas');
  });
});

// ─── Property 18: Analytics CSV export columns ───────────────────────────────

describe('Property 18: Analytics CSV export contains required columns for all balances', () => {
  /**
   * **Validates: Requirements 6.6**
   * Each row has non-empty symbol, balance, fiatValue, and percentageChange columns.
   */
  it('contains a row for each balance with all required columns non-empty', () => {
    fc.assert(
      fc.property(
        fc.array(balanceArb(), { minLength: 1, maxLength: 10 }),
        (balances) => {
          exportAnalyticsCSV(balances, 'USD', 'test.csv');
          const rows = parseCSV(capturedCSV);
          // rows[0] is the header
          expect(rows[0]).toEqual(['symbol', 'balance', 'fiatValue', 'percentageChange']);
          expect(rows.length).toBe(balances.length + 1);

          for (let i = 0; i < balances.length; i++) {
            const row = rows[i + 1];
            // symbol
            expect(row[0]).toBe(balances[i].tokenSymbol);
            expect(row[0].length).toBeGreaterThan(0);
            // balance
            expect(row[1].length).toBeGreaterThan(0);
            // fiatValue
            expect(row[2].length).toBeGreaterThan(0);
            // percentageChange
            expect(row[3].length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('header row contains exactly the required columns', () => {
    const balance: Balance = {
      id: 'b1',
      address: 'addr',
      contractId: 'cid',
      tokenSymbol: 'TKN',
      amount: '10000000',
      lastUpdated: 0,
    };
    exportAnalyticsCSV([balance], 'USD', 'test.csv');
    const rows = parseCSV(capturedCSV);
    expect(rows[0]).toEqual(['symbol', 'balance', 'fiatValue', 'percentageChange']);
  });
});
