import { CatalogParseError, CatalogValidationError } from './errors';
import type { TranslationCatalog, TranslationValue, PluralVariants } from './types';

const FALLBACK_LOCALE = 'en-US';
const STORAGE_KEY = 'fidelis-locale';

/**
 * Checks whether a value is a valid PluralVariants object.
 */
function isPluralVariants(value: unknown): value is PluralVariants {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v['one'] === 'string' && typeof v['other'] === 'string';
}

/**
 * Validates that all translation values are either strings or valid PluralVariants.
 * Throws CatalogValidationError on the first offending key.
 */
function validateTranslations(translations: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(translations)) {
    if (typeof value === 'string') continue;
    if (isPluralVariants(value)) continue;
    throw new CatalogValidationError(
      `Translation key "${key}" has an invalid value type. Expected string or plural variants object.`,
      key
    );
  }
}

/**
 * Substitutes {{placeholder}} tokens in a string with values from the map.
 */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = values[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export class TranslationManager {
  private _activeLocale: string;
  private readonly _fallbackLocale: string = FALLBACK_LOCALE;
  private readonly _catalogs = new Map<string, TranslationCatalog>();
  private _missingKeyHandlers: Array<(key: string, locale: string) => void> = [];

  constructor(activeLocale: string = FALLBACK_LOCALE) {
    this._activeLocale = activeLocale;
  }

  get activeLocale(): string {
    return this._activeLocale;
  }

  get fallbackLocale(): string {
    return this._fallbackLocale;
  }

  get loadedLocales(): string[] {
    return Array.from(this._catalogs.keys());
  }

  /**
   * Fetch and cache a translation catalog for the given locale.
   * Requirement 1.1
   */
  async loadCatalog(locale: string): Promise<void> {
    if (this._catalogs.has(locale)) return;

    const response = await fetch(`/locales/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load catalog for locale "${locale}": HTTP ${response.status}`);
    }

    const json = await response.text();
    const catalog = this.parseCatalog(json);
    this._catalogs.set(locale, catalog);
  }

  /**
   * Parse a raw JSON string into a TranslationCatalog.
   * Throws CatalogParseError for malformed JSON, CatalogValidationError for invalid values.
   * Requirements 2.1, 2.4, 2.5
   */
  parseCatalog(json: string): TranslationCatalog {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CatalogParseError(`Failed to parse catalog JSON: ${message}`);
    }

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new CatalogParseError('Catalog JSON must be an object at the top level');
    }

    const obj = raw as Record<string, unknown>;

    if (typeof obj['locale'] !== 'string') {
      throw new CatalogValidationError('Catalog must have a string "locale" field', 'locale');
    }
    if (typeof obj['version'] !== 'string') {
      throw new CatalogValidationError('Catalog must have a string "version" field', 'version');
    }
    if (typeof obj['translations'] !== 'object' || obj['translations'] === null || Array.isArray(obj['translations'])) {
      throw new CatalogValidationError('Catalog must have an object "translations" field', 'translations');
    }

    const translations = obj['translations'] as Record<string, unknown>;
    validateTranslations(translations);

    return {
      locale: obj['locale'] as string,
      version: obj['version'] as string,
      translations: translations as Record<string, TranslationValue>,
    };
  }

  /**
   * Serialize a TranslationCatalog to a JSON string.
   * Requirement 2.2
   */
  serializeCatalog(catalog: TranslationCatalog): string {
    return JSON.stringify(catalog, null, 2);
  }

  /**
   * Register a handler to be called when a translation key is missing.
   * Requirement 6.3
   */
  onMissingKey(handler: (key: string, locale: string) => void): void {
    this._missingKeyHandlers.push(handler);
  }

  private _emitMissingKey(key: string, locale: string): void {
    for (const handler of this._missingKeyHandlers) {
      handler(key, locale);
    }
  }

  /**
   * Look up a translation key in the given catalog.
   * Returns undefined if not found.
   */
  private _lookup(key: string, locale: string): string | undefined {
    const catalog = this._catalogs.get(locale);
    if (!catalog) return undefined;
    const value = catalog.translations[key];
    if (typeof value === 'string') return value;
    return undefined;
  }

  /**
   * Retrieve a translated string with optional interpolation.
   * Falls back to fallback locale, then raw key.
   * Requirements 1.2, 1.3, 1.4, 1.5
   */
  t(key: string, values?: Record<string, string | number>): string {
    // Active locale lookup
    let raw = this._lookup(key, this._activeLocale);

    // Fallback locale lookup
    if (raw === undefined && this._activeLocale !== this._fallbackLocale) {
      raw = this._lookup(key, this._fallbackLocale);
    }

    // Emit missing key warning if not found in either catalog
    if (raw === undefined) {
      this._emitMissingKey(key, this._activeLocale);
      return key;
    }

    return interpolate(raw, values);
  }

  /**
   * Retrieve a pluralized string based on count, with optional interpolation.
   * Uses Intl.PluralRules to select the CLDR variant.
   * Requirement 1.6
   */
  plural(key: string, count: number, values?: Record<string, string | number>): string {
    const mergedValues = { count, ...values };

    const getVariant = (locale: string): string | undefined => {
      const catalog = this._catalogs.get(locale);
      if (!catalog) return undefined;
      const entry = catalog.translations[key];
      if (!isPluralVariants(entry)) return undefined;

      const rules = new Intl.PluralRules(locale);
      const category = rules.select(count) as keyof PluralVariants;

      // Try the exact CLDR category, then fall back to 'other'
      const template = entry[category] ?? entry['other'];
      return template;
    };

    // Active locale lookup
    let template = getVariant(this._activeLocale);

    // Fallback locale lookup
    if (template === undefined && this._activeLocale !== this._fallbackLocale) {
      template = getVariant(this._fallbackLocale);
    }

    if (template === undefined) {
      this._emitMissingKey(key, this._activeLocale);
      return key;
    }

    return interpolate(template, mergedValues);
  }

  /**
   * Set the active locale (used by I18nProvider).
   */
  setActiveLocale(locale: string): void {
    this._activeLocale = locale;
  }

  /**
   * Persist the active locale to localStorage.
   */
  persistLocale(locale: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // localStorage unavailable (e.g. private browsing) — silently no-op
    }
  }

  /**
   * Restore the persisted locale from localStorage.
   * Returns null if none is stored.
   */
  getPersistedLocale(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Expose the catalog map for use by TranslationValidator.
   */
  getCatalogs(): Map<string, TranslationCatalog> {
    return this._catalogs;
  }
}
