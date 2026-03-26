import { Locale, LocalizationAnalyticsSnapshot } from "../../i18n/types";

const STORAGE_KEY = "fidelis-localization-analytics";

interface MutableAnalyticsState {
  activeLocale: Locale;
  localeSwitches: number;
  keyHits: Record<string, number>;
  missingKeys: Record<string, number>;
  formatterUsage: LocalizationAnalyticsSnapshot["formatterUsage"];
  rtlSessions: number;
}

const defaultFormatterUsage = {
  number: 0,
  currency: 0,
  date: 0,
  relativeTime: 0,
  list: 0,
};

function createDefaultState(locale: Locale): MutableAnalyticsState {
  return {
    activeLocale: locale,
    localeSwitches: 0,
    keyHits: {},
    missingKeys: {},
    formatterUsage: { ...defaultFormatterUsage },
    rtlSessions: 0,
  };
}

class LocalizationAnalyticsService {
  private state: MutableAnalyticsState = createDefaultState("en-US");

  init(initialLocale: Locale): void {
    this.state = createDefaultState(initialLocale);

    try {
      const fromStorage = localStorage.getItem(STORAGE_KEY);
      if (fromStorage) {
        const parsed = JSON.parse(fromStorage) as MutableAnalyticsState;
        this.state = {
          ...this.state,
          ...parsed,
          activeLocale: initialLocale,
          formatterUsage: {
            ...defaultFormatterUsage,
            ...(parsed.formatterUsage ?? {}),
          },
        };
      }
    } catch {
      // Ignore malformed state
    }
  }

  markLocaleSwitch(nextLocale: Locale, isRtl: boolean): void {
    this.state.localeSwitches += 1;
    this.state.activeLocale = nextLocale;
    if (isRtl) this.state.rtlSessions += 1;
    this.persist();
  }

  trackTranslationKey(key: string): void {
    this.state.keyHits[key] = (this.state.keyHits[key] ?? 0) + 1;
  }

  trackMissingKey(key: string): void {
    this.state.missingKeys[key] = (this.state.missingKeys[key] ?? 0) + 1;
    this.persist();
  }

  trackFormatter(
    type: keyof LocalizationAnalyticsSnapshot["formatterUsage"],
  ): void {
    this.state.formatterUsage[type] += 1;
  }

  snapshot(): LocalizationAnalyticsSnapshot {
    const snapshot: LocalizationAnalyticsSnapshot = {
      activeLocale: this.state.activeLocale,
      localeSwitches: this.state.localeSwitches,
      keyHits: { ...this.state.keyHits },
      missingKeys: { ...this.state.missingKeys },
      formatterUsage: { ...this.state.formatterUsage },
      rtlSessions: this.state.rtlSessions,
      recordedAt: Date.now(),
    };

    return snapshot;
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeLocale: this.state.activeLocale,
          localeSwitches: this.state.localeSwitches,
          keyHits: this.state.keyHits,
          missingKeys: this.state.missingKeys,
          formatterUsage: this.state.formatterUsage,
          rtlSessions: this.state.rtlSessions,
        }),
      );
    } catch {
      // Ignore storage errors
    }
  }
}

export const localizationAnalytics = new LocalizationAnalyticsService();
