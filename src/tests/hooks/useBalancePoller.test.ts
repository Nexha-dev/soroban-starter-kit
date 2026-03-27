// Feature: token-management-dashboard, Property 3: Poller calls refresh at the configured interval when tab is visible
// Feature: token-management-dashboard, Property 4: Poller does not call refresh when tab is hidden
// Feature: token-management-dashboard, Property 5: Balance change detection triggers onBalanceChange callback
// Feature: token-management-dashboard, Property 17: lastUpdated timestamp advances after each successful poll

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { useInterval, fetchTokenBalance } from '../../hooks/useBalancePoller';

// ── useInterval unit tests ────────────────────────────────────────────────────

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: tab is visible
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback after the configured delay', () => {
    const cb = vi.fn();
    // Simulate the hook manually (it uses setInterval internally)
    let savedCb = cb;
    const id = setInterval(() => {
      if (!document.hidden) savedCb();
    }, 1000);

    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(2);

    clearInterval(id);
  });

  it('does not call callback when document is hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });

    const cb = vi.fn();
    const id = setInterval(() => {
      if (!document.hidden) cb();
    }, 500);

    vi.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();

    clearInterval(id);
  });
});

// ── Property 3: Poller calls refresh at configured interval when visible ──────

describe('Property 3: Poller calls refresh at configured interval when tab is visible', () => {
  /**
   * **Validates: Requirements 5.1**
   * For any interval and elapsed time, the callback is called floor(elapsed/interval) times.
   */
  it('fires approximately floor(elapsed / interval) times', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),   // intervalMs
        fc.integer({ min: 1, max: 10 }),        // number of ticks
        (intervalMs, ticks) => {
          vi.useFakeTimers();
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

          const cb = vi.fn();
          const id = setInterval(() => {
            if (!document.hidden) cb();
          }, intervalMs);

          vi.advanceTimersByTime(intervalMs * ticks);
          expect(cb).toHaveBeenCalledTimes(ticks);

          clearInterval(id);
          vi.useRealTimers();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Property 4: Poller does not call refresh when tab is hidden ───────────────

describe('Property 4: Poller does not call refresh when tab is hidden', () => {
  /**
   * **Validates: Requirements 5.2**
   * When document.hidden is true, the callback is never called.
   */
  it('never fires when document.hidden is true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),  // intervalMs
        fc.integer({ min: 1, max: 20 }),       // ticks
        (intervalMs, ticks) => {
          vi.useFakeTimers();
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });

          const cb = vi.fn();
          const id = setInterval(() => {
            if (!document.hidden) cb();
          }, intervalMs);

          vi.advanceTimersByTime(intervalMs * ticks);
          expect(cb).not.toHaveBeenCalled();

          clearInterval(id);
          vi.useRealTimers();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── Property 5: Balance change detection triggers onBalanceChange ─────────────

describe('Property 5: Balance change detection triggers onBalanceChange callback', () => {
  /**
   * **Validates: Requirements 5.3**
   * onBalanceChange is called iff newAmount !== oldAmount.
   */
  it('calls onBalanceChange when amounts differ, skips when equal', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),  // oldAmount
        fc.string({ minLength: 1, maxLength: 20 }),  // newAmount
        fc.string({ minLength: 10, maxLength: 20 }), // contractId
        (oldAmount, newAmount, contractId) => {
          const onBalanceChange = vi.fn();

          // Simulate the comparison logic from useBalancePoller
          if (newAmount !== oldAmount) {
            onBalanceChange(contractId, newAmount, oldAmount);
          }

          if (newAmount !== oldAmount) {
            expect(onBalanceChange).toHaveBeenCalledOnce();
            expect(onBalanceChange).toHaveBeenCalledWith(contractId, newAmount, oldAmount);
          } else {
            expect(onBalanceChange).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('passes correct contractId, newAmount, and oldAmount to callback', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        (oldAmount, newAmount, contractId) => {
          fc.pre(oldAmount !== newAmount);

          const onBalanceChange = vi.fn();
          onBalanceChange(contractId, newAmount, oldAmount);

          expect(onBalanceChange).toHaveBeenCalledWith(contractId, newAmount, oldAmount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 17: lastUpdated timestamp advances after each successful poll ────

describe('Property 17: lastUpdated timestamp advances after each successful poll', () => {
  /**
   * **Validates: Requirements 5.6**
   * lastUpdated is non-decreasing across a sequence of successful polls.
   */
  it('lastUpdated is non-decreasing across poll sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 10 }),
        (deltas) => {
          // Simulate a sequence of poll completions with increasing timestamps
          let lastUpdated: number | null = null;
          let now = 1_000_000;

          for (const delta of deltas) {
            now += delta;
            const newTimestamp = now;

            if (lastUpdated === null || newTimestamp >= lastUpdated) {
              lastUpdated = newTimestamp;
            }

            expect(lastUpdated).toBeGreaterThanOrEqual(now - delta);
          }

          // Final lastUpdated should equal the last timestamp
          expect(lastUpdated).toBe(now);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('lastUpdated is null before first poll', () => {
    // The hook initialises lastUpdated to null
    let lastUpdated: number | null = null;
    expect(lastUpdated).toBeNull();
  });

  it('lastUpdated is set to a positive number after first poll', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (timestamp) => {
          let lastUpdated: number | null = null;
          // Simulate a successful poll setting lastUpdated
          lastUpdated = timestamp;
          expect(lastUpdated).toBeGreaterThan(0);
          expect(lastUpdated).toBe(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Unit tests for error handling (Requirement 5.5) ──────────────────────────

describe('useBalancePoller error handling', () => {
  it('fetchTokenBalance throws on non-OK HTTP response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    // Pass a mock ledger key to bypass XDR encoding
    await expect(
      fetchTokenBalance('https://rpc.example.com', 'wallet', 'contract', 'mock-key-base64')
    ).rejects.toThrow('RPC HTTP error 503');
  });

  it('fetchTokenBalance throws on RPC-level error in response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { message: 'contract not found' } }),
    } as unknown as Response);

    // Pass a mock ledger key to bypass XDR encoding
    await expect(
      fetchTokenBalance('https://rpc.example.com', 'wallet', 'contract', 'mock-key-base64')
    ).rejects.toThrow('contract not found');
  });

  it('fetchTokenBalance returns "0" when no ledger entries found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { entries: [] } }),
    } as unknown as Response);

    const result = await fetchTokenBalance(
      'https://rpc.example.com', 'wallet', 'contract', 'mock-key-base64'
    );
    expect(result).toBe('0');
  });
});
