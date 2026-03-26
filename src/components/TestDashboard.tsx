import React, { useMemo } from 'react';
import type { TestRun, TestAnalytics, QualityGate } from '../services/testReporting/types';

// --- sub-components ---

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; ok?: boolean }> = ({
  label, value, sub, ok,
}) => (
  <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 8, minWidth: 140 }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: ok === false ? '#ef4444' : ok === true ? '#22c55e' : '#0f172a' }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>}
  </div>
);

const GateRow: React.FC<{ gate: QualityGate }> = ({ gate }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ fontSize: 13 }}>{gate.name}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: gate.passed ? '#22c55e' : '#ef4444' }}>
      {gate.passed ? '✓' : '✗'} {gate.actual.toFixed(1)} / {gate.threshold}
    </span>
  </div>
);

const MiniBar: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {values.map((v, i) => (
        <div
          key={i}
          title={`${v.toFixed(1)}%`}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: v >= 70 ? '#22c55e' : '#f59e0b',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

// --- main component ---

interface TestDashboardProps {
  run: TestRun;
  analytics: TestAnalytics;
  failureAnalysis: { name: string; suite: string; error: string; occurrences: number }[];
  teamMetrics: { author: string; runs: number; avgPassRate: number; avgCoverage: number }[];
}

export const TestDashboard: React.FC<TestDashboardProps> = ({
  run, analytics, failureAnalysis, teamMetrics,
}) => {
  const passCount = useMemo(() => run.results.filter(r => r.status === 'passed').length, [run]);
  const failCount = useMemo(() => run.results.filter(r => r.status === 'failed').length, [run]);
  const skipCount = useMemo(() => run.results.filter(r => r.status === 'skipped').length, [run]);
  const allGatesPassed = analytics.qualityGates.every(g => g.passed);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 1rem' }}>Test Dashboard</h2>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="Pass Rate" value={`${(analytics.passRate * 100).toFixed(1)}%`} ok={analytics.passRate >= 0.8} />
        <StatCard label="Passed" value={passCount} ok={true} />
        <StatCard label="Failed" value={failCount} ok={failCount === 0} />
        <StatCard label="Skipped" value={skipCount} />
        <StatCard label="Coverage" value={`${run.coveragePercent.toFixed(1)}%`} ok={run.coveragePercent >= 70} />
        <StatCard label="Avg Duration" value={`${analytics.avgDuration.toFixed(0)}ms`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Quality Gates */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>
            Quality Gates{' '}
            <span style={{ color: allGatesPassed ? '#22c55e' : '#ef4444', fontSize: 13 }}>
              {allGatesPassed ? '✓ All passed' : '✗ Some failed'}
            </span>
          </h3>
          {analytics.qualityGates.map(g => <GateRow key={g.name} gate={g} />)}
        </section>

        {/* Coverage Trend */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>Coverage Trend (last {analytics.coverageTrend.length} runs)</h3>
          <MiniBar values={analytics.coverageTrend} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Min: {Math.min(...analytics.coverageTrend).toFixed(1)}% · Max: {Math.max(...analytics.coverageTrend).toFixed(1)}%
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Failure Analysis */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>Top Failures</h3>
          {failureAnalysis.length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b' }}>No failures recorded.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Test</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Suite</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>#</th>
                </tr>
              </thead>
              <tbody>
                {failureAnalysis.slice(0, 5).map(f => (
                  <tr key={f.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 6px' }}>{f.name}</td>
                    <td style={{ padding: '4px 6px', color: '#64748b' }}>{f.suite}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{f.occurrences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Flaky / Slow Tests */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>Insights</h3>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>Flaky tests:</strong>{' '}
            {analytics.flakyTests.length === 0
              ? <span style={{ color: '#22c55e' }}>None detected</span>
              : analytics.flakyTests.map(t => <span key={t} style={{ color: '#f59e0b', marginRight: 6 }}>{t}</span>)}
          </div>
          <div style={{ fontSize: 13 }}>
            <strong>Slow tests (&gt;1s):</strong>{' '}
            {analytics.slowTests.length === 0
              ? <span style={{ color: '#22c55e' }}>None</span>
              : analytics.slowTests.map(t => <span key={t} style={{ color: '#f59e0b', marginRight: 6 }}>{t}</span>)}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Team Metrics */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>Team Metrics</h3>
          {teamMetrics.length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b' }}>No team data.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Author</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Runs</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Pass%</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Cov%</th>
                </tr>
              </thead>
              <tbody>
                {teamMetrics.map(m => (
                  <tr key={m.author} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 6px' }}>{m.author}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{m.runs}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{(m.avgPassRate * 100).toFixed(1)}%</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{m.avgCoverage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ROI */}
        <section>
          <h3 style={{ margin: '0 0 .5rem', fontSize: 15 }}>Testing ROI</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatCard label="Bugs Prevented (est.)" value={analytics.roi.bugsPreventedEstimate} />
            <StatCard label="Manual Time Saved" value={`${(analytics.roi.timeSavedMs / 3_600_000).toFixed(1)}h`} />
            <StatCard label="Avg Coverage Value" value={`${analytics.roi.coverageValue.toFixed(1)}%`} ok={analytics.roi.coverageValue >= 70} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default TestDashboard;
