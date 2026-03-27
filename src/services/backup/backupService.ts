import { openDB } from 'idb';
import {
  BackupConfig,
  BackupMetadata,
  BackupPayload,
  IntegrityReport,
  RecoveryPoint,
} from './types';

const BACKUP_INDEX_KEY = 'fidelis-backup-index';
const BACKUP_DATA_PREFIX = 'fidelis-backup-';
const DB_NAME = 'fidelis-soroban-db';
const CURRENT_VERSION = 1;

const DEFAULT_CONFIG: BackupConfig = {
  maxLocalBackups: 10,
  autoBackupIntervalMs: 0,
  storesToBackup: ['balances', 'escrows', 'pendingTransactions', 'syncedTransactions', 'preferences'],
};

/**
 * Simple checksum: sum of char codes of JSON string, base-36 encoded.
 * Lightweight integrity check without crypto API dependency.
 */
function checksum(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum = (sum + data.charCodeAt(i)) & 0xffffffff;
  return sum.toString(36);
}

class BackupService {
  private config: BackupConfig = { ...DEFAULT_CONFIG };
  private autoTimer: ReturnType<typeof setInterval> | null = null;

  configure(config: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Core backup ──────────────────────────────────────────────────────────

  async createBackup(label?: string, type: BackupMetadata['type'] = 'manual'): Promise<BackupMetadata> {
    const db = await openDB(DB_NAME, CURRENT_VERSION);
    const data: Record<string, unknown[]> = {};
    let recordCount = 0;

    for (const store of this.config.storesToBackup) {
      if (db.objectStoreNames.contains(store)) {
        const records = await db.getAll(store as any);
        data[store] = records;
        recordCount += records.length;
      }
    }

    const serialized = JSON.stringify(data);
    const meta: BackupMetadata = {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      version: CURRENT_VERSION,
      type,
      label,
      checksum: checksum(serialized),
      stores: Object.keys(data),
      recordCount,
      sizeBytes: new Blob([serialized]).size,
    };

    const payload: BackupPayload = { metadata: meta, data };
    this.saveToLocalStorage(meta, payload);
    return meta;
  }

  // ── Restore ──────────────────────────────────────────────────────────────

  async restoreBackup(backupId: string): Promise<void> {
    const point = this.getRecoveryPoints().find(p => p.metadata.id === backupId);
    if (!point) throw new Error(`Backup not found: ${backupId}`);

    const raw = localStorage.getItem(point.storageKey);
    if (!raw) throw new Error(`Backup data missing for: ${backupId}`);

    const payload: BackupPayload = JSON.parse(raw);

    // Verify integrity before restoring
    const report = this.verifyPayload(payload);
    if (!report.valid) throw new Error(`Backup integrity check failed: ${report.errors.join(', ')}`);

    const db = await openDB(DB_NAME, CURRENT_VERSION);

    for (const [store, records] of Object.entries(payload.data)) {
      if (!db.objectStoreNames.contains(store)) continue;
      const tx = db.transaction(store as any, 'readwrite');
      await tx.objectStore(store as any).clear();
      for (const record of records) {
        await tx.objectStore(store as any).put(record);
      }
      await tx.done;
    }
  }

  // ── Point-in-time export / import ────────────────────────────────────────

  exportBackup(backupId: string): string {
    const point = this.getRecoveryPoints().find(p => p.metadata.id === backupId);
    if (!point) throw new Error(`Backup not found: ${backupId}`);
    const raw = localStorage.getItem(point.storageKey);
    if (!raw) throw new Error('Backup data missing');
    return raw; // caller can download as .json file
  }

  async importBackup(jsonString: string): Promise<BackupMetadata> {
    const payload: BackupPayload = JSON.parse(jsonString);
    const report = this.verifyPayload(payload);
    if (!report.valid) throw new Error(`Import integrity check failed: ${report.errors.join(', ')}`);

    // Re-save under a new id so it doesn't collide
    const meta: BackupMetadata = {
      ...payload.metadata,
      id: `imported-${Date.now()}`,
      type: 'manual',
      label: `Imported ${new Date(payload.metadata.timestamp).toLocaleString()}`,
    };
    const newPayload: BackupPayload = { metadata: meta, data: payload.data };
    this.saveToLocalStorage(meta, newPayload);
    return meta;
  }

  // ── Integrity verification ────────────────────────────────────────────────

  verifyBackup(backupId: string): IntegrityReport {
    const point = this.getRecoveryPoints().find(p => p.metadata.id === backupId);
    if (!point) {
      return { valid: false, backupId, timestamp: Date.now(), checksumMatch: false, storesVerified: [], errors: ['Backup not found'] };
    }
    const raw = localStorage.getItem(point.storageKey);
    if (!raw) {
      return { valid: false, backupId, timestamp: Date.now(), checksumMatch: false, storesVerified: [], errors: ['Backup data missing'] };
    }
    const payload: BackupPayload = JSON.parse(raw);
    return this.verifyPayload(payload);
  }

  private verifyPayload(payload: BackupPayload): IntegrityReport {
    const errors: string[] = [];
    const serialized = JSON.stringify(payload.data);
    const computed = checksum(serialized);
    const checksumMatch = computed === payload.metadata.checksum;
    if (!checksumMatch) errors.push(`Checksum mismatch (expected ${payload.metadata.checksum}, got ${computed})`);

    return {
      valid: errors.length === 0,
      backupId: payload.metadata.id,
      timestamp: Date.now(),
      checksumMatch,
      storesVerified: payload.metadata.stores,
      errors,
    };
  }

  // ── Recovery points index ─────────────────────────────────────────────────

  getRecoveryPoints(): RecoveryPoint[] {
    try {
      const raw = localStorage.getItem(BACKUP_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  deleteBackup(backupId: string): void {
    const points = this.getRecoveryPoints();
    const point = points.find(p => p.metadata.id === backupId);
    if (point) localStorage.removeItem(point.storageKey);
    this.saveIndex(points.filter(p => p.metadata.id !== backupId));
  }

  private saveToLocalStorage(meta: BackupMetadata, payload: BackupPayload): void {
    const storageKey = `${BACKUP_DATA_PREFIX}${meta.id}`;
    localStorage.setItem(storageKey, JSON.stringify(payload));

    const points = this.getRecoveryPoints();
    points.unshift({ metadata: meta, storageKey });

    // Enforce max backups (keep newest)
    const pruned = points.slice(0, this.config.maxLocalBackups);
    // Remove data for pruned entries
    points.slice(this.config.maxLocalBackups).forEach(p => localStorage.removeItem(p.storageKey));
    this.saveIndex(pruned);
  }

  private saveIndex(points: RecoveryPoint[]): void {
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(points));
  }

  // ── Auto backup ───────────────────────────────────────────────────────────

  startAutoBackup(): void {
    if (!this.config.autoBackupIntervalMs) return;
    this.stopAutoBackup();
    this.autoTimer = setInterval(
      () => this.createBackup(undefined, 'auto').catch(console.error),
      this.config.autoBackupIntervalMs
    );
  }

  stopAutoBackup(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }
}

export const backupService = new BackupService();
export default backupService;
