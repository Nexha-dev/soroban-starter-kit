import {
  LogEntry,
  ParsedLog,
  LogQuery,
  LogSearchResult,
  AnomalyAlert,
  RetentionPolicy,
  LogStats,
  LogLevel,
  LogSource,
} from './types';

const LOG_STORAGE_KEY = 'soroban_logs';
const MAX_IN_MEMORY = 5000;

const DEFAULT_RETENTION: RetentionPolicy[] = [
  { source: 'app',            maxAgeDays: 30,  maxEntries: 10000, complianceRequired: false },
  { source: 'contract',       maxAgeDays: 90,  maxEntries: 50000, complianceRequired: true  },
  { source: 'infrastructure', maxAgeDays: 60,  maxEntries: 20000, complianceRequired: false },
  { source: 'security',       maxAgeDays: 365, maxEntries: 100000, complianceRequired: true },
  { source: 'performance',    maxAgeDays: 14,  maxEntries: 5000,  complianceRequired: false },
];

class LoggingService {
  private logs: ParsedLog[] = [];
  private anomalyAlerts: AnomalyAlert[] = [];
  private retentionPolicies: RetentionPolicy[] = DEFAULT_RETENTION;
  private correlationMap = new Map<string, string[]>(); // correlationId -> log ids
  private listeners: Array<(alert: AnomalyAlert) => void> = [];

  constructor() {
    this.loadFromStorage();
    this.scheduleRetentionCleanup();
  }

  // ── Ingestion ──────────────────────────────────────────────────────────────

  ingest(entry: Omit<LogEntry, 'id'>): ParsedLog {
    const parsed = this.parse({ ...entry, id: this.generateId() });
    this.logs.unshift(parsed);

    if (parsed.correlationId) {
      const ids = this.correlationMap.get(parsed.correlationId) ?? [];
      ids.push(parsed.id);
      this.correlationMap.set(parsed.correlationId, ids);
    }

    if (this.logs.length > MAX_IN_MEMORY) this.logs.pop();

    this.persistToStorage();
    this.detectAnomalies(parsed);
    return parsed;
  }

  log(level: LogLevel, source: LogSource, message: string, context?: Record<string, unknown>, correlationId?: string): ParsedLog {
    return this.ingest({ timestamp: Date.now(), level, source, message, context, correlationId });
  }

  // ── Parsing & Structuring ──────────────────────────────────────────────────

  private parse(entry: LogEntry): ParsedLog {
    const tags: string[] = [entry.level, entry.source];
    if (entry.contractId) tags.push(`contract:${entry.contractId}`);
    if (entry.correlationId) tags.push(`corr:${entry.correlationId}`);
    if (entry.context) {
      Object.keys(entry.context).forEach(k => tags.push(`field:${k}`));
    }
    return { ...entry, structured: !!entry.context, tags };
  }

  // ── Search & Query ─────────────────────────────────────────────────────────

  search(query: LogQuery): LogSearchResult {
    const start = performance.now();
    let results = [...this.logs];

    if (query.levels?.length)    results = results.filter(l => query.levels!.includes(l.level));
    if (query.sources?.length)   results = results.filter(l => query.sources!.includes(l.source));
    if (query.contractId)        results = results.filter(l => l.contractId === query.contractId);
    if (query.correlationId)     results = results.filter(l => l.correlationId === query.correlationId);
    if (query.tags?.length)      results = results.filter(l => query.tags!.every(t => l.tags.includes(t)));
    if (query.dateRange) {
      results = results.filter(l =>
        l.timestamp >= query.dateRange!.start && l.timestamp <= query.dateRange!.end
      );
    }
    if (query.text) {
      const term = query.text.toLowerCase();
      results = results.filter(l =>
        l.message.toLowerCase().includes(term) ||
        JSON.stringify(l.context ?? {}).toLowerCase().includes(term)
      );
    }

    return { entries: results, total: results.length, executionTime: performance.now() - start };
  }

  // ── Correlation ────────────────────────────────────────────────────────────

  getCorrelatedLogs(correlationId: string): ParsedLog[] {
    const ids = new Set(this.correlationMap.get(correlationId) ?? []);
    return this.logs.filter(l => ids.has(l.id));
  }

  // ── Anomaly Detection ──────────────────────────────────────────────────────

  private detectAnomalies(entry: ParsedLog): void {
    // Threshold: critical log always triggers alert
    if (entry.level === 'critical') {
      this.raiseAlert('threshold', `Critical log: ${entry.message}`, [entry.id], 'critical');
      return;
    }

    // Spike: >10 errors in last 60 s
    const windowStart = Date.now() - 60_000;
    const recentErrors = this.logs.filter(
      l => l.level === 'error' && l.source === entry.source && l.timestamp >= windowStart
    );
    if (recentErrors.length >= 10) {
      const existing = this.anomalyAlerts.find(
        a => a.type === 'spike' && !a.acknowledged && a.message.includes(entry.source)
      );
      if (!existing) {
        this.raiseAlert('spike', `Error spike in ${entry.source}: ${recentErrors.length} errors/min`, recentErrors.map(l => l.id), 'error');
      }
    }
  }

  private raiseAlert(type: AnomalyAlert['type'], message: string, affectedLogs: string[], severity: LogLevel): void {
    const alert: AnomalyAlert = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      message,
      affectedLogs,
      severity,
      acknowledged: false,
    };
    this.anomalyAlerts.unshift(alert);
    this.listeners.forEach(fn => fn(alert));
  }

  onAnomaly(fn: (alert: AnomalyAlert) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  acknowledgeAlert(id: string): void {
    const alert = this.anomalyAlerts.find(a => a.id === id);
    if (alert) alert.acknowledged = true;
  }

  getAlerts(includeAcknowledged = false): AnomalyAlert[] {
    return includeAcknowledged ? this.anomalyAlerts : this.anomalyAlerts.filter(a => !a.acknowledged);
  }

  // ── Retention ──────────────────────────────────────────────────────────────

  setRetentionPolicy(policy: RetentionPolicy): void {
    const idx = this.retentionPolicies.findIndex(p => p.source === policy.source);
    if (idx >= 0) this.retentionPolicies[idx] = policy;
    else this.retentionPolicies.push(policy);
  }

  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.retentionPolicies];
  }

  private applyRetention(): void {
    const now = Date.now();
    this.retentionPolicies.forEach(policy => {
      const cutoff = now - policy.maxAgeDays * 86_400_000;
      const sourceLogs = this.logs.filter(l => l.source === policy.source);
      const toRemove = new Set<string>();

      sourceLogs.filter(l => l.timestamp < cutoff).forEach(l => toRemove.add(l.id));

      if (sourceLogs.length - toRemove.size > policy.maxEntries) {
        sourceLogs
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, sourceLogs.length - policy.maxEntries)
          .forEach(l => toRemove.add(l.id));
      }

      this.logs = this.logs.filter(l => !toRemove.has(l.id));
    });

    this.persistToStorage();
  }

  private scheduleRetentionCleanup(): void {
    // Run once on startup, then every hour
    this.applyRetention();
    setInterval(() => this.applyRetention(), 3_600_000);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): LogStats {
    const byLevel = { debug: 0, info: 0, warn: 0, error: 0, critical: 0 } as Record<LogLevel, number>;
    const bySource = { app: 0, contract: 0, infrastructure: 0, security: 0, performance: 0 } as Record<LogSource, number>;

    this.logs.forEach(l => {
      byLevel[l.level]++;
      bySource[l.source]++;
    });

    const total = this.logs.length;
    const errors = byLevel.error + byLevel.critical;
    return {
      total,
      byLevel,
      bySource,
      errorRate: total > 0 ? errors / total : 0,
      anomalies: this.anomalyAlerts.filter(a => !a.acknowledged).length,
    };
  }

  // ── Compliance Export ──────────────────────────────────────────────────────

  exportCompliance(source: LogSource): ParsedLog[] {
    const policy = this.retentionPolicies.find(p => p.source === source);
    if (!policy?.complianceRequired) return [];
    return this.logs.filter(l => l.source === source);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private persistToStorage(): void {
    try {
      // Only persist compliance-required sources to avoid quota issues
      const toStore = this.logs.filter(l => {
        const policy = this.retentionPolicies.find(p => p.source === l.source);
        return policy?.complianceRequired;
      }).slice(0, 2000);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Storage quota exceeded — skip silently
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      if (raw) this.logs = JSON.parse(raw) as ParsedLog[];
    } catch {
      this.logs = [];
    }
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const loggingService = new LoggingService();
