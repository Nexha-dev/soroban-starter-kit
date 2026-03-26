/**
 * Plural variant keys following CLDR plural category names.
 */
export type PluralVariants = {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

/**
 * A translation value is either a plain string or a set of plural variants.
 */
export type TranslationValue = string | PluralVariants;

/**
 * In-memory representation of a locale's translation catalog.
 * Keys are dot-separated strings (e.g. "nav.balances").
 */
export interface TranslationCatalog {
  locale: string;
  version: string;
  translations: Record<string, TranslationValue>;
}

/**
 * A single validation violation found during catalog comparison.
 */
export interface ValidationViolation {
  type: 'missing_in_locale' | 'extra_in_locale' | 'placeholder_mismatch';
  locale: string;
  key: string;
  detail?: string;
}

/**
 * The result of running TranslationValidator.validate().
 */
export interface ValidationReport {
  violations: ValidationViolation[];
  violationCount: number;
  isClean: boolean;
}

/**
 * The value exposed by I18nContext / useI18n().
 */
export interface I18nContextValue {
  locale: string;
  availableLocales: string[];
  setLocale: (locale: string) => Promise<void>;
  t: (key: string, values?: Record<string, string | number>) => string;
  plural: (key: string, count: number, values?: Record<string, string | number>) => string;
  formatter: import('./LocaleFormatter').LocaleFormatter;
  isRTL: boolean;
}
