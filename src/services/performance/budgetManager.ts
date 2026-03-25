/**
 * Performance Budget Manager
 * Manages performance budgets and alerting
 */

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
}

export const performanceBudgetManager = new PerformanceBudgetManager();
export default performanceBudgetManager;
