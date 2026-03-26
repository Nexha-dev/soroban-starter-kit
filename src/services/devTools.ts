/**
 * Developer Tools Integration
 * Provides debugging, performance monitoring, and state inspection
 */

import { NormalizedState, StateMetrics } from './stateManager';

export interface DevToolsConfig {
  enabled: boolean;
  logStateChanges: boolean;
  logPerformance: boolean;
  maxHistorySize: number;
}

interface StateSnapshot {
  timestamp: number;
  state: NormalizedState;
  metrics: StateMetrics;
}

class DevTools {
  private config: DevToolsConfig = {
    enabled: import.meta.env.DEV,
    logStateChanges: true,
    logPerformance: true,
    maxHistorySize: 50,
  };

  private history: StateSnapshot[] = [];
  private performanceLogs: Array<{ label: string; duration: number; timestamp: number }> = [];

  /**
   * Initialize dev tools
   */
  init(config?: Partial<DevToolsConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enabled) {
      this.setupGlobalDevTools();
    }
  }

  /**
   * Record state snapshot
   */
  recordSnapshot(state: NormalizedState, metrics: StateMetrics): void {
    if (!this.config.enabled) return;

    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state)),
      metrics: { ...metrics },
    };

    this.history.push(snapshot);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }

    if (this.config.logStateChanges) {
      console.group(`🔄 State Update [${new Date().toLocaleTimeString()}]`);
      console.log('State:', state);
      console.log('Metrics:', metrics);
      console.groupEnd();
    }
  }

  /**
   * Log performance metric
   */
  logPerformance(label: string, duration: number): void {
    if (!this.config.enabled || !this.config.logPerformance) return;

    this.performanceLogs.push({ label, duration, timestamp: Date.now() });
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
  }

  /**
   * Get state history
   */
  getHistory(): StateSnapshot[] {
    return JSON.parse(JSON.stringify(this.history));
  }

  /**
   * Get performance logs
   */
  getPerformanceLogs(): Array<{ label: string; duration: number; timestamp: number }> {
    return [...this.performanceLogs];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    this.performanceLogs.forEach(log => {
      if (!summary[log.label]) {
        summary[log.label] = { avg: 0, min: Infinity, max: -Infinity, count: 0 };
      }

      const stat = summary[log.label];
      stat.avg += log.duration;
      stat.min = Math.min(stat.min, log.duration);
      stat.max = Math.max(stat.max, log.duration);
      stat.count++;
    });

    Object.values(summary).forEach(stat => {
      stat.avg /= stat.count;
    });

    return summary;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.performanceLogs = [];
  }

  /**
   * Export state for debugging
   */
  exportState(state: NormalizedState): string {
    return JSON.stringify(state, null, 2);
  }

  /**
   * Import state for testing
   */
  importState(json: string): NormalizedState {
    return JSON.parse(json);
  }

  /**
   * Setup global dev tools
   */
  private setupGlobalDevTools(): void {
    if (typeof window !== 'undefined') {
      (window as any).__SOROBAN_DEVTOOLS__ = {
        getHistory: () => this.getHistory(),
        getPerformanceLogs: () => this.getPerformanceLogs(),
        getPerformanceSummary: () => this.getPerformanceSummary(),
        clearHistory: () => this.clearHistory(),
        exportState: (state: NormalizedState) => this.exportState(state),
        importState: (json: string) => this.importState(json),
      };

      console.log('🛠️ Soroban DevTools available at window.__SOROBAN_DEVTOOLS__');
    }
  }
}

export const devTools = new DevTools();
export default devTools;
