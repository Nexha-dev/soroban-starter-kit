import { CommunityTranslationSuggestion, Locale } from "../../i18n/types";

const STORAGE_KEY = "fidelis-community-translations";

class CommunityTranslationsService {
  private cache: CommunityTranslationSuggestion[] = [];

  constructor() {
    this.cache = this.read();
  }

  list(locale?: Locale): CommunityTranslationSuggestion[] {
    if (!locale) return [...this.cache];
    return this.cache.filter((entry) => entry.locale === locale);
  }

  addSuggestion(
    input: Omit<
      CommunityTranslationSuggestion,
      "id" | "createdAt" | "votes" | "approved"
    >,
  ): CommunityTranslationSuggestion {
    const suggestion: CommunityTranslationSuggestion = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      votes: 0,
      approved: false,
    };

    this.cache = [suggestion, ...this.cache];
    this.persist();
    return suggestion;
  }

  vote(
    id: string,
    delta: 1 | -1 = 1,
  ): CommunityTranslationSuggestion | undefined {
    let updated: CommunityTranslationSuggestion | undefined;

    this.cache = this.cache.map((entry) => {
      if (entry.id !== id) return entry;
      updated = { ...entry, votes: Math.max(0, entry.votes + delta) };
      return updated;
    });

    this.persist();
    return updated;
  }

  approve(id: string): CommunityTranslationSuggestion | undefined {
    let updated: CommunityTranslationSuggestion | undefined;

    this.cache = this.cache.map((entry) => {
      if (entry.id !== id) return entry;
      updated = { ...entry, approved: true };
      return updated;
    });

    this.persist();
    return updated;
  }

  private read(): CommunityTranslationSuggestion[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data) as CommunityTranslationSuggestion[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // ignore storage quota errors
    }
  }
}

export const communityTranslations = new CommunityTranslationsService();
