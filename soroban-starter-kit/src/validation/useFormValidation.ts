import { useCallback, useRef, useState } from 'react';
import type { ValidationRule } from './rules';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldState {
  value: string;
  error: string | null;
  touched: boolean;
  validating: boolean;
}

export interface FormConfig {
  [field: string]: {
    initialValue?: string;
    rules?: ValidationRule[];
  };
}

export interface ValidationAnalytics {
  submits: number;
  failures: number;
  /** field → number of times it caused a validation error */
  fieldErrors: Record<string, number>;
}

// ─── i18n message map (extend as needed) ─────────────────────────────────────

const DEFAULT_MESSAGES: Record<string, string> = {
  'validation.required': 'This field is required.',
  'validation.invalidStellarAddress': 'Enter a valid Stellar address (G…) or contract (C…).',
  'validation.invalidAmount': 'Enter a valid positive number.',
  'validation.amountMustBePositive': 'Amount must be greater than zero.',
  'validation.amountExceedsMax': 'Amount exceeds the allowed maximum.',
  'validation.invalidDate': 'Enter a valid date.',
  'validation.dateTooEarly': 'Date is before the allowed minimum.',
  'validation.dateTooLate': 'Date is after the allowed maximum.',
  'validation.minLength': 'Input is too short.',
  'validation.maxLength': 'Input is too long.',
};

export const resolveMessage = (
  key: string | null,
  messages: Record<string, string> = {}
): string | null => {
  if (!key) return null;
  return messages[key] ?? DEFAULT_MESSAGES[key] ?? key;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFormValidation(
  config: FormConfig,
  messages: Record<string, string> = {}
) {
  const initialFields = (): Record<string, FieldState> =>
    Object.fromEntries(
      Object.entries(config).map(([name, cfg]) => [
        name,
        { value: cfg.initialValue ?? '', error: null, touched: false, validating: false },
      ])
    );

  const [fields, setFields] = useState<Record<string, FieldState>>(initialFields);
  const analytics = useRef<ValidationAnalytics>({ submits: 0, failures: 0, fieldErrors: {} });

  const setFieldPatch = useCallback(
    (name: string, patch: Partial<FieldState>) =>
      setFields((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } })),
    []
  );

  /** Run all rules for a single field */
  const validateField = useCallback(
    async (name: string, value: string, allValues: Record<string, unknown>): Promise<string | null> => {
      const rules = config[name]?.rules ?? [];
      for (const rule of rules) {
        const result = await rule(value, allValues);
        if (result) return resolveMessage(result, messages);
      }
      return null;
    },
    [config, messages]
  );

  const getAllValues = useCallback(
    (overrides: Record<string, string> = {}): Record<string, unknown> => {
      const base = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value]));
      return { ...base, ...overrides };
    },
    [fields]
  );

  /** Called on every change — real-time validation */
  const handleChange = useCallback(
    async (name: string, value: string) => {
      setFieldPatch(name, { value, validating: true });
      const allValues = getAllValues({ [name]: value });
      const error = await validateField(name, value, allValues);
      setFieldPatch(name, { error, validating: false, touched: true });
    },
    [setFieldPatch, getAllValues, validateField]
  );

  const handleBlur = useCallback(
    (name: string) => setFieldPatch(name, { touched: true }),
    [setFieldPatch]
  );

  /** Validate all fields; returns true if form is valid */
  const validateAll = useCallback(async (): Promise<boolean> => {
    const allValues = getAllValues();
    const entries = await Promise.all(
      Object.keys(config).map(async (name) => {
        const error = await validateField(name, fields[name]?.value ?? '', allValues);
        return [name, error] as [string, string | null];
      })
    );

    const next: Record<string, FieldState> = { ...fields };
    let valid = true;
    for (const [name, error] of entries) {
      next[name] = { ...next[name], error, touched: true };
      if (error) {
        valid = false;
        analytics.current.fieldErrors[name] = (analytics.current.fieldErrors[name] ?? 0) + 1;
      }
    }
    setFields(next);
    return valid;
  }, [config, fields, getAllValues, validateField]);

  /** Call on form submit */
  const handleSubmit = useCallback(
    async (onValid: (values: Record<string, string>) => void | Promise<void>) => {
      analytics.current.submits += 1;
      const valid = await validateAll();
      if (!valid) {
        analytics.current.failures += 1;
        return;
      }
      const values = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value]));
      await onValid(values);
    },
    [validateAll, fields]
  );

  const reset = useCallback(() => setFields(initialFields()), []);

  const isFormValid = Object.values(fields).every((f) => !f.error);

  return {
    fields,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    isFormValid,
    analytics: analytics.current,
  };
}
