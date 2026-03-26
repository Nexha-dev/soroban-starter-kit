import { UserPreferences, AlertRule, Notification, NotificationPriority } from './types';

export class NotificationEngine {
  static shouldNotify(preferences: UserPreferences, priority: NotificationPriority): boolean {
    const priorityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    const thresholdLevel = priorityLevels[preferences.priorityThreshold];
    const notificationLevel = priorityLevels[priority];

    if (notificationLevel < thresholdLevel) return false;

    if (preferences.quietHours) {
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end } = preferences.quietHours;

      if (start < end) {
        if (currentHour >= start && currentHour < end) return false;
      } else {
        if (currentHour >= start || currentHour < end) return false;
      }
    }

    return true;
  }

  static evaluateRule(rule: AlertRule, data: Record<string, unknown>): boolean {
    if (!rule.enabled) return false;

    const value = data[rule.condition.field];
    const { operator, value: ruleValue } = rule.condition;

    switch (operator) {
      case 'equals':
        return value === ruleValue;
      case 'greater':
        return typeof value === 'number' && value > (ruleValue as number);
      case 'less':
        return typeof value === 'number' && value < (ruleValue as number);
      case 'contains':
        return typeof value === 'string' && value.includes(ruleValue as string);
      default:
        return false;
    }
  }

  static getOptimalSendTime(preferences: UserPreferences): number {
    const now = Date.now();
    const frequency = preferences.frequency;

    switch (frequency) {
      case 'instant':
        return now;
      case 'hourly':
        return now + 60 * 60 * 1000;
      case 'daily':
        return now + 24 * 60 * 60 * 1000;
      case 'weekly':
        return now + 7 * 24 * 60 * 60 * 1000;
      default:
        return now;
    }
  }

  static shouldBatch(notifications: Notification[], maxBatchSize: number = 5): boolean {
    return notifications.length >= maxBatchSize;
  }

  static calculateEngagementScore(analytics: Array<{ action: string; duration?: number }>): number {
    let score = 0;
    analytics.forEach(a => {
      if (a.action === 'read') score += 10;
      if (a.action === 'clicked') score += 20;
      if (a.action === 'dismissed') score -= 5;
      if (a.duration && a.duration > 5000) score += 5;
    });
    return Math.max(0, score);
  }
}
