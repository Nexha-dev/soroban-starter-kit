import React, { useState } from 'react';
import {
  TroubleshootingIssue,
  IssueCategory,
  IssueSeverity,
  SOROBAN_ISSUES,
  searchIssues,
  diagnoseFromSymptoms,
  getIssuesByCategory,
  submitFeedback,
  getSolutionEffectiveness,
} from '../services/troubleshooting';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const CATEGORY_ICONS: Record<IssueCategory, string> = {
  wallet: '👛',
  contract: '📄',
  network: '🌐',
  transaction: '💸',
  build: '🔨',
  deployment: '🚀',
  other: '❓',
};

const CATEGORIES: IssueCategory[] = ['wallet', 'contract', 'network', 'transaction', 'build', 'deployment', 'other'];

// ── Issue Detail ──────────────────────────────────────────────────────────────

function IssueDetail({ issue, onBack }: { issue: TroubleshootingIssue; onBack: () => void }) {
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});
  const effectiveness = getSolutionEffectiveness(issue.id);

  function handleFeedback(solutionId: string, helpful: boolean) {
    submitFeedback({ issueId: issue.id, solutionId, helpful });
    setFeedbackGiven(prev => ({ ...prev, [solutionId]: true }));
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        ← Back to issues
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>{CATEGORY_ICONS[issue.category]}</span>
        <h2 style={{ margin: 0, color: '#f1f5f9' }}>{issue.title}</h2>
        <span style={{ background: SEVERITY_COLORS[issue.severity], color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 12 }}>{issue.severity}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {issue.tags.map(t => <span key={t} style={{ background: '#1e293b', color: '#64748b', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{t}</span>)}
      </div>

      {/* Symptoms */}
      <Section title="🔍 Symptoms">
        <ul style={{ margin: 0, paddingLeft: 20, color: '#94a3b8' }}>
          {issue.symptoms.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
        </ul>
      </Section>

      {/* Causes */}
      <Section title="⚠️ Possible Causes">
        <ul style={{ margin: 0, paddingLeft: 20, color: '#94a3b8' }}>
          {issue.causes.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
        </ul>
      </Section>

      {/* Diagnostic Steps */}
      <Section title="🩺 Diagnostic Steps">
        <ol style={{ margin: 0, paddingLeft: 20, color: '#94a3b8' }}>
          {issue.diagnosticSteps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
        </ol>
      </Section>

      {/* Solutions */}
      <Section title="✅ Solutions">
        {issue.solutions.map(sol => (
          <div key={sol.id} style={{ background: '#0f172a', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
            <button onClick={() => setExpandedSolution(expandedSolution === sol.id ? null : sol.id)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontWeight: 600 }}>{sol.description}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 12 }}>⭐ {effectiveness[sol.id] ?? sol.effectivenessScore}% effective</span>
                <span style={{ color: '#64748b' }}>{expandedSolution === sol.id ? '▲' : '▼'}</span>
              </div>
            </button>

            {expandedSolution === sol.id && (
              <div style={{ padding: '0 16px 16px' }}>
                <ol style={{ margin: '0 0 12px', paddingLeft: 20, color: '#94a3b8' }}>
                  {sol.steps.map((step, i) => <li key={i} style={{ marginBottom: 6 }}>{step}</li>)}
                </ol>
                {sol.codeExample && (
                  <pre style={{ background: '#1e293b', borderRadius: 6, padding: 12, color: '#86efac', fontSize: 12, overflowX: 'auto', margin: '0 0 12px' }}>
                    {sol.codeExample}
                  </pre>
                )}
                {!feedbackGiven[sol.id] ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#64748b', fontSize: 12 }}>Was this helpful?</span>
                    <button onClick={() => handleFeedback(sol.id, true)} style={{ padding: '4px 12px', background: '#166534', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>👍 Yes</button>
                    <button onClick={() => handleFeedback(sol.id, false)} style={{ padding: '4px 12px', background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>👎 No</button>
                  </div>
                ) : (
                  <span style={{ color: '#64748b', fontSize: 12 }}>Thanks for your feedback!</span>
                )}
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Expert Tips */}
      {issue.expertTips && issue.expertTips.length > 0 && (
        <Section title="💡 Expert Tips">
          <ul style={{ margin: 0, paddingLeft: 20, color: '#fbbf24' }}>
            {issue.expertTips.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <h4 style={{ color: '#f1f5f9', margin: '0 0 10px', fontSize: 14 }}>{title}</h4>
      {children}
    </div>
  );
}

// ── Diagnostic Tool ───────────────────────────────────────────────────────────

function DiagnosticTool({ onSelectIssue }: { onSelectIssue: (issue: TroubleshootingIssue) => void }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ReturnType<typeof diagnoseFromSymptoms>>([]);

  function run() {
    const symptoms = input.split(',').map(s => s.trim()).filter(Boolean);
    setResults(diagnoseFromSymptoms(symptoms));
  }

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ color: '#f1f5f9', marginBottom: 8, fontSize: 16 }}>🩺 Diagnostic Tool</h3>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Describe your symptoms (comma-separated) to find matching issues.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="e.g. wallet not connecting, transaction rejected"
          style={{ flex: 1, padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 13 }} />
        <button onClick={run} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Diagnose</button>
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {results.map(r => {
            const issue = SOROBAN_ISSUES.find(i => i.id === r.issueId);
            if (!issue) return null;
            return (
              <button key={r.issueId} onClick={() => onSelectIssue(issue)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 14px', background: '#0f172a', border: 'none', borderRadius: 8, color: '#f1f5f9', cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}>
                <span>{CATEGORY_ICONS[issue.category]} {issue.title}</span>
                <span style={{ color: '#22c55e', fontSize: 12 }}>{r.confidence}% match</span>
              </button>
            );
          })}
        </div>
      )}
      {results.length === 0 && input && <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>No matches found. Try different keywords.</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TroubleshootingGuide() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<IssueCategory | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<TroubleshootingIssue | null>(null);

  const issues = search
    ? searchIssues(search, activeCategory === 'all' ? undefined : activeCategory)
    : activeCategory === 'all' ? SOROBAN_ISSUES : getIssuesByCategory(activeCategory);

  const categoryCounts = Object.fromEntries(
    CATEGORIES.map(c => [c, SOROBAN_ISSUES.filter(i => i.category === c).length])
  );

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Troubleshooting & Debugging Guide</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Find solutions to common Soroban development issues with diagnostic tools and expert tips.</p>

      {selectedIssue ? (
        <IssueDetail issue={selectedIssue} onBack={() => setSelectedIssue(null)} />
      ) : (
        <>
          <DiagnosticTool onSelectIssue={setSelectedIssue} />

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search issues, symptoms, or tags..."
            style={{ width: '100%', padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => setActiveCategory('all')}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: activeCategory === 'all' ? '#3b82f6' : '#1e293b', color: activeCategory === 'all' ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              All ({SOROBAN_ISSUES.length})
            </button>
            {CATEGORIES.filter(c => categoryCounts[c] > 0).map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: activeCategory === c ? '#3b82f6' : '#1e293b', color: activeCategory === c ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                {CATEGORY_ICONS[c]} {c} ({categoryCounts[c]})
              </button>
            ))}
          </div>

          {/* Issue list */}
          <div style={{ display: 'grid', gap: 10 }}>
            {issues.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No issues found. Try a different search or category.</p>
            )}
            {issues.map(issue => (
              <button key={issue.id} onClick={() => setSelectedIssue(issue)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#1e293b', border: 'none', borderRadius: 10, color: '#f1f5f9', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 24 }}>{CATEGORY_ICONS[issue.category]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{issue.title}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{issue.symptoms.slice(0, 2).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ background: SEVERITY_COLORS[issue.severity], color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>{issue.severity}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{issue.solutions.length} solution{issue.solutions.length !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
