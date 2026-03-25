import React, { useState } from 'react';
import { Workflow } from './Workflow';
import { WORKFLOW_TEMPLATES } from './templates';
import type { WorkflowTemplate, WorkflowValues } from './types';

interface WorkflowLauncherProps {
  onComplete?: (templateId: string, values: WorkflowValues) => void;
}

export function WorkflowLauncher({ onComplete }: WorkflowLauncherProps): JSX.Element {
  const [active, setActive] = useState<WorkflowTemplate | null>(null);

  if (active) {
    return (
      <Workflow
        template={active}
        onComplete={(values) => { onComplete?.(active.id, values); setActive(null); }}
        onReset={() => setActive(null)}
      />
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 var(--spacing-md)', fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
        Choose a Workflow
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--spacing-md)' }}>
        {WORKFLOW_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t)}
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-highlight)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t.steps.length} steps
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
