export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogSource = 'app' | 'contract' | 'infrastructure' | 'security' | 'performance';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  contractId?: string;
  transactionHash?: string;
  userId?: string;
}

export interface ParsedLog extends LogEntry {
  structured: boolean;
  tags: string[];
}

export interface LogQuery {
  text?: string;
  levels?: LogLevel[];
  sources?: LogSource[];
  dateRange?: { start: number; end: number };
  correlationId?: string;
  contractId?: string;
  tags?: string[];
}

export interface LogSearchResult {
  entries: ParsedLog[];
  total: number;
  executionTime: number;
}

export interface AnomalyAlert {
  id: string;
  timestamp: number;
  type: 'spike' | 'pattern' | 'threshold';
  message: string;
  affectedLogs: string[];
  severity: LogLevel;
  acknowledged: boolean;
}

export interface RetentionPolicy {
  source: LogSource;
  maxAgeDays: number;
  maxEntries: number;
  complianceRequired: boolean;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
  errorRate: number;
  anomalies: number;
}
