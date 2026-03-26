/**
 * Usage Analytics
 * Tracks component view counts, playground interactions, and search queries
 */

export interface ComponentUsageEvent {
  componentId: string;
  event: 'view' | 'playground' | 'copy-code' | 'contribution';
  timestamp: number;
}

export interface UsageSummary {
  componentId: string;
  views: number;
  playgroundUses: number;
  codeCopies: number;
}

export interface SearchEvent {
  query: string;
  resultCount: number;
  timestamp: number;
}

export class DocsAnalytics {
  private events: ComponentUsageEvent[] = [];
  private searches: SearchEvent[] = [];
  private maxEvents = 1000;

  track(componentId: string, event: ComponentUsageEvent['event']): void {
    this.events.push({ componentId, event, timestamp: Date.now() });
    if (this.events.length > this.maxEvents) this.events.shift();
  }

  trackSearch(query: string, resultCount: number): void {
    this.searches.push({ query, resultCount, timestamp: Date.now() });
    if (this.searches.length > 200) this.searches.shift();
  }

  getSummary(componentId: string): UsageSummary {
    const relevant = this.events.filter(e => e.componentId === componentId);
    return {
      componentId,
      views: relevant.filter(e => e.event === 'view').length,
      playgroundUses: relevant.filter(e => e.event === 'playground').length,
      codeCopies: relevant.filter(e => e.event === 'copy-code').length,
    };
  }

  getTopComponents(limit = 5): UsageSummary[] {
    const ids = [...new Set(this.events.map(e => e.componentId))];
    return ids
      .map(id => this.getSummary(id))
      .sort((a, b) => (b.views + b.playgroundUses) - (a.views + a.playgroundUses))
      .slice(0, limit);
  }

  getRecentSearches(limit = 10): SearchEvent[] {
    return this.searches.slice(-limit).reverse();
  }

  getPopularSearches(limit = 5): { query: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const s of this.searches) {
      counts.set(s.query, (counts.get(s.query) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  clear(): void {
    this.events = [];
    this.searches = [];
  }
}

export const docsAnalytics = new DocsAnalytics();
export default docsAnalytics;
