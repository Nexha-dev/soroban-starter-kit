import React, { useState, useEffect, useCallback } from 'react';
import { errorHandler } from '../services/error/errorHandler';
import { errorAnalytics } from '../services/error/errorAnalytics';
import { stackTraceAnalyzer } from '../services/error/stackTraceAnalyzer';
import { errorTrendAnalyzer } from '../services/error/errorTrendAnalyzer';
import { userImpactTracker } from '../services/error/userImpactTracker';
import { developerNotifier } from '../services/error/developerNotifier';
import type { ErrorInfo } from '../services/error/errorHandler';
import type { DevAlert } from '../services/error/developerNotifier';

type Tab = 'errors' | 'trends' | 'impact' | 'alerts' | 'rules';

const s = {
  card: { backgroundColor: 'white', padding: '16px', borderRadius: '6px', marginBottom: '12px' } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
    backgroundColor: color, color: 'white', fontSize: '11px', marginLeft: '4px',
  }),
};

const SEV_COLOR: Record<string, string> = { low: '#6c757d', medium: '#ffc107', high: '#fd7e14', critical: '#dc3545' };
const CAT_COLOR: Record<string, string> = { network: '#17a2b8', validation: '#6c757d', auth: '#dc3545', permission: '#fd7e14', server: '#e83e8c', client: '#6f42c1', unknown: '#adb5bd' };

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
      backgroundColor: active ? '#007bff' : '#e9ecef', color: active ? 'white' : '#333',
    }}>{label}</button>
  );
}

function ErrorRow({ error, onSelect }: { error: ErrorInfo; onSelect: (e: ErrorInfo) => void }) {
  return (
    <div onClick={() => onSelect(error)} style={{
      padding: '10px', marginBottom: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
      backgroundColor: error.severity === 'critical' ? '#ffe6e6' : error.severity === 'high' ? '#fff3cd' : '#f8f9fa',
      borderLeft: `4px solid ${SEV_COLOR[error.severity]}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <span style={s.badge(SEV_COLOR[error.severity])}>{error.severity}</span>
          <span style={s.badge(CAT_COLOR[error.category] ?? '#6c757d')}>{error.category}</span>
          <span style={{ marginLeft: '8px', fontWeight: 500 }}>{error.message.slice(0, 80)}</span>
        </span>
        <span style={{ color: '#999', fontSize: '11px' }}>{new Date(error.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

function ErrorDetail({ error, onClose }: { error: ErrorInfo; onClose: () => void }) {
  const analysis = stackTraceAnalyzer.analyze(error.stack, error.context);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSev, setFeedbackSev] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    userImpactTracker.submitFeedback(error.id, feedbackText, feedbackSev);
    setSubmitted(true);
  };

  return (
    <div style={{ ...s.card, borderLeft: `4px solid ${SEV_COLOR[error.severity]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Error Detail</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
      </div>

      <div style={{ marginBottom: '12px', fontSize: '13px' }}>
        <div><strong>Message:</strong> {error.message}</div>
        <div><strong>Category:</strong> <span style={s.badge(CAT_COLOR[error.category] ?? '#6c757d')}>{error.category}</span></div>
        <div><strong>Severity:</strong> <span style={s.badge(SEV_COLOR[error.severity])}>{error.severity}</span></div>
        <div><strong>Origin:</strong> <code style={{ fontSize: '12px' }}>{analysis.origin}</code></div>
        {error.retryable && <div style={{ color: '#28a745' }}>✓ Retryable</div>}
      </div>

      {analysis.reproductionSteps.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ fontSize: '13px' }}>Reproduction Steps</strong>
          <ol style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
            {analysis.reproductionSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {analysis.debugHints.length > 0 && (
        <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#e8f4fd', borderRadius: '4px' }}>
          <strong style={{ fontSize: '13px' }}>🔧 Debug Hints</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
            {analysis.debugHints.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}

      {error.stack && (
        <details style={{ marginBottom: '12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>Stack Trace ({analysis.frames.length} frames)</summary>
          <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', fontSize: '11px', overflowX: 'auto', marginTop: '6px' }}>
            {stackTraceAnalyzer.formatStack(analysis.frames)}
          </pre>
        </details>
      )}

      <div style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
        <strong style={{ fontSize: '13px' }}>Submit Feedback</strong>
        {submitted ? (
          <p style={{ color: '#28a745', fontSize: '13px', margin: '6px 0 0 0' }}>✓ Feedback submitted</p>
        ) : (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={feedbackSev} onChange={e => setFeedbackSev(e.target.value as any)}
              style={{ padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}>
              {['low', 'medium', 'high'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
              placeholder="Describe what you were doing…"
              style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }} />
            <button onClick={submitFeedback} style={{ padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Error Tracking & Reporting Dashboard
 */
export function ErrorDashboard(): JSX.Element {
  const [tab, setTab] = useState<Tab>('errors');
  const [errors, setErrors] = useState<ErrorInfo[]>(() => errorHandler.getErrors());
  const [alerts, setAlerts] = useState<DevAlert[]>(() => developerNotifier.getAlerts());
  const [selectedError, setSelectedError] = useState<ErrorInfo | null>(null);
  const [trend, setTrend] = useState(() => errorTrendAnalyzer.getSummary());
  const [metrics, setMetrics] = useState(() => errorAnalytics.getMetrics());
  const [impactRecords, setImpactRecords] = useState(() => userImpactTracker.getTopImpact());
  const [feedback, setFeedback] = useState(() => userImpactTracker.getFeedback());
  const [rules, setRules] = useState(() => developerNotifier.getRules());
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const refresh = useCallback(() => {
    setErrors(errorHandler.getErrors());
    setAlerts(developerNotifier.getAlerts());
    setTrend(errorTrendAnalyzer.getSummary());
    setMetrics(errorAnalytics.getMetrics());
    setImpactRecords(userImpactTracker.getTopImpact());
    setFeedback(userImpactTracker.getFeedback());
    setRules(developerNotifier.getRules());
  }, []);

  useEffect(() => {
    const unsub = errorHandler.subscribe(err => {
      errorTrendAnalyzer.record(err);
      userImpactTracker.record(err);
      developerNotifier.evaluate(err);
      refresh();
    });
    const unsub2 = developerNotifier.subscribe(() => setAlerts(developerNotifier.getAlerts()));
    return () => { unsub(); unsub2(); };
  }, [refresh]);

  const filteredErrors = errors.filter(e =>
    (severityFilter === 'all' || e.severity === severityFilter) &&
    (categoryFilter === 'all' || e.category === categoryFilter)
  );

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>🐛 Error Tracking</h2>
        <button onClick={() => { errorHandler.clearErrors(); refresh(); }}
          style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          Clear All
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Total Errors', value: metrics.totalErrors, color: '#dc3545' },
          { label: 'Critical', value: errors.filter(e => e.severity === 'critical').length, color: '#dc3545' },
          { label: 'Unresolved', value: userImpactTracker.getAll().length, color: '#fd7e14' },
          { label: 'Alerts', value: unacknowledgedAlerts, color: unacknowledgedAlerts > 0 ? '#dc3545' : '#28a745' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <TabBtn label="Errors" active={tab === 'errors'} onClick={() => setTab('errors')} />
        <TabBtn label="Trends" active={tab === 'trends'} onClick={() => setTab('trends')} />
        <TabBtn label="User Impact" active={tab === 'impact'} onClick={() => setTab('impact')} />
        <TabBtn label={`Alerts${unacknowledgedAlerts > 0 ? ` (${unacknowledgedAlerts})` : ''}`} active={tab === 'alerts'} onClick={() => setTab('alerts')} />
        <TabBtn label="Alert Rules" active={tab === 'rules'} onClick={() => setTab('rules')} />
      </div>

      {/* Errors Tab */}
      {tab === 'errors' && (
        <div>
          {selectedError && <ErrorDetail error={selectedError} onClose={() => setSelectedError(null)} />}
          <div style={s.card}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                style={{ padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}>
                {['all', 'critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                style={{ padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}>
                {['all', 'network', 'validation', 'auth', 'permission', 'server', 'client', 'unknown'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ fontSize: '12px', color: '#666', alignSelf: 'center' }}>{filteredErrors.length} errors</span>
            </div>
            {filteredErrors.length === 0 ? (
              <p style={{ color: '#28a745', fontSize: '14px' }}>✅ No errors recorded</p>
            ) : (
              [...filteredErrors].reverse().map(e => (
                <ErrorRow key={e.id} error={e} onSelect={setSelectedError} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {tab === 'trends' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Error Trends</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Trend</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: trend.trend === 'increasing' ? '#dc3545' : trend.trend === 'decreasing' ? '#28a745' : '#6c757d' }}>
                {trend.trend === 'increasing' ? '↑' : trend.trend === 'decreasing' ? '↓' : '→'} {trend.trend}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: trend.spike ? '#ffe6e6' : '#f8f9fa', borderRadius: '4px', textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Spike</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: trend.spike ? '#dc3545' : '#28a745' }}>
                {trend.spike ? '⚠️ Yes' : '✅ No'}
              </div>
            </div>
          </div>

          {trend.buckets.length > 0 && (
            <>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Error Rate (last {trend.buckets.length} minutes)</h4>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '60px', marginBottom: '16px' }}>
                {trend.buckets.map((b, i) => {
                  const max = Math.max(...trend.buckets.map(x => x.count), 1);
                  return (
                    <div key={i} title={`${b.count} errors at ${new Date(b.timestamp).toLocaleTimeString()}`} style={{
                      flex: 1, backgroundColor: b.count > trend.spikeThreshold ? '#dc3545' : '#007bff',
                      borderRadius: '2px 2px 0 0', height: `${(b.count / max) * 100}%`, minHeight: '2px',
                    }} />
                  );
                })}
              </div>
            </>
          )}

          {trend.preventionStrategies.length > 0 && (
            <>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Prevention Strategies</h4>
              {trend.preventionStrategies.map((s, i) => (
                <div key={i} style={{ padding: '8px 12px', backgroundColor: '#e8f4fd', borderRadius: '4px', marginBottom: '6px', fontSize: '13px', borderLeft: '3px solid #007bff' }}>
                  💡 {s}
                </div>
              ))}
            </>
          )}

          <h4 style={{ margin: '12px 0 8px 0', fontSize: '13px' }}>Errors by Category</h4>
          {Object.entries(metrics.errorsByCategory).map(([cat, count]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
              <span><span style={s.badge(CAT_COLOR[cat] ?? '#6c757d')}>{cat}</span></span>
              <strong>{count as number}</strong>
            </div>
          ))}
        </div>
      )}

      {/* User Impact Tab */}
      {tab === 'impact' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>User Impact</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
            {userImpactTracker.getTotalAffectedSessions()} session(s) affected this session
          </p>
          {impactRecords.length === 0 ? (
            <p style={{ color: '#28a745', fontSize: '14px' }}>✅ No unresolved impact records</p>
          ) : (
            impactRecords.map((r, i) => (
              <div key={i} style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <code style={{ fontSize: '12px', color: '#555' }}>{r.errorKey}</code>
                  <span>
                    <span style={s.badge('#dc3545')}>{r.occurrences}×</span>
                    <span style={s.badge('#fd7e14')}>{r.affectedSessions} sessions</span>
                  </span>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                  <input placeholder="Resolution note…" id={`res-${i}`}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }} />
                  <button onClick={() => {
                    const val = (document.getElementById(`res-${i}`) as HTMLInputElement)?.value;
                    if (val) { userImpactTracker.resolve(r.errorKey, val); setImpactRecords(userImpactTracker.getTopImpact()); }
                  }} style={{ padding: '4px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>
                    Resolve
                  </button>
                </div>
              </div>
            ))
          )}

          {feedback.length > 0 && (
            <>
              <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px' }}>User Feedback ({feedback.length})</h4>
              {feedback.map(f => (
                <div key={f.id} style={{ padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={s.badge(f.severity === 'high' ? '#dc3545' : f.severity === 'medium' ? '#ffc107' : '#6c757d')}>{f.severity}</span>
                  <span style={{ marginLeft: '8px' }}>{f.description}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Developer Alerts</h3>
          {alerts.length === 0 ? (
            <p style={{ color: '#28a745', fontSize: '14px' }}>✅ No active alerts</p>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} style={{
                padding: '10px', marginBottom: '8px', borderRadius: '4px', fontSize: '13px',
                backgroundColor: '#ffe6e6', borderLeft: '4px solid #dc3545',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{alert.ruleName}</strong> — {alert.message}</span>
                  <button onClick={() => { developerNotifier.acknowledge(alert.id); setAlerts(developerNotifier.getAlerts()); }}
                    style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #28a745', borderRadius: '3px', color: '#28a745', background: 'none', cursor: 'pointer' }}>
                    Acknowledge
                  </button>
                </div>
                <div style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>{new Date(alert.timestamp).toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Alert Rules Tab */}
      {tab === 'rules' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Alert Rules</h3>
          {rules.map(rule => (
            <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '8px', fontSize: '13px' }}>
              <div>
                <strong>{rule.name}</strong>
                <span style={{ color: '#666', marginLeft: '8px' }}>
                  {rule.condition} {rule.condition === 'rate' ? `≥ ${rule.value}/min` : `= ${rule.value}`}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={rule.enabled}
                  onChange={e => { developerNotifier.updateRule(rule.id, { enabled: e.target.checked }); setRules(developerNotifier.getRules()); }} />
                {rule.enabled ? <span style={{ color: '#28a745' }}>Enabled</span> : <span style={{ color: '#999' }}>Disabled</span>}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ErrorDashboard;
