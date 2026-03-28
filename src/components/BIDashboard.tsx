import React, { useState } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import { UserAnalyticsDashboard } from './UserAnalyticsDashboard';
import type {
  ReportDefinition, ReportColumn, ReportFilter, ChartType,
  DataSourceType, AggregationFn, FilterOperator, ExportFormat, ScheduleFrequency,
} from '../services/analytics/types';

// Shared primitives
const CHART_ICONS: Record<ChartType, string> = { bar: 'bar', line: 'line', area: 'area', pie: 'pie', table: 'table', kpi: 'kpi' };
const SEV_COLOR: Record<string, string> = { positive: 'var(--color-success)', warning: 'var(--color-warning)', info: 'var(--color-text-muted)' };
const CAT_COLOR: Record<string, string> = { trend: '#4fc3f7', anomaly: 'var(--color-warning)', opportunity: 'var(--color-success)', risk: 'var(--color-error)' };

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>
      {label}
    </span>
  );
}

function Btn({ children, onClick, variant = 'default', disabled, small }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; small?: boolean;
}) {
  const col = { default: 'var(--color-text-primary)', danger: 'var(--color-error)', success: 'var(--color-success)', warning: 'var(--color-warning)' }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '3px 10px' : '6px 14px', fontSize: small ? 11 : 13,
      background: col + '18', color: col, border: `1px solid ${col}44`,
      borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

// Mini SVG bar chart
function MiniBarChart({ data, labelKey, valueKey, color = 'var(--color-highlight)' }: {
  data: Record<string, any>[]; labelKey: string; valueKey: string; color?: string;
}) {
  if (!data.length) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const max = Math.max(...data.map(r => Number(r[valueKey] ?? 0)), 1);
  const w = 400; const h = 120; const bw = Math.max(8, (w / data.length) * 0.6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} aria-label="Bar chart">
      {data.map((row, i) => {
        const x = (i / data.length) * w + bw / 2;
        const val = Number(row[valueKey] ?? 0);
        const bh = Math.max(2, (val / max) * (h - 24));
        return (
          <g key={i}>
            <rect x={x - bw / 2} y={h - bh - 16} width={bw} height={bh} rx="3" fill={color} opacity="0.85">
              <title>{row[labelKey]}: {val}</title>
            </rect>
            <text x={x} y={h - 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">{String(row[labelKey] ?? '').slice(0, 8)}</text>
            <text x={x} y={h - bh - 20} textAnchor="middle" fill="var(--color-text-primary)" fontSize="9">{val}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Mini SVG pie chart
const PIE_COLORS = ['#e94560', '#00d26a', '#ffc107', '#4fc3f7', '#ce93d8', '#ffb74d'];

function MiniPieChart({ data, labelKey, valueKey }: { data: Record<string, any>[]; labelKey: string; valueKey: string }) {
  const total = data.reduce((s, r) => s + Number(r[valueKey] ?? 0), 0);
  if (!total) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const cx = 80; const cy = 80; const r = 60;
  let angle = -Math.PI / 2;
  const slices = data.map((row, i) => {
    const pct = Number(row[valueKey] ?? 0) / total;
    const a = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle); const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle); const y2 = cy + r * Math.sin(angle);
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0},1 ${x2},${y2} Z`, color: PIE_COLORS[i % PIE_COLORS.length], label: row[labelKey], pct: (pct * 100).toFixed(1) };
  });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 160" width={160} height={160} aria-label="Pie chart">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.9}><title>{s.label}: {s.pct}%</title></path>)}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--color-bg-secondary)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{s.label}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// Mini SVG line/area chart
function MiniLineChart({ data, labelKey, valueKey, area = false, color = 'var(--color-highlight)' }: {
  data: Record<string, any>[]; labelKey: string; valueKey: string; area?: boolean; color?: string;
}) {
  if (!data.length) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const w = 400; const h = 120; const pad = 20;
  const vals = data.map(r => Number(r[valueKey] ?? 0));
  const min = Math.min(...vals); const max = Math.max(...vals, min + 1);
  const pts = data.map((_, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((vals[i] - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} L${pts.join(' L')} L${pad + (w - pad * 2)},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} aria-label={area ? 'Area chart' : 'Line chart'}>
      {area && <path d={areaPath} fill={color} opacity={0.15} />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} />
      {data.map((row, i) => {
        const [x, y] = pts[i].split(',').map(Number);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill={color}><title>{row[labelKey]}: {vals[i]}</title></circle>
            {i % Math.max(1, Math.floor(data.length / 6)) === 0 && (
              <text x={x} y={h - 4} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">{String(row[labelKey] ?? '').slice(0, 8)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// KPI card
function KPICard({ data, labelKey, valueKey }: { data: Record<string, any>[]; labelKey: string; valueKey: string }) {
  if (!data.length) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const total = data.reduce((s, r) => s + Number(r[valueKey] ?? 0), 0);
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {data.map((row, i) => (
        <div key={i} style={{ flex: '1 1 120px', padding: '12px 16px', background: 'var(--color-bg-primary)', borderRadius: 8, border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{row[labelKey]}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-highlight)' }}>{Number(row[valueKey] ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{total > 0 ? ((Number(row[valueKey] ?? 0) / total) * 100).toFixed(1) + '%' : ''}</div>
        </div>
      ))}
    </div>
  );
}

// Chart dispatcher
function ChartView({ chartType, data, labelKey, valueKey, color }: {
  chartType: ChartType; data: Record<string, any>[]; labelKey: string; valueKey: string; color?: string;
}) {
  if (chartType === 'bar') return <MiniBarChart data={data} labelKey={labelKey} valueKey={valueKey} color={color} />;
  if (chartType === 'line') return <MiniLineChart data={data} labelKey={labelKey} valueKey={valueKey} color={color} />;
  if (chartType === 'area') return <MiniLineChart data={data} labelKey={labelKey} valueKey={valueKey} area color={color} />;
  if (chartType === 'pie') return <MiniPieChart data={data} labelKey={labelKey} valueKey={valueKey} />;
  if (chartType === 'kpi') return <KPICard data={data} labelKey={labelKey} valueKey={valueKey} />;
  return null;
}

// Result view
function ResultView({ reportId }: { reportId: string }) {
  const { reports, results, runReport, exportResult } = useAnalytics();
  const report = reports.find(r => r.id === reportId);
  const result = results[reportId];
  const [running, setRunning] = useState(false);
  const [fmt, setFmt] = useState<ExportFormat>('csv');

  if (!report) return null;

  const valueCol = report.columns.find(c => c.aggregation)?.field ?? report.columns[1]?.field;
  const labelCol = report.groupBy ?? report.columns[0]?.field;

  function handleRun() {
    setRunning(true);
    try { runReport(reportId); } finally { setRunning(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={handleRun} disabled={running} variant="success">{running ? 'Running...' : 'Run'}</Btn>
        {result && (
          <>
            <Select value={fmt} onChange={v => setFmt(v as ExportFormat)} options={[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }, { value: 'pdf_text', label: 'Text' }]} />
            <Btn small onClick={() => exportResult(reportId, fmt)}>Export</Btn>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{result.totalRows} rows - {result.durationMs}ms - {timeAgo(result.generatedAt)}</span>
          </>
        )}
      </div>
      {result && (
        <>
          {Object.keys(result.summary).length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(result.summary).map(([k, v]) => (
                <div key={k} style={{ padding: '8px 14px', background: 'var(--color-bg-tertiary)', borderRadius: 6, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {labelCol && valueCol && result.rows.length > 0 && report.chartType !== 'table' && (
            <div style={{ padding: 12, background: 'var(--color-bg-tertiary)', borderRadius: 6 }}>
              <ChartView chartType={report.chartType} data={result.rows} labelKey={labelCol} valueKey={valueCol} />
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {report.columns.map(c => (
                    <th key={c.field} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11 }}>
                      {c.label}{c.aggregation ? ` (${c.aggregation})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {report.columns.map(c => <td key={c.field} style={{ padding: '6px 10px' }}>{String(row[c.field] ?? '-')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
// Tab: Reports
function ReportsTab() {
  const { reports, dataSources, results, createReport, deleteReport } = useAnalytics();
  const [selected, setSelected] = useState<string | null>(reports[0]?.id ?? null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [bName, setBName] = useState('');
  const [bSource, setBSource] = useState<DataSourceType>('transactions');
  const [bChart, setBChart] = useState<ChartType>('bar');
  const [bGroupBy, setBGroupBy] = useState('');
  const [bColumns, setBColumns] = useState<ReportColumn[]>([]);
  const [bFilters, setBFilters] = useState<ReportFilter[]>([]);

  const sourceFields = dataSources.find(s => s.id === bSource)?.fields ?? [];
  const AGG_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'None' },
    ...(['count', 'sum', 'avg', 'min', 'max', 'distinct'] as AggregationFn[]).map(a => ({ value: a, label: a })),
  ];

  function handleCreate() {
    if (!bName || bColumns.length === 0) return;
    const r = createReport({ name: bName, dataSource: bSource, chartType: bChart, columns: bColumns, filters: bFilters, groupBy: bGroupBy || undefined });
    setSelected(r.id);
    setShowBuilder(false);
    setBName(''); setBColumns([]); setBFilters([]); setBGroupBy('');
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 400 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>REPORTS</span>
          <Btn small onClick={() => setShowBuilder(v => !v)}>+</Btn>
        </div>
        {reports.map(r => (
          <button key={r.id} onClick={() => { setSelected(r.id); setShowBuilder(false); }} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13,
            background: selected === r.id ? 'var(--color-bg-tertiary)' : 'none', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text-primary)',
            borderLeft: selected === r.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
          }}>
            {r.name}
            {results[r.id] && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block' }}>{results[r.id].totalRows} rows</span>}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {showBuilder ? (
          <Card title="Report Builder">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Name</label><Input value={bName} onChange={setBName} placeholder="My Report" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Data Source</label>
                <Select value={bSource} onChange={v => { setBSource(v as DataSourceType); setBColumns([]); setBGroupBy(''); }} options={dataSources.map(s => ({ value: s.id, label: s.label }))} />
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Chart Type</label>
                <Select value={bChart} onChange={v => setBChart(v as ChartType)} options={(['bar', 'line', 'area', 'pie', 'table', 'kpi'] as ChartType[]).map(t => ({ value: t, label: t }))} />
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Group By</label>
                <Select value={bGroupBy} onChange={setBGroupBy} options={[{ value: '', label: 'None' }, ...sourceFields.filter(f => f.aggregatable).map(f => ({ value: f.key, label: f.label }))]} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Columns</span>
                <Btn small onClick={() => { const f = sourceFields[0]; if (f) setBColumns(c => [...c, { field: f.key, label: f.label }]); }}>+ Add</Btn>
              </div>
              {bColumns.map((col, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                  <Select value={col.field} onChange={v => setBColumns(c => c.map((x, j) => j === i ? { ...x, field: v, label: sourceFields.find(f => f.key === v)?.label ?? v } : x))} options={sourceFields.map(f => ({ value: f.key, label: f.label }))} />
                  <Input value={col.label} onChange={v => setBColumns(c => c.map((x, j) => j === i ? { ...x, label: v } : x))} placeholder="Label" />
                  <Select value={col.aggregation ?? ''} onChange={v => setBColumns(c => c.map((x, j) => j === i ? { ...x, aggregation: (v as AggregationFn) || undefined } : x))} options={AGG_OPTIONS} />
                  <Btn small variant="danger" onClick={() => setBColumns(c => c.filter((_, j) => j !== i))}>x</Btn>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Filters</span>
                <Btn small onClick={() => setBFilters(f => [...f, { id: `f_${Date.now()}`, field: sourceFields[0]?.key ?? '', operator: 'eq', value: '' }])}>+ Add</Btn>
              </div>
              {bFilters.map((f, i) => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                  <Select value={f.field} onChange={v => setBFilters(fs => fs.map((x, j) => j === i ? { ...x, field: v } : x))} options={sourceFields.map(f => ({ value: f.key, label: f.label }))} />
                  <Select value={f.operator} onChange={v => setBFilters(fs => fs.map((x, j) => j === i ? { ...x, operator: v as FilterOperator } : x))} options={(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] as FilterOperator[]).map(o => ({ value: o, label: o }))} />
                  <Input value={String(f.value)} onChange={v => setBFilters(fs => fs.map((x, j) => j === i ? { ...x, value: v } : x))} placeholder="Value" />
                  <Btn small variant="danger" onClick={() => setBFilters(fs => fs.filter((_, j) => j !== i))}>x</Btn>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="success" onClick={handleCreate} disabled={!bName || bColumns.length === 0}>Create Report</Btn>
              <Btn onClick={() => setShowBuilder(false)}>Cancel</Btn>
            </div>
          </Card>
        ) : selected ? (
          <Card title={reports.find(r => r.id === selected)?.name ?? ''} action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge label={reports.find(r => r.id === selected)?.dataSource ?? ''} color="#4fc3f7" />
              <Btn small variant="danger" onClick={() => { if (confirm('Delete this report?')) { deleteReport(selected); setSelected(reports.find(r => r.id !== selected)?.id ?? null); } }}>Delete</Btn>
            </div>
          }>
            <ResultView reportId={selected} />
          </Card>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Select a report or create a new one.</p>
        )}
      </div>
    </div>
  );
}
// Tab: Compare
function CompareTab() {
  const { reports, comparisons, compareReports } = useAnalytics();
  const [selectedId, setSelectedId] = useState<string>(reports[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const comparison = selectedId ? comparisons[selectedId] : undefined;
  const report = reports.find(r => r.id === selectedId);

  function handleCompare() {
    if (!selectedId) return;
    setRunning(true);
    try { compareReports(selectedId); } finally { setRunning(false); }
  }

  const TREND_ICON: Record<string, string> = { up: 'up', down: 'down', flat: 'flat' };
  const TREND_COLOR: Record<string, string> = { up: 'var(--color-success)', down: 'var(--color-error)', flat: 'var(--color-text-muted)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Select Report</label>
          <Select value={selectedId} onChange={setSelectedId} options={reports.map(r => ({ value: r.id, label: r.name }))} />
        </div>
        <Btn onClick={handleCompare} disabled={running || !selectedId} variant="success">
          {running ? 'Comparing...' : 'Compare Periods'}
        </Btn>
      </div>

      {comparison && report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['currentPeriod', 'previousPeriod'] as const).map(period => (
              <div key={period} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  {comparison[period].label.toUpperCase()}
                </div>
                {Object.entries(comparison[period].summary).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {comparison.metrics.length > 0 && (
            <Card title="Period-over-Period Metrics">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {comparison.metrics.map(m => (
                  <div key={m.field} style={{ padding: '12px 16px', background: 'var(--color-bg-tertiary)', borderRadius: 8, borderLeft: `3px solid ${TREND_COLOR[m.trend]}` }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 700 }}>{m.current.toLocaleString()}</span>
                      <span style={{ fontSize: 13, color: TREND_COLOR[m.trend] }}>
                        {TREND_ICON[m.trend]} {Math.abs(m.changePct)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      vs {m.previous.toLocaleString()} ({m.change >= 0 ? '+' : ''}{m.change.toLocaleString()})
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {comparison.currentPeriod.rows.length > 0 && report.columns.length >= 2 && (
            <Card title="Visual Comparison">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>{comparison.currentPeriod.label}</div>
                  <ChartView chartType="bar" data={comparison.currentPeriod.rows} labelKey={report.groupBy ?? report.columns[0].field} valueKey={report.columns.find(c => c.aggregation)?.field ?? report.columns[1].field} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>{comparison.previousPeriod.label}</div>
                  <ChartView chartType="bar" data={comparison.previousPeriod.rows} labelKey={report.groupBy ?? report.columns[0].field} valueKey={report.columns.find(c => c.aggregation)?.field ?? report.columns[1].field} color="#ce93d8" />
                </div>
              </div>
            </Card>
          )}

          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right' }}>
            Generated {timeAgo(comparison.generatedAt)}
          </div>
        </>
      )}

      {!comparison && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Select a report and click Compare Periods to see period-over-period analysis.</p>
      )}
    </div>
  );
}

// Tab: Schedules
function SchedulesTab() {
  const { reports, schedules, scheduleReport, updateSchedule, deleteSchedule } = useAnalytics();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reportId: reports[0]?.id ?? '', frequency: 'daily' as ScheduleFrequency, recipients: '', format: 'csv' as ExportFormat });

  const FREQ_LABELS: Record<ScheduleFrequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', manual: 'Manual' };

  function handleCreate() {
    if (!form.reportId) return;
    scheduleReport(form.reportId, form.frequency, form.recipients.split(',').map(r => r.trim()).filter(Boolean), form.format);
    setShowForm(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setShowForm(v => !v)}>+ Schedule Report</Btn>
      </div>
      {showForm && (
        <Card title="New Schedule">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Report</label>
              <Select value={form.reportId} onChange={v => setForm(f => ({ ...f, reportId: v }))} options={reports.map(r => ({ value: r.id, label: r.name }))} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Frequency</label>
              <Select value={form.frequency} onChange={v => setForm(f => ({ ...f, frequency: v as ScheduleFrequency }))} options={(Object.keys(FREQ_LABELS) as ScheduleFrequency[]).map(k => ({ value: k, label: FREQ_LABELS[k] }))} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Format</label>
              <Select value={form.format} onChange={v => setForm(f => ({ ...f, format: v as ExportFormat }))} options={[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }, { value: 'pdf_text', label: 'Text' }]} />
            </div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Recipients (comma-separated)</label>
              <Input value={form.recipients} onChange={v => setForm(f => ({ ...f, recipients: v }))} placeholder="user@example.com, other@example.com" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleCreate}>Create</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}
      {schedules.length === 0 && !showForm && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No scheduled reports yet.</p>}
      {schedules.map(s => {
        const report = reports.find(r => r.id === s.reportId);
        return (
          <div key={s.id} className="card" style={{ padding: 14, borderLeft: `3px solid ${s.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{report?.name ?? s.reportId}</span>
                  <Badge label={FREQ_LABELS[s.frequency]} color="#4fc3f7" />
                  <Badge label={s.exportFormat} color="var(--color-text-muted)" />
                  <Badge label={s.enabled ? 'active' : 'paused'} color={s.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {s.recipients.length > 0 ? `Recipients: ${s.recipients.join(', ')}` : 'No recipients'}
                  {s.lastRunAt && ` - Last run: ${timeAgo(s.lastRunAt)}`}
                  {` - Run count: ${s.runCount}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small variant={s.enabled ? 'warning' : 'success'} onClick={() => updateSchedule(s.id, { enabled: !s.enabled })}>{s.enabled ? 'Pause' : 'Resume'}</Btn>
                <Btn small variant="danger" onClick={() => { if (confirm('Delete schedule?')) deleteSchedule(s.id); }}>Delete</Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tab: Insights
function InsightsTab() {
  const { insights, lastInsightRefresh, refreshInsights } = useAnalytics();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{lastInsightRefresh ? `Last refreshed ${timeAgo(lastInsightRefresh)}` : 'Not yet refreshed'}</span>
        <Btn onClick={refreshInsights}>Refresh Insights</Btn>
      </div>
      {insights.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No insights yet. Click Refresh to generate.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {insights.map(ins => (
          <div key={ins.id} className="card" style={{ padding: 16, borderLeft: `3px solid ${SEV_COLOR[ins.severity]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <Badge label={ins.category} color={CAT_COLOR[ins.category]} />
                <Badge label={ins.severity} color={SEV_COLOR[ins.severity]} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{timeAgo(ins.generatedAt)}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{ins.title}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>{ins.description}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: SEV_COLOR[ins.severity] }}>{ins.value.toFixed(1)}</span>
              {ins.change !== undefined && (
                <span style={{ fontSize: 13, color: ins.change >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {ins.change >= 0 ? 'up' : 'down'} {Math.abs(ins.change)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Root BIDashboard
type BITab = 'insights' | 'reports' | 'compare' | 'schedules' | 'behavior';

export function BIDashboard(): JSX.Element {
  const { reports, schedules, insights, comparisons } = useAnalytics();
  const [tab, setTab] = useState<BITab>('insights');

  const tabs: { id: BITab; label: string }[] = [
    { id: 'insights', label: `Insights (${insights.length})` },
    { id: 'reports', label: `Reports (${reports.length})` },
    { id: 'compare', label: `Compare (${Object.keys(comparisons).length})` },
    { id: 'schedules', label: `Schedules (${schedules.length})` },
    { id: 'behavior', label: 'User Behavior' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Business Intelligence</h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{reports.length} reports - {schedules.length} schedules - {insights.length} insights</span>
      </div>
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? 'var(--color-highlight)' : 'var(--color-text-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
            fontWeight: tab === t.id ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'insights' && <InsightsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'compare' && <CompareTab />}
        {tab === 'schedules' && <SchedulesTab />}
        {tab === 'behavior' && <UserAnalyticsDashboard />}
      </div>
    </div>
  );
}