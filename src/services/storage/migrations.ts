/**
 * Database Migration System
 * Each migration has a version number and up/down functions.
 * Migrations run in order during DB upgrade and are tracked in a
 * dedicated 'migrations' object store.
 */

import { IDBPDatabase } from 'idb';
import { FidelisDBSchema } from './schema';

export interface Migration {
  version: number;
  description: string;
  up: (db: IDBPDatabase<FidelisDBSchema>) => void;
}

/**
 * All schema migrations in ascending version order.
 * Add new entries here — never modify existing ones.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: balances, escrows, pendingTransactions, syncedTransactions, preferences, cache',
    up(db) {
      if (!db.objectStoreNames.contains('balances')) {
        const s = db.createObjectStore('balances', { keyPath: 'id' });
        s.createIndex('by-address', 'address');
        s.createIndex('by-timestamp', 'lastUpdated');
      }
      if (!db.objectStoreNames.contains('escrows')) {
        const s = db.createObjectStore('escrows', { keyPath: 'id' });
        s.createIndex('by-status', 'status');
        s.createIndex('by-address', 'buyer');
      }
      if (!db.objectStoreNames.contains('pendingTransactions')) {
        const s = db.createObjectStore('pendingTransactions', { keyPath: 'id' });
        s.createIndex('by-status', 'status');
        s.createIndex('by-timestamp', 'createdAt');
      }
      if (!db.objectStoreNames.contains('syncedTransactions')) {
        const s = db.createObjectStore('syncedTransactions', { keyPath: 'id' });
        s.createIndex('by-timestamp', 'createdAt');
      }
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
    },
  },
  {
    version: 2,
    description: 'Add users store and settings store',
    up(db) {
      if (!db.objectStoreNames.contains('users')) {
        const s = db.createObjectStore('users', { keyPath: 'id' });
        s.createIndex('by-address', 'address', { unique: true });
        s.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  },
];

/** Run all migrations up to targetVersion during an IDB upgrade transaction */
export function runMigrations(
  db: IDBPDatabase<FidelisDBSchema>,
  oldVersion: number,
  newVersion: number
): void {
  for (const migration of migrations) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.up(db);
    }
  }
}
