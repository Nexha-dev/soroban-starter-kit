import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  SavedSearch,
  SearchAnalytics,
  SearchSuggestion,
  SearchQuery,
} from './types';

interface SearchDB extends DBSchema {
  savedSearches: {
    key: string;
    value: SavedSearch;
  };
  analytics: {
    key: string;
    value: SearchAnalytics;
  };
  suggestions: {
    key: string;
    value: SearchSuggestion;
  };
}

/**
 * Search manager for saved searches, analytics, and suggestions
 */
class SearchManager {
  private db: IDBPDatabase<SearchDB> | null = null;
  private readonly dbName = 'soroban-search';
  private readonly version = 1;

  async init(): Promise<void> {
    this.db = await openDB<SearchDB>(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('savedSearches')) {
          db.createObjectStore('savedSearches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('suggestions')) {
          db.createObjectStore('suggestions', { keyPath: 'text' });
        }
      },
    });
  }

  async saveSearch(name: string, query: SearchQuery): Promise<SavedSearch> {
    if (!this.db) await this.init();

    const search: SavedSearch = {
      id: `search_${Date.now()}`,
      name,
      query,
      createdAt: Date.now(),
      useCount: 0,
    };

    await this.db!.put('savedSearches', search);
    return search;
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('savedSearches');
  }

  async deleteSavedSearch(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('savedSearches', id);
  }

  async updateSearchUsage(id: string): Promise<void> {
    if (!this.db) await this.init();

    const search = await this.db!.get('savedSearches', id);
    if (search) {
      search.useCount++;
      search.lastUsed = Date.now();
      await this.db!.put('savedSearches', search);
    }
  }

  async recordAnalytics(
    query: string,
    filters: Record<string, unknown>,
    resultCount: number,
    executionTime: number
  ): Promise<void> {
    if (!this.db) await this.init();

    const analytics: SearchAnalytics = {
      id: `analytics_${Date.now()}`,
      query,
      filters,
      resultCount,
      executionTime,
      timestamp: Date.now(),
    };

    await this.db!.put('analytics', analytics);

    // Update suggestions
    if (query.trim()) {
      await this.updateSuggestion(query, 'query');
    }
  }

  private async updateSuggestion(
    text: string,
    type: 'query' | 'filter' | 'saved'
  ): Promise<void> {
    if (!this.db) await this.init();

    const existing = await this.db!.get('suggestions', text);
    const suggestion: SearchSuggestion = {
      text,
      type,
      frequency: (existing?.frequency || 0) + 1,
      lastUsed: Date.now(),
    };

    await this.db!.put('suggestions', suggestion);
  }

  async getSuggestions(prefix: string, limit: number = 5): Promise<SearchSuggestion[]> {
    if (!this.db) await this.init();

    const allSuggestions = await this.db!.getAll('suggestions');
    return allSuggestions
      .filter(s => s.text.toLowerCase().startsWith(prefix.toLowerCase()))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  async getRecentHistory(limit = 10): Promise<SearchAnalytics[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('analytics');
    return all
      .filter(a => a.query.trim())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getTopQueries(limit = 5): Promise<{ query: string; count: number; avgTime: number }[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('analytics');
    const map = new Map<string, { count: number; totalTime: number }>();
    for (const a of all) {
      if (!a.query.trim()) continue;
      const entry = map.get(a.query) ?? { count: 0, totalTime: 0 };
      entry.count++;
      entry.totalTime += a.executionTime;
      map.set(a.query, entry);
    }
    return [...map.entries()]
      .map(([query, { count, totalTime }]) => ({ query, count, avgTime: totalTime / count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getAnalytics(limit: number = 100): Promise<SearchAnalytics[]> {
    if (!this.db) await this.init();

    const all = await this.db!.getAll('analytics');
    return all.slice(-limit);
  }

  async clearOldAnalytics(daysOld: number = 30): Promise<void> {
    if (!this.db) await this.init();

    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const all = await this.db!.getAll('analytics');

    for (const item of all) {
      if (item.timestamp < cutoff) {
        await this.db!.delete('analytics', item.id);
      }
    }
  }
}

export const searchManager = new SearchManager();
