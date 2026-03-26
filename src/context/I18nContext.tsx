import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  TranslationManager,
  LocaleFormatterImpl,
  RTLAdapter,
  LocaleNotFoundError,
} from '../services/i18n';
import type { I18nContextValue } from '../services/i18n';

const STORAGE_KEY = 'fidelis-locale';
const FALLBACK_LOCALE = 'en-US';
const SUPPORTED_LOCALES = [
  'en-US', 'fr-FR', 'ar-SA', 'he-IL', 'de-DE',
  'ja-JP', 'zh-CN', 'es-ES', 'pt-BR', 'fa-IR',
];

/** Read persisted locale from localStorage, silently ignoring unavailability. */
function readPersistedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persist locale to localStorage, silently ignoring unavailability. */
function writePersistedLocale(locale: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage unavailable (e.g. private browsing) — silently no-op
  }
}

/**
 * Determine the initial locale using the priority chain:
 * 1. localStorage persisted preference
 * 2. navigator.languages / navigator.language matched against supported locales
 * 3. 'en-US' fallback
 */
function detectInitialLocale(loadedLocales: string[]): string {
  // 1. Persisted preference
  const persisted = readPersistedLocale();
  if (persisted && SUPPORTED_LOCALES.includes(persisted)) {
    return persisted;
  }

  // 2. Browser language preference
  const browserLanguages: readonly string[] =
    (typeof navigator !== 'undefined' && navigator.languages?.length)
      ? navigator.languages
      : typeof navigator !== 'undefined' && navigator.language
        ? [navigator.language]
        : [];

  for (const lang of browserLanguages) {
    // Exact match first
    if (loadedLocales.includes(lang)) return lang;
    // Language-prefix match (e.g. 'fr' matches 'fr-FR')
    const prefix = lang.split('-')[0].toLowerCase();
    const match = loadedLocales.find(l => l.split('-')[0].toLowerCase() === prefix);
    if (match) return match;
  }

  // 3. Fallback
  return FALLBACK_LOCALE;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const managerRef = useRef(new TranslationManager(FALLBACK_LOCALE));
  const formatterRef = useRef(new LocaleFormatterImpl());
  const rtlAdapterRef = useRef(new RTLAdapter());

  const [locale, setLocaleState] = useState<string>(FALLBACK_LOCALE);
  const [initialized, setInitialized] = useState(false);

  // On mount: pre-load all supported catalogs, then determine initial locale
  useEffect(() => {
    const manager = managerRef.current;
    const rtl = rtlAdapterRef.current;

    async function init() {
      // Load all supported catalogs (or at minimum en-US + detected locale)
      await Promise.allSettled(
        SUPPORTED_LOCALES.map(loc => manager.loadCatalog(loc))
      );

      const loadedLocales = manager.loadedLocales;
      const initial = detectInitialLocale(loadedLocales);

      manager.setActiveLocale(initial);
      rtl.apply(initial);
      setLocaleState(initial);
      setInitialized(true);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback(async (newLocale: string): Promise<void> => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) {
      throw new LocaleNotFoundError(newLocale);
    }

    const manager = managerRef.current;
    const rtl = rtlAdapterRef.current;

    // Load catalog if not already cached
    await manager.loadCatalog(newLocale);

    manager.setActiveLocale(newLocale);
    rtl.apply(newLocale);
    writePersistedLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      managerRef.current.t(key, values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  const plural = useCallback(
    (key: string, count: number, values?: Record<string, string | number>) =>
      managerRef.current.plural(key, count, values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  const isRTL = useMemo(
    () => rtlAdapterRef.current.isRTL(locale),
    [locale]
  );

  const availableLocales = useMemo(
    () => (initialized ? managerRef.current.loadedLocales : SUPPORTED_LOCALES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialized, locale]
  );

  const value: I18nContextValue = useMemo(
    () => ({
      locale,
      availableLocales,
      setLocale,
      t,
      plural,
      formatter: formatterRef.current,
      isRTL,
    }),
    [locale, availableLocales, setLocale, t, plural, isRTL]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
