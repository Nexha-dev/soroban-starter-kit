/**
 * Performance Metrics Collector
 * Tracks real-time performance metrics and Core Web Vitals
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  unit: string;
}

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  vitals: Partial<CoreWebVitals>;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

class PerformanceMetricsCollector {
  private metrics: PerformanceMetric[] = [];
  private snapshots: PerformanceSnapshot[] = [];
  private vitals: Partial<CoreWebVitals> = {};
  private maxSnapshots = 100;

  constructor() {
    this.initCoreWebVitals();
    this.startCollection();
  }

  /**
   * Initialize Core Web Vitals tracking
   */
  private initCoreWebVitals(): void {
    // LCP - Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // CLS - Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              this.vitals.cls = (this.vitals.cls || 0) + (entry as any).value;
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS observer not supported');
      }

      // FID - First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            this.vitals.fid = (entries[0] as any).processingDuration;
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID observer not supported');
      }
    }

    // TTFB - Time to First Byte
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.vitals.ttfb = navigation.responseStart - navigation.fetchStart;
    }

    // FCP - First Contentful Paint
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) {
      this.vitals.fcp = fcp.startTime;
    }
  }

  /**
   * Start collecting metrics
   */
  private startCollection(): void {
    setInterval(() => this.collectSnapshot(), 5000);
  }

  /**
   * Collect performance snapshot
   */
  private collectSnapshot(): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      metrics: [...this.metrics],
      vitals: { ...this.vitals },
    };

    if (performance.memory) {
      snapshot.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };
    }

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(name: string, value: number, unit: string = 'ms'): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      unit,
    });
  }

  /**
   * Get current Core Web Vitals
   */
  getVitals(): Partial<CoreWebVitals> {
    return { ...this.vitals };
  }

  /**
   * Get performance snapshots
   */
  getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    avgLcp: number;
    avgFid: number;
    avgCls: number;
    avgMemory: number;
  } {
    const vitalsArray = this.snapshots.map(s => s.vitals);
    const memoryArray = this.snapshots.map(s => s.memory?.usedJSHeapSize || 0);

    return {
      avgLcp: vitalsArray.reduce((sum, v) => sum + (v.lcp || 0), 0) / vitalsArray.length || 0,
      avgFid: vitalsArray.reduce((sum, v) => sum + (v.fid || 0), 0) / vitalsArray.length || 0,
      avgCls: vitalsArray.reduce((sum, v) => sum + (v.cls || 0), 0) / vitalsArray.length || 0,
      avgMemory: memoryArray.reduce((a, b) => a + b, 0) / memoryArray.length || 0,
    };
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
    this.snapshots = [];
  }
}

export const performanceMetricsCollector = new PerformanceMetricsCollector();
export default performanceMetricsCollector;
