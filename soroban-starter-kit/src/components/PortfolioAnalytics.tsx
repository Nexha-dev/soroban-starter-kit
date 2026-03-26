import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FinancialChart } from './FinancialChart';
import { useStorage } from '../context/StorageContext';
import { useTransactionQueue } from '../context/TransactionQueueContext';
import { DataPoint, OHLCPoint } from '../services/visualization/types';
import { createWebSocketManager } from '../services/visualization';

// ─── Constants ────────────────────────────────────────────────────────────────

const STROOPS = 10_000_000;
const PALETTE = ['#e94560', '#00d26a', '#ffc107', '#4fc3f7', '#ce93d8', '#ffb74d', '#80cbc4'];
const CURRENCIES = ['USD', 'EUR', 'GBP'];
const toFloat = (s: string | number) => Number(s) / STROOPS;

function fmtFiat(n: number, currency: string) {
  return n.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
}
function fmtNum(n: number, d = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── Demo OHLC generator ──────────────────────────────────────────────────────

function generateOHLC(basePrice: number, days = 30): OHLCPoint[] {
  const now = Date.now();
  let price = basePrice;
  return Array.from({ length: days }, (_, i) => {
    const ts = now - (days - 1 - i) * 86_400_000;
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.04;
    const close = Math.max(0.001, open + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.random() * 1_000_000;
    price = close;
    return { timestamp: ts, open, high, low, close, volume };
  });
}

// ─── Demo time-series generator ───────────────────────────────────────────────

function generateSeries(baseValue: number, points = 60, spanMs = 30 * 86_400_000): DataPoint[] {
  const now = Date.now();
  let v = baseValue;
  return Array.from({ length: points }, (_, i) => {
    v = Math.max(0, v + (Math.random() - 0.48) * v * 0.03);
    return { timestamp: now - spanMs + (i / (points - 1)) * spanMs, value: v };
  });
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, positive, icon }: {
  label: string; value: string; sub?: string; positive?: boolean; icon?: string;
}) {
  return (
    <div className="card" style={{ padding: '14px 18px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{icon && `${icon} `}{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: positive === true ? 'var(--color-success)' : positive === false ? 'var(--color-error)' : 'var(--color-text-primary)',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Comparative bar chart (SVG) ──────────────────────────────────────────────

function ComparativeBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const pct = (Math.abs(item.value) / max) * 100;
        const isNeg = item.value < 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 60, fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right', flexShrink: 0 }}>{item.label}</span>
            <div style={{ flex: 1, height: 18, background: 'var(--color-bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: isNeg ? 'var(--color-error)' : item.color,
                borderRadius: 4, transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ width: 70, fontSize: 12, color: isNeg ? 'var(--color-error)' : 'var(--color-success)', textAlign: 'right', flexShrink: 0 }}>
              {isNeg ? '' : '+'}{fmtNum(item.value)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Volume chart (SVG) ───────────────────────────────────────────────────────

function VolumeChart({ ohlc, w = 400, h = 60 }: { ohlc: OHLCPoint[]; w?: number; h?: number }) {
  if (!ohlc.length) return null;
  const maxVol = Math.max(...ohlc.map(p => p.volume ?? 0), 1);
  const bw = Math.max(2, (w / ohlc.length) * 0.7);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="Volume chart" style={{ display: 'block' }}>
      {ohlc.map((p, i) => {
        const x = (i / (ohlc.length - 1)) * (w - bw) + bw / 2;
        const barH = ((p.volume ?? 0) / maxVol) * (h - 4);
        const bullish = p.close >= p.open;
        return (
          <rect key={i} x={x - bw / 2} y={h - barH} width={bw} height={barH}
            fill={bullish ? 'var(--color-success)' : 'var(--color-error)'} opacity="0.5" rx="1" />
        );
      })}
    </svg>
  );
}

// ─── Real-time hook ───────────────────────────────────────────────────────────

function useRealtimeData(wsUrl?: string) {
  const [livePoint, setLivePoint] = useState<DataPoint | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!wsUrl) return;
    const mgr = createWebSocketManager(wsUrl);
    mgr.connect()
      .then(() => {
        setIsConnected(true);
        mgr.subscribe('price', msg => {
          setLivePoint({ timestamp: msg.timestamp, value: typeof msg.data.value === 'number' ? msg.data.value : 0 });
        });
      })
      .catch(() => setIsConnected(false));
    return () => { mgr.disconnect(); setIsConnected(false); };
  }, [wsUrl]);

  return { livePoint, isConnected };
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PortfolioAnalyticsProps {
  wsUrl?: string;
}

export function PortfolioAnalytics({ wsUrl }: PortfolioAnalyticsProps): JSX.Element {
  const { balances } = useStorage();
  const { pendingTransactions, syncedTransactions } = useTransactionQueue();
  const allTxs = useMemo(() => [...pendingTransactions, ...syncedTransactions], [pendingTransactions, syncedTransactions]);

  const [currency, setCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'transactions' | 'candlestick'>('overview');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const { livePoint, isConnected } = useRealtimeData(wsUrl);

  // Build per-token series from balance history (or demo data)
  const tokenSeries = useMemo(() => {
    return balances.map((b, i) => {
      const base = toFloat(b.amount);
      const prev = b.previousAmount ? toFloat(b.previousAmount) : base * 0.95;
      const series = generateSeries(prev, 60, 30 * 86_400_000).map((p, j, arr) => ({
        ...p,
        value: prev + ((base - prev) * j) / (arr.length - 1) + (Math.random() - 0.5) * base * 0.02,
      }));
      return { symbol: b.tokenSymbol, color: PALETTE[i % PALETTE.length], series, balance: b };
    });
  }, [balances]);

  // Portfolio value series (sum across tokens)
  const portfolioSeries = useMemo((): DataPoint[] => {
    if (!tokenSeries.length) return generateSeries(1000, 60);
    const len = tokenSeries[0].series.length;
    return tokenSeries[0].series.map((p, i) => ({
      timestamp: p.timestamp,
      value: tokenSeries.reduce((sum, t) => {
        const rate = t.balance.fiatRates?.[currency] ?? 1;
        return sum + (t.series[i]?.value ?? 0) * rate;
      }, 0),
    }));
  }, [tokenSeries, currency]);

  // Transaction volume series
  const txVolumeSeries = useMemo((): DataPoint[] => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const ts = Date.now() - (29 - i) * 86_400_000;
      const dayStart = new Date(ts).setHours(0, 0, 0, 0);
      return {
        timestamp: dayStart,
        value: allTxs.filter(t => t.createdAt >= dayStart && t.createdAt < dayStart + 86_400_000).length,
      };
    });
    return days;
  }, [allTxs]);

  // Comparative performance
  const comparative = useMemo(() => tokenSeries.map(t => {
    const first = t.series[0]?.value ?? 0;
    const last = t.series[t.series.length - 1]?.value ?? 0;
    return { label: t.symbol, value: first > 0 ? ((last - first) / first) * 100 : 0, color: t.color };
  }), [tokenSeries]);

  // OHLC for selected token
  const ohlcData = useMemo((): OHLCPoint[] => {
    const token = tokenSeries.find(t => t.symbol === selectedToken) ?? tokenSeries[0];
    if (!token) return generateOHLC(1.0, 60);
    return generateOHLC(toFloat(token.balance.amount), 60);
  }, [tokenSeries, selectedToken]);

  // KPIs
  const totalValue = useMemo(() =>
    balances.reduce((s, b) => s + toFloat(b.amount) * (b.fiatRates?.[currency] ?? 0), 0),
    [balances, currency]);

  const totalPnl = useMemo(() =>
    balances.reduce((s, b) => {
      const cur = toFloat(b.amount); const prev = b.previousAmount ? toFloat(b.previousAmount) : cur;
      return s + (cur - prev) * (b.fiatRates?.[currency] ?? 0);
    }, 0),
    [balances, currency]);

  const winRate = useMemo(() => {
    const synced = allTxs.filter(t => t.status === 'synced').length;
    return allTxs.length > 0 ? (synced / allTxs.length) * 100 : 0;
  }, [allTxs]);

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'candlestick', label: 'Price Chart' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Portfolio Analytics</h2>
          {wsUrl && (
            <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: isConnected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'inline-block' }} />
              {isConnected ? 'Live' : 'Offline'}
            </span>
          )}
        </div>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          aria-label="Currency"
          style={{ padding: '6px 10px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KpiCard icon="💼" label="Total Value" value={fmtFiat(totalValue, currency)} />
        <KpiCard icon="📈" label="P&L" value={fmtFiat(totalPnl, currency)} positive={totalPnl >= 0} sub={totalValue > 0 ? `${fmtNum((totalPnl / totalValue) * 100)}%` : undefined} />
        <KpiCard icon="🪙" label="Tokens" value={String(balances.length)} />
        <KpiCard icon="✓" label="Tx Success" value={`${fmtNum(winRate)}%`} positive={winRate >= 80} sub={`${allTxs.length} total`} />
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === t.key ? 'var(--color-highlight)' : 'var(--color-text-muted)',
              borderBottom: activeTab === t.key ? '2px solid var(--color-highlight)' : '2px solid transparent',
              fontWeight: activeTab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Portfolio Value</div>
            <FinancialChart
              config={{ type: 'area', title: 'Portfolio Value', dataKey: 'portfolio', color: 'var(--color-highlight)', showGrid: true, showTooltip: true, animated: true }}
              data={portfolioSeries}
              height={240}
              showTrend
              liveData={livePoint}
            />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Comparative Performance (30d)</div>
            {comparative.length > 0
              ? <ComparativeBar items={comparative} />
              : <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No token data</p>
            }
          </div>
        </div>
      )}

      {activeTab === 'tokens' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tokenSeries.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <FinancialChart
                config={{ type: 'line', title: 'Demo Token Series', dataKey: 'demo', color: PALETTE[0], showGrid: true, showTooltip: true }}
                data={generateSeries(1.0, 60)}
                height={200}
                showTrend
              />
            </div>
          )}
          {tokenSeries.map((t, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <FinancialChart
                config={{ type: 'area', title: t.symbol, dataKey: t.symbol, color: t.color, showGrid: true, showTooltip: true }}
                data={t.series}
                height={180}
                showTrend
                liveData={selectedToken === t.symbol ? livePoint : null}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <FinancialChart
              config={{ type: 'bar', title: 'Daily Transaction Volume (30d)', dataKey: 'txVolume', color: 'var(--color-highlight)', showGrid: true, showTooltip: true }}
              data={txVolumeSeries}
              height={220}
            />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Transaction Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {(['pending', 'synced', 'failed', 'conflict'] as const).map(status => {
                const count = allTxs.filter(t => t.status === status).length;
                const colors: Record<string, string> = { pending: 'var(--color-warning)', synced: 'var(--color-success)', failed: 'var(--color-error)', conflict: 'var(--color-highlight)' };
                return (
                  <div key={status} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${colors[status]}` }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{status}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: colors[status] }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'candlestick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tokenSeries.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tokenSeries.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => setSelectedToken(t.symbol)}
                  style={{
                    padding: '4px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: '1px solid',
                    borderColor: selectedToken === t.symbol ? t.color : 'var(--color-border)',
                    background: selectedToken === t.symbol ? t.color + '22' : 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          )}
          <div className="card" style={{ padding: 16 }}>
            <FinancialChart
              config={{ type: 'candlestick', title: `${selectedToken ?? (tokenSeries[0]?.symbol ?? 'Token')} Price`, dataKey: 'ohlc', showGrid: true, showTooltip: true }}
              data={ohlcData.map(p => ({ timestamp: p.timestamp, value: p.close }))}
              ohlcData={ohlcData}
              height={280}
            />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Volume</div>
            <VolumeChart ohlc={ohlcData} h={60} />
          </div>
        </div>
      )}
    </div>
  );
}
