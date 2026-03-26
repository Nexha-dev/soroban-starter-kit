import React, { useState, useEffect, useCallback } from 'react';
import { performanceMetricsCollector } from '../services/performance/metricsCollector';
import { performanceBudgetManager } from '../services/performance/budgetManager';
import { performanceAnalyzer } from '../services/performance/analyzer';
import { bundleAnalyzer } from '../services/performance/bundleAnalyzer';
import { imageOptimizer } from '../services/performance/imageOptimizer';
import { cacheStrategyManager } from '../services/performance/cacheStrategyManager';
import { uxCorrelator } from '../services/performance/uxCorrelator';

type Tab = 'vitals' | 'bundle' | 'images' | 'cache' | 'ux' | 'alerts';

const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  lcp: [2500, 4000],
  fid: [100, 300],
  cls: [0.1, 0.25],
  ttfb: [800, 1800],
  fcp: [1800, 3000],
};

function vitalStatus(metric: string, value: number): '✅' | '⚠️' | '❌' {
  const [good, poor] = VITAL_THRESHOLDS[metric] ?? [Infinity, Infinity];
  if (value <= good) return '✅';
  if (value <= poor) return '⚠️';
  return '❌';
}
import { useBottlenecks, useRecommendations, usePerformanceViolations } from '../hooks/usePerformance';

/**
 * Performance Optimization Dashboard
 * Covers bundle analysis, image optimization, caching, UX correlation, and budgets
 */
export function PerformanceDashboard(): JSX.Element {
  const [tab, setTab] = useState<Tab>('vitals');
  const [vitals, setVitals] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [bundleReport, setBundleReport] = useState<any>(null);
  const [imageReport, setImageReport] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any[]>([]);
  const [uxInsights, setUxInsights] = useState<any[]>([]);
  const [uxCorrelations, setUxCorrelations] = useState<any[]>([]);
  const [tab, setTab] = useState<'vitals' | 'alerts' | 'recommendations' | 'bottlenecks' | 'violations'>('vitals');
  const bottlenecks = useBottlenecks();
  const recommendations = useRecommendations();
  const violations = usePerformanceViolations();

  const refresh = useCallback(() => {
    const currentVitals = performanceMetricsCollector.getVitals() as Record<string, number>;
    setVitals(currentVitals);

    Object.entries(currentVitals).forEach(([k, v]) => performanceBudgetManager.checkBudget(k, v));
    setAlerts(performanceBudgetManager.getAlerts().slice(-20));

    const snapshots = performanceMetricsCollector.getSnapshots();
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      setAnalysis(performanceAnalyzer.analyze(latest.vitals, latest.memory));
    }

    setUxInsights(uxCorrelator.generateInsights(currentVitals));
    setUxCorrelations(
      Object.entries(currentVitals)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => uxCorrelator.correlate(k, v))
    );
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const runBundleAnalysis = () => setBundleReport(bundleAnalyzer.analyze());
  const runImageAudit = () => setImageReport(imageOptimizer.audit());
  const applyLazyLoading = () => {
    const count = imageOptimizer.applyLazyLoading();
    alert(`Applied lazy loading to ${count} image(s)`);
    runImageAudit();
  };
  const loadCacheStats = async () => setCacheStats(await cacheStrategyManager.getCacheStats());

  const tabStyle = (t: Tab) => ({
    padding: '8px 14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: tab === t ? '#007bff' : '#e9ecef',
    color: tab === t ? 'white' : '#333',
    fontSize: '13px',
  });

  const card = { backgroundColor: 'white', padding: '16px', borderRadius: '6px', marginBottom: '12px' };
  const badge = (color: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
    backgroundColor: color, color: 'white', fontSize: '11px', marginLeft: '6px',
  });

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 16px 0' }}>⚡ Performance Optimization</h2>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {(['vitals', 'bundle', 'images', 'cache', 'ux', 'alerts'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t === 'alerts' ? `Alerts (${alerts.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
      <h2>Performance Dashboard</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setTab('vitals')}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'vitals' ? '#007bff' : '#ddd',
            color: tab === 'vitals' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Core Web Vitals
        </button>
        <button
          onClick={() => setTab('alerts')}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'alerts' ? '#007bff' : '#ddd',
            color: tab === 'alerts' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setTab('recommendations')}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'recommendations' ? '#007bff' : '#ddd',
            color: tab === 'recommendations' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Recommendations
        </button>
        <button
          onClick={() => setTab('bottlenecks')}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'bottlenecks' ? '#007bff' : '#ddd',
            color: tab === 'bottlenecks' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Bottlenecks ({bottlenecks.length})
        </button>
        <button
          onClick={() => setTab('violations')}
          style={{
            padding: '8px 16px',
            backgroundColor: tab === 'violations' ? '#007bff' : '#ddd',
            color: tab === 'violations' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Violations ({violations.length})
        </button>
      </div>

      {/* Core Web Vitals */}
      {tab === 'vitals' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Core Web Vitals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { key: 'lcp', label: 'LCP', fmt: (v: number) => `${v.toFixed(0)}ms` },
              { key: 'fid', label: 'FID', fmt: (v: number) => `${v.toFixed(0)}ms` },
              { key: 'cls', label: 'CLS', fmt: (v: number) => v.toFixed(3) },
              { key: 'ttfb', label: 'TTFB', fmt: (v: number) => `${v.toFixed(0)}ms` },
              { key: 'fcp', label: 'FCP', fmt: (v: number) => `${v.toFixed(0)}ms` },
            ].map(({ key, label, fmt }) => (
              <div key={key} style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {vitalStatus(key, vitals[key] || 0)} {vitals[key] ? fmt(vitals[key]) : '—'}
                </div>
              </div>
            ))}
          </div>
          {analysis && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e8f4fd', borderRadius: '4px' }}>
              <strong>Performance Score: {analysis.score}/100</strong>
              {analysis.issues.length > 0 && (
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                  {analysis.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bundle Analysis */}
      {tab === 'bundle' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Bundle Analysis</h3>
            <button onClick={runBundleAnalysis} style={{ ...tabStyle('bundle'), backgroundColor: '#28a745' }}>
              Analyze Now
            </button>
          </div>
          {bundleReport ? (
            <>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                Total transfer: <strong>{(bundleReport.totalSize / 1024).toFixed(1)}KB</strong> across{' '}
                <strong>{bundleReport.chunks.length}</strong> chunks
              </p>
              <div style={{ marginBottom: '12px' }}>
                {bundleReport.chunks.map((chunk: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                    <span>{chunk.name}</span>
                    <span>
                      <span style={badge(chunk.type === 'vendor' ? '#6c757d' : chunk.type === 'async' ? '#17a2b8' : '#007bff')}>
                        {chunk.type}
                      </span>
                      {' '}{(chunk.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                ))}
              </div>
              <h4 style={{ margin: '12px 0 8px 0' }}>Recommendations</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {bundleReport.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
              {bundleReport.splitOpportunities.length > 0 && (
                <>
                  <h4 style={{ margin: '12px 0 8px 0' }}>Code Split Opportunities</h4>
                  {bundleReport.splitOpportunities.map((op: any, i: number) => (
                    <div key={i} style={{ padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}>
                      <strong>{op.route}</strong>
                      <span style={badge(op.priority === 'high' ? '#dc3545' : op.priority === 'medium' ? '#fd7e14' : '#6c757d')}>
                        {op.priority}
                      </span>
                      {' '}— save ~{(op.estimatedSavings / 1024).toFixed(0)}KB on initial load
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <p style={{ color: '#666', fontSize: '14px' }}>Click "Analyze Now" to inspect bundle composition</p>
          )}
        </div>
      )}

      {/* Image Optimization */}
      {tab === 'images' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Image Optimization</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={runImageAudit} style={{ ...tabStyle('images'), backgroundColor: '#28a745' }}>Audit</button>
              <button onClick={applyLazyLoading} style={{ ...tabStyle('images'), backgroundColor: '#17a2b8' }}>Apply Lazy Loading</button>
            </div>
          </div>
          {imageReport ? (
            <>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                {imageReport.images.length} images · {(imageReport.totalSize / 1024).toFixed(1)}KB total ·{' '}
                <strong style={{ color: '#28a745' }}>~{(imageReport.potentialSavings / 1024).toFixed(1)}KB potential savings</strong>
              </p>
              {imageReport.recommendations.length === 0 ? (
                <p style={{ color: '#28a745' }}>✅ All images are optimized</p>
              ) : (
                imageReport.recommendations.map((rec: any, i: number) => (
                  <div key={i} style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '8px', fontSize: '13px' }}>
                    <div><strong>{rec.issue}</strong></div>
                    <div style={{ color: '#555', marginTop: '4px' }}>💡 {rec.suggestion}</div>
                    {rec.estimatedSavings > 0 && (
                      <div style={{ color: '#28a745', marginTop: '4px' }}>Save ~{(rec.estimatedSavings / 1024).toFixed(1)}KB</div>
                    )}
                  </div>
                ))
              )}
            </>
          ) : (
            <p style={{ color: '#666', fontSize: '14px' }}>Click "Audit" to analyze images on this page</p>
          )}
        </div>
      )}

      {/* Cache Strategies */}
      {tab === 'cache' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Cache Strategies</h3>
            <button onClick={loadCacheStats} style={{ ...tabStyle('cache'), backgroundColor: '#28a745' }}>Load Stats</button>
          </div>
          <h4 style={{ margin: '0 0 8px 0' }}>Active Rules</h4>
          <div style={{ fontSize: '13px' }}>
            {cacheStrategyManager.getRules().map((rule, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <code style={{ fontSize: '12px', color: '#555' }}>{rule.pattern.toString()}</code>
                <span>
                  <span style={badge('#007bff')}>{rule.strategy}</span>
                  {' '}{rule.maxAge >= 86400 ? `${rule.maxAge / 86400}d` : `${rule.maxAge}s`}
                </span>
              </div>
            ))}
          </div>
          {cacheStats.length > 0 && (
            <>
              <h4 style={{ margin: '16px 0 8px 0' }}>Cache Storage</h4>
              {cacheStats.map((stat, i) => (
                <div key={i} style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}>
                  <strong>{stat.cacheName}</strong> — {stat.entries} entries
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* UX Correlation */}
      {tab === 'ux' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>UX & Performance Correlation</h3>
          {uxInsights.length > 0 && (
            <>
              <h4 style={{ margin: '0 0 8px 0' }}>Automated Insights</h4>
              {uxInsights.map((insight, i) => (
                <div key={i} style={{
                  padding: '10px', borderRadius: '4px', marginBottom: '8px', fontSize: '13px',
                  backgroundColor: insight.impact === 'high' ? '#ffe6e6' : insight.impact === 'medium' ? '#fff3cd' : '#e8f4fd',
                  borderLeft: `4px solid ${insight.impact === 'high' ? '#dc3545' : insight.impact === 'medium' ? '#ffc107' : '#17a2b8'}`,
                }}>
                  <div><strong>{insight.title}</strong> <span style={badge(insight.impact === 'high' ? '#dc3545' : '#fd7e14')}>{insight.impact}</span></div>
                  <div style={{ color: '#555', marginTop: '4px' }}>{insight.description}</div>
                  {insight.automatedFix && (
                    <div style={{ color: '#007bff', marginTop: '4px' }}>🔧 {insight.automatedFix}</div>
                  )}
                </div>
              ))}
            </>
          )}
          {uxCorrelations.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 8px 0' }}>Metric → UX Score</h4>
              {uxCorrelations.map((corr, i) => (
                <div key={i} style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{corr.metric.toUpperCase()}</strong>
                    <span>
                      UX Score: <strong>{corr.uxScore}/100</strong>
                      <span style={badge(corr.bounceRisk === 'high' ? '#dc3545' : corr.bounceRisk === 'medium' ? '#ffc107' : '#28a745')}>
                        {corr.bounceRisk} bounce risk
                      </span>
                    </span>
                  </div>
                  <div style={{ color: '#555', marginTop: '4px' }}>{corr.insight}</div>
                </div>
              ))}
            </>
          )}
          {uxInsights.length === 0 && uxCorrelations.length === 0 && (
            <p style={{ color: '#666', fontSize: '14px' }}>Collecting UX signals — interact with the page to generate data</p>
          )}
        </div>
      )}

      {/* Alerts */}
      {tab === 'alerts' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Budget Alerts</h3>
            <button onClick={() => { performanceBudgetManager.clearAlerts(); setAlerts([]); }}
              style={{ ...tabStyle('alerts'), backgroundColor: '#dc3545' }}>Clear</button>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: '#28a745' }}>✅ No budget violations</p>
          ) : (
            alerts.map((alert, i) => (
              <div key={i} style={{
                padding: '10px', marginBottom: '8px', borderRadius: '4px', fontSize: '13px',
                backgroundColor: alert.severity === 'critical' ? '#ffe6e6' : '#fff3cd',
                borderLeft: `4px solid ${alert.severity === 'critical' ? '#dc3545' : '#ffc107'}`,
              }}>
                <strong>{alert.budgetName}</strong>: {alert.currentValue.toFixed(2)} exceeds threshold {alert.threshold.toFixed(2)}
                <span style={badge(alert.severity === 'critical' ? '#dc3545' : '#ffc107')}>{alert.severity}</span>
              </div>
            ))
          )}
          <h4 style={{ margin: '16px 0 8px 0' }}>Active Budgets</h4>
          {performanceBudgetManager.getBudgets().map((budget, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
              <span>{budget.name}</span>
              <span>{budget.threshold}{budget.unit} <span style={badge(budget.enabled ? '#28a745' : '#6c757d')}>{budget.enabled ? 'on' : 'off'}</span></span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bottlenecks' && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <h3>Bottlenecks</h3>
          {bottlenecks.length === 0 ? (
            <p>No bottlenecks detected</p>
          ) : (
            bottlenecks.map((b, idx) => (
              <div key={idx} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>{b.operationName}</strong> ({b.type})</p>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                  Mean: {b.meanDurationMs.toFixed(2)}ms &nbsp;|&nbsp; Percentile rank: {b.percentileRank.toFixed(1)}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'violations' && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <h3>Budget Violations</h3>
          {violations.length === 0 ? (
            <p>No violations recorded</p>
          ) : (
            violations.slice(-20).map((v, idx) => (
              <div key={idx} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>{v.metricName}</strong></p>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                  Measured: {v.measuredValue.toFixed(2)} &nbsp;|&nbsp; Threshold: {v.thresholdValue.toFixed(2)} &nbsp;|&nbsp; {new Date(v.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PerformanceDashboard;
