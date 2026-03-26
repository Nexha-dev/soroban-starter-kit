import React, { useState } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { ALL_TUTORIALS, HELP_DOCS } from '../tutorial/steps';

export function HelpPanel(): JSX.Element {
  const { start, isCompleted, progress } = useTutorial();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const doc = HELP_DOCS.find(d => d.id === activeDoc);

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="card-header">
        <span className="card-title">❓ Help &amp; Onboarding</span>
      </div>

      {/* Onboarding progress */}
      <section style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
          Tutorials
        </h3>
        <div className="flex flex-col gap-sm">
          {ALL_TUTORIALS.map(t => {
            const done = isCompleted(t.id);
            return (
              <div key={t.id} className="flex items-center gap-md" style={{ padding: 'var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)' }}>
                <span style={{ fontSize: '1.1rem' }}>{done ? '✅' : '⭕'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t.description}</div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={() => start(t.id)}
                >
                  {done ? 'Replay' : 'Start'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            <span>Overall progress</span>
            <span>{Object.values(progress.completed).filter(Boolean).length} / {ALL_TUTORIALS.length} completed</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              width: `${(Object.values(progress.completed).filter(Boolean).length / ALL_TUTORIALS.length) * 100}%`,
              background: 'var(--color-highlight)',
              borderRadius: 3,
              transition: 'width var(--transition-normal)',
            }} />
          </div>
        </div>
      </section>

      {/* Help docs */}
      <section>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
          Documentation
        </h3>
        {doc ? (
          <div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', marginBottom: 'var(--spacing-sm)' }} onClick={() => setActiveDoc(null)}>
              ← Back
            </button>
            <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>{doc.title}</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{doc.content}</p>
            {doc.tutorialId && (
              <button className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)', fontSize: '0.85rem' }} onClick={() => { start(doc.tutorialId!); setActiveDoc(null); }}>
                🚀 Launch Tutorial
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {HELP_DOCS.map(d => (
              <button
                key={d.id}
                className="btn btn-secondary"
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                onClick={() => setActiveDoc(d.id)}
              >
                📄 {d.title}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
