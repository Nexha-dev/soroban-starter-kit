import type { Notification, UserPreferences, NotificationCategory, NotificationPriority } from './types';

export class NotificationCategorizer {
  private static categoryRules = new Map<NotificationCategory, {
    priority: NotificationPriority;
    defaultChannels: string[];
    expiresAfter?: number;
    maxRetries?: number;
  }>();

  static {
    NotificationCategorizer.initializeCategoryRules();
  }

  private static initializeCategoryRules(): void {
    NotificationCategorizer.categoryRules.set('transaction', {
      priority: 'medium',
      defaultChannels: ['in-app', 'push'],
      expiresAfter: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxRetries: 3,
    });

    NotificationCategorizer.categoryRules.set('escrow', {
      priority: 'high',
      defaultChannels: ['in-app', 'push', 'email'],
      expiresAfter: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxRetries: 5,
    });

    NotificationCategorizer.categoryRules.set('system', {
      priority: 'medium',
      defaultChannels: ['in-app'],
      expiresAfter: 3 * 24 * 60 * 60 * 1000, // 3 days
      maxRetries: 2,
    });

    NotificationCategorizer.categoryRules.set('security', {
      priority: 'critical',
      defaultChannels: ['in-app', 'push', 'email'],
      expiresAfter: 90 * 24 * 60 * 60 * 1000, // 90 days
      maxRetries: 10,
    });

    NotificationCategorizer.categoryRules.set('marketing', {
      priority: 'low',
      defaultChannels: ['in-app'],
      expiresAfter: 24 * 60 * 60 * 1000, // 1 day
      maxRetries: 1,
    });

    NotificationCategorizer.categoryRules.set('general', {
      priority: 'low',
      defaultChannels: ['in-app'],
      expiresAfter: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxRetries: 2,
    });
  }

  static categorizeNotification(
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): NotificationCategory {
    const content = `${title} ${message}`.toLowerCase();

    if (NotificationCategorizer.isSecurityRelated(content, metadata)) {
      return 'security';
    }

    if (NotificationCategorizer.isTransactionRelated(content, metadata)) {
      return 'transaction';
    }

    if (NotificationCategorizer.isEscrowRelated(content, metadata)) {
      return 'escrow';
    }

    if (NotificationCategorizer.isSystemRelated(content, metadata)) {
      return 'system';
    }

    if (NotificationCategorizer.isMarketingRelated(content, metadata)) {
      return 'marketing';
    }

    return 'general';
  }

  static prioritizeNotification(
    category: NotificationCategory,
    content: string,
    metadata?: Record<string, unknown>
  ): NotificationPriority {
    const basePriority = NotificationCategorizer.categoryRules.get(category)?.priority || 'medium';
    
    if (NotificationCategorizer.isUrgent(content, metadata)) {
      return 'critical';
    }

    if (NotificationCategorizer.isHighImportance(content, metadata)) {
      return 'high';
    }

    if (NotificationCategorizer.isLowImportance(content, metadata)) {
      return 'low';
    }

    return basePriority;
  }

  static getNotificationChannels(
    category: NotificationCategory,
    priority: NotificationPriority,
    preferences: UserPreferences
  ): string[] {
    const categoryRule = NotificationCategorizer.categoryRules.get(category);
    const defaultChannels = categoryRule?.defaultChannels || ['in-app'];
    
    return defaultChannels.filter(channel => 
      preferences.enabledChannels.includes(channel as any)
    );
  }

  static getExpirationTime(category: NotificationCategory): number | undefined {
    const rule = NotificationCategorizer.categoryRules.get(category);
    return rule?.expiresAfter ? Date.now() + rule.expiresAfter : undefined;
  }

  static getMaxRetries(category: NotificationCategory): number {
    const rule = NotificationCategorizer.categoryRules.get(category);
    return rule?.maxRetries || 3;
  }

  private static isSecurityRelated(content: string, metadata?: Record<string, unknown>): boolean {
    const securityKeywords = [
      'security', 'unauthorized', 'suspicious', 'alert', 'warning',
      'login', 'password', 'authentication', 'verification', 'blocked',
      'malicious', 'phishing', 'breach', 'compromise', 'threat'
    ];

    return securityKeywords.some(keyword => content.includes(keyword)) ||
           (metadata?.security as boolean) === true ||
           metadata?.type === 'security_alert';
  }

  private static isTransactionRelated(content: string, metadata?: Record<string, unknown>): boolean {
    const transactionKeywords = [
      'transaction', 'payment', 'transfer', 'sent', 'received',
      'deposit', 'withdrawal', 'balance', 'amount', 'fee',
      'stellar', 'soroban', 'token', 'asset', 'contract'
    ];

    return transactionKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.type === 'transaction' ||
           metadata?.transactionId;
  }

  private static isEscrowRelated(content: string, metadata?: Record<string, unknown>): boolean {
    const escrowKeywords = [
      'escrow', 'smart contract', 'release', 'dispute', 'arbitration',
      'milestone', 'condition', 'trigger', 'execution'
    ];

    return escrowKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.type === 'escrow' ||
           metadata?.escrowId;
  }

  private static isSystemRelated(content: string, metadata?: Record<string, unknown>): boolean {
    const systemKeywords = [
      'system', 'maintenance', 'update', 'upgrade', 'downtime',
      'feature', 'improvement', 'bug fix', 'performance'
    ];

    return systemKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.type === 'system' ||
           (metadata?.system as boolean) === true;
  }

  private static isMarketingRelated(content: string, metadata?: Record<string, unknown>): boolean {
    const marketingKeywords = [
      'promotion', 'offer', 'discount', 'sale', 'deal', 'bonus',
      'reward', 'referral', 'invite', 'campaign', 'announcement'
    ];

    return marketingKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.type === 'marketing' ||
           (metadata?.marketing as boolean) === true;
  }

  private static isUrgent(content: string, metadata?: Record<string, unknown>): boolean {
    const urgentKeywords = [
      'urgent', 'immediate', 'critical', 'emergency', 'alert',
      'failure', 'error', 'expired', 'deadline', 'required'
    ];

    return urgentKeywords.some(keyword => content.includes(keyword)) ||
           (metadata?.urgent as boolean) === true ||
           metadata?.severity === 'critical';
  }

  private static isHighImportance(content: string, metadata?: Record<string, unknown>): boolean {
    const highImportanceKeywords = [
      'important', 'attention', 'notice', 'reminder', 'warning',
      'significant', 'major', 'substantial'
    ];

    return highImportanceKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.importance === 'high' ||
           metadata?.severity === 'high';
  }

  private static isLowImportance(content: string, metadata?: Record<string, unknown>): boolean {
    const lowImportanceKeywords = [
      'info', 'information', 'fyi', 'update', 'minor', 'trivial',
      'routine', 'regular', 'scheduled'
    ];

    return lowImportanceKeywords.some(keyword => content.includes(keyword)) ||
           metadata?.importance === 'low' ||
           metadata?.severity === 'low';
  }
}

export class NotificationPriorityQueue {
  private queue: Notification[] = [];
  private readonly maxQueueSize = 1000;

  enqueue(notification: Notification): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.dequeueLowestPriority();
    }

    const insertIndex = this.findInsertPosition(notification);
    this.queue.splice(insertIndex, 0, notification);
  }

  dequeue(): Notification | undefined {
    return this.queue.shift();
  }

  dequeueByCategory(category: NotificationCategory): Notification[] {
    const notifications = this.queue.filter(n => n.category === category);
    this.queue = this.queue.filter(n => n.category !== category);
    return notifications;
  }

  peek(): Notification | undefined {
    return this.queue[0];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  getNotificationsByPriority(priority: NotificationPriority): Notification[] {
    return this.queue.filter(n => n.priority === priority);
  }

  getNotificationsByCategory(category: NotificationCategory): Notification[] {
    return this.queue.filter(n => n.category === category);
  }

  removeExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter(n => !n.expiresAt || n.expiresAt > now);
  }

  private findInsertPosition(notification: Notification): number {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const notificationPriority = priorityOrder[notification.priority];

    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (notificationPriority < queuePriority) {
        return i;
      }
      if (notificationPriority === queuePriority && notification.timestamp > this.queue[i].timestamp) {
        return i;
      }
    }

    return this.queue.length;
  }

  private dequeueLowestPriority(): void {
    if (this.queue.length === 0) return;

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    let lowestPriorityIndex = 0;
    let lowestPriority = priorityOrder[this.queue[0].priority];
    let oldestTimestamp = this.queue[0].timestamp;

    for (let i = 1; i < this.queue.length; i++) {
      const currentPriority = priorityOrder[this.queue[i].priority];
      const currentTimestamp = this.queue[i].timestamp;

      if (currentPriority > lowestPriority || 
          (currentPriority === lowestPriority && currentTimestamp < oldestTimestamp)) {
        lowestPriorityIndex = i;
        lowestPriority = currentPriority;
        oldestTimestamp = currentTimestamp;
      }
    }

    this.queue.splice(lowestPriorityIndex, 1);
  }
}

export class NotificationRateLimiter {
  private notifications = new Map<string, number[]>();
  private readonly windowMs = 60 * 60 * 1000; // 1 hour
  private readonly maxNotifications = 50;

  canSend(userId: string, category?: NotificationCategory): boolean {
    const key = category ? `${userId}:${category}` : userId;
    const userNotifications = this.notifications.get(key) || [];
    
    const now = Date.now();
    const recentNotifications = userNotifications.filter(timestamp => 
      now - timestamp < this.windowMs
    );

    if (recentNotifications.length >= this.maxNotifications) {
      return false;
    }

    recentNotifications.push(now);
    this.notifications.set(key, recentNotifications);
    return true;
  }

  getRemainingNotifications(userId: string, category?: NotificationCategory): number {
    const key = category ? `${userId}:${category}` : userId;
    const userNotifications = this.notifications.get(key) || [];
    
    const now = Date.now();
    const recentNotifications = userNotifications.filter(timestamp => 
      now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxNotifications - recentNotifications.length);
  }

  getResetTime(userId: string, category?: NotificationCategory): number | undefined {
    const key = category ? `${userId}:${category}` : userId;
    const userNotifications = this.notifications.get(key) || [];
    
    if (userNotifications.length === 0) {
      return undefined;
    }

    const oldestNotification = Math.min(...userNotifications);
    return oldestNotification + this.windowMs;
  }

  clearExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, timestamps] of this.notifications.entries()) {
      const recentTimestamps = timestamps.filter(timestamp => 
        now - timestamp < this.windowMs
      );
      
      if (recentTimestamps.length === 0) {
        this.notifications.delete(key);
      } else {
        this.notifications.set(key, recentTimestamps);
      }
    }
  }
}
