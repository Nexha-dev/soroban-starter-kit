import React, { useState, useEffect } from 'react';
import { performanceMetricsCollector } from '../services/performance/metricsCollector';
import { performanceBudgetManager } from '../services/performance/budgetManager';
import { performanceAnalyzer } from '../services/performance/analyzer';

/**
 * Performance Monitoring Dashboard Component
 */
export function PerformanceDashboard(): JSX.Element {
  const [vitals, setVitals] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [tab, setTab] = useState<'vitals' | 'alerts' | 'recommendations'>('vitals');

  useEffect(() => {
    const interval = setInterval(() => {
      const currentVitals = performanceMetricsCollector.getVitals();
      setVitals(currentVitals);

      // Check budgets
      Object.entries(currentVitals).forEach(([key, value]) => {
        performanceBudgetManager.checkBudget(key, value as number);
      });

      // Update alerts
      setAlerts(performanceBudgetManager.getAlerts());

      // Analyze
      const snapshots = performanceMetricsCollector.getSnapshots();
      if (snapshots.length > 0) {
        const latest = snapshots[snapshots.length - 1];
        const result = performanceAnalyzer.analyze(latest.vitals, latest.memory);
        setAnalysis(result);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getVitalStatus = (metric: string, value: number): string => {
    const thresholds: Record<string, number> = {
      lcp: 2500,
      fid: 100,
      cls: 0.1,
    };
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    return value <= threshold ? '✅' : value <= threshold * 1.5 ? '⚠️' : '❌';
  };

  return (
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
      </div>

      {tab === 'vitals' && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <h3>Core Web Vitals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            <div>
              <p>
                <strong>LCP:</strong> {getVitalStatus('lcp', vitals.lcp || 0)} {(vitals.lcp || 0).toFixed(0)}ms
              </p>
            </div>
            <div>
              <p>
                <strong>FID:</strong> {getVitalStatus('fid', vitals.fid || 0)} {(vitals.fid || 0).toFixed(0)}ms
              </p>
            </div>
            <div>
              <p>
                <strong>CLS:</strong> {getVitalStatus('cls', vitals.cls || 0)} {(vitals.cls || 0).toFixed(3)}
              </p>
            </div>
            <div>
              <p>
                <strong>TTFB:</strong> {(vitals.ttfb || 0).toFixed(0)}ms
              </p>
            </div>
            <div>
              <p>
                <strong>FCP:</strong> {(vitals.fcp || 0).toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <h3>Performance Alerts</h3>
          {alerts.length === 0 ? (
            <p>No alerts</p>
          ) : (
            alerts.slice(-10).map((alert, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: alert.severity === 'critical' ? '#ffe6e6' : '#fff3cd',
                  borderLeft: `4px solid ${alert.severity === 'critical' ? '#dc3545' : '#ffc107'}`,
                }}
              >
                <strong>{alert.budgetName}:</strong> {alert.currentValue.toFixed(2)} (threshold: {alert.threshold.toFixed(2)})
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'recommendations' && (
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <h3>Recommendations</h3>
          {analysis ? (
            <>
              <p>
                <strong>Score:</strong> {analysis.score}/100
              </p>
              {analysis.recommendations.map((rec: any, idx: number) => (
                <div key={idx} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 5px 0' }}>
                    <strong>{rec.title}</strong> ({rec.impact})
                  </p>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>{rec.description}</p>
                </div>
              ))}
            </>
          ) : (
            <p>No analysis available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default PerformanceDashboard;
