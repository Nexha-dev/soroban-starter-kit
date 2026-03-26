/**
 * Cache Optimization Service
 * Implements smart caching strategies and optimization
 */

import { offlineCache, CacheEntry } from './cache';

export interface OptimizationStrategy {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface CompressionResult {
  original: number;
  compressed: number;
  ratio: number;
  time: number;
}

export interface PrefetchStrategy {
  name: string;
  patterns: string[];
  enabled: boolean;
  priority: 'low' | 'medium' | 'high';
}

class CacheOptimizationService {
  private strategies: Map<string, OptimizationStrategy> = new Map();
  private compressionStats: CompressionResult[] = [];
  private prefetchPatterns: PrefetchStrategy[] = [];
  private accessPatterns: Map<string, number[]> = new Map();

  /**
   * Initialize optimization service
   */
  async init(): Promise<void> {
    this.initializeStrategies();
  }

  /**
   * Initialize default strategies
   */
  private initializeStrategies(): void {
    this.strategies.set('compression', {
      name: 'Compression',
      enabled: true,
      config: { algorithm: 'gzip', level: 6 },
    });

    this.strategies.set('deduplication', {
      name: 'Deduplication',
      enabled: true,
      config: { threshold: 100 },
    });

    this.strategies.set('prefetch', {
      name: 'Prefetch',
      enabled: true,
      config: { maxPrefetch: 10, timeout: 5000 },
    });

    this.strategies.set('lazy-load', {
      name: 'Lazy Load',
      enabled: true,
      config: { threshold: 1024 * 1024 }, // 1MB
    });
  }

  /**
   * Enable strategy
   */
  enableStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.enabled = true;
    }
  }

  /**
   * Disable strategy
   */
  disableStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.enabled = false;
    }
  }

  /**
   * Compress data for storage
   */
  async compressData(data: unknown): Promise<CompressionResult> {
    const startTime = Date.now();
    const original = JSON.stringify(data);
    const originalSize = new Blob([original]).size;

    // Simple compression simulation (in production use actual compression library)
    let compressed = original;
    
    // Remove whitespace
    compressed = compressed.replace(/\s+/g, '');
    
    // Basic RLE for repeated patterns
    compressed = this.applyRLE(compressed);

    const compressedSize = new Blob([compressed]).size;
    const duration = Date.now() - startTime;

    const result: CompressionResult = {
      original: originalSize,
      compressed: compressedSize,
      ratio: compressedSize / originalSize,
      time: duration,
    };

    this.compressionStats.push(result);
    if (this.compressionStats.length > 100) {
      this.compressionStats.shift();
    }

    return result;
  }

  /**
   * Simple RLE compression
   */
  private applyRLE(str: string): string {
    let result = '';
    let count = 1;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === str[i + 1]) {
        count++;
      } else {
        result += count > 3 ? str[i] + count : str.substring(i - count + 1, i + 1);
        count = 1;
      }
    }

    return result;
  }

  /**
   * Analyze access patterns
   */
  analyzeAccessPatterns(): Map<string, { frequency: number; recency: number }> {
    const analysis = new Map<string, { frequency: number; recency: number }>();

    this.accessPatterns.forEach((timestamps, key) => {
      if (timestamps.length === 0) return;

      const now = Date.now();
      const frequency = timestamps.length;
      const recency = (now - timestamps[timestamps.length - 1]) / 1000; // seconds ago

      analysis.set(key, {
        frequency,
        recency,
      });
    });

    return analysis;
  }

  /**
   * Identify hot data
   */
  getHotDataKeys(threshold: number = 5): string[] {
    const analysis = this.analyzeAccessPatterns();
    const hot: string[] = [];

    analysis.forEach((metrics, key) => {
      if (metrics.frequency >= threshold) {
        hot.push(key);
      }
    });

    return hot;
  }

  /**
   * Identify cold data
   */
  getColdDataKeys(maxAge: number = 24 * 60 * 60 * 1000): string[] {
    const analysis = this.analyzeAccessPatterns();
    const cold: string[] = [];

    analysis.forEach((metrics, key) => {
      if (metrics.recency * 1000 > maxAge) {
        cold.push(key);
      }
    });

    return cold;
  }

  /**
   * Suggest cache eviction candidates
   */
  suggestEvictionCandidates(count: number = 10): string[] {
    const analysis = this.analyzeAccessPatterns();
    const candidates = Array.from(analysis.entries())
      .map(([key, metrics]) => ({
        key,
        score: metrics.frequency * Math.exp(-metrics.recency / (24 * 60 * 60)), // Decay over time
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map(item => item.key);

    return candidates;
  }

  /**
   * Record data access
   */
  recordAccess(key: string): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    this.accessPatterns.get(key)!.push(Date.now());
  }

  /**
   * Setup intelligent prefetch
   */
  setupPrefetchStrategy(strategy: PrefetchStrategy): void {
    const existing = this.prefetchPatterns.findIndex(s => s.name === strategy.name);
    if (existing >= 0) {
      this.prefetchPatterns[existing] = strategy;
    } else {
      this.prefetchPatterns.push(strategy);
    }
  }

  /**
   * Predict required data
   */
  predictRequiredData(): string[] {
    const patterns = this.prefetchPatterns.filter(s => s.enabled);
    const predicted: Set<string> = new Set();

    patterns.forEach(strategy => {
      strategy.patterns.forEach(pattern => {
        predicted.add(pattern);
      });
    });

    return Array.from(predicted);
  }

  /**
   * Optimize cache size
   */
  optimizeCacheSize(targetSize: number): { freed: number; entries: number } {
    const candidates = this.suggestEvictionCandidates(100);
    let freed = 0;
    let entries = 0;

    for (const key of candidates) {
      if (freed >= targetSize) break;
      if (offlineCache.delete(key)) {
        entries++;
        // Note: actual size would need to be tracked
      }
    }

    return { freed, entries };
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    averageRatio: number;
    totalTimeSpent: number;
    compressionCount: number;
  } {
    if (this.compressionStats.length === 0) {
      return { averageRatio: 1, totalTimeSpent: 0, compressionCount: 0 };
    }

    const avgRatio = 
      this.compressionStats.reduce((sum, s) => sum + s.ratio, 0) / 
      this.compressionStats.length;

    const totalTime = this.compressionStats.reduce((sum, s) => sum + s.time, 0);

    return {
      averageRatio: avgRatio,
      totalTimeSpent: totalTime,
      compressionCount: this.compressionStats.length,
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getCompressionStats();
    const hotKeys = this.getHotDataKeys();
    const coldKeys = this.getColdDataKeys();

    // Compression recommendation
    if (stats.averageRatio < 0.8) {
      recommendations.push('Enable compression - achieving good compression ratio');
    } else if (stats.averageRatio > 0.95) {
      recommendations.push('Data may not compress well - consider disabling compression');
    }

    // Cache priority recommendation
    if (hotKeys.length > 0) {
      recommendations.push(
        `Prioritize caching: ${hotKeys.slice(0, 3).join(', ')}`
      );
    }

    // Eviction recommendation
    if (coldKeys.length > 10) {
      recommendations.push(
        `Consider evicting cold data - ${coldKeys.length} old entries detected`
      );
    }

    // Prefetch recommendation
    const analysis = this.analyzeAccessPatterns();
    if (analysis.size > 100) {
      recommendations.push('Setup intelligent prefetch to optimize load patterns');
    }

    return recommendations;
  }

  /**
   * Run optimization routine
   */
  async runOptimization(): Promise<{
    entriesAnalyzed: number;
    entriesOptimized: number;
    spaceFreed: number;
  }> {
    let entriesAnalyzed = 0;
    let entriesOptimized = 0;
    let spaceFreed = 0;

    // Analyze patterns
    const analysis = this.analyzeAccessPatterns();
    entriesAnalyzed = analysis.size;

    // Apply optimizations
    const candidates = this.suggestEvictionCandidates(50);
    for (const key of candidates) {
      if (offlineCache.delete(key)) {
        entriesOptimized++;
      }
    }

    return {
      entriesAnalyzed,
      entriesOptimized,
      spaceFreed,
    };
  }

  /**
   * Get strategy status
   */
  getStrategies(): Array<{ name: string; enabled: boolean }> {
    return Array.from(this.strategies.values()).map(s => ({
      name: s.name,
      enabled: s.enabled,
    }));
  }

  /**
   * Reset optimization data
   */
  reset(): void {
    this.accessPatterns.clear();
    this.compressionStats = [];
  }
}

export const cacheOptimization = new CacheOptimizationService();
