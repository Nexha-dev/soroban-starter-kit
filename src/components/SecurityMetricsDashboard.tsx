import React, { useState, useEffect } from 'react';
import { useSecurity } from '../context/SecurityContext';

/**
 * Security Metrics Dashboard — Issue #70
 * Adds: threat detection visualization, risk assessment/scoring,
 * security metrics overview, and security policy configuration.
 * Complements the existing SecurityDashboard (alerts/audit/session).
 */

// ── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface ThreatEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: Severity;
  source: string;
  description: string;
  resolved: boolean;
}

interface RiskCategory {
  name: string;
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
}

// ── Mock threat data (derived from audit log in real usage) ──────────────────

const MOCK_THREATS: ThreatEvent[] = [
  { id: 't1', timestamp: Date.now() - 3_600_000, type: 'Brute Force', severity: 'high', source: '192.168.1.45', description: 'Multiple failed login attempts', resolved: false },
  { id: 't2', timestamp: Date.now() - 7_200_000, type: 'Privilege Escalation', severity: 'critical', source: 'user:alice', description: 'Unexpected admin role assignment', resolved: false },
  { id: 't3', timestamp: Date.now() - 14_400_000, type: 'Suspicious Export', severity: 'medium', source: '10.0.0.22', description: 'Large data export detected', resolved: true },
  { id: 't4', timestamp: Date.now() - 86_400_000, type: 'Config Change', severity: 'low', source: 'user:bob', description: 'Security policy modified', resolved: true },
];

const RISK_CATEGORIES: RiskCategory[] = [
  { name: 'Authentication', score: 45, trend: 'down' },
  { name: 'Network', score: 70, trend: 'stable' },
  { name: 'Data Access', score: 55, trend: 'up' },
  { name: 'Session Mgmt', score: 80, trend: 'stable' },
  { name: 'Compliance', score: 60, trend: 'down' },
];

const TREND_DATA = [
  { label: 'Mon', critical: 1, high: 3, medium: 5 },
  { label: 'Tue', critical: 0, high: 2, medium: 7 },
  { label: 'Wed', critical: 2, high: 4, medium: 4 },
  { label: 'Thu', critical: 1, high: 1, medium: 6 },
  { label: 'Fri', critical: 3, high: 5, medium: 8 },
  { label: 'Sat', critical: 0, high: 2, medium: 3 },
  { label: 'Sun', critical: 2, high: 3, medium: 5 },
];

// ── Colour helpers ────────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const riskColor = (score: number) =>
  score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : '#22c55e';

const riskLabel = (score: number) =>
  score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      role="region"
      aria-label={`${label}: ${value}`}
      style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', background: '#fff' }}
    >
      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: color ?? '#111' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{sub}</p>}
    </div>
  );
}

function ThreatBar({ day, critical, high, medium }: { day: string; critical: number; high: number; medium: number }) {
  const max = 10;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, height: 80, justifyContent: 'flex-start' }}>
        {[
          { count: medium, color: '#eab308' },
          { count: high, color: '#f97316' },
          { count: critical, color: '#ef4444' },
        ].map(({ count, color }, i) => (
          <div
            key={i}
            title={`${count} events`}
            style={{ width: 24, height: `${(count / max) * 80}px`, background: color, borderRadius: 2, minHeight: count > 0 ? 4 : 0 }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: '#9ca3af' }}>{day}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'metrics' | 'threats' | 'risk' | 'policy';

export function SecurityMetricsDashboard(): JSX.Element {
  const security = useSecurity();
  const [tab, setTab] = useState<Tab>('metrics');
  const [threats, setThreats] = useState<ThreatEvent[]>(MOCK_THREATS);
  const [policyDraft, setPolicyDraft] = useState({
    sessionTimeoutMin: security.config.sessionTimeoutMs / 60_000,
    maxFailedAttempts: security.config.maxFailedAttempts,
    require2FA: security.config.require2FA,
    alertOnCritical: true,
    alertOnHigh: true,
    alertOnMedium: false,
    lockOnBrute: true,
  });
  const [policySaved, setPolicySaved] = useState(false);

  // Derive overall risk score from categories
  const overallRisk = Math.round(
    RISK_CATEGORIES.reduce((sum, c) => sum + c.score, 0) / RISK_CATEGORIES.length,
  );

  // Derive metrics from audit log + mock threats
  const openThreats = threats.filter((t) => !t.resolved);
  const criticalCount = openThreats.filter((t) => t.severity === 'critical').length;
  const resolvedToday = threats.filter(
    (t) => t.resolved && Date.now() - t.timestamp < 86_400_000,
  ).length;

  const resolveThread = (id: string) =>
    setThreats((prev) => prev.map((t) => (t.id === id ? { ...t, resolved: true } : t)));

  const savePolicy = () => {
    security.updateConfig({
      sessionTimeoutMs: policyDraft.sessionTimeoutMin * 60_000,
      maxFailedAttempts: policyDraft.maxFailedAttempts,
      require2FA: policyDraft.require2FA,
    });
    setPolicySaved(true);
    setTimeout(() => setPolicySaved(false), 2000);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: '📊 Metrics' },
    { id: 'threats', label: `🚨 Threats${openThreats.length ? ` (${openThreats.length})` : ''}` },
    { id: 'risk', label: '⚠️ Risk Score' },
    { id: 'policy', label: '⚙️ Policy' },
  ];

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Security Metrics &amp; Threat Detection</h2>

      {/* Tab bar */}
      <div role="tablist" aria-label="Security sections" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#6366f1' : '#e5e7eb',
              color: tab === t.id ? '#fff' : '#111',
              fontWeight: tab === t.id ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Metrics ── */}
      {tab === 'metrics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <MetricTile label="Open Threats" value={openThreats.length} color={openThreats.length > 0 ? '#ef4444' : '#22c55e'} />
            <MetricTile label="Critical Alerts" value={criticalCount} color={criticalCount > 0 ? '#ef4444' : '#22c55e'} />
            <MetricTile label="Resolved Today" value={resolvedToday} color="#22c55e" />
            <MetricTile label="Overall Risk" value={`${overallRisk}/100`} color={riskColor(overallRisk)} sub={riskLabel(overallRisk)} />
            <MetricTile label="Audit Entries" value={security.auditLog.length} />
            <MetricTile label="Failed Attempts" value={security.failedAttempts} color={security.failedAttempts > 0 ? '#f97316' : '#22c55e'} />
          </div>

          {/* Threat trend chart */}
          <section aria-label="Threat trend over 7 days" style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Threat Trend (7 days)</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', padding: '0 8px' }}>
              {TREND_DATA.map((d) => (
                <ThreatBar key={d.label} day={d.label} critical={d.critical} high={d.high} medium={d.medium} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
              {[['Critical', '#ef4444'], ['High', '#f97316'], ['Medium', '#eab308']].map(([label, color]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── Threats ── */}
      {tab === 'threats' && (
        <section aria-label="Threat detection">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Detected Threats</h3>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{openThreats.length} open · {threats.length - openThreats.length} resolved</span>
          </div>
          {threats.map((threat) => (
            <div
              key={threat.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '10px 14px', marginBottom: 8, borderRadius: 8,
                borderLeft: `4px solid ${SEV_COLOR[threat.severity]}`,
                background: threat.resolved ? '#f9fafb' : '#fff',
                opacity: threat.resolved ? 0.6 : 1,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[threat.severity], textTransform: 'uppercase', marginRight: 8 }}>
                  {threat.severity}
                </span>
                <strong style={{ fontSize: 13 }}>{threat.type}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{threat.description}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  Source: {threat.source} · {new Date(threat.timestamp).toLocaleString()}
                </p>
              </div>
              {!threat.resolved && (
                <button
                  onClick={() => resolveThread(threat.id)}
                  aria-label={`Resolve threat: ${threat.type}`}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#dcfce7', color: '#16a34a', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Resolve
                </button>
              )}
              {threat.resolved && <span style={{ fontSize: 11, color: '#22c55e' }}>✓ Resolved</span>}
            </div>
          ))}
        </section>
      )}

      {/* ── Risk Score ── */}
      {tab === 'risk' && (
        <section aria-label="Risk assessment">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              role="img"
              aria-label={`Overall risk score: ${overallRisk} out of 100, ${riskLabel(overallRisk)} risk`}
              style={{ width: 80, height: 80, borderRadius: '50%', border: `6px solid ${riskColor(overallRisk)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: riskColor(overallRisk) }}>{overallRisk}</span>
              <span style={{ fontSize: 9, color: '#9ca3af' }}>/ 100</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: riskColor(overallRisk) }}>{riskLabel(overallRisk)} Risk</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Based on {RISK_CATEGORIES.length} risk categories</p>
            </div>
          </div>

          {RISK_CATEGORIES.map((cat) => (
            <div key={cat.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{cat.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: cat.trend === 'up' ? '#ef4444' : cat.trend === 'down' ? '#22c55e' : '#9ca3af' }}>
                    {cat.trend === 'up' ? '↑' : cat.trend === 'down' ? '↓' : '→'}
                  </span>
                  <span style={{ fontWeight: 700, color: riskColor(cat.score) }}>{cat.score}</span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={cat.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.name} risk: ${cat.score} out of 100`}
                style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}
              >
                <div style={{ height: '100%', width: `${cat.score}%`, background: riskColor(cat.score), borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Policy ── */}
      {tab === 'policy' && (
        <section aria-label="Security policy configuration" style={{ maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>Security Policy Configuration</h3>

          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Session</legend>
            <label style={labelStyle}>
              Session timeout (minutes)
              <input
                type="number" min={1} max={1440}
                value={policyDraft.sessionTimeoutMin}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, sessionTimeoutMin: Number(e.target.value) }))}
                style={inputStyle}
                aria-label="Session timeout in minutes"
              />
            </label>
            <label style={labelStyle}>
              Max failed attempts before lockout
              <input
                type="number" min={1} max={20}
                value={policyDraft.maxFailedAttempts}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, maxFailedAttempts: Number(e.target.value) }))}
                style={inputStyle}
                aria-label="Maximum failed login attempts"
              />
            </label>
          </fieldset>

          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Authentication</legend>
            <ToggleRow label="Require 2FA for all users" checked={policyDraft.require2FA} onChange={(v) => setPolicyDraft((p) => ({ ...p, require2FA: v }))} />
            <ToggleRow label="Lock account on brute-force detection" checked={policyDraft.lockOnBrute} onChange={(v) => setPolicyDraft((p) => ({ ...p, lockOnBrute: v }))} />
          </fieldset>

          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 6px' }}>Alert Thresholds</legend>
            <ToggleRow label="Alert on Critical events" checked={policyDraft.alertOnCritical} onChange={(v) => setPolicyDraft((p) => ({ ...p, alertOnCritical: v }))} />
            <ToggleRow label="Alert on High events" checked={policyDraft.alertOnHigh} onChange={(v) => setPolicyDraft((p) => ({ ...p, alertOnHigh: v }))} />
            <ToggleRow label="Alert on Medium events" checked={policyDraft.alertOnMedium} onChange={(v) => setPolicyDraft((p) => ({ ...p, alertOnMedium: v }))} />
          </fieldset>

          <button
            onClick={savePolicy}
            aria-label="Save security policy"
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 14 }}
          >
            {policySaved ? '✓ Saved' : 'Save Policy'}
          </button>
        </section>
      )}
    </div>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', marginTop: 4, fontSize: 13, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, marginBottom: 10, color: '#374151',
};

export default SecurityMetricsDashboard;
