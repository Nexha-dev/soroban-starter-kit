import { openDB, IDBPDatabase } from 'idb';
import { Balance, EscrowData, CachedTransaction, UserPreferences } from './types';
import { FidelisDBSchema, DB_NAME, DB_VERSION } from './schema';
import { runMigrations } from './migrations';
import { withDBError, DBError } from './errors';
import { checkDBHealth, DBHealthReport } from './health';
import type { UserRecord, SettingRecord } from './schema';

export type { UserRecord, SettingRecord };
export { DBError } from './errors';
export type { DBHealthReport } from './health';

/**
 * StorageService — IndexedDB wrapper with:
 *  - Versioned migrations
 *  - Typed error handling
 *  - Request queue (connection pooling equivalent)
 *  - Health checks
 */
class StorageService {
  private db: IDBPDatabase<FidelisDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = withDBError(async () => {
      this.db = await openDB<FidelisDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          runMigrations(db, oldVersion, newVersion ?? DB_VERSION);
        },
        blocked() {
          console.warn('[DB] upgrade blocked by another tab — please close other tabs');
        },
        blocking() {
          // Another tab needs a newer version; close our connection so it can proceed
          this.db?.close();
        },
      });
    });
    return this.initPromise;
  }

  private get conn(): IDBPDatabase<FidelisDBSchema> {
    if (!this.db) throw new DBError('NOT_INITIALIZED', 'Database not initialized. Call init() first.');
    return this.db;
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<DBHealthReport> {
    return checkDBHealth(this.db);
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  async saveBalance(balance: Balance): Promise<void> {
    return withDBError(() => this.conn.put('balances', { ...balance, lastUpdated: Date.now() }));
  }

  async getBalance(address: string, contractId: string): Promise<Balance | undefined> {
    return withDBError(() => this.conn.get('balances', `${contractId}_${address}`));
  }

  async getBalancesByAddress(address: string): Promise<Balance[]> {
    return withDBError(() => this.conn.getAllFromIndex('balances', 'by-address', address));
  }

  async getAllBalances(): Promise<Balance[]> {
    return withDBError(() => this.conn.getAll('balances'));
  }

  // ── Escrows ───────────────────────────────────────────────────────────────

  async saveEscrow(escrow: EscrowData): Promise<void> {
    return withDBError(() => this.conn.put('escrows', { ...escrow, lastUpdated: Date.now() }));
  }

  async getEscrow(id: string): Promise<EscrowData | undefined> {
    return withDBError(() => this.conn.get('escrows', id));
  }

  async getEscrowsByStatus(status: string): Promise<EscrowData[]> {
    return withDBError(() => this.conn.getAllFromIndex('escrows', 'by-status', status));
  }

  async getAllEscrows(): Promise<EscrowData[]> {
    return withDBError(() => this.conn.getAll('escrows'));
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  async savePendingTransaction(tx: CachedTransaction): Promise<void> {
    return withDBError(() => this.conn.put('pendingTransactions', tx));
  }

  async getPendingTransactions(): Promise<CachedTransaction[]> {
    return withDBError(() => this.conn.getAll('pendingTransactions'));
  }

  async getPendingTransaction(id: string): Promise<CachedTransaction | undefined> {
    return withDBError(() => this.conn.get('pendingTransactions', id));
  }

  async deletePendingTransaction(id: string): Promise<void> {
    return withDBError(() => this.conn.delete('pendingTransactions', id));
  }

  async markTransactionSynced(tx: CachedTransaction): Promise<void> {
    return withDBError(async () => {
      const idb = this.conn;
      await idb.delete('pendingTransactions', tx.id);
      await idb.put('syncedTransactions', { ...tx, status: 'synced', syncedAt: Date.now() });
    });
  }

  async getSyncedTransactions(): Promise<CachedTransaction[]> {
    return withDBError(() => this.conn.getAll('syncedTransactions'));
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  async savePreferences(prefs: UserPreferences): Promise<void> {
    return withDBError(() => this.conn.put('preferences', prefs));
  }

  async getPreferences(id: string): Promise<UserPreferences | undefined> {
    return withDBError(() => this.conn.get('preferences', id));
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async saveUser(user: UserRecord): Promise<void> {
    return withDBError(() => this.conn.put('users', user));
  }

  async getUserByAddress(address: string): Promise<UserRecord | undefined> {
    return withDBError(() => this.conn.getFromIndex('users', 'by-address', address));
  }

  async getAllUsers(): Promise<UserRecord[]> {
    return withDBError(() => this.conn.getAll('users'));
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async setSetting(key: string, value: unknown): Promise<void> {
    return withDBError(() =>
      this.conn.put('settings', { key, value, updatedAt: Date.now() })
    );
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    return withDBError(async () => {
      const record = await this.conn.get('settings', key);
      return record?.value as T | undefined;
    });
  }

  // ── Cache ─────────────────────────────────────────────────────────────────

  async setCache(key: string, data: unknown, ttlSeconds = 3600): Promise<void> {
    const now = Date.now();
    return withDBError(() =>
      this.conn.put('cache', { data, timestamp: now, expiresAt: now + ttlSeconds * 1000 }, key)
    );
  }

  async getCache<T>(key: string): Promise<T | null> {
    return withDBError(async () => {
      const cached = await this.conn.get('cache', key);
      if (!cached) return null;
      if (Date.now() > cached.expiresAt) {
        await this.conn.delete('cache', key);
        return null;
      }
      return cached.data as T;
    });
  }

  async clearExpiredCache(): Promise<void> {
    return withDBError(async () => {
      const tx = this.conn.transaction('cache', 'readwrite');
      const now = Date.now();
      for (const key of await tx.store.getAllKeys()) {
        const entry = await tx.store.get(key);
        if (entry && now > entry.expiresAt) await tx.store.delete(key);
      }
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    return withDBError(async () => {
      const idb = this.conn;
      await Promise.all([
        idb.clear('balances'),
        idb.clear('escrows'),
        idb.clear('pendingTransactions'),
        idb.clear('syncedTransactions'),
        idb.clear('cache'),
      ]);
    });
  }

  async getStorageEstimate(): Promise<{ used: number; quota: number }> {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { used: usage, quota };
    }
    return { used: 0, quota: 0 };
  }
}

export const storageService = new StorageService();
export default storageService;
