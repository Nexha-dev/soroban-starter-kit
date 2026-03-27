/**
 * TokenDetailPanel — displays metadata and allowances for a selected token.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React, { useState } from 'react';
import { useTokenMetadata } from '../../hooks/useTokenMetadata';
import { useAllowances } from '../../hooks/useAllowances';

const STROOPS = 10_000_000;

function toFloat(s: string): string {
  return (Number(s) / STROOPS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

export interface TokenDetailPanelProps {
  contractId: string;
  walletAddress: string;
  rpcUrl: string;
  knownSpenders?: string[];
}

export function TokenDetailPanel({
  contractId,
  walletAddress,
  rpcUrl,
  knownSpenders = [],
}: TokenDetailPanelProps): JSX.Element {
  const { metadata, loading, error, retry } = useTokenMetadata({ contractId, rpcUrl });
  const { allowances, loading: allowancesLoading } = useAllowances({
    contractId,
    walletAddress,
    rpcUrl,
    knownSpenders,
  });

  const [copied, setCopied] = useState(false);

  const copyContractId = () => {
    navigator.clipboard.writeText(contractId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="tmd-detail-panel">
        <p className="text-muted">Loading token metadata…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tmd-detail-panel">
        <p className="text-error" role="alert">Failed to load token metadata: {error}</p>
        <button className="btn btn-secondary" onClick={retry}>Retry</button>
      </div>
    );
  }

  return (
    <div className="tmd-detail-panel">
      <h3 className="tmd-detail-title">{metadata?.name || contractId}</h3>

      <dl className="tmd-detail-list">
        <div className="tmd-detail-row">
          <dt>Symbol</dt>
          <dd>{metadata?.symbol ?? '—'}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Decimals</dt>
          <dd>{metadata?.decimals ?? '—'}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Total Supply</dt>
          <dd>{metadata?.totalSupply ? toFloat(metadata.totalSupply) : '—'}</dd>
        </div>
        <div className="tmd-detail-row">
          <dt>Contract ID</dt>
          <dd className="tmd-detail-contract">
            <span className="tmd-detail-contract-id">{contractId}</span>
            <button
              className="btn btn-secondary tmd-copy-btn"
              onClick={copyContractId}
              aria-label="Copy contract ID to clipboard"
              title="Copy contract ID"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </dd>
        </div>
      </dl>

      {/* Allowances */}
      <section className="tmd-allowances">
        <h4>Active Allowances</h4>
        {allowancesLoading ? (
          <p className="text-muted">Loading allowances…</p>
        ) : allowances.length === 0 ? (
          <p className="text-muted">No active allowances.</p>
        ) : (
          <ul className="tmd-allowance-list">
            {allowances.map((a) => (
              <li key={a.spender} className="tmd-allowance-item">
                <span className="tmd-allowance-spender" title={a.spender}>
                  {a.spender.slice(0, 12)}…
                </span>
                <span className="tmd-allowance-amount">{toFloat(a.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default TokenDetailPanel;
