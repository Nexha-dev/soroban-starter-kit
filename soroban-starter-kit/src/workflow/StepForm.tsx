import React, { useState } from 'react';
import { FormField } from '../components/FormField';
import { useFormValidation } from '../validation/useFormValidation';
import type { WorkflowStep, WorkflowValues } from './types';

interface StepFormProps {
  step: WorkflowStep;
  savedValues?: Record<string, string>;
  onNext: (values: Record<string, string>) => void;
  onBack: () => void;
  onSkip?: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function StepForm({ step, savedValues, onNext, onBack, onSkip, isFirst, isLast }: StepFormProps): JSX.Element {
  const config = Object.fromEntries(
    Object.entries(step.fields ?? {}).map(([k, v]) => [
      k,
      { ...v, initialValue: savedValues?.[k] ?? v.initialValue ?? '' },
    ])
  );

  const { fields, handleChange, handleBlur, handleSubmit } = useFormValidation(config);
  const [showTooltip, setShowTooltip] = useState(false);

  const fieldEntries = Object.entries(step.fields ?? {});

  return (
    <div>
      {/* Step header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{step.title}</h2>
        {step.tooltip && (
          <div style={{ position: 'relative' }}>
            <button
              aria-label="Help"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              style={{ background: 'none', border: '1px solid var(--color-border-light)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
            >?</button>
            {showTooltip && (
              <div role="tooltip" style={{
                position: 'absolute', left: 28, top: -4, zIndex: 10,
                background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm) var(--spacing-md)',
                fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-md)',
              }}>
                {step.tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      {step.description && (
        <p style={{ margin: '0 0 var(--spacing-md)', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          {step.description}
        </p>
      )}

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {fieldEntries.map(([name]) => (
          <FormField
            key={name}
            name={name}
            label={name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            field={fields[name]}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          disabled={isFirst}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)',
            cursor: isFirst ? 'not-allowed' : 'pointer', opacity: isFirst ? 0.4 : 1,
          }}
        >← Back</button>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {step.optional && onSkip && (
            <button
              onClick={onSkip}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', cursor: 'pointer',
              }}
            >Skip</button>
          )}
          <button
            onClick={() => handleSubmit((values) => onNext(values))}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-highlight)', border: 'none',
              borderRadius: 'var(--radius-md)', color: '#fff',
              fontWeight: 600, cursor: 'pointer',
            }}
          >{isLast ? 'Finish' : 'Next →'}</button>
        </div>
      </div>
    </div>
  );
}
