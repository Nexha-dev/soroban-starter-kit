/**
 * TokenSidebar — lists token balances in a sidebar for master-detail navigation.
 * Requirements: 1.1, 1.3
 */

import React from 'react';
import { Balance } from '../../services/storage/types';

const STROOPS = 10_000_000;

function toFloat(s: string | number): number {
  return Number(s) / STROOPS;
}

function fmtAmount(s: string): string {
  return toFloat(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function fmtFiat(n: number, currency: string): string {
  return n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
}

export interface TokenSidebarProps {
  balances: Balance[];
  selectedId: string | null;
  onSelect: (contractId: string) => void;
  currency: string;
}

export function TokenSidebar({ balances, selectedId, onSelect, currency }: TokenSidebarProps): JSX.Element {
  if (balances.length === 0) {
    return (
      <aside className="tmd-sidebar" aria-label="Token list">
        <div className="tmd-sidebar-empty">
          <p className="text-muted">No tokens found. Add a token contract to get started.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="tmd-sidebar" aria-label="Token list">
      <ul className="tmd-sidebar-list" role="listbox" aria-label="Select a token">
        {balances.map((b) => {
          const amount = toFloat(b.amount);
          const rate = b.fiatRates?.[currency] ?? 0;
          const fiatValue = amount * rate;
          const isSelected = b.contractId === selectedId;

          return (
            <li
              key={b.contractId}
              role="option"
              aria-selected={isSelected}
              className={`tmd-sidebar-item${isSelected ? ' tmd-sidebar-item--selected' : ''}`}
              onClick={() => onSelect(b.contractId)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(b.contractId)}
              tabIndex={0}
            >
              <div className="tmd-sidebar-symbol">{b.tokenSymbol}</div>
              <div className="tmd-sidebar-amount">{fmtAmount(b.amount)}</div>
              {rate > 0 && (
                <div className="tmd-sidebar-fiat">{fmtFiat(fiatValue, currency)}</div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default TokenSidebar;
