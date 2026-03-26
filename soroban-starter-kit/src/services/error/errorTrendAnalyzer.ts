/**
 * Error Trend Analyzer
 * Buckets errors over time, detects spikes, and suggests prevention strategies
 */

import type { ErrorInfo } from './errorHandler';

export interface TrendBucket {
  timestamp: number; // bucket start (rounded to minute)
  count: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface TrendSummary {
  buckets: TrendBucket[];
  spike: boolean;
  spikeThreshold: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  preventionStrategies: string[];
}

const PREVENTION: Record<string, string> = {
  network: 'Implement exponential back-off retries and offline queuing',
  validation: 'Add client-side validation before API calls to reduce round-trips',
  auth: 'Implement token refresh logic and proactive session renewal',
  permission: 'Audit role assignments and surface permission errors earlier in the UI',
  server: 'Add circuit-breaker pattern and graceful degradation for server errors',
  client: 'Enable source maps and error boundaries to catch rendering errors early',
  unknown: 'Add structured logging with context to improve error categorisation',
};

export class ErrorTrendAnalyzer {
  private buckets: Map<number, TrendBucket> = new Map();
  private bucketSizeMs = 60_000; // 1-minute buckets
  private maxBuckets = 60;

  record(error: ErrorInfo): void {
    const key = Math.floor(error.timestamp / this.bucketSizeMs) * this.bucketSizeMs;

    if (!this.buckets.has(key)) {
      this.buckets.set(key, { timestamp: key, count: 0, byCategory: {}, bySeverity: {} });
      // Evict oldest if over limit
      if (this.buckets.size > this.maxBuckets) {
        const oldest = Math.min(...this.buckets.keys());
        this.buckets.delete(oldest);
      }
    }

    const bucket = this.buckets.get(key)!;
    bucket.count++;
    bucket.byCategory[error.category] = (bucket.byCategory[error.category] ?? 0) + 1;
    bucket.bySeverity[error.severity] = (bucket.bySeverity[error.severity] ?? 0) + 1;
  }

  getSummary(windowBuckets = 10): TrendSummary {
    const sorted = [...this.buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
    const recent = sorted.slice(-windowBuckets);

    const counts = recent.map(b => b.count);
    const latest = counts[counts.length - 1] ?? 0;
    const earlier = counts.slice(0, -1);
    const earlierAvg = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : 0;
    // Spike: either latest is 2× the historical average, or ≥10 with no history
    const spikeThreshold = earlier.length > 0 ? Math.max(earlierAvg * 2, 5) : 9;
    const spike = latest > spikeThreshold;

    let trend: TrendSummary['trend'] = 'stable';
    if (counts.length >= 3) {
      const first = counts.slice(0, Math.ceil(counts.length / 2)).reduce((a, b) => a + b, 0);
      const second = counts.slice(Math.ceil(counts.length / 2)).reduce((a, b) => a + b, 0);
      const delta = (second - first) / Math.max(first, 1);
      if (delta > 0.2) trend = 'increasing';
      else if (delta < -0.2) trend = 'decreasing';
    }

    // Collect top categories across recent buckets
    const catCounts: Record<string, number> = {};
    for (const b of recent) {
      for (const [cat, n] of Object.entries(b.byCategory)) {
        catCounts[cat] = (catCounts[cat] ?? 0) + n;
      }
    }
    const topCats = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const preventionStrategies = topCats.map(c => PREVENTION[c]).filter(Boolean);
    if (spike) preventionStrategies.unshift('Error spike detected — investigate recent deployments or infrastructure changes');

    return { buckets: recent, spike, spikeThreshold, trend, preventionStrategies };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const errorTrendAnalyzer = new ErrorTrendAnalyzer();
export default errorTrendAnalyzer;
