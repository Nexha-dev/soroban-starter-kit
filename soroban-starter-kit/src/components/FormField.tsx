import React from 'react';
import type { FieldState } from '../validation/useFormValidation';

interface FormFieldProps {
  name: string;
  label: string;
  field: FieldState;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  hint?: string;
}

/**
 * Accessible form field with real-time validation feedback.
 * Uses aria-describedby to link error/hint to the input for screen readers.
 */
export function FormField({
  name,
  label,
  field,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  hint,
}: FormFieldProps): JSX.Element {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = field.touched && !!field.error;
  const describedBy = [hasError && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      <label htmlFor={name} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        {label}
      </label>

      <div style={{ position: 'relative' }}>
        <input
          id={name}
          name={name}
          type={type}
          value={field.value}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--color-bg-tertiary)',
            border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
          }}
        />
        {field.validating && (
          <span
            aria-label="Validating…"
            style={{ position: 'absolute', right: 'var(--spacing-sm)', top: '50%', transform: 'translateY(-50%)' }}
          >
            <span className="spinner" style={{ width: '14px', height: '14px' }} />
          </span>
        )}
      </div>

      {hint && !hasError && (
        <span id={hintId} style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {hint}
        </span>
      )}

      {hasError && (
        <span id={errorId} role="alert" style={{ fontSize: '0.75rem', color: 'var(--color-error)' }}>
          {field.error}
        </span>
      )}
    </div>
  );
}
