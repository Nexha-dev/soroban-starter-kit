/**
 * useAllowances — fetches active Allowance[] for the connected wallet from Soroban RPC.
 *
 * Requirements: 2.3
 *
 * NOTE: The Soroban RPC does not expose a "list all allowances" endpoint. The SEP-41
 * token standard stores allowances as persistent contract data entries keyed by
 * (owner, spender) pairs. Without an indexer there is no way to enumerate all spenders
 * for a given owner. This hook therefore:
 *   1. Accepts an optional `knownSpenders` list and checks each one individually.
 *   2. Returns an empty array when no known spenders are provided.
 * Callers that have access to an indexer or a known spender list can pass it in.
 */

import { useEffect, useState } from 'react';
import { Allowance } from '../types/tokenManagement';

export interface UseAllowancesParams {
  contractId: string;
  walletAddress: string;
  rpcUrl: string;
  /** Optional list of spender addresses to check. Without this the result is always []. */
  knownSpenders?: string[];
}

export interface UseAllowancesResult {
  allowances: Allowance[];
  loading: boolean;
  error: string | null;
}

// ── RPC helper ────────────────────────────────────────────────────────────────

/**
 * Builds the base64-encoded XDR ledger key for an allowance entry.
 *
 * SEP-41 stores allowances as persistent contract data under the key:
 *   ScvVec([ ScvSymbol("Allowance"), ScvVec([ ScvAddress(owner), ScvAddress(spender) ]) ])
 */
async function buildAllowanceLedgerKey(
  contractId: string,
  owner: string,
  spender: string,
): Promise<string> {
  const { xdr, Address } = await import('@stellar/stellar-sdk');

  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol('Allowance'),
        xdr.ScVal.scvVec([
          new Address(owner).toScVal(),
          new Address(spender).toScVal(),
        ]),
      ]),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  return key.toXDR('base64');
}

/**
 * Fetches the allowance for a specific (owner, spender) pair from the Soroban RPC.
 * Returns null if no allowance entry exists.
 *
 * The SEP-41 allowance entry is a map with `amount` (i128) and `expiration_ledger` (u32).
 */
async function fetchAllowanceEntry(
  rpcUrl: string,
  contractId: string,
  owner: string,
  spender: string,
): Promise<Allowance | null> {
  const { xdr } = await import('@stellar/stellar-sdk');

  const ledgerKey = await buildAllowanceLedgerKey(contractId, owner, spender);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getLedgerEntries',
      params: { keys: [ledgerKey] },
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error ${response.status}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message ?? 'RPC error');
  }

  const entries: Array<{ xdr: string }> = json.result?.entries ?? [];
  if (entries.length === 0) return null;

  const entryData = xdr.LedgerEntryData.fromXDR(entries[0].xdr, 'base64');
  const val = entryData.contractData().val();

  // The allowance value is a map: { amount: i128, expiration_ledger: u32 }
  if (val.switch() !== xdr.ScValType.scvMap()) return null;

  const map: Array<import('@stellar/stellar-sdk').xdr.ScMapEntry> = val.map() ?? [];

  let amount = '0';
  let expirationLedger = 0;

  for (const entry of map) {
    const keyStr =
      entry.key().switch() === xdr.ScValType.scvSymbol()
        ? entry.key().sym().toString()
        : '';

    if (keyStr === 'amount') {
      const v = entry.val();
      if (v.switch() === xdr.ScValType.scvI128()) {
        const i128 = v.i128();
        const hi = BigInt(i128.hi().toString());
        const lo = BigInt(i128.lo().toString());
        amount = ((hi << 64n) | lo).toString();
      }
    } else if (keyStr === 'expiration_ledger') {
      const v = entry.val();
      if (v.switch() === xdr.ScValType.scvU32()) {
        expirationLedger = v.u32();
      }
    }
  }

  // Skip zero-amount allowances — they are effectively inactive
  if (amount === '0') return null;

  return { owner, spender, amount, expirationLedger };
}

// ── useAllowances ─────────────────────────────────────────────────────────────

/**
 * Fetches active allowances for the connected wallet from Soroban RPC.
 *
 * Because the Soroban RPC has no "list allowances" endpoint, this hook checks
 * each address in `knownSpenders` individually. When `knownSpenders` is empty
 * or omitted the result is always an empty array.
 *
 * Re-fetches when `contractId` or `walletAddress` changes (Requirement 2.3).
 */
export function useAllowances({
  contractId,
  walletAddress,
  rpcUrl,
  knownSpenders = [],
}: UseAllowancesParams): UseAllowancesResult {
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable serialised key so the effect only re-runs when the list actually changes
  const spendersKey = knownSpenders.join(',');

  useEffect(() => {
    if (!contractId || !walletAddress || !rpcUrl) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    const spenders = spendersKey ? spendersKey.split(',') : [];

    if (spenders.length === 0) {
      // No known spenders — return empty immediately
      setAllowances([]);
      setLoading(false);
      return;
    }

    Promise.all(
      spenders.map((spender) =>
        fetchAllowanceEntry(rpcUrl, contractId, walletAddress, spender),
      ),
    )
      .then((results) => {
        if (!cancelled) {
          // Filter out null entries (no allowance or zero amount)
          setAllowances(results.filter((a): a is Allowance => a !== null));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useAllowances] fetch error:', message);
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contractId, walletAddress, rpcUrl, spendersKey]);

  return { allowances, loading, error };
}
