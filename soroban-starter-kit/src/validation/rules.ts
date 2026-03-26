/** Validation rule result */
export type ValidationResult = string | null; // null = valid

/** Sync rule */
export type SyncRule<T = string> = (value: T, allValues?: Record<string, unknown>) => ValidationResult;

/** Async rule */
export type AsyncRule<T = string> = (value: T, allValues?: Record<string, unknown>) => Promise<ValidationResult>;

/** Combined rule */
export type ValidationRule<T = string> = SyncRule<T> | AsyncRule<T>;

// ─── Blockchain ───────────────────────────────────────────────────────────────

/** Stellar/Soroban public key (G...) or contract address (C...) */
export const stellarAddress = (): SyncRule => (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[GC][A-Z2-7]{55}$/.test(trimmed)) {
    return 'validation.invalidStellarAddress';
  }
  return null;
};

/** Positive numeric amount, optional max decimals */
export const tokenAmount = (maxDecimals = 7): SyncRule => (value) => {
  if (!value) return null;
  const regex = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
  if (!regex.test(value.trim())) return 'validation.invalidAmount';
  if (parseFloat(value) <= 0) return 'validation.amountMustBePositive';
  return null;
};

/** Amount must not exceed a maximum (in stroops or raw units as string) */
export const maxAmount = (max: number): SyncRule => (value) => {
  if (!value) return null;
  if (parseFloat(value) > max) return 'validation.amountExceedsMax';
  return null;
};

// ─── Common ───────────────────────────────────────────────────────────────────

export const required = (): SyncRule => (value) =>
  !value || String(value).trim() === '' ? 'validation.required' : null;

export const minLength = (min: number): SyncRule => (value) =>
  value && value.length < min ? 'validation.minLength' : null;

export const maxLength = (max: number): SyncRule => (value) =>
  value && value.length > max ? 'validation.maxLength' : null;

export const pattern = (regex: RegExp, messageKey: string): SyncRule => (value) =>
  value && !regex.test(value) ? messageKey : null;

/** ISO date string, optional min/max */
export const dateRange = (min?: string, max?: string): SyncRule => (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'validation.invalidDate';
  if (min && d < new Date(min)) return 'validation.dateTooEarly';
  if (max && d > new Date(max)) return 'validation.dateTooLate';
  return null;
};

// ─── Conditional ─────────────────────────────────────────────────────────────

/** Apply `rule` only when `condition` returns true */
export const when = <T>(
  condition: (allValues: Record<string, unknown>) => boolean,
  rule: ValidationRule<T>
): ValidationRule<T> => {
  return (value: T, allValues?: Record<string, unknown>) => {
    if (!allValues || !condition(allValues)) return null;
    return (rule as SyncRule<T>)(value, allValues);
  };
};

// ─── Async helpers ────────────────────────────────────────────────────────────

/** Debounce an async rule */
export const debounced = <T>(
  rule: AsyncRule<T>,
  ms = 400
): AsyncRule<T> => {
  let timer: ReturnType<typeof setTimeout>;
  return (value, allValues) =>
    new Promise((resolve) => {
      clearTimeout(timer);
      timer = setTimeout(() => resolve(rule(value, allValues)), ms);
    });
};
