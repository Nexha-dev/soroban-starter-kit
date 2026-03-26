import {
  CURRENCY_OPTIONS,
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  SUPPORTED_LOCALES,
} from "../../i18n/config";
import { MESSAGES } from "../../i18n/messages";
import {
  CommunityTranslationSuggestion,
  Locale,
  LocalizationState,
  TranslationMessages,
  TranslationMiss,
} from "../../i18n/types";
import { communityTranslations } from "./communityTranslations";
import { localizationAnalytics } from "./localizationAnalytics";

const STORAGE_KEY = "fidelis-localization-state";

const FALLBACK_LOCALE: Locale = DEFAULT_LOCALE;

type InterpolationValues = Record<string, string | number>;

type ListFormatOptions = {
  style?: "long" | "short" | "narrow";
  type?: "conjunction" | "disjunction" | "unit";
};

function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(/\{([\w.-]+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function coerceLocale(locale?: string): Locale {
  if (!locale) return DEFAULT_LOCALE;
  const normalized = locale as Locale;
  if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
  const languagePrefix = locale.split("-")[0].toLowerCase();
  const matched = SUPPORTED_LOCALES.find((candidate) =>
    candidate.toLowerCase().startsWith(languagePrefix),
  );
  return matched ?? DEFAULT_LOCALE;
}

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const fromLanguages = navigator.languages
    ?.map((value) => coerceLocale(value))
    .find((value) => SUPPORTED_LOCALES.includes(value));
  if (fromLanguages) return fromLanguages;
  return coerceLocale(navigator.language);

  type ListFormatOptions = {
    style?: "long" | "short" | "narrow";
    type?: "conjunction" | "disjunction" | "unit";
  };
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeCurrency(currency: string | undefined, locale: Locale): string {
  if (!currency) return LOCALE_CONFIG[locale].defaultCurrency;
  const normalized = currency.toUpperCase();
  return CURRENCY_OPTIONS.includes(normalized)
    ? normalized
    : LOCALE_CONFIG[locale].defaultCurrency;
}

export class TranslationManager {
  private state: LocalizationState;
  private misses: TranslationMiss[] = [];

  constructor() {
    this.state = this.loadInitialState();
    localizationAnalytics.init(this.state.locale);
  }

  getState(): LocalizationState {
    return { ...this.state };
  }

  setLocale(locale: Locale): LocalizationState {
    if (locale === this.state.locale) return this.getState();
    this.state = {
      ...this.state,
      locale,
      currency: this.state.currency || LOCALE_CONFIG[locale].defaultCurrency,
    };
    localizationAnalytics.markLocaleSwitch(locale, this.isRTL(locale));
    this.persist();
    return this.getState();
  }

  setCurrency(currency: string): LocalizationState {
    this.state = {
      ...this.state,
      currency: safeCurrency(currency, this.state.locale),
    };
    this.persist();
    return this.getState();
  }

  setTimezone(timezone: string): LocalizationState {
    this.state = {
      ...this.state,
      timezone,
    };
    this.persist();
    return this.getState();
  }

  isRTL(locale: Locale = this.state.locale): boolean {
    return LOCALE_CONFIG[locale].dir === "rtl";
  }

  dir(locale: Locale = this.state.locale): "ltr" | "rtl" {
    return LOCALE_CONFIG[locale].dir;
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    localizationAnalytics.trackFormatter("number");
    return new Intl.NumberFormat(this.state.locale, options).format(value);
  }

  formatCurrency(value: number, currency?: string): string {
    localizationAnalytics.trackFormatter("currency");
    return new Intl.NumberFormat(this.state.locale, {
      style: "currency",
      currency: safeCurrency(
        currency ?? this.state.currency,
        this.state.locale,
      ),
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatDate(
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    localizationAnalytics.trackFormatter("date");
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(this.state.locale, {
      dateStyle: LOCALE_CONFIG[this.state.locale].dateStyle,
      timeStyle: LOCALE_CONFIG[this.state.locale].timeStyle,
      ...options,
      timeZone: this.state.timezone,
    }).format(date);
  }

  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
    localizationAnalytics.trackFormatter("relativeTime");
    return new Intl.RelativeTimeFormat(this.state.locale, {
      numeric: "auto",
    }).format(value, unit);
  }

  formatList(values: string[], options?: ListFormatOptions): string {
    localizationAnalytics.trackFormatter("list");
    const listFormatCtor = (
      Intl as unknown as {
        ListFormat?: new (
          locale: string,
          opts: ListFormatOptions,
        ) => { format: (input: string[]) => string };
      }
    ).ListFormat;
    if (listFormatCtor) {
      return new listFormatCtor(this.state.locale, {
        style: "long",
        type: "conjunction",
        ...options,
      }).format(values);
    }
    return values.join(", ");
  }

  t(
    key: string,
    options?: {
      count?: number;
      locale?: Locale;
      context?: string;
      values?: InterpolationValues;
      fallback?: string;
    },
  ): string {
    const locale = options?.locale ?? this.state.locale;
    const messages = this.getMergedMessages(locale);
    const contextKey = options?.context
      ? `${key}.${options.context}`
      : undefined;

    const resolved = this.resolveMessage(
      messages,
      key,
      options?.count,
      options?.values,
      contextKey,
    );
    if (resolved !== undefined) {
      localizationAnalytics.trackTranslationKey(contextKey ?? key);
      return resolved;
    }

    this.reportMissingKey(key, locale);
    return options?.fallback ?? key;
  }

  missingTranslations(): TranslationMiss[] {
    return [...this.misses];
  }

  getAnalytics() {
    return localizationAnalytics.snapshot();
  }

  getCommunitySuggestions(locale?: Locale): CommunityTranslationSuggestion[] {
    return communityTranslations.list(locale);
  }

  addCommunitySuggestion(
    data: Omit<
      CommunityTranslationSuggestion,
      "id" | "createdAt" | "votes" | "approved"
    >,
  ): CommunityTranslationSuggestion {
    return communityTranslations.addSuggestion(data);
  }

  voteCommunitySuggestion(
    id: string,
    delta: 1 | -1 = 1,
  ): CommunityTranslationSuggestion | undefined {
    return communityTranslations.vote(id, delta);
  }

  approveCommunitySuggestion(
    id: string,
  ): CommunityTranslationSuggestion | undefined {
    return communityTranslations.approve(id);
  }

  exportState(): string {
    return JSON.stringify(this.state);
  }

  importState(raw: string): LocalizationState | null {
    try {
      const parsed = JSON.parse(raw) as Partial<LocalizationState>;
      const locale = coerceLocale(parsed.locale);
      this.state = {
        locale,
        currency: safeCurrency(parsed.currency, locale),
        timezone: parsed.timezone || detectTimezone(),
      };
      this.persist();
      return this.getState();
    } catch {
      return null;
    }
  }

  private getMergedMessages(locale: Locale): TranslationMessages {
    const base = MESSAGES[FALLBACK_LOCALE] ?? {};
    const localized = MESSAGES[locale] ?? {};

    const approvedSuggestions = communityTranslations
      .list(locale)
      .filter((entry) => entry.approved)
      .reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.suggestedValue;
        return acc;
      }, {});

    return { ...base, ...localized, ...approvedSuggestions };
  }

  private resolveMessage(
    messages: TranslationMessages,
    key: string,
    count?: number,
    values?: InterpolationValues,
    contextKey?: string,
  ): string | undefined {
    if (contextKey) {
      const contextual = messages[contextKey];
      const contextualResolved = this.resolveValue(contextual, count, values);
      if (contextualResolved !== undefined) return contextualResolved;
    }

    const direct = messages[key];
    return this.resolveValue(direct, count, values);
  }

  private resolveValue(
    value: string | ((count: number) => string) | undefined,
    count?: number,
    values?: InterpolationValues,
  ): string | undefined {
    if (value === undefined) return undefined;

    if (typeof value === "function") {
      const safeCount = Number.isFinite(count) ? Number(count) : 0;
      return interpolate(value(safeCount), values);
    }

    return interpolate(value, values);
  }

  private reportMissingKey(key: string, locale: Locale): void {
    const miss: TranslationMiss = {
      key,
      locale,
      fallbackLocale: FALLBACK_LOCALE,
      timestamp: Date.now(),
    };
    this.misses = [miss, ...this.misses].slice(0, 200);
    localizationAnalytics.trackMissingKey(`${locale}:${key}`);
  }

  private loadInitialState(): LocalizationState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalizationState>;
        const locale = coerceLocale(parsed.locale);
        return {
          locale,
          currency: safeCurrency(parsed.currency, locale),
          timezone: parsed.timezone || detectTimezone(),
        };
      }
    } catch {
      // Ignore malformed persisted locale state
    }

    const locale = detectLocale();
    return {
      locale,
      currency: LOCALE_CONFIG[locale].defaultCurrency,
      timezone: detectTimezone(),
    };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage issues
    }
  }
}

export const translationManager = new TranslationManager();
