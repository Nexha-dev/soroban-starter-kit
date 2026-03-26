/**
 * Database Health Check
 * Verifies the DB is open, readable, and writable.
 * Returns a structured health report.
 */

import { IDBPDatabase } from 'idb';
import { FidelisDBSchema } from './schema';

export interface DBHealthReport {
  healthy: boolean;
  latencyMs: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  openStores: string[];
  error?: string;
}

export async function checkDBHealth(
  db: IDBPDatabase<FidelisDBSchema> | null
): Promise<DBHealthReport> {
  const start = performance.now();

  if (!db) {
    return { healthy: false, latencyMs: 0, storageUsedBytes: 0, storageQuotaBytes: 0, openStores: [], error: 'DB not initialized' };
  }

  try {
    // Probe: write + read + delete a sentinel key
    const PROBE_KEY = '__health_probe__';
    const tx = db.transaction('cache', 'readwrite');
    await tx.store.put({ data: 1, timestamp: Date.now(), expiresAt: Date.now() + 5000 }, PROBE_KEY);
    await tx.store.get(PROBE_KEY);
    await tx.store.delete(PROBE_KEY);
    await tx.done;

    const latencyMs = Math.round(performance.now() - start);
    const { usage = 0, quota = 0 } = navigator.storage
      ? await navigator.storage.estimate()
      : {};

    return {
      healthy: true,
      latencyMs,
      storageUsedBytes: usage,
      storageQuotaBytes: quota,
      openStores: Array.from(db.objectStoreNames),
    };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
      storageUsedBytes: 0,
      storageQuotaBytes: 0,
      openStores: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
