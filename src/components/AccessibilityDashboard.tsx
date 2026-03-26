import React, { useState, useCallback, useEffect } from 'react';
import { accessibilityAuditor } from '../services/a11y/accessibilityAuditor';
import { accessibilityManager } from '../services/a11y/accessibilityManager';
import { contrastChecker } from '../services/a11y/contrastChecker';
import { complianceMonitor } from '../services/a11y/complianceMonitor';
import { a11yFeedbackCollector } from '../services/a11y/feedbackCollector';
import type { A11yAuditReport } from '../services/a11y/accessibilityAuditor';
import type { A11yFeedback } from '../services/a11y/feedbackCollector';

type Tab = 'audit' | 'contrast' | 'compliance' | 'feedback' | 'remediation';

const card: React.CSSProperties = { backgroundColor: 'white', padding: '16px', borderRadius: '6px', marginBottom: '12px' };
const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
  backgroundColor: color, color: 'white', fontSize: '11px', marginLeft: '6px',
});

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
      backgroundColor: active ? '#007bff' : '#e9ecef', color: active ? 'white' : '#333',
    }}>
      {label}
    </button>
  );
}

/**
 * Accessibility Testing Dashboard
 * Covers WCAG auditing, contrast checking, compliance monitoring, feedback, and remediation
 */
export function AccessibilityDashboard(): JSX.Element {
  const [tab, setTab] = useState<Tab>('audit');
  const [report, setReport] = useState<A11yAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [contrastIssues, setContrastIssues] = useState<any[]>([]);
  const [manualContrast, setManualContrast] = useState({ fg: '#000000', bg: '#ffffff' });
  const [manualResult, setManualResult] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [topIssues, setTopIssues] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<A11yFeedback[]>([]);
  const [feedbackForm, setFeedbackForm] = useState({ category: 'other', severity: 'minor', description: '' } as any);
  const [remediations] = useState(() => a11yFeedbackCollector.getAllRemediations());
  const [selectedRemediation, setSelectedRemediation] = useState<any>(null);

  const runAudit = useCallback(() => {
    setIsAuditing(true);
    const result = accessibilityAuditor.audit();
    complianceMonitor.record(result);
    accessibilityManager.updateMetrics({
      issuesFound: result.totalIssues,
      wcagLevel: result.wcagLevel,
      complianceScore: result.score,
    });
    setReport(result);
    setTrend(complianceMonitor.getTrend());
    setTopIssues(complianceMonitor.getTopIssues());
    setIsAuditing(false);
  }, []);

  useEffect(() => {
    setFeedback(a11yFeedbackCollector.getAll());
  }, []);

  const runContrastAudit = () => setContrastIssues(contrastChecker.auditPage());

  const checkManualContrast = () => {
    const result = contrastChecker.check(manualContrast.fg, manualContrast.bg);
    setManualResult(result);
  };

  const submitFeedback = () => {
    if (!feedbackForm.description.trim()) return;
    a11yFeedbackCollector.submit(feedbackForm);
    setFeedback(a11yFeedbackCollector.getAll());
    setFeedbackForm({ category: 'other', severity: 'minor', description: '' });
  };

  const resolveFeedback = (id: string) => {
    a11yFeedbackCollector.resolve(id);
    setFeedback(a11yFeedbackCollector.getAll());
  };

  const scoreColor = (score: number) => score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : '#dc3545';
  const levelColor = (level: string) => level === 'AAA' ? '#28a745' : level === 'AA' ? '#17a2b8' : '#dc3545';

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 16px 0' }}>♿ Accessibility Testing</h2>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {(['audit', 'contrast', 'compliance', 'feedback', 'remediation'] as Tab[]).map(t => (
          <TabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {/* Audit Tab */}
      {tab === 'audit' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>WCAG Compliance Audit</h3>
            <button onClick={runAudit} disabled={isAuditing} style={{
              padding: '8px 16px', backgroundColor: '#28a745', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}>
              {isAuditing ? 'Auditing…' : 'Run Audit'}
            </button>
          </div>

          {report ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Score', value: `${report.score}/100`, color: scoreColor(report.score) },
                  { label: 'WCAG Level', value: report.wcagLevel, color: levelColor(report.wcagLevel) },
                  { label: 'Errors', value: report.errors, color: report.errors > 0 ? '#dc3545' : '#28a745' },
                  { label: 'Warnings', value: report.warnings, color: report.warnings > 0 ? '#ffc107' : '#28a745' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>{label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
                  </div>
                ))}
              </div>

              {report.issues.length === 0 ? (
                <p style={{ color: '#28a745' }}>✅ No accessibility issues found</p>
              ) : (
                <div>
                  <h4 style={{ margin: '0 0 8px 0' }}>Issues ({report.totalIssues})</h4>
                  {report.issues.map((issue, i) => (
                    <div key={i} style={{
                      padding: '10px', marginBottom: '6px', borderRadius: '4px', fontSize: '13px',
                      backgroundColor: issue.type === 'error' ? '#ffe6e6' : issue.type === 'warning' ? '#fff3cd' : '#e8f4fd',
                      borderLeft: `4px solid ${issue.type === 'error' ? '#dc3545' : issue.type === 'warning' ? '#ffc107' : '#17a2b8'}`,
                    }}>
                      <span style={badge(issue.type === 'error' ? '#dc3545' : issue.type === 'warning' ? '#ffc107' : '#17a2b8')}>
                        {issue.type}
                      </span>
                      <span style={badge('#6c757d')}>{issue.wcagLevel}</span>
                      <span style={{ marginLeft: '8px' }}><strong>{issue.code}</strong> — {issue.message}</span>
                      <button onClick={() => { setSelectedRemediation(a11yFeedbackCollector.getRemediation(issue.code)); setTab('remediation'); }}
                        style={{ float: 'right', fontSize: '11px', padding: '2px 6px', cursor: 'pointer', border: '1px solid #007bff', borderRadius: '3px', color: '#007bff', background: 'none' }}>
                        Fix →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#666', fontSize: '14px' }}>Click "Run Audit" to check WCAG compliance</p>
          )}
        </div>
      )}

      {/* Contrast Tab */}
      {tab === 'contrast' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Color Contrast Checker</h3>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px' }}>
              Foreground
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input type="color" value={manualContrast.fg} onChange={e => setManualContrast(p => ({ ...p, fg: e.target.value }))} />
                <input value={manualContrast.fg} onChange={e => setManualContrast(p => ({ ...p, fg: e.target.value }))}
                  style={{ width: '90px', padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }} />
              </div>
            </label>
            <label style={{ fontSize: '13px' }}>
              Background
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input type="color" value={manualContrast.bg} onChange={e => setManualContrast(p => ({ ...p, bg: e.target.value }))} />
                <input value={manualContrast.bg} onChange={e => setManualContrast(p => ({ ...p, bg: e.target.value }))}
                  style={{ width: '90px', padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }} />
              </div>
            </label>
            <button onClick={checkManualContrast} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Check
            </button>
          </div>

          {manualResult && (
            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '60px', height: '40px', backgroundColor: manualContrast.bg, border: '1px solid #ccc', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: manualContrast.fg, fontSize: '14px', fontWeight: 'bold' }}>Aa</span>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: levelColor(manualResult.level) }}>
                    {manualResult.ratio}:1
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Contrast Ratio</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
                {[
                  { label: 'AA Normal (4.5:1)', pass: manualResult.passesAA },
                  { label: 'AA Large (3:1)', pass: manualResult.passesAALarge },
                  { label: 'AAA Normal (7:1)', pass: manualResult.passesAAA },
                  { label: 'AAA Large (4.5:1)', pass: manualResult.passesAAALarge },
                ].map(({ label, pass }) => (
                  <span key={label} style={badge(pass ? '#28a745' : '#dc3545')}>{pass ? '✓' : '✗'} {label}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>Page Contrast Audit</h4>
            <button onClick={runContrastAudit} style={{ padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              Audit Page
            </button>
          </div>
          {contrastIssues.length === 0 ? (
            <p style={{ color: '#666', fontSize: '13px' }}>Click "Audit Page" to scan all text elements</p>
          ) : contrastIssues.length === 0 ? (
            <p style={{ color: '#28a745' }}>✅ All text elements pass contrast requirements</p>
          ) : (
            contrastIssues.map((issue, i) => (
              <div key={i} style={{ padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
                Ratio <strong>{issue.ratio}:1</strong> — fails AA
                <span style={{ marginLeft: '8px', color: '#666' }}>fg: {issue.foreground} / bg: {issue.background}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {tab === 'compliance' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Compliance Monitoring</h3>
          {trend ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Avg Score</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: scoreColor(complianceMonitor.getAverageScore()) }}>
                    {complianceMonitor.getAverageScore()}
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Trend</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: trend.direction === 'improving' ? '#28a745' : trend.direction === 'degrading' ? '#dc3545' : '#6c757d' }}>
                    {trend.direction === 'improving' ? '↑' : trend.direction === 'degrading' ? '↓' : '→'} {Math.abs(trend.delta)}
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Audits</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{complianceMonitor.getSnapshots().length}</div>
                </div>
              </div>

              {topIssues.length > 0 && (
                <>
                  <h4 style={{ margin: '0 0 8px 0' }}>Top Recurring Issues</h4>
                  {topIssues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}>
                      <span><strong>{issue.code}</strong> — {issue.message}</span>
                      <span>
                        <span style={badge('#6c757d')}>{issue.wcagLevel}</span>
                        <span style={badge('#dc3545')}>{issue.occurrences}×</span>
                      </span>
                    </div>
                  ))}
                </>
              )}

              <h4 style={{ margin: '12px 0 8px 0' }}>Score History</h4>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
                {trend.snapshots.map((s: any, i: number) => (
                  <div key={i} title={`Score: ${s.score}`} style={{
                    flex: 1, backgroundColor: scoreColor(s.score), borderRadius: '2px 2px 0 0',
                    height: `${s.score}%`, minHeight: '4px',
                  }} />
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#666', fontSize: '14px' }}>Run an audit first to populate compliance history</p>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {tab === 'feedback' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>User Feedback</h3>

          <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Report an Issue</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <select value={feedbackForm.category} onChange={e => setFeedbackForm((p: any) => ({ ...p, category: e.target.value }))}
                style={{ padding: '6px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '3px' }}>
                {['navigation', 'contrast', 'screen-reader', 'keyboard', 'other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select value={feedbackForm.severity} onChange={e => setFeedbackForm((p: any) => ({ ...p, severity: e.target.value }))}
                style={{ padding: '6px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '3px' }}>
                {['blocker', 'major', 'minor'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea value={feedbackForm.description} onChange={e => setFeedbackForm((p: any) => ({ ...p, description: e.target.value }))}
              placeholder="Describe the accessibility issue…"
              style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '3px', minHeight: '70px', boxSizing: 'border-box' }} />
            <button onClick={submitFeedback} style={{ marginTop: '8px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Submit
            </button>
          </div>

          {feedback.length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px' }}>No feedback submitted yet</p>
          ) : (
            feedback.map(f => (
              <div key={f.id} style={{
                padding: '10px', marginBottom: '8px', borderRadius: '4px', fontSize: '13px',
                backgroundColor: f.severity === 'blocker' ? '#ffe6e6' : f.severity === 'major' ? '#fff3cd' : '#f8f9fa',
                borderLeft: `4px solid ${f.severity === 'blocker' ? '#dc3545' : f.severity === 'major' ? '#ffc107' : '#6c757d'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    <span style={badge('#6c757d')}>{f.category}</span>
                    <span style={badge(f.severity === 'blocker' ? '#dc3545' : f.severity === 'major' ? '#ffc107' : '#6c757d')}>{f.severity}</span>
                  </span>
                  <button onClick={() => resolveFeedback(f.id)} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', border: '1px solid #28a745', borderRadius: '3px', color: '#28a745', background: 'none' }}>
                    Resolve
                  </button>
                </div>
                <div style={{ marginTop: '6px' }}>{f.description}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Remediation Tab */}
      {tab === 'remediation' && (
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Remediation Guidance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>
            <div>
              {remediations.map(r => (
                <div key={r.issueCode} onClick={() => setSelectedRemediation(r)} style={{
                  padding: '8px', marginBottom: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
                  backgroundColor: selectedRemediation?.issueCode === r.issueCode ? '#007bff' : '#f8f9fa',
                  color: selectedRemediation?.issueCode === r.issueCode ? 'white' : '#333',
                }}>
                  {r.issueCode}
                </div>
              ))}
            </div>
            <div>
              {selectedRemediation ? (
                <>
                  <h4 style={{ margin: '0 0 4px 0' }}>{selectedRemediation.title}</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>{selectedRemediation.wcagCriteria}</p>
                  <ol style={{ margin: '0 0 12px 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {selectedRemediation.steps.map((step: string, i: number) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
                  </ol>
                  {selectedRemediation.codeExample && (
                    <pre style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto' }}>
                      {selectedRemediation.codeExample}
                    </pre>
                  )}
                </>
              ) : (
                <p style={{ color: '#666', fontSize: '14px' }}>Select an issue code to see remediation steps</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccessibilityDashboard;
