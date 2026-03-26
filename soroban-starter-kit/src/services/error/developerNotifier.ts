/**
 * Developer Notifier
 * Threshold-based alerting and developer notification dispatch
 */

import type { ErrorInfo, ErrorSeverity } from './errorHandler';

export interface AlertRule {
  id: string;
  name: string;
  condition: 'severity' | 'rate' | 'category';
  value: string | number; // severity level, errors/min, or category name
  enabled: boolean;
}

export interface DevAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  timestamp: number;
  error: ErrorInfo;
  acknowledged: boolean;
}

const SEVERITY_ORDER: Record<ErrorSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export class DeveloperNotifier {
  private rules: AlertRule[] = [
    { id: 'critical', name: 'Critical Errors', condition: 'severity', value: 'critical', enabled: true },
    { id: 'auth', name: 'Auth Failures', condition: 'category', value: 'auth', enabled: true },
    { id: 'rate', name: 'Error Rate Spike', condition: 'rate', value: 10, enabled: true },
  ];

  private alerts: DevAlert[] = [];
  private recentTimestamps: number[] = [];
  private listeners: Set<(alert: DevAlert) => void> = new Set();
  private maxAlerts = 200;

  evaluate(error: ErrorInfo): void {
    const now = Date.now();
    this.recentTimestamps.push(now);
    // Keep only last 60s
    this.recentTimestamps = this.recentTimestamps.filter(t => now - t < 60_000);

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      let triggered = false;
      let message = '';

      if (rule.condition === 'severity') {
        const threshold = SEVERITY_ORDER[rule.value as ErrorSeverity] ?? 0;
        if (SEVERITY_ORDER[error.severity] >= threshold) {
          triggered = true;
          message = `${error.severity.toUpperCase()} error: ${error.message}`;
        }
      } else if (rule.condition === 'category' && error.category === rule.value) {
        triggered = true;
        message = `${rule.value} error detected: ${error.message}`;
      } else if (rule.condition === 'rate' && this.recentTimestamps.length >= (rule.value as number)) {
        triggered = true;
        message = `Error rate exceeded ${rule.value}/min (current: ${this.recentTimestamps.length}/min)`;
      }

      if (triggered) {
        const alert: DevAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          message,
          timestamp: now,
          error,
          acknowledged: false,
        };
        this.alerts.push(alert);
        if (this.alerts.length > this.maxAlerts) this.alerts.shift();
        this.listeners.forEach(l => l(alert));
      }
    }
  }

  acknowledge(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) alert.acknowledged = true;
  }

  subscribe(listener: (alert: DevAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getAlerts(includeAcknowledged = false): DevAlert[] {
    return this.alerts.filter(a => includeAcknowledged || !a.acknowledged);
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  updateRule(id: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.find(r => r.id === id);
    if (rule) Object.assign(rule, updates);
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  clear(): void {
    this.alerts = [];
    this.recentTimestamps = [];
  }
}

export const developerNotifier = new DeveloperNotifier();
export default developerNotifier;
