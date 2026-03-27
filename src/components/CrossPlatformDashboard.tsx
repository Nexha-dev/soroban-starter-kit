import React, { useState, useEffect, useCallback } from 'react';
import {
  platformCompatibilityService,
  type PlatformInfo,
  type FeatureDetection,
  type NativeCapability,
  type Optimization,
  type CompatibilityTestResult,
  type PlatformAnalyticsEntry,
  type PlatformStrategy,
  type FeatureStatus,
  type OptimizationPriority,
  type PlatformType,
} from '../services/platform/platformCompatibilityService';

type Tab = 'overview' | 'features' | 'optimizations' | 'native' | 'testing' | 'analytics' | 'strategies';

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 13px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: active ? '#7c3aed' : '#e9ecef',
    color: active ? 'white' : '#374151',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
  };
}

function statusPill(status: FeatureStatus): React.ReactElement {
  const cfg: Record<FeatureStatus, { bg: string; label: string }> = {
    supported:   { bg: '#16a34a', label: 'Supported' },
    partial:     { bg: '#d97706', label: 'Partial' },
    unsupported: { bg: '#dc2626', label: 'Unsupported' },
    unknown:     { bg: '#9ca3af', label: 'Unknown' },
  };
  const { bg, label } = cfg[status];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', backgroundColor: bg, color: 'white', fontSize: '11px', fontWeight: 600 }}>
      {label}
    </span>
  );
}

function priorityPill(p: OptimizationPriority): React.ReactElement {
  const colors: Record<OptimizationPriority, string> = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', backgroundColor: colors[p] + '22', color: colors[p], border: `1px solid ${colors[p]}44`, fontSize: '11px', fontWeight: 600 }}>
      {p}
    </span>
  );
}

function outcomePill(outcome: CompatibilityTestResult['outcome']): React.ReactElement {
  const cfg = { pass: { bg: '#16a34a', label: '✓ Pass' }, fail: { bg: '#dc2626', label: '✗ Fail' }, warn: { bg: '#d97706', label: '⚠ Warn' }, skip: { bg: '#9ca3af', label: '— Skip' } };
  const { bg, label } = cfg[outcome];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', backgroundColor: bg, color: 'white', fontSize: '11px', fontWeight: 600 }}>{label}</span>;
}

function progressBar(pct: number, color: string): React.ReactElement {
  return (
    <div style={{ backgroundColor: '#e9ecef', borderRadius: '3px', height: '6px' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color, borderRadius: '3px', height: '100%' }} />
    </div>
  );
}

const PLATFORM_ICONS: Record<string, string> = {
  'web-desktop': '🖥', 'web-mobile': '📱', 'pwa-desktop': '💻', 'pwa-mobile': '📲', unknown: '❓',
  windows: '🪟', macos: '🍎', linux: '🐧', ios: '🍎', android: '🤖', chromeos: '🌐',
  chrome: '🌐', firefox: '🦊', safari: '🧭', edge: '🔷', samsung: '📱', opera: '🎭',
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ platform, features }: { platform: PlatformInfo; features: FeatureDetection[] }): React.ReactElement {
  const supported = features.filter((f) => f.status === 'supported').length;
  const unsupported = features.filter((f) => f.status === 'unsupported').length;
  const critical = features.filter((f) => f.critical && f.status === 'unsupported');

  const infoRows: Array<[string, string]> = [
    ['Platform', `${PLATFORM_ICONS[platform.type] ?? ''} ${platform.type}`],
    ['OS', `${PLATFORM_ICONS[platform.os] ?? ''} ${platform.os} ${platform.osVersion}`],
    ['Browser', `${PLATFORM_ICONS[platform.browser] ?? ''} ${platform.browser} ${platform.browserVersion}`],
    ['Device', platform.deviceClass],
    ['Viewport', `${platform.viewport.width} × ${platform.viewport.height} px`],
    ['DPR', `${window.devicePixelRatio}× ${platform.isHighDPI ? '(HiDPI)' : ''}`],
    ['Touch', platform.isTouchDevice ? `Yes (${navigator.maxTouchPoints} pts)` : 'No'],
    ['CPU Cores', String(platform.cores)],
    ['RAM', platform.memory.deviceMemoryGB > 0 ? `${platform.memory.deviceMemoryGB} GB` : 'Unknown'],
    ['Connection', `${platform.connection.effectiveType} (${platform.connection.downlink > 0 ? `${platform.connection.downlink} Mbps` : 'unknown'})`],
    ['Save Data', platform.connection.saveData ? '⚠ Enabled' : 'Off'],
    ['PWA Installed', platform.isInstalled ? '✓ Yes' : 'No'],
  ];

  return (
    <div>
      {/* Critical issues banner */}
      {critical.length > 0 && (
        <div style={{ ...card, backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626' }}>
          <strong style={{ color: '#dc2626' }}>⚠ Critical features unavailable ({critical.length})</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '13px', color: '#374151' }}>
            {critical.map((f) => (
              <li key={f.id}>{f.name}{f.fallback && <span style={{ color: '#6b7280' }}> — fallback: {f.fallback}</span>}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Platform info */}
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Detected Platform</h3>
          {infoRows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Feature summary + memory */}
        <div>
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Feature Coverage</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {[
                { label: 'Supported', value: supported, color: '#16a34a' },
                { label: 'Partial/Unknown', value: features.length - supported - unsupported, color: '#d97706' },
                { label: 'Unsupported', value: unsupported, color: '#dc2626' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
                </div>
              ))}
            </div>
            {progressBar((supported / features.length) * 100, '#16a34a')}
            <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right', marginTop: '3px' }}>
              {((supported / features.length) * 100).toFixed(0)}% supported
            </div>
          </div>

          {platform.memory.jsHeapLimitMB > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>JS Heap Usage</h3>
              <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                {platform.memory.jsHeapUsedMB} MB / {platform.memory.jsHeapLimitMB} MB
              </div>
              {progressBar(
                (platform.memory.jsHeapUsedMB / platform.memory.jsHeapLimitMB) * 100,
                platform.memory.jsHeapUsedMB / platform.memory.jsHeapLimitMB > 0.8 ? '#dc2626' : '#16a34a'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Features Tab ─────────────────────────────────────────────────────────────

function FeaturesTab({ features }: { features: FeatureDetection[] }): React.ReactElement {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'all'>('all');

  const categories = ['all', ...Array.from(new Set(features.map((f) => f.category)))];

  const filtered = features
    .filter((f) => categoryFilter === 'all' || f.category === categoryFilter)
    .filter((f) => statusFilter === 'all' || f.status === statusFilter);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FeatureStatus | 'all')}
          style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {(['all', 'supported', 'partial', 'unsupported', 'unknown'] as const).map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <span style={{ alignSelf: 'center', fontSize: '13px', color: '#6b7280' }}>{filtered.length} features</span>
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Feature', 'Category', 'Status', 'Fallback', 'Critical'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 6px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 6px', fontWeight: 500 }}>
                  {f.name}
                  {f.detectedValue && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '11px', marginLeft: '6px' }}>({f.detectedValue})</span>}
                </td>
                <td style={{ padding: '8px 6px', color: '#6b7280' }}>{f.category}</td>
                <td style={{ padding: '8px 6px' }}>{statusPill(f.status)}</td>
                <td style={{ padding: '8px 6px', color: '#6b7280', fontSize: '12px' }}>{f.fallback ?? '—'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  {f.critical ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Yes</span> : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Optimizations Tab ────────────────────────────────────────────────────────

function OptimizationsTab({ optimizations }: { optimizations: Optimization[] }): React.ReactElement {
  const statusStyles: Record<Optimization['status'], { bg: string; color: string }> = {
    applied:          { bg: '#f0fdf4', color: '#16a34a' },
    recommended:      { bg: '#eff6ff', color: '#2563eb' },
    'not-applicable': { bg: '#f9fafb', color: '#9ca3af' },
  };

  const categoryIcon: Record<string, string> = {
    rendering: '🎨', network: '🌐', memory: '💾', input: '👆',
    battery: '🔋', storage: '💿', performance: '⚡',
  };

  return (
    <div>
      {optimizations.map((opt) => (
        <div key={opt.id} style={{
          ...card,
          backgroundColor: statusStyles[opt.status].bg,
          borderLeft: `4px solid ${statusStyles[opt.status].color}`,
          opacity: opt.status === 'not-applicable' ? 0.6 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{categoryIcon[opt.category] ?? '⚙'}</span>
              <strong style={{ fontSize: '14px' }}>{opt.title}</strong>
              {priorityPill(opt.priority)}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: statusStyles[opt.status].color }}>
              {opt.status === 'applied' ? '✓ Applied' : opt.status === 'recommended' ? '→ Recommended' : 'N/A'}
            </span>
          </div>
          <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#374151' }}>{opt.description}</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span style={{ color: '#16a34a' }}>Impact: {opt.impact}</span>
            {opt.implementation && (
              <code style={{ backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '3px', color: '#374151' }}>
                {opt.implementation}
              </code>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Native Integrations Tab ──────────────────────────────────────────────────

function NativeTab({ capabilities }: { capabilities: NativeCapability[] }): React.ReactElement {
  const [demoResults, setDemoResults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const runDemo = async (cap: NativeCapability) => {
    if (!cap.demo || !cap.supported) return;
    setRunning((r) => ({ ...r, [cap.id]: true }));
    try {
      const result = await cap.demo();
      setDemoResults((d) => ({ ...d, [cap.id]: result }));
    } catch (e) {
      setDemoResults((d) => ({ ...d, [cap.id]: `Error: ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      setRunning((r) => ({ ...r, [cap.id]: false }));
    }
  };

  const supported = capabilities.filter((c) => c.supported);
  const unsupported = capabilities.filter((c) => !c.supported);

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
        {supported.length}/{capabilities.length} native APIs available on this platform. Click "Demo" to try each one live.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {[...supported, ...unsupported].map((cap) => (
          <div key={cap.id} style={{
            backgroundColor: 'white',
            padding: '14px',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderTop: `3px solid ${cap.supported ? '#16a34a' : '#e5e7eb'}`,
            opacity: cap.supported ? 1 : 0.65,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px' }}>{cap.icon}</span>
                <strong style={{ fontSize: '13px' }}>{cap.name}</strong>
              </div>
              {cap.supported
                ? <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>✓ Available</span>
                : <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>✗ Not available</span>
              }
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#374151' }}>{cap.description}</p>
            <code style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>{cap.apiName}</code>

            {cap.supported && cap.demo && (
              <button
                onClick={() => runDemo(cap)}
                disabled={running[cap.id]}
                style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: running[cap.id] ? '#e5e7eb' : '#7c3aed', color: running[cap.id] ? '#9ca3af' : 'white', border: 'none', borderRadius: '3px', cursor: running[cap.id] ? 'not-allowed' : 'pointer' }}>
                {running[cap.id] ? 'Running…' : 'Demo'}
              </button>
            )}

            {demoResults[cap.id] && (
              <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: '#f0fdf4', borderRadius: '4px', fontSize: '12px', color: '#166534' }}>
                {demoResults[cap.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Testing Tab ──────────────────────────────────────────────────────────────

function TestingTab(): React.ReactElement {
  const [results, setResults] = useState<CompatibilityTestResult[]>(platformCompatibilityService.getTestResults());
  const [running, setRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const tests = platformCompatibilityService.getTests();

  const runAll = async () => {
    setRunning(true);
    const r = await platformCompatibilityService.runAllTests();
    setResults(r);
    setRunning(false);
  };

  const runSingle = async (id: string) => {
    setRunningId(id);
    const r = await platformCompatibilityService.runTest(id);
    if (r) setResults((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.testId === id);
      if (idx >= 0) next[idx] = r; else next.push(r);
      return next;
    });
    setRunningId(null);
  };

  const resultMap = Object.fromEntries(results.map((r) => [r.testId, r]));

  const passCount = results.filter((r) => r.outcome === 'pass').length;
  const failCount = results.filter((r) => r.outcome === 'fail').length;
  const warnCount = results.filter((r) => r.outcome === 'warn').length;

  const categories = Array.from(new Set(tests.map((t) => t.category)));

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={runAll} disabled={running}
          style={{ padding: '7px 16px', backgroundColor: running ? '#9ca3af' : '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
          {running ? 'Running…' : 'Run All Tests'}
        </button>
        {results.length > 0 && (
          <span style={{ fontSize: '13px', color: failCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {passCount} pass · {failCount} fail · {warnCount} warn
          </span>
        )}
      </div>

      {categories.map((cat) => (
        <div key={cat} style={card}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{cat}</h4>
          {tests.filter((t) => t.category === cat).map((test) => {
            const result = resultMap[test.id];
            const isRunning = runningId === test.id;
            return (
              <div key={test.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{test.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{test.description}</div>
                  {result && (
                    <div style={{ fontSize: '12px', color: result.outcome === 'pass' ? '#16a34a' : result.outcome === 'fail' ? '#dc2626' : '#d97706', marginTop: '3px' }}>
                      {result.message} <span style={{ color: '#9ca3af' }}>({result.duration}ms)</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  {result && outcomePill(result.outcome)}
                  <button onClick={() => runSingle(test.id)} disabled={isRunning || running}
                    style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white', opacity: running ? 0.5 : 1 }}>
                    {isRunning ? '…' : 'Run'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ data }: { data: PlatformAnalyticsEntry[] }): React.ReactElement {
  const total = data.reduce((s, d) => s + d.sessions, 0);

  const byPlatform = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.platform] = (acc[d.platform] ?? 0) + d.sessions;
    return acc;
  }, {});

  const byBrowser = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.browser] = (acc[d.browser] ?? 0) + d.sessions;
    return acc;
  }, {});

  const maxSessions = Math.max(...data.map((d) => d.sessions), 1);

  return (
    <div>
      {/* Platform distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={card}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Platform Distribution</h4>
          {Object.entries(byPlatform).sort(([, a], [, b]) => b - a).map(([platform, sessions]) => (
            <div key={platform} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                <span>{PLATFORM_ICONS[platform] ?? ''} {platform}</span>
                <span>{sessions} <span style={{ color: '#6b7280' }}>({((sessions / total) * 100).toFixed(0)}%)</span></span>
              </div>
              {progressBar((sessions / total) * 100, '#7c3aed')}
            </div>
          ))}
        </div>

        <div style={card}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Browser Distribution</h4>
          {Object.entries(byBrowser).sort(([, a], [, b]) => b - a).map(([browser, sessions]) => (
            <div key={browser} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                <span>{PLATFORM_ICONS[browser] ?? ''} {browser}</span>
                <span>{sessions} <span style={{ color: '#6b7280' }}>({((sessions / total) * 100).toFixed(0)}%)</span></span>
              </div>
              {progressBar((sessions / total) * 100, '#2563eb')}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed table */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Per-Platform Metrics</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Platform', 'OS', 'Browser', 'Sessions', 'Avg Session', 'Error Rate', 'Fallback Rate'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '7px 6px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data].sort((a, b) => b.sessions - a.sessions).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 6px' }}>{PLATFORM_ICONS[row.platform] ?? ''} {row.platform}</td>
                <td style={{ padding: '8px 6px', color: '#6b7280' }}>{PLATFORM_ICONS[row.os] ?? ''} {row.os}</td>
                <td style={{ padding: '8px 6px', color: '#6b7280' }}>{PLATFORM_ICONS[row.browser] ?? ''} {row.browser}</td>
                <td style={{ padding: '8px 6px' }}>
                  {row.sessions.toLocaleString()}
                  <div style={{ width: `${(row.sessions / maxSessions) * 80}px`, height: '3px', backgroundColor: '#7c3aed', borderRadius: '2px', marginTop: '2px' }} />
                </td>
                <td style={{ padding: '8px 6px', color: '#374151' }}>{(row.avgSessionMs / 60_000).toFixed(1)} min</td>
                <td style={{ padding: '8px 6px', color: row.errorRate > 0.02 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {(row.errorRate * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '8px 6px', color: row.featureFallbackRate > 0.1 ? '#d97706' : '#374151' }}>
                  {(row.featureFallbackRate * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Strategies Tab ───────────────────────────────────────────────────────────

function StrategiesTab({ strategies, currentPlatform }: { strategies: PlatformStrategy[]; currentPlatform: PlatformType }): React.ReactElement {
  const effortColors = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
  const priorityColors: Record<OptimizationPriority, string> = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280' };

  return (
    <div>
      {strategies.map((strategy) => {
        const isCurrent = strategy.platform === 'all' || strategy.platform === currentPlatform;
        return (
          <div key={strategy.title} style={{
            ...card,
            borderLeft: `4px solid ${priorityColors[strategy.priority]}`,
            opacity: isCurrent ? 1 : 0.7,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <h3 style={{ margin: '0 0 3px 0', fontSize: '14px', fontWeight: 700 }}>{strategy.title}</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    {strategy.platform === 'all' ? '🌐 All platforms' : `${PLATFORM_ICONS[strategy.platform] ?? ''} ${strategy.platform}`}
                    {isCurrent && strategy.platform !== 'all' && <span style={{ color: '#7c3aed', fontWeight: 600 }}> ← your platform</span>}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {priorityPill(strategy.priority)}
                <span style={{ fontSize: '11px', fontWeight: 600, color: effortColors[strategy.effort], padding: '2px 8px', borderRadius: '10px', backgroundColor: effortColors[strategy.effort] + '22', border: `1px solid ${effortColors[strategy.effort]}44` }}>
                  {strategy.effort} effort
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#374151' }}>{strategy.description}</p>

            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {strategy.tactics.map((tactic, i) => (
                <li key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>{tactic}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function CrossPlatformDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('overview');
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [features, setFeatures] = useState<FeatureDetection[]>([]);
  const [capabilities, setCapabilities] = useState<NativeCapability[]>([]);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalyticsEntry[]>([]);
  const [strategies, setStrategies] = useState<PlatformStrategy[]>([]);

  const init = useCallback(() => {
    const p = platformCompatibilityService.detectPlatform();
    setPlatform(p);
    setFeatures(platformCompatibilityService.detectFeatures());
    setCapabilities(platformCompatibilityService.getNativeCapabilities());
    setOptimizations(platformCompatibilityService.getOptimizations());
    setAnalytics(platformCompatibilityService.getAnalytics());
    setStrategies(platformCompatibilityService.getStrategies());
  }, []);

  useEffect(() => { init(); }, [init]);

  if (!platform) return <div style={{ padding: '20px', color: '#6b7280' }}>Detecting platform…</div>;

  const featureSupported = features.filter((f) => f.status === 'supported').length;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'features', label: `Features (${featureSupported}/${features.length})` },
    { id: 'optimizations', label: 'Optimizations' },
    { id: 'native', label: 'Native APIs' },
    { id: 'testing', label: 'Compat Testing' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'strategies', label: 'Strategies' },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Cross-Platform Compatibility</h2>
        <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#6b7280', alignItems: 'center' }}>
          <span>{PLATFORM_ICONS[platform.type] ?? ''} {platform.type}</span>
          <span>·</span>
          <span>{PLATFORM_ICONS[platform.browser] ?? ''} {platform.browser} {platform.browserVersion}</span>
          <span>·</span>
          <span>{PLATFORM_ICONS[platform.os] ?? ''} {platform.os}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(({ id, label }) => (
          <button key={id} style={tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && <OverviewTab platform={platform} features={features} />}
      {tab === 'features' && <FeaturesTab features={features} />}
      {tab === 'optimizations' && <OptimizationsTab optimizations={optimizations} />}
      {tab === 'native' && <NativeTab capabilities={capabilities} />}
      {tab === 'testing' && <TestingTab />}
      {tab === 'analytics' && <AnalyticsTab data={analytics} />}
      {tab === 'strategies' && <StrategiesTab strategies={strategies} currentPlatform={platform.type} />}
    </div>
  );
}

export default CrossPlatformDashboard;
