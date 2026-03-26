import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartConfig, ChartTooltip, DataPoint, OHLCPoint, TrendMetrics } from '../services/visualization/types';
import { DataAggregator } from '../services/visualization/dataAggregator';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAD = { top: 20, right: 16, bottom: 36, left: 56 };
const GRID_LINES = 5;
const TICK_COUNT = 6;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function niceRange(min: number, max: number): [number, number] {
  const range = max - min || 1;
  const pad = range * 0.08;
  return [min - pad, max + pad];
}

function fmtVal(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(2);
}

function fmtTime(ts: number, span: number): string {
  const d = new Date(ts);
  if (span < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (span < 30 * 86_400_000) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
}

function calcTrend(data: DataPoint[]): TrendMetrics {
  if (data.length < 2) return { slope: 0, rSquared: 0, direction: 'flat', changePercent: 0, volatility: 0 };
  const n = data.length;
  const xs = data.map((_, i) => i);
  const ys = data.map(d => d.value);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const ssXY = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const ssXX = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const predicted = xs.map(x => yMean + slope * (x - xMean));
  const ssRes = ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const first = ys[0]; const last = ys[n - 1];
  const changePercent = first === 0 ? 0 : ((last - first) / first) * 100;
  const diffs = ys.slice(1).map((y, i) => y - ys[i]);
  const diffMean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const volatility = Math.sqrt(diffs.reduce((s, d) => s + (d - diffMean) ** 2, 0) / diffs.length);
  return {
    slope,
    rSquared,
    direction: Math.abs(changePercent) < 0.5 ? 'flat' : changePercent > 0 ? 'up' : 'down',
    changePercent,
    volatility,
  };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function exportChartSVG(svgEl: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.svg`;
  a.click();
}

export function exportChartPNG(svgEl: SVGSVGElement, filename: string) {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const img = new Image();
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svgEl.viewBox.baseVal.width * 2;
    canvas.height = svgEl.viewBox.baseVal.height * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${filename}.png`;
    a.click();
  };
  img.src = url;
}

export function exportChartCSV(data: DataPoint[], filename: string) {
  const rows = [['Timestamp', 'Date', 'Value'], ...data.map(p => [p.timestamp, new Date(p.timestamp).toISOString(), p.value])];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${filename}.csv`;
  a.click();
}

// ─── SVG sub-charts ───────────────────────────────────────────────────────────

interface PlotProps {
  data: DataPoint[];
  w: number; h: number;
  minY: number; maxY: number;
  color: string;
  animated?: boolean;
}

function toX(i: number, total: number, w: number) {
  return total <= 1 ? PAD.left : PAD.left + (i / (total - 1)) * (w - PAD.left - PAD.right);
}
function toY(v: number, minY: number, maxY: number, h: number) {
  const range = maxY - minY || 1;
  return PAD.top + (1 - (v - minY) / range) * (h - PAD.top - PAD.bottom);
}

function LinePlot({ data, w, h, minY, maxY, color, animated }: PlotProps) {
  const d = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length, w)},${toY(p.value, minY, maxY, h)}`).join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={animated ? { animation: 'chartDraw 0.6s ease-out' } : undefined}
    />
  );
}

function AreaPlot({ data, w, h, minY, maxY, color, animated }: PlotProps) {
  if (data.length < 2) return null;
  const baseY = toY(minY, minY, maxY, h);
  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i, data.length, w)},${toY(p.value, minY, maxY, h)}`).join(' ');
  const area = `${line} L${toX(data.length - 1, data.length, w)},${baseY} L${toX(0, data.length, w)},${baseY} Z`;
  const gradId = `area-grad-${color.replace('#', '')}`;
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} style={animated ? { animation: 'chartFade 0.6s ease-out' } : undefined} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function BarPlot({ data, w, h, minY, maxY, color }: PlotProps) {
  const chartW = w - PAD.left - PAD.right;
  const barW = Math.max(2, (chartW / data.length) * 0.7);
  const baseY = toY(Math.max(0, minY), minY, maxY, h);
  return (
    <>
      {data.map((p, i) => {
        const x = toX(i, data.length, w) - barW / 2;
        const y = toY(p.value, minY, maxY, h);
        const barH = Math.abs(baseY - y);
        const isNeg = p.value < 0;
        return (
          <rect
            key={i}
            x={x} y={isNeg ? baseY : y}
            width={barW} height={Math.max(1, barH)}
            rx="2"
            fill={isNeg ? 'var(--color-error)' : color}
            opacity="0.85"
          />
        );
      })}
    </>
  );
}

interface CandlestickPlotProps {
  data: OHLCPoint[];
  w: number; h: number;
  minY: number; maxY: number;
}

function CandlestickPlot({ data, w, h, minY, maxY }: CandlestickPlotProps) {
  const candleW = Math.max(3, ((w - PAD.left - PAD.right) / data.length) * 0.6);
  return (
    <>
      {data.map((p, i) => {
        const x = toX(i, data.length, w);
        const openY = toY(p.open, minY, maxY, h);
        const closeY = toY(p.close, minY, maxY, h);
        const highY = toY(p.high, minY, maxY, h);
        const lowY = toY(p.low, minY, maxY, h);
        const bullish = p.close >= p.open;
        const fill = bullish ? 'var(--color-success)' : 'var(--color-error)';
        const bodyTop = Math.min(openY, closeY);
        const bodyH = Math.max(1, Math.abs(closeY - openY));
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={x} y1={highY} x2={x} y2={lowY} stroke={fill} strokeWidth="1" />
            {/* Body */}
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={fill} rx="1" />
          </g>
        );
      })}
    </>
  );
}

// ─── Grid & Axes ──────────────────────────────────────────────────────────────

function GridAxes({ w, h, minY, maxY, timestamps, showGrid }: {
  w: number; h: number; minY: number; maxY: number; timestamps: number[]; showGrid: boolean;
}) {
  const yTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => minY + (i / GRID_LINES) * (maxY - minY));
  const span = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 86_400_000;
  const xStep = Math.max(1, Math.floor(timestamps.length / TICK_COUNT));
  const xTicks = timestamps.filter((_, i) => i % xStep === 0 || i === timestamps.length - 1);

  return (
    <>
      {/* Y grid + labels */}
      {yTicks.map((v, i) => {
        const y = toY(v, minY, maxY, h);
        return (
          <g key={i}>
            {showGrid && <line x1={PAD.left} y1={y} x2={w - PAD.right} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,4" />}
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="var(--color-text-muted)" fontSize="10">{fmtVal(v)}</text>
          </g>
        );
      })}
      {/* X ticks */}
      {xTicks.map((ts, i) => {
        const idx = timestamps.indexOf(ts);
        const x = toX(idx, timestamps.length, w);
        return (
          <text key={i} x={x} y={h - PAD.bottom + 14} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">
            {fmtTime(ts, span)}
          </text>
        );
      })}
      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={h - PAD.bottom} stroke="var(--color-border)" strokeWidth="1" />
      <line x1={PAD.left} y1={h - PAD.bottom} x2={w - PAD.right} y2={h - PAD.bottom} stroke="var(--color-border)" strokeWidth="1" />
    </>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ tip, w, h }: { tip: ChartTooltip; w: number; h: number }) {
  const boxW = 130; const boxH = 52;
  const tx = Math.min(tip.x + 12, w - boxW - 4);
  const ty = Math.max(tip.y - boxH / 2, PAD.top);
  return (
    <g>
      <line x1={tip.x} y1={PAD.top} x2={tip.x} y2={h - PAD.bottom} stroke="var(--color-border-light)" strokeWidth="1" strokeDasharray="3,3" />
      <rect x={tx} y={ty} width={boxW} height={boxH} rx="6" fill="var(--color-bg-tertiary)" stroke="var(--color-border-light)" strokeWidth="1" />
      <text x={tx + 8} y={ty + 16} fill="var(--color-text-muted)" fontSize="10">{tip.label}</text>
      <text x={tx + 8} y={ty + 34} fill="var(--color-text-primary)" fontSize="13" fontWeight="700">{fmtVal(tip.value)}</text>
    </g>
  );
}

// ─── Trend line overlay ───────────────────────────────────────────────────────

function TrendLine({ data, w, h, minY, maxY, trend }: {
  data: DataPoint[]; w: number; h: number; minY: number; maxY: number; trend: TrendMetrics;
}) {
  if (data.length < 2 || trend.direction === 'flat') return null;
  const n = data.length;
  const yMean = data.reduce((s, p) => s + p.value, 0) / n;
  const x0 = toX(0, n, w);
  const x1 = toX(n - 1, n, w);
  const y0 = toY(yMean + trend.slope * (-(n - 1) / 2), minY, maxY, h);
  const y1 = toY(yMean + trend.slope * ((n - 1) / 2), minY, maxY, h);
  const color = trend.direction === 'up' ? 'var(--color-success)' : 'var(--color-error)';
  return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.6" />;
}

// ─── Main FinancialChart component ────────────────────────────────────────────

export interface FinancialChartProps {
  config: ChartConfig;
  data: DataPoint[];
  ohlcData?: OHLCPoint[];
  height?: number;
  showTrend?: boolean;
  liveData?: DataPoint | null;
  onExport?: (format: 'csv' | 'svg' | 'png') => void;
}

export function FinancialChart({
  config,
  data,
  ohlcData,
  height = 280,
  showTrend = false,
  liveData,
  onExport,
}: FinancialChartProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [tooltip, setTooltip] = useState<ChartTooltip | null>(null);
  const [showTrendLine, setShowTrendLine] = useState(showTrend);

  // Merge live data into series
  const series = useMemo(() => {
    const base = DataAggregator.downsample(data, 200);
    if (!liveData) return base;
    const merged = [...base, liveData].sort((a, b) => a.timestamp - b.timestamp);
    return DataAggregator.downsample(merged, 200);
  }, [data, liveData]);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setW(Math.max(300, entry.contentRect.width));
    });
    ro.observe(containerRef.current);
    setW(containerRef.current.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const h = height;

  const { minY, maxY, timestamps } = useMemo(() => {
    if (config.type === 'candlestick' && ohlcData?.length) {
      const [mn, mx] = niceRange(Math.min(...ohlcData.map(p => p.low)), Math.max(...ohlcData.map(p => p.high)));
      return { minY: mn, maxY: mx, timestamps: ohlcData.map(p => p.timestamp) };
    }
    if (!series.length) return { minY: 0, maxY: 1, timestamps: [] };
    const vals = series.map(p => p.value);
    const [mn, mx] = niceRange(Math.min(...vals), Math.max(...vals));
    return { minY: mn, maxY: mx, timestamps: series.map(p => p.timestamp) };
  }, [series, ohlcData, config.type]);

  const trend = useMemo(() => calcTrend(series), [series]);
  const stats = useMemo(() => DataAggregator.calculateStats(series), [series]);
  const color = config.color || 'var(--color-highlight)';

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !series.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const chartW = w - PAD.left - PAD.right;
    const frac = Math.max(0, Math.min(1, (mx - PAD.left) / chartW));
    const idx = Math.round(frac * (series.length - 1));
    const p = series[idx];
    if (!p) return;
    setTooltip({
      x: toX(idx, series.length, w),
      y: toY(p.value, minY, maxY, h),
      value: p.value,
      label: fmtTime(p.timestamp, timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 86_400_000),
      timestamp: p.timestamp,
    });
  }, [series, w, h, minY, maxY, timestamps]);

  const handleExport = (format: 'csv' | 'svg' | 'png') => {
    const name = config.title.replace(/\s+/g, '_');
    if (format === 'csv') exportChartCSV(series, name);
    else if (format === 'svg' && svgRef.current) exportChartSVG(svgRef.current, name);
    else if (format === 'png' && svgRef.current) exportChartPNG(svgRef.current, name);
    onExport?.(format);
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{config.title}</span>
          {liveData && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-success)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {fmtVal(stats.min)} – {fmtVal(stats.max)} · avg {fmtVal(stats.avg)}
          </span>
          {series.length > 1 && (
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={showTrendLine} onChange={e => setShowTrendLine(e.target.checked)} style={{ margin: 0 }} />
              Trend
            </label>
          )}
          <ExportMenu onExport={handleExport} />
        </div>
      </div>

      {/* Trend badge */}
      {showTrendLine && series.length > 1 && (
        <div style={{ marginBottom: 6, fontSize: 11, color: trend.direction === 'up' ? 'var(--color-success)' : trend.direction === 'down' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '→'}{' '}
          {trend.changePercent >= 0 ? '+' : ''}{trend.changePercent.toFixed(2)}% · R²={trend.rSquared.toFixed(2)} · σ={fmtVal(trend.volatility)}
        </div>
      )}

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={`${config.title} chart`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <GridAxes w={w} h={h} minY={minY} maxY={maxY} timestamps={timestamps} showGrid={config.showGrid !== false} />

        {config.type === 'line' && series.length > 1 && (
          <LinePlot data={series} w={w} h={h} minY={minY} maxY={maxY} color={color} animated={config.animated} />
        )}
        {config.type === 'area' && series.length > 1 && (
          <AreaPlot data={series} w={w} h={h} minY={minY} maxY={maxY} color={color} animated={config.animated} />
        )}
        {config.type === 'bar' && series.length > 0 && (
          <BarPlot data={series} w={w} h={h} minY={minY} maxY={maxY} color={color} />
        )}
        {config.type === 'candlestick' && ohlcData && ohlcData.length > 0 && (
          <CandlestickPlot data={ohlcData} w={w} h={h} minY={minY} maxY={maxY} />
        )}

        {showTrendLine && config.type !== 'candlestick' && (
          <TrendLine data={series} w={w} h={h} minY={minY} maxY={maxY} trend={trend} />
        )}

        {tooltip && config.showTooltip !== false && (
          <Tooltip tip={tooltip} w={w} h={h} />
        )}

        {series.length === 0 && (
          <text x={w / 2} y={h / 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="13">No data</text>
        )}
      </svg>

      <style>{`
        @keyframes chartDraw { from { stroke-dashoffset: 1000; stroke-dasharray: 1000; } to { stroke-dashoffset: 0; } }
        @keyframes chartFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({ onExport }: { onExport: (f: 'csv' | 'svg' | 'png') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{ padding: '4px 10px', fontSize: 11, background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, cursor: 'pointer' }}
      >
        ↓ Export
      </button>
      {open && (
        <div
          role="menu"
          style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 6, zIndex: 100, minWidth: 100 }}
          onMouseLeave={() => setOpen(false)}
        >
          {(['csv', 'svg', 'png'] as const).map(f => (
            <button
              key={f}
              role="menuitem"
              onClick={() => { onExport(f); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: 'var(--color-text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
