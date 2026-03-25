import React from 'react';
import { StepForm } from './StepForm';
import { StepIndicator } from './StepIndicator';
import { useWorkflow } from './useWorkflow';
import type { WorkflowTemplate, WorkflowValues } from './types';

interface WorkflowProps {
  template: WorkflowTemplate;
  onComplete?: (values: WorkflowValues) => void;
  onReset?: () => void;
}

export function Workflow({ template, onComplete, onReset }: WorkflowProps): JSX.Element {
  const {
    state,
    visibleSteps,
    currentStepDef,
    next,
    back,
    skip,
    reset,
    goToStep,
    analytics,
    isFirst,
    isLast,
  } = useWorkflow(template.id, template.steps, onComplete);

  const handleReset = () => { reset(); onReset?.(); };

  // All steps done
  if (!currentStepDef) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-md)' }}>🎉</div>
        <h2 style={{ color: 'var(--color-success)', margin: '0 0 var(--spacing-sm)' }}>Workflow Complete!</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0 0 var(--spacing-lg)' }}>
          Completed in {visibleSteps.length} steps · {analytics.skips} skipped · {analytics.backNavigations} back navigations
        </p>
        <button
          onClick={handleReset}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >Start Over</button>
      </div>
    );
  }

  const progress = Math.round((state.currentStep / visibleSteps.length) * 100);

  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)', boxShadow: 'var(--shadow-md)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Step {state.currentStep + 1} of {visibleSteps.length}
        </span>
        <button
          onClick={handleReset}
          aria-label="Reset workflow"
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
        >↺ Reset</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--spacing-lg)', overflow: 'hidden' }}>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Workflow progress"
          style={{
            height: '100%', width: `${progress}%`,
            background: 'var(--color-highlight)',
            transition: 'width 0.3s ease',
            borderRadius: 'var(--radius-full)',
          }}
        />
      </div>

      <StepIndicator
        steps={visibleSteps}
        statuses={state.stepStatuses}
        currentIndex={state.currentStep}
        onStepClick={goToStep}
      />

      <StepForm
        step={currentStepDef}
        savedValues={state.values[currentStepDef.id]}
        onNext={next}
        onBack={back}
        onSkip={currentStepDef.optional ? skip : undefined}
        isFirst={isFirst}
        isLast={isLast}
      />
    </div>
  );
}
