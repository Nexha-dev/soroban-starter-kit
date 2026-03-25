import React, { useEffect, useRef, useState } from 'react';
import { Balance, BalanceDisplayPreferences } from '../services/storage/types';
import { useConnectivity } from '../context/ConnectivityContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const STROOPS = 10_000_000n;

function stroopsToFloat(amount: string): number {
  try {
    const n = BigInt(amount);
    return Number(n) / Number(STROOPS);
  } catch {
    return 0;
  }
}

function formatAmount(amount: string, decimals = 2): string {
  const n = stroopsToFloat(amount);
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatFiat(amount: string, rate: number, currency: string): string {
  const value = stroopsToFloat(amount) * rate;
  return value.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
}

function percentChange(current: string, previous: string): number | null {
  const cur = stroopsToFloat(current);
  const prev = stroopsToFloat(previous);
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Preferences hook ────────────────────────────────────────────────────────

const PREFS_KEY = 'balance_display_prefs';

const DEFAULT_PREFS: BalanceDisplayPreferences = {
  currency: 'USD',
  showFiat: true,
  showChange: true,
  hideBalance: false,
  alertsEnabled: true,
};

function useBalancePreferences(): [BalanceDisplayPreferences, (p: Partial<BalanceDisplayPreferences>) => void] {
  const [prefs, setPrefs] = useState<BalanceDisplayPreferences>(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const update = (patch: Partial<BalanceDisplayPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return [prefs, update];
}

// ─── Animated number ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, hidden }: { value: string; hidden: boolean }) {
  const [display, setDisplay] = useState(value);
  const [animating, setAnimating] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      setAnimating(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setAnimating(false);
        prev.current = value;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [value]);

  if (hidden) return <span className="balance-hidden" aria-label="Balance hidden">••••••</span>;

  return (
    <span className={`balance-amount-value${animating ? ' balance-animating' : ''}`}>
      {display}
    </span>
  );
}

// ─── Alert badge ─────────────────────────────────────────────────────────────

function AlertBadge({ balance, enabled }: { balance: Balance; enabled: boolean }) {
  if (!enabled || balance.alertThreshold == null) return null;
  const current = stroopsToFloat(balance.amount);
  const threshold = balance.alertThreshold / Number(STROOPS);
  if (current > threshold) return null;
  return (
    <span className="balance-alert" role="alert" aria-live="polite">
      ⚠ Low balance
    </span>
  );
}

// ─── Single token card ───────────────────────────────────────────────────────

interface TokenCardProps {
  balance: Balance;
  prefs: BalanceDisplayPreferences;
}

function TokenCard({ balance, prefs }: TokenCardProps) {
  const { isOnline } = useConnectivity();
  const isStale = Date.now() - balance.lastUpdated > 300_000;
  const change = balance.previousAmount ? percentChange(balance.amount, balance.previousAmount) : null;
  const rate = balance.fiatRates?.[prefs.currency];
  const formatted = formatAmount(balance.amount);

  return (
    <div
      className="card balance-card-advanced"
      role="region"
      aria-label={`${balance.tokenSymbol} balance`}
    >
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-sm">
          <span className="balance-token-symbol">{balance.tokenSymbol}</span>
          <AlertBadge balance={balance} enabled={prefs.alertsEnabled} />
        </div>
        <div className="flex items-center gap-sm">
          {!isOnline && <span className="offline-badge">📴 Cached</span>}
          {isOnline && isStale && <span className="offline-badge synced">✓ Synced</span>}
        </div>
      </div>

      {/* Main balance */}
      <div className="balance-amount" aria-label={`${formatted} ${balance.tokenSymbol}`}>
        <AnimatedNumber value={formatted} hidden={prefs.hideBalance} />
        {!prefs.hideBalance && (
          <span className="balance-symbol">{balance.tokenSymbol}</span>
        )}
      </div>

      {/* Fiat equivalent */}
      {prefs.showFiat && rate != null && !prefs.hideBalance && (
        <div className="balance-fiat">
          ≈ {formatFiat(balance.amount, rate, prefs.currency)}
        </div>
      )}

      {/* Change indicator */}
      {prefs.showChange && change != null && (
        <div className={`balance-change ${change >= 0 ? 'positive' : 'negative'}`} aria-label={`${change >= 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(2)} percent`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          {balance.previousUpdated && (
            <span className="balance-change-since"> vs {timeAgo(balance.previousUpdated)}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="balance-last-updated">
        Updated {timeAgo(balance.lastUpdated)}
        {!isOnline && ' (offline)'}
      </div>
    </div>
  );
}

// ─── Portfolio summary ────────────────────────────────────────────────────────

function PortfolioSummary({ balances, prefs }: { balances: Balance[]; prefs: BalanceDisplayPreferences }) {
  const totalFiat = balances.reduce((sum, b) => {
    const rate = b.fiatRates?.[prefs.currency];
    return rate != null ? sum + stroopsToFloat(b.amount) * rate : sum;
  }, 0);

  const hasFiat = balances.some(b => b.fiatRates?.[prefs.currency] != null);

  return (
    <div className="card balance-portfolio-summary" role="region" aria-label="Portfolio summary">
      <div className="card-header">
        <span className="card-title">Portfolio</span>
        <span className="text-muted" style={{ fontSize: '0.875rem' }}>{balances.length} token{balances.length !== 1 ? 's' : ''}</span>
      </div>
      {hasFiat && !prefs.hideBalance && (
        <div className="balance-portfolio-total">
          {totalFiat.toLocaleString(undefined, { style: 'currency', currency: prefs.currency })}
          <span className="balance-portfolio-label">Total {prefs.currency} value</span>
        </div>
      )}
    </div>
  );
}

// ─── Preferences panel ───────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'BTC'];

function PreferencesPanel({ prefs, update }: { prefs: BalanceDisplayPreferences; update: (p: Partial<BalanceDisplayPreferences>) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="balance-prefs-wrapper">
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="balance-prefs-panel"
      >
        ⚙ Display Options
      </button>

      {open && (
        <div id="balance-prefs-panel" className="card balance-prefs-panel" role="dialog" aria-label="Balance display preferences">
          <div className="card-header">
            <span className="card-title">Display Preferences</span>
            <button className="btn btn-secondary" onClick={() => setOpen(false)} aria-label="Close preferences">✕</button>
          </div>

          <div className="flex flex-col gap-sm">
            {/* Currency */}
            <label className="form-label" htmlFor="currency-select">Currency</label>
            <select
              id="currency-select"
              className="form-input"
              value={prefs.currency}
              onChange={e => update({ currency: e.target.value })}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Toggles */}
            {(
              [
                ['showFiat', 'Show fiat equivalent'],
                ['showChange', 'Show % change'],
                ['hideBalance', 'Hide balance amounts'],
                ['alertsEnabled', 'Low balance alerts'],
              ] as [keyof BalanceDisplayPreferences, string][]
            ).map(([key, label]) => (
              <label key={key} className="balance-prefs-toggle" htmlFor={`pref-${key}`}>
                <input
                  id={`pref-${key}`}
                  type="checkbox"
                  checked={prefs[key] as boolean}
                  onChange={e => update({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface AdvancedBalanceDisplayProps {
  balances: Balance[];
  emptyMessage?: string;
}

/**
 * AdvancedBalanceDisplay
 *
 * Sophisticated token balance display with:
 * - Animated real-time updates
 * - Multi-currency fiat conversion
 * - Historical % change with trend indicator
 * - Portfolio aggregation
 * - Low-balance alerts
 * - User-configurable display preferences (persisted to localStorage)
 * - Accessible markup (ARIA roles, live regions, labels)
 * - Responsive grid layout
 */
export function AdvancedBalanceDisplay({ balances, emptyMessage = 'No balances available.' }: AdvancedBalanceDisplayProps) {
  const [prefs, update] = useBalancePreferences();

  return (
    <div className="advanced-balance-root">
      {/* Controls row */}
      <div className="flex items-center justify-between mb-md" style={{ flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
        <h2>Token Balances</h2>
        <PreferencesPanel prefs={prefs} update={update} />
      </div>

      {balances.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <p className="text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <PortfolioSummary balances={balances} prefs={prefs} />
          <div className="grid grid-2 mt-md">
            {balances.map(b => (
              <TokenCard key={b.id} balance={b} prefs={prefs} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdvancedBalanceDisplay;
