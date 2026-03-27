/**
 * AnalyticsPanel — portfolio analytics with sparkline, P&L, bar chart, diversification score.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import React, { useMemo, useState } from 'react';
import { Balance, CachedTransaction } from '../../services/storage/types';
import {
  computePnL,
  computeDiversificationScore,
  filterByTimeRange,
  TimeRange,
  toFloat,
} from '../../utils/analyticsCompute';
import { exportAnalyticsCSV } from '../../utils/exportCSV';

const STROOPS = 10_000_000;

function fmtNum(n: number, d = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Inline SVG Sparkline ──────────────────────────────────────────────────────

function Sparkline({ points, color = '#e94560', width = 200, height = 48 }: {
  points: number[]; color?: string; width?: number; height?: number;
}) {
  if (points.length < 2) return <p className="text-muted" style={{ fontSize: '0.8rem' }}>Not enough data</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((p) => height - ((p - min) / range) * (height - 8) - 4);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const fill = `${d} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', width: '100%' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Inline SVG Bar Chart ──────────────────────────────────────────────────────

function BarChart({ data, width = 300, height = 80 }: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = Math.floor((width - (data.length - 1) * 4) / data.length);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Transaction activity bar chart"
      style={{ display: 'block', width: '100%' }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / max) * (height - 16));
        const x = i * (bw + 4);
        return (
          <g key={i}>
            <rect
              x={x}
              y={height - bh - 12}
              width={bw}
              height={bh}
              rx="2"
              fill="var(--color-highlight, #6366f1)"
              opacity="0.8"
            />
            <text
              x={x + bw / 2}
              y={height - 2}
              textAnchor="middle"
              fill="var(--color-text-muted, #9ca3af)"
              fontSize="8"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── AnalyticsPanel ────────────────────────────────────────────────────────────

export interface AnalyticsPanelProps {
  balances: Balance[];
  transactions: CachedTransaction[];
  currency: string;
}

export function AnalyticsPanel({ balances, transactions, currency }: AnalyticsPanelProps): JSX.Element {
  const [range, setRange] = useState<TimeRange>('7d');

  const filteredTxs = useMemo(() => filterByTimeRange(transactions, range), [transactions, range]);

  // Sparkline: 7 interpolated portfolio value points from previousAmount → amount
  const sparkPoints = useMemo(() => {
    if (balances.length === 0) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const frac = i / 6;
      return balances.reduce((sum, b) => {
        const prev = b.previousAmount !== undefined ? toFloat(b.previousAmount) : toFloat(b.amount);
        const cur = toFloat(b.amount);
        const rate = b.fiatRates?.[currency] ?? 1;
        return sum + (prev + (cur - prev) * frac) * rate;
      }, 0);
    });
  }, [balances, currency]);

  // P&L per token
  const pnlData = useMemo(
    () => balances.map((b) => ({ symbol: b.tokenSymbol, pnl: computePnL(b, currency) })),
    [balances, currency],
  );

  // Transaction activity bar chart (last 7 days)
  const activityData = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86_400_000);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const value = filteredTxs.filter(
        (t) => t.createdAt >= start && t.createdAt < start + 86_400_000,
      ).length;
      return { label, value };
    });
  }, [filteredTxs]);

  const diversificationScore = useMemo(() => computeDiversificationScore(balances), [balances]);

  const totalPnl = pnlData.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="tmd-analytics-panel">
      {/* Time range selector */}
      <div className="tmd-analytics-toolbar">
        <div className="dash-btn-group" role="group" aria-label="Time range">
          {(['7d', '30d', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              className={`btn btn-secondary dash-range-btn${range === r ? ' active' : ''}`}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => exportAnalyticsCSV(balances, currency)}
          aria-label="Export analytics CSV"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Portfolio value sparkline */}
      <section className="tmd-analytics-section" aria-label="Portfolio value trend">
        <h4>Portfolio Value Trend</h4>
        <Sparkline points={sparkPoints} color={totalPnl >= 0 ? '#00d26a' : '#dc3545'} width={300} height={56} />
      </section>

      {/* P&L summary */}
      <section className="tmd-analytics-section" aria-label="Profit and loss">
        <h4>P&amp;L Summary</h4>
        {pnlData.length === 0 ? (
          <p className="text-muted">No data available.</p>
        ) : (
          <ul className="tmd-pnl-list">
            {pnlData.map(({ symbol, pnl }) => (
              <li key={symbol} className="tmd-pnl-row">
                <span>{symbol}</span>
                <span className={pnl >= 0 ? 'text-success' : 'text-error'}>
                  {pnl >= 0 ? '+' : ''}{fmtNum(pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Transaction activity bar chart */}
      <section className="tmd-analytics-section" aria-label="Transaction activity">
        <h4>Transaction Activity (7d)</h4>
        <BarChart data={activityData} height={72} />
      </section>

      {/* Diversification score */}
      <section className="tmd-analytics-section" aria-label="Diversification score">
        <h4>Diversification Score</h4>
        <div className="tmd-diversification">
          <span className="tmd-diversification-score">{diversificationScore}</span>
          <span className="tmd-diversification-label">/ 100</span>
          <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
            {diversificationScore >= 60 ? '✓ Well diversified' : diversificationScore >= 30 ? '📊 Moderate' : '⚠ Concentrated'}
          </span>
        </div>
      </section>
    </div>
  );
}

export default AnalyticsPanel;
