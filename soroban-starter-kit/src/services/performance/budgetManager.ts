/**
 * Performance Budget Manager
 * Manages performance budgets and alerting
 */

import { Budget, BudgetViolation, InvalidBudgetError } from './types';

const STORAGE_KEY_BUDGETS = 'perf:budgets';
const STORAGE_KEY_VIOLATIONS = 'perf:violations';
const PRUNE_WINDOW_MS = 86400000; // 24 hours

const DEFAULT_THRESHOLDS: Record<string, number> = {
  pageLoadTime: 3000,
  contractRead: 200,
  contractTx: 5000,
};

export interface PerformanceBudget {
  name: string;
  metric: string;
  threshold: number;
  unit: string;
  enabled: boolean;
}

export interface BudgetAlert {
  budgetName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: number;
}

class PerformanceBudgetManager {
  private budgets: Map<string, PerformanceBudget> = new Map();
  private alerts: BudgetAlert[] = [];
  private maxAlerts = 100;
  private listeners: Set<(alert: BudgetAlert) => void> = new Set();

  constructor() {
    this.initDefaultBudgets();
  }

  /**
   * Initialize default budgets
   */
  private initDefaultBudgets(): void {
    this.addBudget({
      name: 'LCP',
      metric: 'lcp',
      threshold: 2500,
      unit: 'ms',
      enabled: true,
    });

    this.addBudget({
      name: 'FID',
      metric: 'fid',
      threshold: 100,
      unit: 'ms',
      enabled: true,
    });

    this.addBudget({
      name: 'CLS',
      metric: 'cls',
      threshold: 0.1,
      unit: '',
      enabled: true,
    });

    this.addBudget({
      name: 'Memory',
      metric: 'memory',
      threshold: 100 * 1024 * 1024, // 100MB
      unit: 'bytes',
      enabled: true,
    });
  }

  /**
   * Add performance budget
   */
  addBudget(budget: PerformanceBudget): void {
    this.budgets.set(budget.name, budget);
  }

  /**
   * Check metric against budget
   */
  checkBudget(metric: string, value: number): void {
    for (const [name, budget] of this.budgets) {
      if (budget.metric === metric && budget.enabled) {
        if (value > budget.threshold) {
          const severity = value > budget.threshold * 1.5 ? 'critical' : 'warning';
          this.createAlert({
            budgetName: name,
            metric,
            currentValue: value,
            threshold: budget.threshold,
            severity,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: BudgetAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }
    this.notifyListeners(alert);
  }

  /**
   * Subscribe to alerts
   */
  subscribe(listener: (alert: BudgetAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(alert: BudgetAlert): void {
    this.listeners.forEach(listener => listener(alert));
  }

  /**
   * Get alerts
   */
  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  /**
   * Get budgets
   */
  getBudgets(): PerformanceBudget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  // ---- New Budget/Violation API ----

  /**
   * Define a performance budget. Throws InvalidBudgetError if threshold <= 0.
   */
  defineBudget(budget: Budget): void {
    if (budget.threshold <= 0) {
      throw new InvalidBudgetError(
        `Budget threshold must be > 0, got ${budget.threshold} for metric "${budget.metricName}"`
      );
    }
    const budgets = this.readBudgets().filter(b => b.metricName !== budget.metricName);
    budgets.push(budget);
    this.writeBudgets(budgets);
  }

  /**
   * Returns the threshold for a metric. Falls back to defaults, then Infinity.
   */
  getThreshold(metricName: string): number {
    const budgets = this.readBudgets();
    const found = budgets.find(b => b.metricName === metricName);
    if (found) return found.threshold;
    return DEFAULT_THRESHOLDS[metricName] ?? Infinity;
  }

  /**
   * Records a budget violation, pruning entries older than 24h.
   */
  recordViolation(violation: BudgetViolation): void {
    const cutoff = Date.now() - PRUNE_WINDOW_MS;
    const violations = this.readViolations().filter(v => v.timestamp >= cutoff);
    violations.push(violation);
    this.writeViolations(violations);
  }

  /**
   * Returns violations within [windowStart, windowEnd] (inclusive).
   */
  getViolations(windowStart: number, windowEnd: number): BudgetViolation[] {
    return this.readViolations().filter(
      v => v.timestamp >= windowStart && v.timestamp <= windowEnd
    );
  }

  // ---- Private helpers ----

  private readBudgets(): Budget[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BUDGETS);
      if (!raw) return [];
      return JSON.parse(raw) as Budget[];
    } catch (e) {
      console.warn('perf:budgets parse error', e);
      return [];
    }
  }

  private writeBudgets(budgets: Budget[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify(budgets));
    } catch {
      // silently no-op if localStorage unavailable
    }
  }

  private readViolations(): BudgetViolation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VIOLATIONS);
      if (!raw) return [];
      return JSON.parse(raw) as BudgetViolation[];
    } catch (e) {
      console.warn('perf:violations parse error', e);
      return [];
    }
  }

  private writeViolations(violations: BudgetViolation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_VIOLATIONS, JSON.stringify(violations));
    } catch {
      // silently no-op if localStorage unavailable
    }
  }
}

export const performanceBudgetManager = new PerformanceBudgetManager();
export default performanceBudgetManager;
