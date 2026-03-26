import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  UserPreferences,
  PreferenceUpdatePayload,
  PreferenceAnalytics,
  PreferenceBackup,
  Theme,
  Language,
  TimeFormat,
  DateFormat,
} from './types';

interface PreferencesDB extends DBSchema {
  preferences: {
    key: string;
    value: UserPreferences;
  };
  backups: {
    key: string;
    value: PreferenceBackup;
  };
  analytics: {
    key: string;
    value: PreferenceAnalytics;
  };
}

/**
 * User Preferences Manager Service
 * Handles comprehensive preference management, persistence, backup, and synchronization
 */
class PreferencesManager {
  private db: IDBPDatabase<PreferencesDB> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  async init(): Promise<void> {
    this.db = await openDB<PreferencesDB>('soroban-preferences', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences');
        }
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups');
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics');
        }
      },
    });
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    if (!this.db) await this.init();
    const prefs = await this.db!.get('preferences', userId);
    return prefs || null;
  }

  /**
   * Create default preferences for a new user
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    const now = Date.now();
    const deviceId = this.generateDeviceId();

    return {
      userId,
      theme: {
        theme: 'auto',
        fontSize: 'normal',
        compactMode: false,
      },
      notifications: {
        enabledChannels: ['in-app'],
        priorityThreshold: 'medium',
        frequency: 'instant',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        categories: {
          transactions: true,
          escrows: true,
          balances: true,
          system: true,
          security: true,
        },
      },
      display: {
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        timeFormat: '24h',
        dateFormat: 'YYYY-MM-DD',
        currency: 'USD',
        numberFormat: 'en-US',
        showAdvancedOptions: false,
      },
      privacy: {
        dataCollection: false,
        crashReports: true,
        analyticsTracking: false,
        personalizedResults: false,
        shareUsageData: false,
        allowCrossSyncData: false,
      },
      sync: {
        enableCloudSync: false,
        autoSync: true,
        syncInterval: 300000, // 5 minutes
        syncDeviceId: deviceId,
        linkedDevices: [
          {
            id: deviceId,
            name: this.getDeviceName(),
            type: 'web',
            osType: this.getOSType(),
            lastActive: now,
            canRemove: false,
          },
        ],
      },
      onboarding: {
        completed: false,
        currentStep: 0,
        stepsCompleted: [],
        lastAccessed: now,
        skipped: false,
      },
      backups: [],
      createdAt: now,
      updatedAt: now,
      version: '1.0',
    };
  }

  /**
   * Save or update user preferences
   */
  async savePreferences(userId: string, updates: PreferenceUpdatePayload): Promise<UserPreferences> {
    if (!this.db) await this.init();

    let prefs = await this.getPreferences(userId);
    if (!prefs) {
      prefs = this.getDefaultPreferences(userId);
    }

    // Merge updates
    const updated: UserPreferences = {
      ...prefs,
      theme: updates.theme ? { ...prefs.theme, ...updates.theme } : prefs.theme,
      notifications: updates.notifications ? { ...prefs.notifications, ...updates.notifications } : prefs.notifications,
      display: updates.display ? { ...prefs.display, ...updates.display } : prefs.display,
      privacy: updates.privacy ? { ...prefs.privacy, ...updates.privacy } : prefs.privacy,
      sync: updates.sync ? { ...prefs.sync, ...updates.sync } : prefs.sync,
      onboarding: updates.onboarding ? { ...prefs.onboarding, ...updates.onboarding } : prefs.onboarding,
      updatedAt: Date.now(),
    };

    await this.db!.put('preferences', updated, userId);

    // Record analytics
    await this.recordPreferenceChange(userId, prefs, updates);

    // Notify listeners
    this.notifyListeners(`preferences:${userId}`, updated);

    return updated;
  }

  /**
   * Create preference backup
   */
  async createBackup(userId: string, notes?: string): Promise<PreferenceBackup> {
    if (!this.db) await this.init();

    const prefs = await this.getPreferences(userId);
    if (!prefs) throw new Error('User preferences not found');

    const backup: PreferenceBackup = {
      id: this.generateId(),
      timestamp: Date.now(),
      data: prefs,
      version: prefs.version,
      device: prefs.sync.syncDeviceId,
      notes,
    };

    // Add backup to preferences
    prefs.backups = prefs.backups || [];
    prefs.backups.push(backup);
    await this.db!.put('preferences', prefs, userId);

    // Store in backups store
    await this.db!.put('backups', backup, backup.id);

    this.notifyListeners(`backup:created`, backup);

    return backup;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(userId: string, backupId: string): Promise<UserPreferences> {
    if (!this.db) await this.init();

    const backup = await this.db!.get('backups', backupId);
    if (!backup) throw new Error('Backup not found');

    const restored = {
      ...backup.data,
      updatedAt: Date.now(),
      sync: {
        ...backup.data.sync,
        lastSyncTime: Date.now(),
      },
    };

    await this.db!.put('preferences', restored, userId);

    await this.recordAnalytics(userId, {
      action: 'restore',
      status: 'success',
      timestamp: Date.now(),
    });

    this.notifyListeners(`backup:restored`, restored);

    return restored;
  }

  /**
   * Export preferences as JSON
   */
  async exportPreferences(userId: string): Promise<string> {
    const prefs = await this.getPreferences(userId);
    if (!prefs) throw new Error('User preferences not found');

    const exportData = {
      ...prefs,
      exportedAt: Date.now(),
      exportedFrom: prefs.sync.syncDeviceId,
    };

    await this.recordAnalytics(userId, {
      action: 'export',
      status: 'success',
      timestamp: Date.now(),
    });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import preferences from JSON
   */
  async importPreferences(userId: string, jsonData: string): Promise<UserPreferences> {
    try {
      const imported = JSON.parse(jsonData);

      // Validate imported data
      if (!imported.version || !imported.theme || !imported.notifications) {
        throw new Error('Invalid preference data format');
      }

      const merged: UserPreferences = {
        userId,
        theme: imported.theme,
        notifications: imported.notifications,
        display: imported.display,
        privacy: imported.privacy,
        sync: { ...imported.sync, syncDeviceId: this.generateDeviceId() },
        onboarding: imported.onboarding,
        backups: imported.backups || [],
        createdAt: imported.createdAt || Date.now(),
        updatedAt: Date.now(),
        version: imported.version,
      };

      if (!this.db) await this.init();
      await this.db!.put('preferences', merged, userId);

      await this.recordAnalytics(userId, {
        action: 'import',
        status: 'success',
        timestamp: Date.now(),
      });

      this.notifyListeners(`preferences:${userId}`, merged);

      return merged;
    } catch (error) {
      await this.recordAnalytics(userId, {
        action: 'import',
        status: 'error',
        timestamp: Date.now(),
      });
      throw new Error(`Failed to import preferences: ${error}`);
    }
  }

  /**
   * Get all backups for user
   */
  async getBackups(userId: string): Promise<PreferenceBackup[]> {
    if (!this.db) await this.init();

    const prefs = await this.getPreferences(userId);
    return prefs?.backups || [];
  }

  /**
   * Delete backup
   */
  async deleteBackup(userId: string, backupId: string): Promise<void> {
    if (!this.db) await this.init();

    const prefs = await this.getPreferences(userId);
    if (!prefs) return;

    prefs.backups = prefs.backups.filter(b => b.id !== backupId);
    await this.db!.put('preferences', prefs, userId);
    await this.db!.delete('backups', backupId);

    this.notifyListeners(`backup:deleted`, backupId);
  }

  /**
   * Link device for cross-sync
   */
  async linkDevice(userId: string, deviceInfo: { name: string; type: 'web' | 'mobile' | 'desktop' }): Promise<string> {
    const prefs = await this.getPreferences(userId);
    if (!prefs) throw new Error('User preferences not found');

    const newDeviceId = this.generateDeviceId();
    const linkedDevice = {
      id: newDeviceId,
      name: deviceInfo.name,
      type: deviceInfo.type,
      osType: this.getOSType(),
      lastActive: Date.now(),
      canRemove: true,
    };

    prefs.sync.linkedDevices.push(linkedDevice);
    await this.savePreferences(userId, { sync: prefs.sync });

    await this.recordAnalytics(userId, {
      action: 'cross-sync',
      status: 'success',
      deviceId: newDeviceId,
      timestamp: Date.now(),
    });

    this.notifyListeners(`device:linked`, linkedDevice);

    return newDeviceId;
  }

  /**
   * Unlink device
   */
  async unlinkDevice(userId: string, deviceId: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs) return;

    prefs.sync.linkedDevices = prefs.sync.linkedDevices.filter(d => d.id !== deviceId);
    await this.savePreferences(userId, { sync: prefs.sync });

    this.notifyListeners(`device:unlinked`, deviceId);
  }

  /**
   * Record preference change for analytics
   */
  private async recordPreferenceChange(
    userId: string,
    oldPrefs: UserPreferences,
    updates: PreferenceUpdatePayload
  ): Promise<void> {
    if (!this.db) return;

    const timestamp = Date.now();
    const changes: any[] = [];

    // Compare and record changes
    Object.entries(updates).forEach(([category, value]) => {
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, newValue]) => {
          const oldValue = (oldPrefs as any)[category]?.[key];
          if (oldValue !== newValue) {
            changes.push({ category, key, oldValue, newValue, timestamp });
          }
        });
      }
    });

    if (changes.length > 0) {
      const analyticsKey = `${userId}-${Date.now()}`;
      const analytics: PreferenceAnalytics = {
        userId,
        prefChanges: changes,
        onboardingProgress: {
          startTime: oldPrefs.onboarding.lastAccessed,
        },
        syncEvents: [],
      };

      await this.db!.put('analytics', analytics, analyticsKey);
    }
  }

  /**
   * Record sync analytics
   */
  private async recordAnalytics(
    userId: string,
    event: { action: 'backup' | 'restore' | 'import' | 'export' | 'cross-sync'; status: 'success' | 'error'; deviceId?: string; timestamp: number }
  ): Promise<void> {
    if (!this.db) return;

    const analyticsKey = `${userId}-${event.timestamp}`;
    const analytics: PreferenceAnalytics = {
      userId,
      prefChanges: [],
      onboardingProgress: { startTime: Date.now() },
      syncEvents: [event as any],
    };

    await this.db!.put('analytics', analytics, analyticsKey);
  }

  /**
   * Get preference analytics
   */
  async getAnalytics(userId: string, limit: number = 100): Promise<PreferenceAnalytics[]> {
    if (!this.db) await this.init();

    const allAnalytics = await this.db!.getAll('analytics');
    return allAnalytics.filter(a => a.userId === userId).slice(-limit);
  }

  /**
   * Subscribe to preference updates
   */
  subscribe(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('soroban-device-id');
    if (!deviceId) {
      deviceId = `device-${Math.random().toString(36).substr(2, 16)}`;
      localStorage.setItem('soroban-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get device name
   */
  private getDeviceName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edge')) return 'Edge';
    return 'Web Browser';
  }

  /**
   * Get OS type
   */
  private getOSType(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }
}

export const preferencesManager = new PreferencesManager();
