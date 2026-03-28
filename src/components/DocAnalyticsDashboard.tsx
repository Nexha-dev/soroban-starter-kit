import React, { useState, useCallback } from 'react';
import { docsAnalytics } from '../services/docs/docsAnalytics';
import type {
  ABTest,
  ABTestResult,
  ContentGap,
  DocROI,
  OptimizationRecommendation,
  UsageSummary,
} from '../services/docs/docsAnalytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDocAnalytics() {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  const topComponents = docsAnalytics.getTopComponents(10);
  const contentGaps = docsAnalytics.getContentGaps(10);
  const recommendations = docsAnalytics.getOptimizationRecommendations();
  const roi = docsAnalytics.getROI();
  const activeTests = docsAnalytics.getActiveABTests();
  const satisfactionByPage = docsAnalytics.getSatisfactionByPage();
  const popularSearches = docsAnalytics.getPopularSearches(10);

  return { topComponents, contentGaps, recommendations, roi, activeTests, satisfactionByPage, popularSearches, refresh };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ROICard({ roi }: { roi: DocROI }) {
  const scoreColor = roi.score >= 70 ? '#22c55e' : roi.score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
        Documentation ROI
      </h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Stat label="ROI Score" value={`${roi.score}/100`} color={scoreColor} />
        <Stat label="Total Views" value={roi.totalPageViews} />
        <Stat label="Avg Satisfaction" value={`${roi.avgSatisfaction}/5`} />
        <Stat label="Support Deflections" value={roi.supportDeflectionEstimate} />
        <Stat label="Content Gaps" value={roi.contentGapCount} color={roi.contentGapCount > 5 ? '#ef4444' : '#94a3b8'} />
        <Stat label="Optimizations" value={roi.optimizationOpportunities} />
      </div>
    </div>
  );
}

function Stat({ label, value, color = '#f1f5f9' }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function UsageTable({ rows }: { rows: UsageSummary[] }) {
  if (!rows.length) return <Empty text="No usage data yet." />;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ color: '#64748b', textAlign: 'left' }}>
          {['Page', 'Views', 'Playground', 'Code Copies', 'Avg Time (s)', 'Satisfaction'].map(h => (
            <th key={h} style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.componentId} style={{ borderBottom: '1px solid #1e293b' }}>
            <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>{r.componentId}</td>
            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{r.views}</td>
            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{r.playgroundUses}</td>
            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{r.codeCopies}</td>
            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{r.avgTimeOnPage}</td>
            <td style={{ padding: '6px 8px', color: r.satisfactionScore < 3 && r.satisfactionScore > 0 ? '#ef4444' : '#94a3b8' }}>
              {r.satisfactionScore > 0 ? `${r.satisfactionScore}/5` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GapList({ gaps }: { gaps: ContentGap[] }) {
  if (!gaps.length) return <Empty text="No content gaps detected." />;
  const priorityColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {gaps.map(g => (
        <li key={g.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
          <span style={{ color: '#e2e8f0', fontSize: 13 }}>{g.topic}</span>
          <span style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
            <span>{g.searchCount} searches</span>
            <span>{Math.round(g.zeroResultRate * 100)}% no results</span>
            <span style={{ color: priorityColor[g.priority], fontWeight: 600 }}>{g.priority}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecommendationList({ items }: { items: OptimizationRecommendation[] }) {
  if (!items.length) return <Empty text="No recommendations — documentation looks great!" />;
  const priorityColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((r, i) => (
        <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor[r.priority], textTransform: 'uppercase' }}>{r.priority}</span>
            <span style={{ fontSize: 11, color: '#475569', background: '#0f172a', padding: '1px 6px', borderRadius: 4 }}>{r.type}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>{r.message}</p>
        </li>
      ))}
    </ul>
  );
}

function ABTestPanel({ tests, onEnd }: { tests: ABTest[]; onEnd: (id: string) => void }) {
  const [results, setResults] = useState<Record<string, ABTestResult>>({});

  const viewResult = (id: string) => {
    const r = docsAnalytics.getABTestResult(id);
    if (r) setResults(prev => ({ ...prev, [id]: r }));
  };

  if (!tests.length) return <Empty text="No active A/B tests." />;

  return (
    <div>
      {tests.map(t => (
        <div key={t.id} style={{ marginBottom: 12, padding: 12, background: '#0f172a', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{t.name}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => viewResult(t.id)} style={btnStyle('#334155')}>Results</button>
              <button onClick={() => onEnd(t.id)} style={btnStyle('#7f1d1d')}>End Test</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Variants: {t.variants.map(v => v.label).join(', ')}
          </div>
          {results[t.id] && (
            <div style={{ marginTop: 8 }}>
              {results[t.id].variants.map(v => (
                <div key={v.id} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 16, padding: '4px 0' }}>
                  <span style={{ color: results[t.id].winner === v.id ? '#22c55e' : '#e2e8f0', fontWeight: results[t.id].winner === v.id ? 700 : 400 }}>
                    {v.label} {results[t.id].winner === v.id ? '🏆' : ''}
                  </span>
                  <span>{v.impressions} impressions</span>
                  <span>{v.conversions} conversions</span>
                  <span>{(v.conversionRate * 100).toFixed(1)}% CVR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NewABTestForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');

  const handleCreate = () => {
    if (!name || !variantA || !variantB) return;
    const id = `test-${Date.now()}`;
    docsAnalytics.createABTest(id, name, [
      { id: 'a', label: variantA },
      { id: 'b', label: variantB },
    ]);
    setName(''); setVariantA(''); setVariantB('');
    onCreated();
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <input placeholder="Test name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <input placeholder="Variant A label" value={variantA} onChange={e => setVariantA(e.target.value)} style={inputStyle} />
      <input placeholder="Variant B label" value={variantB} onChange={e => setVariantB(e.target.value)} style={inputStyle} />
      <button onClick={handleCreate} style={btnStyle('#1d4ed8')}>Create Test</button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: '#475569', fontSize: 13, margin: '8px 0' }}>{text}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</h3>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
  color: '#e2e8f0', padding: '6px 10px', fontSize: 12, outline: 'none',
};

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, border: 'none', borderRadius: 4, color: '#e2e8f0',
  padding: '6px 12px', fontSize: 12, cursor: 'pointer',
});

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'usage' | 'gaps' | 'recommendations' | 'abtests';

export const DocAnalyticsDashboard: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const { topComponents, contentGaps, recommendations, roi, activeTests, popularSearches, refresh } = useDocAnalytics();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'usage', label: 'Usage' },
    { id: 'gaps', label: 'Content Gaps' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'abtests', label: 'A/B Tests' },
  ];

  const handleEndTest = (id: string) => { docsAnalytics.endABTest(id); refresh(); };

  return (
    <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Documentation Analytics</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
                fontSize: 13, color: tab === t.id ? '#60a5fa' : '#64748b',
                borderBottom: tab === t.id ? '2px solid #60a5fa' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
              {t.id === 'recommendations' && recommendations.length > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                  {recommendations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <>
            <ROICard roi={roi} />
            <Section title="Popular Searches">
              {popularSearches.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {popularSearches.map(s => (
                    <span key={s.query} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '4px 10px', fontSize: 12, color: '#94a3b8' }}>
                      {s.query} <strong style={{ color: '#60a5fa' }}>×{s.count}</strong>
                    </span>
                  ))}
                </div>
              ) : <Empty text="No searches recorded yet." />}
            </Section>
          </>
        )}

        {tab === 'usage' && (
          <Section title="Page Usage">
            <UsageTable rows={topComponents} />
          </Section>
        )}

        {tab === 'gaps' && (
          <Section title="Content Gaps">
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px' }}>
              Topics users search for that return few or no results.
            </p>
            <GapList gaps={contentGaps} />
          </Section>
        )}

        {tab === 'recommendations' && (
          <Section title="Optimization Recommendations">
            <RecommendationList items={recommendations} />
          </Section>
        )}

        {tab === 'abtests' && (
          <Section title="A/B Tests">
            <ABTestPanel tests={activeTests} onEnd={handleEndTest} />
            <div style={{ marginTop: 16, borderTop: '1px solid #334155', paddingTop: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748b' }}>Create new test</p>
              <NewABTestForm onCreated={refresh} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

export default DocAnalyticsDashboard;
