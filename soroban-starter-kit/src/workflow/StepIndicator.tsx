import React from 'react';
import type { StepStatus, WorkflowStep } from './types';

interface StepIndicatorProps {
  steps: WorkflowStep[];
  statuses: Record<string, StepStatus>;
  currentIndex: number;
  onStepClick?: (index: number) => void;
}

const STATUS_COLOR: Record<StepStatus, string> = {
  completed: 'var(--color-success)',
  active:    'var(--color-highlight)',
  error:     'var(--color-error)',
  skipped:   'var(--color-text-muted)',
  pending:   'var(--color-border-light)',
};

const STATUS_ICON: Record<StepStatus, string> = {
  completed: '✓',
  active:    '●',
  error:     '✕',
  skipped:   '⤳',
  pending:   '○',
};

export function StepIndicator({ steps, statuses, currentIndex, onStepClick }: StepIndicatorProps): JSX.Element {
  return (
    <nav aria-label="Workflow progress" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--spacing-lg)' }}>
      {steps.map((step, i) => {
        const status = statuses[step.id] ?? 'pending';
        const isClickable = onStepClick && (status === 'completed' || status === 'skipped');
        const color = STATUS_COLOR[status];

        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <button
                aria-current={i === currentIndex ? 'step' : undefined}
                aria-label={`${step.title} — ${status}`}
                title={step.tooltip ?? step.description ?? step.title}
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(i)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: color, border: 'none',
                  color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'background var(--transition-fast)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {STATUS_ICON[status]}
              </button>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 4, textAlign: 'center', maxWidth: 72 }}>
                {step.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: status === 'completed' ? 'var(--color-success)' : 'var(--color-border)',
                marginBottom: 20, transition: 'background var(--transition-fast)',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
