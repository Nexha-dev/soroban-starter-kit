import { Locale, LocaleConfig } from "./types";

export const DEFAULT_LOCALE: Locale = "en-US";

export const LOCALE_CONFIG: Record<Locale, LocaleConfig> = {
  "en-US": {
    locale: "en-US",
    languageName: "English (US)",
    dir: "ltr",
    defaultCurrency: "USD",
    dateStyle: "medium",
    timeStyle: "short",
    firstDayOfWeek: 0,
    region: "US",
  },
  "fr-FR": {
    locale: "fr-FR",
    languageName: "Français (France)",
    dir: "ltr",
    defaultCurrency: "EUR",
    dateStyle: "medium",
    timeStyle: "short",
    firstDayOfWeek: 1,
    region: "FR",
  },
  "es-ES": {
    locale: "es-ES",
    languageName: "Español (España)",
    dir: "ltr",
    defaultCurrency: "EUR",
    dateStyle: "medium",
    timeStyle: "short",
    firstDayOfWeek: 1,
    region: "ES",
  },
  "ar-SA": {
    locale: "ar-SA",
    languageName: "العربية (السعودية)",
    dir: "rtl",
    defaultCurrency: "SAR",
    dateStyle: "medium",
    timeStyle: "short",
    firstDayOfWeek: 6,
    region: "SA",
  },
};

export const SUPPORTED_LOCALES = Object.keys(LOCALE_CONFIG) as Locale[];

export const RTL_LOCALES: Locale[] = SUPPORTED_LOCALES.filter(
  (locale) => LOCALE_CONFIG[locale].dir === "rtl",
);

export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "SAR", "JPY", "NGN"];
