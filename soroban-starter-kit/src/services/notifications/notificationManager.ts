import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Notification, UserPreferences, AlertRule, NotificationAnalytics, NotificationSchedule } from './types';

interface NotificationDB extends DBSchema {
  notifications: {
    key: string;
    value: Notification;
  };
  preferences: {
    key: string;
    value: UserPreferences;
  };
  rules: {
    key: string;
    value: AlertRule;
  };
  analytics: {
    key: string;
    value: NotificationAnalytics;
  };
  schedules: {
    key: string;
    value: NotificationSchedule;
  };
}

class NotificationManager {
  private db: IDBPDatabase<NotificationDB> | null = null;
  private readonly dbName = 'soroban-notifications';
  private readonly version = 1;

  async init(): Promise<void> {
    this.db = await openDB<NotificationDB>(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains('rules')) {
          db.createObjectStore('rules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules', { keyPath: 'id' });
        }
      },
    });
  }

  async addNotification(notification: Notification): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('notifications', notification);
  }

  async getNotifications(limit: number = 50): Promise<Notification[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('notifications');
    return all.slice(-limit).reverse();
  }

  async markAsRead(id: string): Promise<void> {
    if (!this.db) await this.init();
    const notification = await this.db!.get('notifications', id);
    if (notification) {
      notification.read = true;
      await this.db!.put('notifications', notification);
    }
  }

  async deleteNotification(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('notifications', id);
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('preferences', preferences);
  }

  async getPreferences(userId: string): Promise<UserPreferences | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('preferences', userId);
  }

  async saveRule(rule: AlertRule): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('rules', rule);
  }

  async getRules(): Promise<AlertRule[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('rules');
  }

  async deleteRule(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('rules', id);
  }

  async recordAnalytics(notificationId: string, action: 'sent' | 'delivered' | 'read' | 'clicked' | 'dismissed', channel: 'in-app' | 'push' | 'email', duration?: number): Promise<void> {
    if (!this.db) await this.init();

    const analytics: NotificationAnalytics = {
      id: `analytics_${Date.now()}`,
      notificationId,
      action,
      channel,
      timestamp: Date.now(),
      duration,
    };

    await this.db!.put('analytics', analytics);
  }

  async getAnalytics(limit: number = 100): Promise<NotificationAnalytics[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('analytics');
    return all.slice(-limit);
  }

  async scheduleNotification(schedule: NotificationSchedule): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('schedules', schedule);
  }

  async getPendingSchedules(): Promise<NotificationSchedule[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('schedules');
    return all.filter(s => s.status === 'pending' && s.scheduledTime <= Date.now());
  }

  async updateScheduleStatus(id: string, status: 'sent' | 'failed'): Promise<void> {
    if (!this.db) await this.init();
    const schedule = await this.db!.get('schedules', id);
    if (schedule) {
      schedule.status = status;
      await this.db!.put('schedules', schedule);
    }
  }

  async clearOldNotifications(daysOld: number = 30): Promise<void> {
    if (!this.db) await this.init();
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const all = await this.db!.getAll('notifications');

    for (const notification of all) {
      if (notification.timestamp < cutoff) {
        await this.db!.delete('notifications', notification.id);
      }
    }
  }
}

export const notificationManager = new NotificationManager();
