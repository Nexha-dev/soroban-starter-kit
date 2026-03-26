/**
 * Cache Strategy Manager
 * Manages caching strategies and resource preloading
 */

export type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only';

export interface CacheRule {
  pattern: RegExp;
  strategy: CacheStrategy;
  maxAge: number; // seconds
  maxEntries?: number;
}

export interface PreloadHint {
  href: string;
  as: 'script' | 'style' | 'image' | 'font' | 'fetch';
  crossOrigin?: boolean;
}

export interface CacheStats {
  cacheName: string;
  entries: number;
  estimatedSize: number;
}

class CacheStrategyManager {
  private rules: CacheRule[] = [];

  constructor() {
    this.initDefaultRules();
  }

  private initDefaultRules(): void {
    this.rules = [
      { pattern: /\.(js|css)(\?.*)?$/, strategy: 'cache-first', maxAge: 7 * 24 * 3600, maxEntries: 50 },
      { pattern: /\.(png|jpg|jpeg|webp|avif|svg|ico)(\?.*)?$/, strategy: 'cache-first', maxAge: 30 * 24 * 3600, maxEntries: 100 },
      { pattern: /\/api\//, strategy: 'network-first', maxAge: 60, maxEntries: 50 },
      { pattern: /\.(woff2?|ttf|eot)(\?.*)?$/, strategy: 'cache-first', maxAge: 365 * 24 * 3600 },
    ];
  }

  /**
   * Get the appropriate cache strategy for a URL
   */
  getStrategy(url: string): CacheRule | null {
    return this.rules.find(r => r.pattern.test(url)) ?? null;
  }

  /**
   * Add a custom cache rule
   */
  addRule(rule: CacheRule): void {
    this.rules.unshift(rule); // higher priority
  }

  /**
   * Inject preload hints into the document head
   */
  preload(hints: PreloadHint[]): void {
    for (const hint of hints) {
      if (document.querySelector(`link[rel="preload"][href="${hint.href}"]`)) continue;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = hint.href;
      link.as = hint.as;
      if (hint.crossOrigin) link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }

  /**
   * Prefetch resources for likely next navigations
   */
  prefetch(urls: string[]): void {
    for (const url of urls) {
      if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) continue;

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    }
  }

  /**
   * Get cache storage stats
   */
  async getCacheStats(): Promise<CacheStats[]> {
    if (!('caches' in window)) return [];

    const cacheNames = await caches.keys();
    const stats: CacheStats[] = [];

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      stats.push({ cacheName: name, entries: keys.length, estimatedSize: 0 });
    }

    return stats;
  }

  /**
   * Clear stale cache entries
   */
  async clearStale(cacheName: string, maxAge: number): Promise<number> {
    if (!('caches' in window)) return 0;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const cutoff = Date.now() - maxAge * 1000;
    let cleared = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (!response) continue;

      const dateHeader = response.headers.get('date');
      if (dateHeader && new Date(dateHeader).getTime() < cutoff) {
        await cache.delete(request);
        cleared++;
      }
    }

    return cleared;
  }

  getRules(): CacheRule[] {
    return [...this.rules];
  }
}

export const cacheStrategyManager = new CacheStrategyManager();
export default cacheStrategyManager;
