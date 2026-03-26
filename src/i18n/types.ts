export type Locale = "en-US" | "fr-FR" | "es-ES" | "ar-SA";

export type TranslationValue = string | ((count: number) => string);

export type TranslationMessages = Record<string, TranslationValue>;

export interface LocaleConfig {
  locale: Locale;
  languageName: string;
  dir: "ltr" | "rtl";
  defaultCurrency: string;
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle: Intl.DateTimeFormatOptions["timeStyle"];
  numberSystem?: string;
  firstDayOfWeek: 0 | 1 | 6;
  region: string;
}

export interface LocalizationState {
  locale: Locale;
  currency: string;
  timezone: string;
}

export interface TranslationMiss {
  key: string;
  locale: Locale;
  fallbackLocale: Locale;
  timestamp: number;
}

export interface CommunityTranslationSuggestion {
  id: string;
  key: string;
  locale: Locale;
  suggestedValue: string;
  contributor: string;
  votes: number;
  createdAt: number;
  approved: boolean;
}

export interface LocalizationAnalyticsSnapshot {
  activeLocale: Locale;
  localeSwitches: number;
  keyHits: Record<string, number>;
  missingKeys: Record<string, number>;
  formatterUsage: {
    number: number;
    currency: number;
    date: number;
    relativeTime: number;
    list: number;
  };
  rtlSessions: number;
  recordedAt: number;
}
