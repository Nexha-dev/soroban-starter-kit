/**
 * Performance Monitor
 * Tracks runtime metrics, page load, and contract call performance.
 */

import { RuntimeMetric, ThresholdViolationEvent } from './types';
import { performanceBudgetManager } from './budgetManager';

const STORAGE_KEY = 'perf:metrics';
const PRUNE_WINDOW_MS = 86400000; // 24 hours

export class Monitor {
  private _memoryMetrics: RuntimeMetric[] = [];
  private _useMemory = false;
  private _observers: PerformanceObserver[] = [];
  private _violationHandlers: Set<(event: ThresholdViolationEvent) => void> = new Set();

  // ---- Lifecycle ----

  start(): void {
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this._storeMetric({
            name: 'pageLoadTime',
            value: entry.duration,
            timestamp: Date.now(),
            category: 'page',
          });
        }
      });
      navObserver.observe({ type: 'navigation', buffered: true });
      this._observers.push(navObserver);
    } catch {
      // PerformanceObserver not available
    }

    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this._storeMetric({
              name: 'firstContentfulPaint',
              value: entry.startTime,
              timestamp: Date.now(),
              category: 'page',
            });
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
      this._observers.push(paintObserver);
    } catch {
      // PerformanceObserver not available
    }
  }

  stop(): void {
    for (const observer of this._observers) {
      try {
        observer.disconnect();
      } catch {
        // ignore
      }
    }
    this._observers = [];
  }

  // ---- Contract call recording ----

  recordContractCall(name: string, latencyMs: number, success: boolean): void {
    const metric: RuntimeMetric = {
      name,
      value: latencyMs,
      timestamp: Date.now(),
      category: 'contract',
    };

    this._storeMetric(metric);

    const threshold = performanceBudgetManager.getThreshold(name);
    if (latencyMs > threshold) {
      const event: ThresholdViolationEvent = {
        metricName: name,
        measuredValue: latencyMs,
        thresholdValue: threshold,
        timestamp: metric.timestamp,
      };

      for (const handler of this._violationHandlers) {
        try {
          handler(event);
        } catch {
          // ignore handler errors
        }
      }

      performanceBudgetManager.recordViolation({
        metricName: name,
        measuredValue: latencyMs,
        thresholdValue: threshold,
        timestamp: metric.timestamp,
      });
    }
  }

  // ---- Query ----

  getMetrics(windowStart: number, windowEnd: number): RuntimeMetric[] {
    const all = this._readMetrics();
    return all.filter(m => m.timestamp >= windowStart && m.timestamp <= windowEnd);
  }

  getAggregated(
    windowStart: number,
    windowEnd: number
  ): { mean: number; p95: number; p99: number } | null {
    const metrics = this.getMetrics(windowStart, windowEnd);
    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const p95 = values[Math.floor(values.length * 0.95)];
    const p99 = values[Math.floor(values.length * 0.99)];

    return { mean, p95, p99 };
  }

  // ---- Violation handlers ----

  onViolation(handler: (event: ThresholdViolationEvent) => void): () => void {
    this._violationHandlers.add(handler);
    return () => this._violationHandlers.delete(handler);
  }

  // ---- Private helpers ----

  private _storeMetric(metric: RuntimeMetric): void {
    if (this._useMemory) {
      this._memoryMetrics.push(metric);
      this._pruneMemory();
      return;
    }

    try {
      const existing = this._readFromStorage();
      const cutoff = Date.now() - PRUNE_WINDOW_MS;
      const pruned = existing.filter(m => m.timestamp >= cutoff);
      pruned.push(metric);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      this._useMemory = true;
      this._memoryMetrics.push(metric);
      this._pruneMemory();
    }
  }

  private _readMetrics(): RuntimeMetric[] {
    if (this._useMemory) return [...this._memoryMetrics];
    return this._readFromStorage();
  }

  private _readFromStorage(): RuntimeMetric[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RuntimeMetric[];
    } catch {
      return [];
    }
  }

  private _pruneMemory(): void {
    const cutoff = Date.now() - PRUNE_WINDOW_MS;
    this._memoryMetrics = this._memoryMetrics.filter(m => m.timestamp >= cutoff);
  }
}

export const monitor = new Monitor();
export default monitor;
