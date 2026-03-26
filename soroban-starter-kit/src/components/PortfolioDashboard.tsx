import React, { useMemo, useState } from 'react';
import { Balance, CachedTransaction } from '../services/storage/types';
import { useStorage } from '../context/StorageContext';
import { useTransactionQueue } from '../context/TransactionQueueContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const STROOPS = 10_000_000;
const PALETTE = ['#e94560', '#00d26a', '#ffc107', '#4fc3f7', '#ce93d8', '#ffb74d', '#80cbc4'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toFloat = (s: string | number) => Number(s) / STROOPS;

function fmtNum(n: number, decimals = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtFiat(n: number, currency: string) {
  return n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | 'all';
type Widget = 'allocation' | 'performance' | 'activity' | 'metrics';

const TIME_LABELS: Record<TimeRange, string> = { '7d': '7 Days', '30d': '30 Days', 'all': 'All Time' };

// ─── SVG Donut chart ──────────────────────────────────────────────────────────

interface DonutSlice { label: string; value: number; color: string; }

function DonutChart({ slices, size = 160 }: { slices: DonutSlice[]; size?: number }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-muted" style={{ textAlign: 'center' }}>No data</p>;

  const r = 56; const cx = size / 2; const cy = size / 2;
  let cumAngle = -Math.PI / 2;

  const paths = slices.map((slice, i) => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return (
      <path
        key={i}
        d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
        fill={slice.color}
        opacity={0.9}
      >
        <title>{slice.label}: {fmtNum((slice.value / total) * 100)}%</title>
      </path>
    );
  });

  return (
    <svg width={size} height={size} role="img" aria-label="Token allocation donut chart" viewBox={`0 0 ${size} ${size}`}>
      {paths}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--color-bg-secondary)" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-text-primary)" fontSize="13" fontWeight="700">
        {slices.length}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">
        tokens
      </text>
    </svg>
  );
}

// ─── SVG Sparkline ────────────────────────────────────────────────────────────

function Sparkline({ points, color = '#e94560', width = 200, height = 48 }: {
  points: number[]; color?: string; width?: number; height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points); const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map(p => height - ((p - min) / range) * (height - 8) - 4);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const fill = `${d} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── SVG Bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, width = 300, height = 80 }: { data: { label: string; value: number }[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const bw = Math.floor((width - (data.length - 1) * 4) / data.length);

  return (
    <svg width={width} height={height} role="img" aria-label="Activity bar chart" style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / max) * (height - 16));
        const x = i * (bw + 4);
        return (
          <g key={i}>
            <rect x={x} y={height - bh - 12} width={bw} height={bh} rx="2" fill="var(--color-highlight)" opacity="0.8" />
            <text x={x + bw / 2} y={height - 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="8">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Derived analytics ────────────────────────────────────────────────────────

function useAnalytics(balances: Balance[], txs: CachedTransaction[], range: TimeRange, currency: string) {
  return useMemo(() => {
    const now = Date.now();
    const cutoff = range === '7d' ? now - 7 * 86400000 : range === '30d' ? now - 30 * 86400000 : 0;

    // Allocation slices
    const allocation: DonutSlice[] = balances.map((b, i) => ({
      label: b.tokenSymbol,
      value: toFloat(b.amount),
      color: PALETTE[i % PALETTE.length],
    }));

    // Total fiat value
    const totalFiat = balances.reduce((sum, b) => {
      const rate = b.fiatRates?.[currency] ?? 0;
      return sum + toFloat(b.amount) * rate;
    }, 0);

    // P&L per token
    const pnl = balances.map((b, i) => {
      const cur = toFloat(b.amount);
      const prev = b.previousAmount ? toFloat(b.previousAmount) : cur;
      const rate = b.fiatRates?.[currency] ?? 0;
      const change = (cur - prev) * rate;
      const pct = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
      return { symbol: b.tokenSymbol, change, pct, color: PALETTE[i % PALETTE.length] };
    });

    const totalPnl = pnl.reduce((s, p) => s + p.change, 0);

    // Activity by day (last 7 days)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), ts: d.setHours(0, 0, 0, 0) };
    });
    const activity = days.map(day => ({
      label: day.label,
      value: txs.filter(t => t.createdAt >= day.ts && t.createdAt < day.ts + 86400000).length,
    }));

    // Filtered txs for range
    const filteredTxs = txs.filter(t => t.createdAt >= cutoff);

    // Sparkline: simulate portfolio value over 7 points using previousAmount → amount
    const sparkPoints = balances.length > 0
      ? Array.from({ length: 7 }, (_, i) => {
          const frac = i / 6;
          return balances.reduce((sum, b) => {
            const prev = b.previousAmount ? toFloat(b.previousAmount) : toFloat(b.amount);
            const cur = toFloat(b.amount);
            const rate = b.fiatRates?.[currency] ?? 1;
            return sum + (prev + (cur - prev) * frac) * rate;
          }, 0);
        })
      : [];

    // Diversification: Herfindahl index (0=concentrated, 1=diversified)
    const total = allocation.reduce((s, a) => s + a.value, 0);
    const hhi = total > 0
      ? allocation.reduce((s, a) => s + Math.pow(a.value / total, 2), 0)
      : 1;
    const diversification = Math.round((1 - hhi) * 100);

    return { allocation, totalFiat, pnl, totalPnl, activity, sparkPoints, diversification, filteredTxs };
  }, [balances, txs, range, currency]);
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="dash-metric-card">
      <span className="dash-metric-label">{label}</span>
      <span className={`dash-metric-value${positive === true ? ' positive' : positive === false ? ' negative' : ''}`}>{value}</span>
      {sub && <span className="dash-metric-sub">{sub}</span>}
    </div>
  );
}

// ─── Widget: Allocation ───────────────────────────────────────────────────────

function AllocationWidget({ allocation, totalFiat, currency }: { allocation: DonutSlice[]; totalFiat: number; currency: string }) {
  return (
    <div className="card dash-widget" role="region" aria-label="Token allocation">
      <div className="card-header"><span className="card-title">Allocation</span></div>
      <div className="dash-donut-row">
        <DonutChart slices={allocation} />
        <div className="dash-legend">
          {allocation.map((s, i) => (
            <div key={i} className="dash-legend-item">
              <span className="dash-legend-dot" style={{ background: s.color }} />
              <span className="dash-legend-label">{s.label}</span>
              <span className="dash-legend-pct">{allocation.reduce((t, a) => t + a.value, 0) > 0 ? fmtNum((s.value / allocation.reduce((t, a) => t + a.value, 0)) * 100) : '0.00'}%</span>
            </div>
          ))}
          {allocation.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>No tokens</p>}
        </div>
      </div>
      {totalFiat > 0 && (
        <p className="dash-total-fiat">{fmtFiat(totalFiat, currency)} total</p>
      )}
    </div>
  );
}

// ─── Widget: Performance ──────────────────────────────────────────────────────

function PerformanceWidget({ sparkPoints, totalPnl, pnl, currency }: {
  sparkPoints: number[]; totalPnl: number; pnl: { symbol: string; change: number; pct: number; color: string }[]; currency: string;
}) {
  return (
    <div className="card dash-widget" role="region" aria-label="Performance">
      <div className="card-header">
        <span className="card-title">Performance</span>
        <span className={`dash-pnl-badge${totalPnl >= 0 ? ' positive' : ' negative'}`}>
          {totalPnl >= 0 ? '▲' : '▼'} {fmtFiat(Math.abs(totalPnl), currency)}
        </span>
      </div>
      {sparkPoints.length >= 2 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Sparkline points={sparkPoints} color={totalPnl >= 0 ? '#00d26a' : '#dc3545'} width={300} height={56} />
        </div>
      )}
      <div className="dash-pnl-list">
        {pnl.map((p, i) => (
          <div key={i} className="dash-pnl-row">
            <span className="dash-legend-dot" style={{ background: p.color }} />
            <span style={{ flex: 1 }}>{p.symbol}</span>
            <span className={p.pct >= 0 ? 'text-success' : 'text-error'} style={{ fontSize: '0.85rem' }}>
              {p.pct >= 0 ? '+' : ''}{fmtNum(p.pct)}%
            </span>
            <span className={`dash-pnl-fiat${p.change >= 0 ? ' positive' : ' negative'}`}>
              {p.change >= 0 ? '+' : ''}{fmtFiat(p.change, currency)}
            </span>
          </div>
        ))}
        {pnl.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>No data</p>}
      </div>
    </div>
  );
}

// ─── Widget: Activity ─────────────────────────────────────────────────────────

function ActivityWidget({ activity, filteredTxs }: { activity: { label: string; value: number }[]; filteredTxs: CachedTransaction[] }) {
  const synced = filteredTxs.filter(t => t.status === 'synced').length;
  const failed = filteredTxs.filter(t => t.status === 'failed').length;

  return (
    <div className="card dash-widget" role="region" aria-label="Transaction activity">
      <div className="card-header"><span className="card-title">Activity (7d)</span></div>
      <BarChart data={activity} height={72} />
      <div className="dash-activity-stats">
        <span className="text-success">✓ {synced} synced</span>
        <span className="text-error">✕ {failed} failed</span>
        <span className="text-muted">{filteredTxs.length} total</span>
      </div>
    </div>
  );
}

// ─── Widget: Metrics ──────────────────────────────────────────────────────────

function MetricsWidget({ totalFiat, totalPnl, diversification, tokenCount, currency }: {
  totalFiat: number; totalPnl: number; diversification: number; tokenCount: number; currency: string;
}) {
  const suggestion = diversification < 30
    ? '⚠ Portfolio is highly concentrated. Consider diversifying.'
    : diversification < 60
    ? '📊 Moderate diversification. Room to spread risk.'
    : '✓ Well-diversified portfolio.';

  return (
    <div className="card dash-widget" role="region" aria-label="Portfolio metrics">
      <div className="card-header"><span className="card-title">Metrics</span></div>
      <div className="dash-metrics-grid">
        <MetricCard label="Total Value" value={fmtFiat(totalFiat, currency)} />
        <MetricCard label="P&L" value={fmtFiat(totalPnl, currency)} positive={totalPnl >= 0} />
        <MetricCard label="Diversification" value={`${diversification}%`} sub={diversification >= 60 ? 'Good' : diversification >= 30 ? 'Moderate' : 'Low'} />
        <MetricCard label="Tokens" value={String(tokenCount)} />
      </div>
      <div className="dash-suggestion">{suggestion}</div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportCSV(balances: Balance[], currency: string) {
  const rows = [
    ['Symbol', 'Amount', `Value (${currency})`, 'Change %', 'Last Updated'],
    ...balances.map(b => {
      const amt = toFloat(b.amount);
      const rate = b.fiatRates?.[currency] ?? 0;
      const prev = b.previousAmount ? toFloat(b.previousAmount) : amt;
      const pct = prev > 0 ? ((amt - prev) / prev * 100).toFixed(2) : '0.00';
      return [b.tokenSymbol, fmtNum(amt, 7), fmtNum(amt * rate), pct, new Date(b.lastUpdated).toISOString()];
    }),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `portfolio-${Date.now()}.csv`;
  a.click();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const ALL_WIDGETS: Widget[] = ['metrics', 'allocation', 'performance', 'activity'];
const WIDGET_LABELS: Record<Widget, string> = { metrics: 'Metrics', allocation: 'Allocation', performance: 'Performance', activity: 'Activity' };
const CURRENCIES = ['USD', 'EUR', 'GBP'];

export function PortfolioDashboard() {
  const { balances } = useStorage();
  const { pendingTransactions, syncedTransactions } = useTransactionQueue();
  const allTxs = [...pendingTransactions, ...syncedTransactions];

  const [range, setRange] = useState<TimeRange>('7d');
  const [currency, setCurrency] = useState('USD');
  const [visibleWidgets, setVisibleWidgets] = useState<Widget[]>([...ALL_WIDGETS]);

  const { allocation, totalFiat, pnl, totalPnl, activity, sparkPoints, diversification, filteredTxs } = useAnalytics(balances, allTxs, range, currency);

  const toggleWidget = (w: Widget) =>
    setVisibleWidgets(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  return (
    <div className="dash-root">
      {/* Toolbar */}
      <div className="dash-toolbar">
        <h2>Portfolio Analytics</h2>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Time range */}
          <div className="dash-btn-group" role="group" aria-label="Time range">
            {(Object.keys(TIME_LABELS) as TimeRange[]).map(r => (
              <button key={r} className={`btn btn-secondary dash-range-btn${range === r ? ' active' : ''}`} onClick={() => setRange(r)} aria-pressed={range === r}>
                {TIME_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Currency */}
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px' }} value={currency} onChange={e => setCurrency(e.target.value)} aria-label="Currency">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Export */}
          <button className="btn btn-secondary" onClick={() => exportCSV(balances, currency)} aria-label="Export CSV">
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Widget toggles */}
      <div className="dash-widget-toggles" role="group" aria-label="Toggle widgets">
        {ALL_WIDGETS.map(w => (
          <label key={w} className="balance-prefs-toggle" htmlFor={`dash-toggle-${w}`}>
            <input id={`dash-toggle-${w}`} type="checkbox" checked={visibleWidgets.includes(w)} onChange={() => toggleWidget(w)} />
            {WIDGET_LABELS[w]}
          </label>
        ))}
      </div>

      {/* Widget grid */}
      <div className="dash-grid">
        {visibleWidgets.includes('metrics') && (
          <MetricsWidget totalFiat={totalFiat} totalPnl={totalPnl} diversification={diversification} tokenCount={balances.length} currency={currency} />
        )}
        {visibleWidgets.includes('allocation') && (
          <AllocationWidget allocation={allocation} totalFiat={totalFiat} currency={currency} />
        )}
        {visibleWidgets.includes('performance') && (
          <PerformanceWidget sparkPoints={sparkPoints} totalPnl={totalPnl} pnl={pnl} currency={currency} />
        )}
        {visibleWidgets.includes('activity') && (
          <ActivityWidget activity={activity} filteredTxs={filteredTxs} />
        )}
      </div>

      {balances.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="text-muted">No token data available. Balances will appear here once cached.</p>
        </div>
      )}
    </div>
  );
}

export default PortfolioDashboard;
