import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DashboardLayout, VisualizationAnalytics } from './types';

interface VisualizationDB extends DBSchema {
  dashboards: {
    key: string;
    value: DashboardLayout;
  };
  analytics: {
    key: string;
    value: VisualizationAnalytics;
  };
}

class VisualizationManager {
  private db: IDBPDatabase<VisualizationDB> | null = null;
  private readonly dbName = 'soroban-viz';
  private readonly version = 1;

  async init(): Promise<void> {
    this.db = await openDB<VisualizationDB>(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('dashboards')) {
          db.createObjectStore('dashboards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id' });
        }
      },
    });
  }

  async saveDashboard(layout: DashboardLayout): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('dashboards', layout);
  }

  async getDashboard(id: string): Promise<DashboardLayout | undefined> {
    if (!this.db) await this.init();
    return this.db!.get('dashboards', id);
  }

  async getDashboards(): Promise<DashboardLayout[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('dashboards');
  }

  async deleteDashboard(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('dashboards', id);
  }

  async recordAnalytics(widgetId: string, action: 'zoom' | 'pan' | 'export' | 'interact', duration?: number): Promise<void> {
    if (!this.db) await this.init();

    const analytics: VisualizationAnalytics = {
      id: `viz_${Date.now()}`,
      widgetId,
      action,
      timestamp: Date.now(),
      duration,
    };

    await this.db!.put('analytics', analytics);
  }

  async getAnalytics(limit: number = 100): Promise<VisualizationAnalytics[]> {
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

export const visualizationManager = new VisualizationManager();
