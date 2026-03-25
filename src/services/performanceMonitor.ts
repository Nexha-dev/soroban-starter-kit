/**
 * Performance Monitor
 * Tracks and analyzes state management performance
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceSummary {
  name: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetricsSize = 1000;
  private marks: Map<string, number> = new Map();

  /**
   * Start measuring a metric
   */
  mark(label: string): void {
    this.marks.set(label, performance.now());
  }

  /**
   * End measuring and record metric
   */
  measure(label: string, metadata?: Record<string, any>): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`No mark found for ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.recordMetric(label, duration, metadata);
    this.marks.delete(label);

    return duration;
  }

  /**
   * Record a metric directly
   */
  recordMetric(name: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
  }

  /**
   * Get summary for a specific metric
   */
  getSummary(name: string): PerformanceSummary | null {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
    const totalTime = durations.reduce((a, b) => a + b, 0);

    return {
      name,
      count: durations.length,
      totalTime,
      avgTime: totalTime / durations.length,
      minTime: durations[0],
      maxTime: durations[durations.length - 1],
      p95Time: durations[Math.floor(durations.length * 0.95)],
      p99Time: durations[Math.floor(durations.length * 0.99)],
    };
  }

  /**
   * Get all summaries
   */
  getAllSummaries(): PerformanceSummary[] {
    const names = new Set(this.metrics.map(m => m.name));
    return Array.from(names)
      .map(name => this.getSummary(name))
      .filter((s): s is PerformanceSummary => s !== null);
  }

  /**
   * Get recent metrics
   */
  getRecent(limit: number = 50): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get metrics for a time range
   */
  getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summaries: this.getAllSummaries(),
      timestamp: Date.now(),
    }, null, 2);
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
