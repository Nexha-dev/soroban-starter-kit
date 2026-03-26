/**
 * Performance Comparator
 * Compares performance metrics over time
 */

export interface PerformanceComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
}

class PerformanceComparator {
  private history: Map<string, number[]> = new Map();
  private maxHistory = 100;

  /**
   * Record metric value
   */
  recordValue(metric: string, value: number): void {
    if (!this.history.has(metric)) {
      this.history.set(metric, []);
    }
    const values = this.history.get(metric)!;
    values.push(value);
    if (values.length > this.maxHistory) {
      values.shift();
    }
  }

  /**
   * Compare current with previous
   */
  compare(metric: string, currentValue: number): PerformanceComparison | null {
    const values = this.history.get(metric);
    if (!values || values.length < 2) {
      return null;
    }

    const previousValue = values[values.length - 2];
    const change = currentValue - previousValue;
    const changePercent = (change / previousValue) * 100;

    let trend: 'improving' | 'degrading' | 'stable';
    if (Math.abs(changePercent) < 5) {
      trend = 'stable';
    } else if (change < 0) {
      trend = 'improving';
    } else {
      trend = 'degrading';
    }

    return {
      metric,
      current: currentValue,
      previous: previousValue,
      change,
      changePercent,
      trend,
    };
  }

  /**
   * Get trend over time
   */
  getTrend(metric: string, windowSize: number = 10): number[] {
    const values = this.history.get(metric);
    if (!values) return [];
    return values.slice(-windowSize);
  }

  /**
   * Get average over time
   */
  getAverage(metric: string, windowSize: number = 10): number {
    const values = this.history.get(metric);
    if (!values || values.length === 0) return 0;

    const window = values.slice(-windowSize);
    return window.reduce((a, b) => a + b, 0) / window.length;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.clear();
  }
}

export const performanceComparator = new PerformanceComparator();
export default performanceComparator;
