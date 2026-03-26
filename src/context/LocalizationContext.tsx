import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { LOCALE_CONFIG, SUPPORTED_LOCALES } from "../i18n/config";
import {
  CommunityTranslationSuggestion,
  Locale,
  LocalizationAnalyticsSnapshot,
  TranslationMiss,
} from "../i18n/types";
import { translationManager } from "../services/localization/translationManager";

interface LocalizationContextValue {
  locale: Locale;
  currency: string;
  timezone: string;
  supportedLocales: Locale[];
  localeConfig: typeof LOCALE_CONFIG;
  isRTL: boolean;
  t: (
    key: string,
    options?: {
      count?: number;
      context?: string;
      values?: Record<string, string | number>;
      fallback?: string;
    },
  ) => string;
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: string) => void;
  setTimezone: (timezone: string) => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatRelativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
  ) => string;
  formatList: (
    values: string[],
    options?: {
      style?: "long" | "short" | "narrow";
      type?: "conjunction" | "disjunction" | "unit";
    },
  ) => string;
  missingTranslations: TranslationMiss[];
  analytics: LocalizationAnalyticsSnapshot;
  exportLocalizationState: () => string;
  importLocalizationState: (raw: string) => boolean;
  communitySuggestions: CommunityTranslationSuggestion[];
  addCommunitySuggestion: (
    data: Omit<
      CommunityTranslationSuggestion,
      "id" | "createdAt" | "votes" | "approved"
    >,
  ) => void;
  voteCommunitySuggestion: (id: string, delta?: 1 | -1) => void;
  approveCommunitySuggestion: (id: string) => void;
  refreshLocalizationInsights: () => void;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(
  null,
);

export function LocalizationProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [state, setState] = useState(() => translationManager.getState());
  const [missingTranslations, setMissingTranslations] = useState<
    TranslationMiss[]
  >(() => translationManager.missingTranslations());
  const [analytics, setAnalytics] = useState<LocalizationAnalyticsSnapshot>(
    () => translationManager.getAnalytics(),
  );
  const [communitySuggestions, setCommunitySuggestions] = useState<
    CommunityTranslationSuggestion[]
  >(() =>
    translationManager.getCommunitySuggestions(
      translationManager.getState().locale,
    ),
  );

  const refreshLocalizationInsights = useCallback(() => {
    setMissingTranslations(translationManager.missingTranslations());
    setAnalytics(translationManager.getAnalytics());
    setCommunitySuggestions(
      translationManager.getCommunitySuggestions(state.locale),
    );
  }, [state.locale]);

  const setLocale = useCallback((locale: Locale) => {
    const next = translationManager.setLocale(locale);
    setState(next);
    setCommunitySuggestions(translationManager.getCommunitySuggestions(locale));
    setAnalytics(translationManager.getAnalytics());
  }, []);

  const setCurrency = useCallback((currency: string) => {
    setState(translationManager.setCurrency(currency));
  }, []);

  const setTimezone = useCallback((timezone: string) => {
    setState(translationManager.setTimezone(timezone));
  }, []);

  const addCommunitySuggestion = useCallback(
    (
      data: Omit<
        CommunityTranslationSuggestion,
        "id" | "createdAt" | "votes" | "approved"
      >,
    ) => {
      translationManager.addCommunitySuggestion(data);
      setCommunitySuggestions(
        translationManager.getCommunitySuggestions(state.locale),
      );
    },
    [state.locale],
  );

  const voteCommunitySuggestion = useCallback(
    (id: string, delta: 1 | -1 = 1) => {
      translationManager.voteCommunitySuggestion(id, delta);
      setCommunitySuggestions(
        translationManager.getCommunitySuggestions(state.locale),
      );
    },
    [state.locale],
  );

  const approveCommunitySuggestion = useCallback(
    (id: string) => {
      translationManager.approveCommunitySuggestion(id);
      setCommunitySuggestions(
        translationManager.getCommunitySuggestions(state.locale),
      );
    },
    [state.locale],
  );

  const t = useCallback<LocalizationContextValue["t"]>((key, options) => {
    const value = translationManager.t(key, {
      count: options?.count,
      context: options?.context,
      values: options?.values,
      fallback: options?.fallback,
    });
    return value;
  }, []);

  const exportLocalizationState = useCallback(
    () => translationManager.exportState(),
    [],
  );
  const importLocalizationState = useCallback(
    (raw: string) => {
      const next = translationManager.importState(raw);
      if (!next) return false;
      setState(next);
      refreshLocalizationInsights();
      return true;
    },
    [refreshLocalizationInsights],
  );

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.documentElement.dir = translationManager.dir(state.locale);
    document.body.setAttribute("data-locale", state.locale);
    document.body.setAttribute(
      "data-dir",
      translationManager.dir(state.locale),
    );
  }, [state.locale]);

  useEffect(() => {
    setAnalytics(translationManager.getAnalytics());
  }, [state.locale, missingTranslations.length]);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale: state.locale,
      currency: state.currency,
      timezone: state.timezone,
      supportedLocales: SUPPORTED_LOCALES,
      localeConfig: LOCALE_CONFIG,
      isRTL: translationManager.isRTL(state.locale),
      t,
      setLocale,
      setCurrency,
      setTimezone,
      formatNumber: translationManager.formatNumber.bind(translationManager),
      formatCurrency:
        translationManager.formatCurrency.bind(translationManager),
      formatDate: translationManager.formatDate.bind(translationManager),
      formatRelativeTime:
        translationManager.formatRelativeTime.bind(translationManager),
      formatList: translationManager.formatList.bind(translationManager),
      missingTranslations,
      analytics,
      exportLocalizationState,
      importLocalizationState,
      communitySuggestions,
      addCommunitySuggestion,
      voteCommunitySuggestion,
      approveCommunitySuggestion,
      refreshLocalizationInsights,
    }),
    [
      state,
      t,
      setLocale,
      setCurrency,
      setTimezone,
      missingTranslations,
      analytics,
      exportLocalizationState,
      importLocalizationState,
      communitySuggestions,
      addCommunitySuggestion,
      voteCommunitySuggestion,
      approveCommunitySuggestion,
      refreshLocalizationInsights,
    ],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error(
      "useLocalization must be used within a LocalizationProvider",
    );
  }
  return context;
}
