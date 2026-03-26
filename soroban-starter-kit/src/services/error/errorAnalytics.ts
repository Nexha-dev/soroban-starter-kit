/**
 * Error Analytics
 * Tracks error metrics and crash reporting
 */

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  mostCommonErrors: Array<{ message: string; count: number }>;
  crashRate: number;
}

export interface CrashReport {
  timestamp: number;
  errorCount: number;
  lastError: any;
  userAgent: string;
  url: string;
}

class ErrorAnalytics {
  private errorCounts: Map<string, number> = new Map();
  private crashes: CrashReport[] = [];
  private maxCrashes = 50;

  /**
   * Track error
   */
  trackError(category: string, message: string): void {
    const key = `${category}:${message}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  /**
   * Report crash
   */
  reportCrash(errorCount: number, lastError: any): void {
    const crash: CrashReport = {
      timestamp: Date.now(),
      errorCount,
      lastError,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.crashes.push(crash);
    if (this.crashes.length > this.maxCrashes) {
      this.crashes.shift();
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): ErrorMetrics {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const mostCommonErrors: Array<{ message: string; count: number }> = [];

    this.errorCounts.forEach((count, key) => {
      const [category] = key.split(':');
      errorsByCategory[category] = (errorsByCategory[category] || 0) + count;
      mostCommonErrors.push({ message: key, count });
    });

    mostCommonErrors.sort((a, b) => b.count - a.count);

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      errorsByCategory,
      errorsBySeverity,
      mostCommonErrors: mostCommonErrors.slice(0, 10),
      crashRate: this.crashes.length > 0 ? (this.crashes.length / 100) * 100 : 0,
    };
  }

  /**
   * Get crash reports
   */
  getCrashReports(): CrashReport[] {
    return [...this.crashes];
  }

  /**
   * Clear analytics
   */
  clear(): void {
    this.errorCounts.clear();
    this.crashes = [];
  }
}

export const errorAnalytics = new ErrorAnalytics();
export default errorAnalytics;
