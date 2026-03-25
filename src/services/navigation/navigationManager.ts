import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { NavConfig, NavAnalytics } from './types';

interface NavDB extends DBSchema {
  config: {
    key: string;
    value: NavConfig;
  };
  analytics: {
    key: string;
    value: NavAnalytics;
  };
}

class NavigationManager {
  private db: IDBPDatabase<NavDB> | null = null;
  private readonly dbName = 'soroban-nav';
  private readonly version = 1;

  async init(): Promise<void> {
    this.db = await openDB<NavDB>(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'items' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id' });
        }
      },
    });
  }

  async saveConfig(config: NavConfig): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('config', config);
  }

  async getConfig(): Promise<NavConfig | undefined> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('config');
    return all[0];
  }

  async recordAnalytics(itemId: string, action: 'click' | 'hover'): Promise<void> {
    if (!this.db) await this.init();

    const analytics: NavAnalytics = {
      id: `nav_${Date.now()}`,
      itemId,
      timestamp: Date.now(),
      action,
    };

    await this.db!.put('analytics', analytics);
  }

  async getAnalytics(limit: number = 100): Promise<NavAnalytics[]> {
    if (!this.db) await this.init();
    const all = await this.db!.getAll('analytics');
    return all.slice(-limit);
  }

  async clearOldAnalytics(daysOld: number = 30): Promise<void> {
    if (!this.db) await this.init();
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const all = await this.db!.getAll('analytics');

    for (const item of all) {
      if (item.timestamp < cutoff) {
        await this.db!.delete('analytics', item.id);
      }
    }
  }
}

export const navigationManager = new NavigationManager();
