/**
 * Structured Logger
 * Browser-compatible structured logging with levels, correlation IDs,
 * Stellar operation tracking, and performance metrics.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

export interface StellarLogData {
  operation: string;
  transactionHash?: string;
  contractId?: string;
  account?: string;
  [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const LOG_RETENTION_KEY = 'app:logs';
const MAX_STORED_LOGS = 500;

class Logger {
  private minLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
  private correlationId: string | undefined;

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  clearCorrelationId(): void {
    this.correlationId = undefined;
  }

  generateCorrelationId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.minLevel];
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(data && { data }),
    };

    const formatted = JSON.stringify(entry);

    switch (level) {
      case 'debug': console.debug(formatted); break;
      case 'info':  console.info(formatted);  break;
      case 'warn':  console.warn(formatted);  break;
      case 'error': console.error(formatted); break;
    }

    this.persist(entry);
  }

  private persist(entry: LogEntry): void {
    try {
      const raw = sessionStorage.getItem(LOG_RETENTION_KEY);
      const logs: LogEntry[] = raw ? JSON.parse(raw) : [];
      logs.push(entry);
      if (logs.length > MAX_STORED_LOGS) logs.splice(0, logs.length - MAX_STORED_LOGS);
      sessionStorage.setItem(LOG_RETENTION_KEY, JSON.stringify(logs));
    } catch {
      // Storage unavailable — silently skip persistence
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write('error', message, data);
  }

  /** Log a Stellar operation with optional transaction hash */
  stellar(data: StellarLogData): void {
    this.info(`stellar:${data.operation}`, data as Record<string, unknown>);
  }

  /** Log a performance metric */
  perf(label: string, durationMs: number, meta?: Record<string, unknown>): void {
    this.debug(`perf:${label}`, { durationMs, ...meta });
  }

  /** Retrieve stored logs (for export / debug UI) */
  getLogs(): LogEntry[] {
    try {
      const raw = sessionStorage.getItem(LOG_RETENTION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  clearLogs(): void {
    sessionStorage.removeItem(LOG_RETENTION_KEY);
  }
}

export const logger = new Logger();
