import type { LocaleFormatter } from './LocaleFormatter';

const SUPPORTED_LOCALES = new Set([
  'en-US', 'fr-FR', 'ar-SA', 'he-IL', 'de-DE',
  'ja-JP', 'zh-CN', 'es-ES', 'pt-BR', 'fa-IR',
]);

const FALLBACK_LOCALE = 'en-US';

/** Returns a validated locale, falling back to en-US with a warning if unsupported. */
function resolveLocale(locale: string): string {
  if (SUPPORTED_LOCALES.has(locale)) return locale;
  console.warn(`[LocaleFormatter] Unsupported locale "${locale}", falling back to ${FALLBACK_LOCALE}`);
  return FALLBACK_LOCALE;
}

// First day of week: 0=Sun, 1=Mon, 6=Sat
const FIRST_DAY_OF_WEEK: Record<string, 0 | 1 | 6> = {
  'en-US': 0,
  'fr-FR': 1,
  'de-DE': 1,
  'ar-SA': 6,
  'he-IL': 0,
  'ja-JP': 0,
  'zh-CN': 1,
  'es-ES': 1,
  'pt-BR': 0,
  'fa-IR': 6,
};

// Calendar system per locale
const CALENDAR_SYSTEM: Record<string, string> = {
  'ar-SA': 'islamic-umalqura',
  'he-IL': 'hebrew',
  'ja-JP': 'japanese',
  'fa-IR': 'persian',
};

// Name order per locale
const FAMILY_FIRST_LOCALES = new Set(['ja-JP', 'zh-CN', 'ko-KR']);

export class LocaleFormatterImpl implements LocaleFormatter {
  formatDate(value: Date, locale: string, options?: Intl.DateTimeFormatOptions): string {
    const resolved = resolveLocale(locale);
    const opts: Intl.DateTimeFormatOptions = options ?? {
      year: 'numeric', month: 'long', day: 'numeric',
    };
    try {
      return new Intl.DateTimeFormat(resolved, opts).format(value);
    } catch {
      return String(value);
    }
  }

  formatTime(value: Date, locale: string, options?: Intl.DateTimeFormatOptions): string {
    const resolved = resolveLocale(locale);
    const opts: Intl.DateTimeFormatOptions = options ?? {
      hour: 'numeric', minute: 'numeric',
    };
    try {
      return new Intl.DateTimeFormat(resolved, opts).format(value);
    } catch {
      return String(value);
    }
  }

  formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
    const resolved = resolveLocale(locale);
    try {
      return new Intl.NumberFormat(resolved, options).format(value);
    } catch {
      return String(value);
    }
  }

  formatCurrency(value: number, locale: string, currency: string): string {
    const resolved = resolveLocale(locale);
    try {
      return new Intl.NumberFormat(resolved, {
        style: 'currency',
        currency,
      }).format(value);
    } catch {
      return String(value);
    }
  }

  formatMeasurement(value: number, unit: string, locale: string): string {
    const resolved = resolveLocale(locale);
    try {
      if (typeof Intl === 'undefined' || !Intl.NumberFormat) {
        return String(value);
      }
      return new Intl.NumberFormat(resolved, {
        style: 'unit',
        unit,
      }).format(value);
    } catch {
      return String(value);
    }
  }

  sort(strings: string[], locale: string): string[] {
    const resolved = resolveLocale(locale);
    try {
      const collator = new Intl.Collator(resolved);
      return [...strings].sort((a, b) => collator.compare(a, b));
    } catch {
      return [...strings].sort();
    }
  }

  getFirstDayOfWeek(locale: string): 0 | 1 | 6 {
    const resolved = resolveLocale(locale);
    return FIRST_DAY_OF_WEEK[resolved] ?? 0;
  }

  getCalendarSystem(locale: string): string {
    const resolved = resolveLocale(locale);
    return CALENDAR_SYSTEM[resolved] ?? 'gregory';
  }

  getNameOrder(locale: string): 'given-first' | 'family-first' {
    const resolved = resolveLocale(locale);
    return FAMILY_FIRST_LOCALES.has(resolved) ? 'family-first' : 'given-first';
  }
}
