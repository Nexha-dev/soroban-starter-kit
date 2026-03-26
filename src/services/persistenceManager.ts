/**
 * Persistence Manager
 * Handles state persistence, hydration, and synchronization
 */

import { storageService } from './storage';
import { NormalizedState } from './stateManager';

interface PersistenceConfig {
  key: string;
  version: number;
  throttle: number;
  blacklist: string[];
}

class PersistenceManager {
  private config: PersistenceConfig = {
    key: 'app-state',
    version: 1,
    throttle: 1000,
    blacklist: [],
  };

  private lastPersistTime = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize persistence
   */
  async init(config?: Partial<PersistenceConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    await storageService.init();
  }

  /**
   * Persist state to storage
   */
  async persist(state: NormalizedState): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastPersistTime < this.config.throttle) {
      if (this.persistTimer) clearTimeout(this.persistTimer);
      this.persistTimer = setTimeout(() => this.persist(state), this.config.throttle);
      return;
    }

    this.lastPersistTime = now;

    const filtered = this.filterState(state);
    await storageService.setCache(
      `${this.config.key}-v${this.config.version}`,
      filtered,
      86400 // 24 hours
    );
  }

  /**
   * Hydrate state from storage
   */
  async hydrate(): Promise<NormalizedState | null> {
    const cached = await storageService.getCache<NormalizedState>(
      `${this.config.key}-v${this.config.version}`
    );
    return cached;
  }

  /**
   * Clear persisted state
   */
  async clear(): Promise<void> {
    await storageService.setCache(`${this.config.key}-v${this.config.version}`, null, 0);
  }

  /**
   * Sync state across tabs
   */
  setupCrossTabSync(onStateChange: (state: NormalizedState) => void): () => void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `${this.config.key}-v${this.config.version}` && event.newValue) {
        try {
          const state = JSON.parse(event.newValue) as NormalizedState;
          onStateChange(state);
        } catch (error) {
          console.error('Failed to parse cross-tab state:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }

  /**
   * Broadcast state to other tabs
   */
  broadcastState(state: NormalizedState): void {
    const filtered = this.filterState(state);
    localStorage.setItem(
      `${this.config.key}-v${this.config.version}`,
      JSON.stringify(filtered)
    );
  }

  private filterState(state: NormalizedState): NormalizedState {
    const filtered = JSON.parse(JSON.stringify(state)) as NormalizedState;
    
    this.config.blacklist.forEach(key => {
      delete (filtered as any)[key];
    });

    return filtered;
  }
}

export const persistenceManager = new PersistenceManager();
export default persistenceManager;
