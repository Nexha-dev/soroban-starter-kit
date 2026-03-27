export type BackupStatus = 'idle' | 'running' | 'success' | 'failed';
export type RecoveryPointType = 'manual' | 'auto' | 'pre-migration';

export interface BackupMetadata {
  id: string;
  timestamp: number;
  version: number;
  type: RecoveryPointType;
  label?: string;
  checksum: string;
  stores: string[];
  recordCount: number;
  sizeBytes: number;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, unknown[]>;
}

export interface RecoveryPoint {
  metadata: BackupMetadata;
  storageKey: string;
}

export interface IntegrityReport {
  valid: boolean;
  backupId: string;
  timestamp: number;
  checksumMatch: boolean;
  storesVerified: string[];
  errors: string[];
}

export interface BackupConfig {
  maxLocalBackups: number;       // max recovery points kept in localStorage
  autoBackupIntervalMs: number;  // 0 = disabled
  storesToBackup: string[];
}
