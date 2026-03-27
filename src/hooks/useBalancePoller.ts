/**
 * useBalancePoller — periodically refreshes token balances from Soroban RPC.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '../context/StorageContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseBalancePollerOptions {
  walletAddress: string | null;
  contractIds: string[];
  rpcUrl: string;
  intervalMs: number;
  onBalanceChange: (contractId: string, newAmount: string, oldAmount: string) => void;
}

export interface UseBalancePollerResult {
  lastUpdated: number | null;
  error: string | null;
}

// ── RPC helper ────────────────────────────────────────────────────────────────

/**
 * Builds the base64-encoded XDR ledger key for a token balance entry.
 * Exported for testing purposes.
 */
export async function buildBalanceLedgerKey(
  walletAddress: string,
  contractId: string,
): Promise<string> {
  const { xdr, Address } = await import('@stellar/stellar-sdk');

  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('Balance'),
        new Address(walletAddress).toScVal(),
      ]),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  return key.toXDR('base64');
}

/**
 * Fetches the token balance for a given wallet address and contract ID
 * by calling the Soroban RPC `getLedgerEntries` endpoint.
 *
 * Returns the balance as a string in stroops, or throws on error.
 *
 * @param ledgerKeyOverride - Optional pre-built base64 XDR key (used in tests to bypass XDR encoding)
 */
export async function fetchTokenBalance(
  rpcUrl: string,
  walletAddress: string,
  contractId: string,
  ledgerKeyOverride?: string,
): Promise<string> {
  const { xdr } = await import('@stellar/stellar-sdk');

  const ledgerKey = ledgerKeyOverride ?? await buildBalanceLedgerKey(walletAddress, contractId);

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getLedgerEntries',
    params: { keys: [ledgerKey] },
  });

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error ${response.status}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message ?? 'RPC error');
  }

  const entries: Array<{ xdr: string }> = json.result?.entries ?? [];
  if (entries.length === 0) {
    // No entry means zero balance
    return '0';
  }

  // Decode the ledger entry XDR to extract the i128 balance value
  const entryXdr = xdr.LedgerEntryData.fromXDR(entries[0].xdr, 'base64');
  const val = entryXdr.contractData().val();

  // The balance is stored as an i128 ScVal
  if (val.switch() === xdr.ScValType.scvI128()) {
    const i128 = val.i128();
    // Combine hi and lo parts (treat as unsigned for display purposes)
    const hi = BigInt(i128.hi().toString());
    const lo = BigInt(i128.lo().toString());
    const amount = (hi << 64n) | lo;
    return amount.toString();
  }

  return '0';
}

// ── useInterval ───────────────────────────────────────────────────────────────

/**
 * Runs `callback` every `delay` ms, but pauses automatically when the
 * browser tab is hidden (`document.hidden === true`).
 *
 * Requirement 5.1 — fires at configured interval when visible.
 * Requirement 5.2 — pauses when tab is hidden.
 */
export function useInterval(callback: () => void, delay: number): void {
  const savedCallback = useRef<() => void>(callback);

  // Keep the ref up-to-date so the interval always calls the latest version
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay <= 0) return;

    const tick = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };

    const id = setInterval(tick, delay);

    // Also resume immediately when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay]);
}

// ── useBalancePoller ──────────────────────────────────────────────────────────

/**
 * Polls Soroban RPC for token balances at a configurable interval.
 *
 * - Pauses when the browser tab is hidden (Requirement 5.2).
 * - Calls `onBalanceChange` when a balance differs from the stored value (Requirement 5.3).
 * - Persists updated balances via `StorageContext.saveBalance` (Requirement 5.3).
 * - Tracks `lastUpdated` timestamp after each successful poll (Requirement 5.6).
 * - Catches RPC errors, logs them, and sets `error` state without crashing (Requirement 5.5).
 */
export function useBalancePoller(opts: UseBalancePollerOptions): UseBalancePollerResult {
  const { walletAddress, contractIds, rpcUrl, intervalMs, onBalanceChange } = opts;

  const { balances, saveBalance } = useStorage();
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the latest balances array to avoid stale closures
  const balancesRef = useRef(balances);
  useEffect(() => {
    balancesRef.current = balances;
  }, [balances]);

  const poll = useCallback(async () => {
    if (!walletAddress || contractIds.length === 0) return;

    try {
      await Promise.all(
        contractIds.map(async (contractId) => {
          const newAmount = await fetchTokenBalance(rpcUrl, walletAddress, contractId);

          // Find the stored balance record for this contract
          const stored = balancesRef.current.find(
            (b) => b.contractId === contractId && b.address === walletAddress,
          );

          const oldAmount = stored?.amount ?? '0';

          if (newAmount !== oldAmount) {
            // Notify the caller about the change (Requirement 5.3)
            onBalanceChange(contractId, newAmount, oldAmount);

            // Persist the updated balance (Requirement 5.3)
            const updatedBalance = {
              id: stored?.id ?? `${walletAddress}-${contractId}`,
              address: walletAddress,
              contractId,
              tokenSymbol: stored?.tokenSymbol ?? '',
              amount: newAmount,
              lastUpdated: Date.now(),
              previousAmount: oldAmount,
              previousUpdated: stored?.lastUpdated,
              fiatRates: stored?.fiatRates,
              alertThreshold: stored?.alertThreshold,
            };
            await saveBalance(updatedBalance);
          }
        }),
      );

      // Update lastUpdated after a fully successful poll (Requirement 5.6)
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      // Log and surface the error without crashing (Requirement 5.5)
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useBalancePoller] RPC error:', message);
      setError(message);
    }
  }, [walletAddress, contractIds, rpcUrl, onBalanceChange, saveBalance]);

  // Schedule the poll at the configured interval, pausing when tab is hidden
  useInterval(poll, intervalMs);

  return { lastUpdated, error };
}
