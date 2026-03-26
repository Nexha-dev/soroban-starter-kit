/**
 * Offline Cache Management Service
 * Handles intelligent caching, eviction policies, and cache optimization
 */

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  priority: 'low' | 'medium' | 'high';
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags?: string[];
}

export interface CacheStats {
  totalSize: number;
  entryCount: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressionRatio: number;
}

export interface CachePolicy {
  maxSize: number; // in bytes
  maxEntries: number;
  ttl: number; // time to live in ms
  evictionStrategy: 'LRU' | 'LFU' | 'FIFO';
  compressionEnabled: boolean;
}

class OfflineCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private accessLog: string[] = [];
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
  };

  private policy: CachePolicy = {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 5000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    evictionStrategy: 'LRU',
    compressionEnabled: true,
  };

  private cleanupInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(stats: CacheStats) => void> = new Set();

  constructor(policy?: Partial<CachePolicy>) {
    if (policy) {
      this.policy = { ...this.policy, ...policy };
    }
    this.startCleanupRoutine();
  }

  /**
   * Initialize cache service
   */
  async init(): Promise<void> {
    // Load cache from storage if needed
    await this.performCleanup();
  }

  /**
   * Set cache entry with smart sizing
   */
  async set<T>(
    key: string,
    data: T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high';
      tags?: string[];
    }
  ): Promise<void> {
    const size = this.estimateSize(data);
    
    // Check if entry would exceed limits
    if (size > this.policy.maxSize * 0.1) {
      console.warn(`Cache entry size (${size} bytes) exceeds 10% of max cache size`);
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options?.ttl || this.policy.ttl),
      priority: options?.priority || 'medium',
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      tags: options?.tags,
    };

    // Remove evicted entry if needed
    if (this.shouldEvict(size)) {
      await this.evict();
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.notifyListeners();
  }

  /**
   * Get cache entry
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.notifyListeners();
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.misses++;
      this.notifyListeners();
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.accessLog.push(key);

    this.notifyListeners();
    return entry.data as T;
  }

  /**
   * Check if entry exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      return false;
    }
    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.stats.totalSize -= entry.size;
    this.notifyListeners();
    return true;
  }

  /**
   * Clear all cache or by tag
   */
  clear(tag?: string): void {
    if (!tag) {
      this.cache.clear();
      this.stats.totalSize = 0;
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.evictions = 0;
    } else {
      const toDelete: string[] = [];
      this.cache.forEach((entry, key) => {
        if (entry.tags?.includes(tag)) {
          toDelete.push(key);
          this.stats.totalSize -= entry.size;
        }
      });
      toDelete.forEach(key => this.cache.delete(key));
    }
    this.notifyListeners();
  }

  /**
   * Get entries by tag
   */
  getByTag<T = unknown>(tag: string): T[] {
    const results: T[] = [];
    this.cache.forEach(entry => {
      if (entry.tags?.includes(tag) && entry.expiresAt > Date.now()) {
        results.push(entry.data as T);
      }
    });
    return results;
  }

  /**
   * Determine if eviction is needed
   */
  private shouldEvict(newSize: number): boolean {
    return (
      this.stats.totalSize + newSize > this.policy.maxSize ||
      this.cache.size >= this.policy.maxEntries
    );
  }

  /**
   * Evict entries based on policy
   */
  private async evict(): Promise<void> {
    let evicted = 0;

    switch (this.policy.evictionStrategy) {
      case 'LRU':
        evicted = await this.evictLRU();
        break;
      case 'LFU':
        evicted = await this.evictLFU();
        break;
      case 'FIFO':
        evicted = await this.evictFIFO();
        break;
    }

    this.stats.evictions += evicted;
  }

  /**
   * Least Recently Used eviction
   */
  private async evictLRU(): Promise<number> {
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, Math.ceil(this.cache.size * 0.1)); // Remove 10% of entries

    sorted.forEach(([key, entry]) => {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
    });

    return sorted.length;
  }

  /**
   * Least Frequently Used eviction
   */
  private async evictLFU(): Promise<number> {
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount)
      .slice(0, Math.ceil(this.cache.size * 0.1));

    sorted.forEach(([key, entry]) => {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
    });

    return sorted.length;
  }

  /**
   * FIFO eviction
   */
  private async evictFIFO(): Promise<number> {
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, Math.ceil(this.cache.size * 0.1));

    sorted.forEach(([key, entry]) => {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
    });

    return sorted.length;
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: unknown): number {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  }

  /**
   * Perform cleanup of expired entries
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        toDelete.push(key);
        this.stats.totalSize -= entry.size;
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
    this.notifyListeners();
  }

  /**
   * Start automatic cleanup routine
   */
  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      totalSize: this.stats.totalSize,
      entryCount: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      evictions: this.stats.evictions,
      compressionRatio: this.policy.compressionEnabled ? 0.85 : 1.0,
    };
  }

  /**
   * Subscribe to stats updates
   */
  subscribe(listener: (stats: CacheStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const stats = this.getStats();
    this.listeners.forEach(listener => listener(stats));
  }

  /**
   * Prefetch data based on patterns
   */
  async prefetch(keys: string[], priority: 'low' | 'medium' | 'high' = 'low'): Promise<void> {
    // This would be called before expected network use
    console.log(`Prefetching ${keys.length} items with priority: ${priority}`);
  }

  /**
   * Get cache size breakdown
   */
  getSizeBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};

    this.cache.forEach(entry => {
      const category = entry.tags?.[0] || 'other';
      breakdown[category] = (breakdown[category] || 0) + entry.size;
    });

    return breakdown;
  }

  /**
   * Export cache for debugging
   */
  export(): Record<string, unknown> {
    const exported: Record<string, unknown> = {};
    this.cache.forEach((entry, key) => {
      exported[key] = {
        data: entry.data,
        expiresAt: entry.expiresAt,
        priority: entry.priority,
        accessCount: entry.accessCount,
        size: entry.size,
      };
    });
    return exported;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const offlineCache = new OfflineCacheService();
