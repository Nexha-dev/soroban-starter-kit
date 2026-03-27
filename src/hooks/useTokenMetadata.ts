/**
 * useTokenMetadata — fetches TokenMetadata from Soroban RPC for a given contract.
 *
 * Requirements: 2.1, 2.4
 */

import { useCallback, useEffect, useState } from 'react';
import { TokenMetadata } from '../types/tokenManagement';

export interface UseTokenMetadataParams {
  contractId: string;
  rpcUrl: string;
}

export interface UseTokenMetadataResult {
  metadata: TokenMetadata | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

/**
 * Builds the base64-encoded XDR ledger key for a token metadata entry.
 * The key is a ScVal symbol stored as persistent contract data.
 */
async function buildMetadataLedgerKey(contractId: string, symbol: string): Promise<string> {
  const { xdr, Address } = await import('@stellar/stellar-sdk');

  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvSymbol(symbol),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );

  return key.toXDR('base64');
}

/**
 * Calls `getLedgerEntries` for a single key and returns the decoded ScVal,
 * or null if the entry does not exist.
 */
async function fetchLedgerEntry(
  rpcUrl: string,
  ledgerKey: string,
): Promise<import('@stellar/stellar-sdk').xdr.ScVal | null> {
  const { xdr } = await import('@stellar/stellar-sdk');

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
  return entryData.contractData().val();
}

/** Decodes a ScVal string (scvString or scvBytes) to a JS string. */
function scValToString(val: import('@stellar/stellar-sdk').xdr.ScVal): string {
  const { xdr } = require('@stellar/stellar-sdk');
  if (val.switch() === xdr.ScValType.scvString()) {
    return val.str().toString();
  }
  if (val.switch() === xdr.ScValType.scvBytes()) {
    return Buffer.from(val.bytes()).toString('utf8');
  }
  return '';
}

/** Decodes a ScVal u32 to a JS number. */
function scValToU32(val: import('@stellar/stellar-sdk').xdr.ScVal): number {
  const { xdr } = require('@stellar/stellar-sdk');
  if (val.switch() === xdr.ScValType.scvU32()) {
    return val.u32();
  }
  return 0;
}

/** Decodes a ScVal i128 to a BigInt string. */
function scValToI128String(val: import('@stellar/stellar-sdk').xdr.ScVal): string {
  const { xdr } = require('@stellar/stellar-sdk');
  if (val.switch() === xdr.ScValType.scvI128()) {
    const i128 = val.i128();
    const hi = BigInt(i128.hi().toString());
    const lo = BigInt(i128.lo().toString());
    return ((hi << 64n) | lo).toString();
  }
  return '0';
}

/**
 * Fetches all token metadata fields from the Soroban RPC by reading the
 * persistent contract data entries for `name`, `symbol`, `decimals`, and
 * `total_supply`.
 *
 * SEP-41 / Soroban token interface stores these as top-level persistent
 * contract data entries keyed by their symbol name.
 */
export async function fetchTokenMetadata(
  rpcUrl: string,
  contractId: string,
): Promise<TokenMetadata> {
  const [nameKey, symbolKey, decimalsKey, supplyKey] = await Promise.all([
    buildMetadataLedgerKey(contractId, 'name'),
    buildMetadataLedgerKey(contractId, 'symbol'),
    buildMetadataLedgerKey(contractId, 'decimals'),
    buildMetadataLedgerKey(contractId, 'total_supply'),
  ]);

  const [nameVal, symbolVal, decimalsVal, supplyVal] = await Promise.all([
    fetchLedgerEntry(rpcUrl, nameKey),
    fetchLedgerEntry(rpcUrl, symbolKey),
    fetchLedgerEntry(rpcUrl, decimalsKey),
    fetchLedgerEntry(rpcUrl, supplyKey),
  ]);

  return {
    contractId,
    name: nameVal ? scValToString(nameVal) : '',
    symbol: symbolVal ? scValToString(symbolVal) : '',
    decimals: decimalsVal ? scValToU32(decimalsVal) : 0,
    totalSupply: supplyVal ? scValToI128String(supplyVal) : '0',
  };
}

// ── useTokenMetadata ──────────────────────────────────────────────────────────

/**
 * Fetches token metadata (name, symbol, decimals, total supply) from Soroban RPC.
 *
 * - Re-fetches automatically when `contractId` changes (Requirement 2.1).
 * - Exposes `retry()` to re-trigger the fetch after an error (Requirement 2.4).
 * - Sets `error` state on RPC failure; `loading` is true while the request is in-flight.
 */
export function useTokenMetadata({
  contractId,
  rpcUrl,
}: UseTokenMetadataParams): UseTokenMetadataResult {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrementing this triggers a re-fetch without changing contractId
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!contractId || !rpcUrl) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchTokenMetadata(rpcUrl, contractId)
      .then((data) => {
        if (!cancelled) {
          setMetadata(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useTokenMetadata] fetch error:', message);
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // retryCount is intentionally included so retry() re-runs this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, rpcUrl, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return { metadata, loading, error, retry };
}
