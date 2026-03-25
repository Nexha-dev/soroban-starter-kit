/**
 * Database Error Handler
 * Classifies IDB errors and provides structured error objects with retry guidance.
 */

export type DBErrorCode =
  | 'NOT_INITIALIZED'
  | 'QUOTA_EXCEEDED'
  | 'VERSION_ERROR'
  | 'TRANSACTION_INACTIVE'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class DBError extends Error {
  constructor(
    public readonly code: DBErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DBError';
  }

  get retryable(): boolean {
    return this.code === 'TRANSACTION_INACTIVE' || this.code === 'UNKNOWN';
  }
}

export function classifyError(err: unknown): DBError {
  if (err instanceof DBError) return err;

  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (name === 'QuotaExceededError' || msg.includes('QuotaExceeded')) {
    return new DBError('QUOTA_EXCEEDED', 'Storage quota exceeded. Clear old data to continue.', err);
  }
  if (name === 'VersionError' || msg.includes('version')) {
    return new DBError('VERSION_ERROR', 'Database version conflict. Reload the page.', err);
  }
  if (msg.includes('transaction') && msg.includes('finished')) {
    return new DBError('TRANSACTION_INACTIVE', 'IDB transaction already completed.', err);
  }
  if (msg.includes('not initialized')) {
    return new DBError('NOT_INITIALIZED', 'Database not initialized. Call init() first.', err);
  }

  return new DBError('UNKNOWN', msg, err);
}

/** Wrap an async DB operation with error classification */
export async function withDBError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw classifyError(err);
  }
}
