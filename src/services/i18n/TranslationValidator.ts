import type { TranslationCatalog, TranslationValue, ValidationViolation, ValidationReport } from './types';

/**
 * Extracts all {{placeholder}} token names from a string.
 */
function extractPlaceholders(str: string): Set<string> {
  const result = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    result.add(match[1]);
  }
  return result;
}

/**
 * Collects all placeholder names from a TranslationValue (string or plural variants).
 */
function getPlaceholders(value: TranslationValue): Set<string> {
  if (typeof value === 'string') {
    return extractPlaceholders(value);
  }
  // Plural variants — union of all string values
  const result = new Set<string>();
  for (const v of Object.values(value)) {
    if (typeof v === 'string') {
      for (const p of extractPlaceholders(v)) {
        result.add(p);
      }
    }
  }
  return result;
}

/**
 * Validates translation catalogs against a fallback locale, detecting:
 * - Keys present in fallback but missing in other locales (missing_in_locale)
 * - Keys present in non-fallback locales but absent from fallback (extra_in_locale)
 * - Placeholder drift between fallback and other locales (placeholder_mismatch)
 *
 * Requirements: 6.1, 6.2, 6.4, 6.5, 6.6
 */
export class TranslationValidator {
  validate(
    catalogs: Record<string, TranslationCatalog>,
    fallbackLocale: string
  ): ValidationReport {
    const violations: ValidationViolation[] = [];
    const fallbackCatalog = catalogs[fallbackLocale];

    // If there's no fallback catalog, we can't compare — return clean
    if (!fallbackCatalog) {
      return { violations: [], violationCount: 0, isClean: true };
    }

    const fallbackKeys = new Set(Object.keys(fallbackCatalog.translations));

    for (const [locale, catalog] of Object.entries(catalogs)) {
      if (locale === fallbackLocale) continue;

      const localeKeys = new Set(Object.keys(catalog.translations));

      // Requirement 6.1: keys in fallback but absent in this locale
      for (const key of fallbackKeys) {
        if (!localeKeys.has(key)) {
          violations.push({ type: 'missing_in_locale', locale, key });
        }
      }

      // Requirement 6.2: keys in this locale but absent from fallback
      for (const key of localeKeys) {
        if (!fallbackKeys.has(key)) {
          violations.push({ type: 'extra_in_locale', locale, key });
        }
      }

      // Requirement 6.4: placeholder drift for keys present in both
      for (const key of fallbackKeys) {
        if (!localeKeys.has(key)) continue; // already flagged as missing

        const fallbackPlaceholders = getPlaceholders(fallbackCatalog.translations[key]);
        const localePlaceholders = getPlaceholders(catalog.translations[key]);

        // Find placeholders in fallback but missing in locale
        const missingInLocale = [...fallbackPlaceholders].filter(p => !localePlaceholders.has(p));
        // Find placeholders in locale but missing in fallback
        const extraInLocale = [...localePlaceholders].filter(p => !fallbackPlaceholders.has(p));

        if (missingInLocale.length > 0 || extraInLocale.length > 0) {
          const parts: string[] = [];
          if (missingInLocale.length > 0) {
            parts.push(`missing: ${missingInLocale.map(p => `{{${p}}}`).join(', ')}`);
          }
          if (extraInLocale.length > 0) {
            parts.push(`extra: ${extraInLocale.map(p => `{{${p}}}`).join(', ')}`);
          }
          violations.push({
            type: 'placeholder_mismatch',
            locale,
            key,
            detail: parts.join('; '),
          });
        }
      }
    }

    return {
      violations,
      violationCount: violations.length,
      isClean: violations.length === 0,
    };
  }
}
