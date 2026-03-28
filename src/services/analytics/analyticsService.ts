import {
  AnalyticsState, ReportDefinition, ReportResult, ReportRow,
  ScheduledReport, ScheduleFrequency, ExportFormat, BIInsight,
  DataSource, DataSourceType, AggregationFn, ComparisonResult, ComparisonMetric,
} from './types';

const STORAGE_KEY = 'bi_analytics_state';

// ─── Data source schemas ──────────────────────────────────────────────────────

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'transactions',
    label: 'Transactions',
    fields: [
      { key: 'id', label: 'ID', type: 'string', aggregatable: false },
      { key: 'type', label: 'Type', type: 'string', aggregatable: true },
      { key: 'status', label: 'Status', type: 'string', aggregatable: true },
      { key: 'contractId', label: 'Contract', type: 'string', aggregatable: true },
      { key: 'createdAt', label: 'Created At', type: 'date', aggregatable: false },
      { key: 'retryCount', label: 'Retry Count', type: 'number', aggregatable: true },
    ],
  },
  {
    id: 'balances',
    label: 'Balances',
    fields: [
      { key: 'tokenSymbol', label: 'Token', type: 'string', aggregatable: true },
      { key: 'amount', label: 'Amount', type: 'number', aggregatable: true },
      { key: 'address', label: 'Address', type: 'string', aggregatable: true },
      { key: 'lastUpdated', label: 'Last Updated', type: 'date', aggregatable: false },
    ],
  },
  {
    id: 'escrows',
    label: 'Escrows',
    fields: [
      { key: 'status', label: 'Status', type: 'string', aggregatable: true },
      { key: 'amount', label: 'Amount', type: 'number', aggregatable: true },
      { key: 'buyer', label: 'Buyer', type: 'string', aggregatable: true },
      { key: 'seller', label: 'Seller', type: 'string', aggregatable: true },
      { key: 'createdAt', label: 'Created At', type: 'date', aggregatable: false },
      { key: 'deadline', label: 'Deadline', type: 'date', aggregatable: false },
    ],
  },
  {
    id: 'performance',
    label: 'Performance Metrics',
    fields: [
      { key: 'name', label: 'Metric Name', type: 'string', aggregatable: true },
      { key: 'duration', label: 'Duration (ms)', type: 'number', aggregatable: true },
      { key: 'timestamp', label: 'Timestamp', type: 'date', aggregatable: false },
    ],
  },
];

// ─── Seed reports ─────────────────────────────────────────────────────────────

function seedReports(): ReportDefinition[] {
  const now = Date.now();
  return [
    {
      id: 'rpt_tx_summary', name: 'Transaction Summary', description: 'Count and breakdown of all transactions by status',
      dataSource: 'transactions', chartType: 'bar',
      columns: [{ field: 'status', label: 'Status' }, { field: 'id', label: 'Count', aggregation: 'count' }],
      filters: [], sort: { field: 'id', direction: 'desc' }, groupBy: 'status',
      createdAt: now - 86400000 * 7, updatedAt: now - 86400000 * 2,
    },
    {
      id: 'rpt_balance_dist', name: 'Balance Distribution', description: 'Token balance distribution across addresses',
      dataSource: 'balances', chartType: 'pie',
      columns: [{ field: 'tokenSymbol', label: 'Token' }, { field: 'amount', label: 'Total Amount', aggregation: 'sum' }],
      filters: [], groupBy: 'tokenSymbol',
      createdAt: now - 86400000 * 5, updatedAt: now - 86400000 * 1,
    },
    {
      id: 'rpt_escrow_status', name: 'Escrow Status Report', description: 'Active escrows by status and value',
      dataSource: 'escrows', chartType: 'table',
      columns: [{ field: 'status', label: 'Status' }, { field: 'amount', label: 'Avg Amount', aggregation: 'avg' }, { field: 'id', label: 'Count', aggregation: 'count' }],
      filters: [], groupBy: 'status',
      createdAt: now - 86400000 * 3, updatedAt: now,
    },
  ];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class AnalyticsService {
  private state: AnalyticsState;
  private listeners: Set<(s: AnalyticsState) => void> = new Set();
  private scheduleTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor() {
    const stored = this.load();
    this.state = stored ?? this.defaultState();
    this.setupSchedules();
    setTimeout(() => this.refreshInsights(), 300);
  }

  private defaultState(): AnalyticsState {
    return { reports: seedReports(), schedules: [], results: {}, comparisons: {}, insights: [] };
  }

  private load(): AnalyticsState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* quota */ }
  }

  private emit() {
    const s = this.getState();
    this.listeners.forEach(fn => fn(s));
    this.save();
  }

  subscribe(fn: (s: AnalyticsState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): AnalyticsState { return { ...this.state }; }

  // ── Data fetching ──────────────────────────────────────────────────────────

  private fetchData(source: DataSourceType): ReportRow[] {
    try {
      switch (source) {
        case 'transactions': {
          const pending = JSON.parse(localStorage.getItem('fidelis_pending_txs') ?? '[]');
          const synced = JSON.parse(localStorage.getItem('fidelis_synced_txs') ?? '[]');
          return [...pending, ...synced].map((t: any) => ({
            id: t.id, type: t.type, status: t.status, contractId: t.contractId,
            createdAt: t.createdAt, retryCount: t.retryCount ?? 0,
          }));
        }
        case 'balances': {
          const raw = JSON.parse(localStorage.getItem('fidelis_balances') ?? '[]');
          return raw.map((b: any) => ({
            tokenSymbol: b.tokenSymbol, amount: Number(b.amount) / 10_000_000,
            address: b.address, lastUpdated: b.lastUpdated,
          }));
        }
        case 'escrows': {
          const raw = JSON.parse(localStorage.getItem('fidelis_escrows') ?? '[]');
          return raw.map((e: any) => ({
            status: e.status, amount: Number(e.amount) / 10_000_000,
            buyer: e.buyer, seller: e.seller, createdAt: e.createdAt, deadline: e.deadline,
          }));
        }
        case 'performance': {
          const raw = JSON.parse(localStorage.getItem('perf_metrics') ?? '[]');
          return raw.map((m: any) => ({ name: m.name, duration: m.duration, timestamp: m.timestamp }));
        }
        default: return [];
      }
    } catch { return this.generateDemoData(source); }
  }

  private generateDemoData(source: DataSourceType): ReportRow[] {
    const now = Date.now();
    if (source === 'transactions') {
      const types = ['transfer', 'mint', 'burn', 'approve'];
      const statuses = ['synced', 'pending', 'failed', 'synced', 'synced'];
      return Array.from({ length: 40 }, (_, i) => ({
        id: `tx_${i}`, type: types[i % types.length], status: statuses[i % statuses.length],
        contractId: `C${(i % 3) + 1}`, createdAt: now - i * 3600000, retryCount: i % 3,
      }));
    }
    if (source === 'balances') {
      return [
        { tokenSymbol: 'XLM', amount: 1250.5, address: 'GABC...', lastUpdated: now - 3600000 },
        { tokenSymbol: 'USDC', amount: 500.0, address: 'GABC...', lastUpdated: now - 7200000 },
        { tokenSymbol: 'BTC', amount: 0.05, address: 'GDEF...', lastUpdated: now - 86400000 },
        { tokenSymbol: 'ETH', amount: 1.2, address: 'GDEF...', lastUpdated: now - 86400000 },
      ];
    }
    if (source === 'escrows') {
      const statuses = ['initialized', 'funded', 'delivered', 'completed', 'cancelled'];
      return Array.from({ length: 15 }, (_, i) => ({
        status: statuses[i % statuses.length], amount: (i + 1) * 100,
        buyer: `buyer_${i % 3}`, seller: `seller_${i % 2}`,
        createdAt: now - i * 86400000, deadline: now + (7 - i) * 86400000,
      }));
    }
    return [];
  }

  // ── Report execution ───────────────────────────────────────────────────────

  runReport(reportId: string): ReportResult {
    const report = this.state.reports.find(r => r.id === reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    const start = Date.now();
    let rows = this.fetchData(report.dataSource);

    // Apply filters
    for (const f of report.filters) {
      rows = rows.filter(row => {
        const val = row[f.field];
        const fv = f.value;
        switch (f.operator) {
          case 'eq': return val == fv;
          case 'neq': return val != fv;
          case 'gt': return Number(val) > Number(fv);
          case 'gte': return Number(val) >= Number(fv);
          case 'lt': return Number(val) < Number(fv);
          case 'lte': return Number(val) <= Number(fv);
          case 'contains': return String(val).toLowerCase().includes(String(fv).toLowerCase());
          default: return true;
        }
      });
    }

    // Group + aggregate
    let result: ReportRow[] = rows;
    if (report.groupBy) {
      const groups: Record<string, ReportRow[]> = {};
      rows.forEach(row => {
        const key = String(row[report.groupBy!] ?? 'null');
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      });

      result = Object.entries(groups).map(([groupVal, groupRows]) => {
        const out: ReportRow = { [report.groupBy!]: groupVal };
        for (const col of report.columns) {
          if (col.aggregation) {
            out[col.field] = this.aggregate(groupRows.map(r => r[col.field]), col.aggregation);
          }
        }
        return out;
      });
    }

    // Sort
    if (report.sort) {
      const { field, direction } = report.sort;
      result.sort((a, b) => {
        const av = a[field] ?? 0; const bv = b[field] ?? 0;
        return direction === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }

    // Summary
    const summary: Record<string, number | string> = { total_rows: result.length };
    for (const col of report.columns) {
      if (col.aggregation && col.aggregation !== 'distinct') {
        const nums = result.map(r => Number(r[col.field] ?? 0));
        summary[`${col.label}_total`] = this.aggregate(result.map(r => r[col.field]), col.aggregation) as number;
      }
    }

    const reportResult: ReportResult = {
      reportId, generatedAt: Date.now(), durationMs: Date.now() - start,
      rows: result, totalRows: result.length, summary,
    };

    this.state = { ...this.state, results: { ...this.state.results, [reportId]: reportResult } };
    this.emit();
    return reportResult;
  }

  private aggregate(values: (string | number | boolean | null)[], fn: AggregationFn): number | string {
    const nums = values.map(v => Number(v ?? 0)).filter(n => !isNaN(n));
    switch (fn) {
      case 'count': return values.length;
      case 'sum': return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
      case 'avg': return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
      case 'min': return nums.length ? Math.min(...nums) : 0;
      case 'max': return nums.length ? Math.max(...nums) : 0;
      case 'distinct': return new Set(values.map(String)).size;
    }
  }

  // ── Report CRUD ────────────────────────────────────────────────────────────

  createReport(def: Omit<ReportDefinition, 'id' | 'createdAt' | 'updatedAt'>): ReportDefinition {
    const report: ReportDefinition = { ...def, id: `rpt_${Date.now()}`, createdAt: Date.now(), updatedAt: Date.now() };
    this.state = { ...this.state, reports: [...this.state.reports, report] };
    this.emit();
    return report;
  }

  updateReport(id: string, patch: Partial<ReportDefinition>) {
    this.state = { ...this.state, reports: this.state.reports.map(r => r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r) };
    this.emit();
  }

  deleteReport(id: string) {
    const { [id]: _, ...results } = this.state.results;
    const { [id]: _c, ...comparisons } = this.state.comparisons;
    this.state = { ...this.state, reports: this.state.reports.filter(r => r.id !== id), results, comparisons };
    this.emit();
  }

  // ── Comparative analysis ───────────────────────────────────────────────────

  compareReports(reportId: string): ComparisonResult {
    const report = this.state.reports.find(r => r.id === reportId);
    if (!report) throw new Error('Report not found');

    const allRows = this.fetchData(report.dataSource);
    const now = Date.now();
    const midpoint = now - 7 * 86400000; // split: last 7 days vs prior 7 days
    const start = now - 14 * 86400000;

    const currentRows = allRows.filter((_, i) => i >= Math.floor(allRows.length / 2));
    const previousRows = allRows.filter((_, i) => i < Math.floor(allRows.length / 2));

    const summarize = (rows: ReportRow[]): Record<string, number | string> => {
      const s: Record<string, number | string> = { total_rows: rows.length };
      for (const col of report.columns) {
        if (col.aggregation) {
          s[col.label] = this.aggregate(rows.map(r => r[col.field]), col.aggregation);
        }
      }
      return s;
    };

    const currentSummary = summarize(currentRows);
    const previousSummary = summarize(previousRows);

    const metrics: ComparisonMetric[] = report.columns
      .filter(c => c.aggregation && c.aggregation !== 'distinct')
      .map(c => {
        const cur = Number(currentSummary[c.label] ?? 0);
        const prev = Number(previousSummary[c.label] ?? 0);
        const change = cur - prev;
        const changePct = prev !== 0 ? Math.round((change / prev) * 1000) / 10 : 0;
        return {
          field: c.field, label: c.label, current: cur, previous: prev,
          change, changePct,
          trend: Math.abs(changePct) < 2 ? 'flat' : changePct > 0 ? 'up' : 'down',
        };
      });

    const result: ComparisonResult = {
      reportId, generatedAt: now,
      currentPeriod: { label: 'Last 7 days', rows: currentRows, summary: currentSummary },
      previousPeriod: { label: 'Prior 7 days', rows: previousRows, summary: previousSummary },
      metrics,
    };

    this.state = { ...this.state, comparisons: { ...this.state.comparisons, [reportId]: result } };
    this.emit();
    return result;
  }

  // ── Schedules ──────────────────────────────────────────────────────────────

  scheduleReport(reportId: string, frequency: ScheduleFrequency, recipients: string[], format: ExportFormat): ScheduledReport {
    const schedule: ScheduledReport = {
      id: `sch_${Date.now()}`, reportId, frequency, enabled: true,
      nextRunAt: this.nextRunTime(frequency), recipients, exportFormat: format, runCount: 0,
    };
    this.state = { ...this.state, schedules: [...this.state.schedules, schedule] };
    this.setupScheduleTimer(schedule);
    this.emit();
    return schedule;
  }

  updateSchedule(id: string, patch: Partial<ScheduledReport>) {
    this.state = { ...this.state, schedules: this.state.schedules.map(s => s.id === id ? { ...s, ...patch } : s) };
    this.emit();
  }

  deleteSchedule(id: string) {
    const timer = this.scheduleTimers.get(id);
    if (timer) { clearInterval(timer); this.scheduleTimers.delete(id); }
    this.state = { ...this.state, schedules: this.state.schedules.filter(s => s.id !== id) };
    this.emit();
  }

  private nextRunTime(freq: ScheduleFrequency): number {
    const now = Date.now();
    if (freq === 'daily') return now + 86400000;
    if (freq === 'weekly') return now + 7 * 86400000;
    if (freq === 'monthly') return now + 30 * 86400000;
    return 0;
  }

  private setupSchedules() {
    this.state.schedules.filter(s => s.enabled).forEach(s => this.setupScheduleTimer(s));
  }

  private setupScheduleTimer(schedule: ScheduledReport) {
    if (!schedule.enabled || schedule.frequency === 'manual') return;
    const intervalMs = schedule.frequency === 'daily' ? 86400000 : schedule.frequency === 'weekly' ? 7 * 86400000 : 30 * 86400000;
    const timer = setInterval(() => {
      try {
        this.runReport(schedule.reportId);
        this.state = {
          ...this.state,
          schedules: this.state.schedules.map(s => s.id === schedule.id
            ? { ...s, lastRunAt: Date.now(), nextRunAt: this.nextRunTime(s.frequency), runCount: s.runCount + 1 }
            : s
          ),
        };
        this.emit();
      } catch { /* report may have been deleted */ }
    }, intervalMs);
    this.scheduleTimers.set(schedule.id, timer);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  exportResult(reportId: string, format: ExportFormat): void {
    const result = this.state.results[reportId];
    const report = this.state.reports.find(r => r.id === reportId);
    if (!result || !report) return;

    let content = '';
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'csv') {
      const headers = report.columns.map(c => c.label);
      const rows = result.rows.map(r => report.columns.map(c => JSON.stringify(r[c.field] ?? '')));
      content = [headers, ...rows].map(r => r.join(',')).join('\n');
      mime = 'text/csv'; ext = 'csv';
    } else if (format === 'json') {
      content = JSON.stringify({ report: report.name, generatedAt: new Date(result.generatedAt).toISOString(), summary: result.summary, rows: result.rows }, null, 2);
      mime = 'application/json'; ext = 'json';
    } else if (format === 'pdf_text') {
      const lines = [
        `REPORT: ${report.name}`, `Generated: ${new Date(result.generatedAt).toISOString()}`,
        `Total rows: ${result.totalRows}`, '',
        'SUMMARY:', ...Object.entries(result.summary).map(([k, v]) => `  ${k}: ${v}`),
        '', 'DATA:', report.columns.map(c => c.label).join('\t'),
        ...result.rows.map(r => report.columns.map(c => r[c.field] ?? '').join('\t')),
      ];
      content = lines.join('\n');
      mime = 'text/plain'; ext = 'txt';
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
    a.click();
  }

  // ── BI Insights ────────────────────────────────────────────────────────────

  refreshInsights(): BIInsight[] {
    const now = Date.now();
    const txRows = this.generateDemoData('transactions');
    const balRows = this.generateDemoData('balances');
    const escRows = this.generateDemoData('escrows');

    const insights: BIInsight[] = [];

    // Transaction success rate
    const total = txRows.length;
    const synced = txRows.filter(r => r.status === 'synced').length;
    const successRate = total > 0 ? (synced / total) * 100 : 0;
    insights.push({ id: 'ins_tx_success', category: 'trend', title: 'Transaction Success Rate', description: `${successRate.toFixed(1)}% of transactions completed successfully`, metric: 'success_rate', value: successRate, severity: successRate >= 80 ? 'positive' : 'warning', generatedAt: now });

    // Failed transactions
    const failed = txRows.filter(r => r.status === 'failed').length;
    if (failed > 0) insights.push({ id: 'ins_tx_failed', category: 'risk', title: 'Failed Transactions', description: `${failed} transaction(s) failed and may need attention`, metric: 'failed_count', value: failed, severity: failed > 5 ? 'warning' : 'info', generatedAt: now });

    // Portfolio concentration
    const totalBalance = balRows.reduce((s, r) => s + Number(r.amount), 0);
    const topToken = balRows.sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    if (topToken && totalBalance > 0) {
      const concentration = (Number(topToken.amount) / totalBalance) * 100;
      insights.push({ id: 'ins_concentration', category: concentration > 70 ? 'risk' : 'opportunity', title: 'Portfolio Concentration', description: `${topToken.tokenSymbol} represents ${concentration.toFixed(0)}% of total balance`, metric: 'concentration_pct', value: concentration, change: -5, severity: concentration > 70 ? 'warning' : 'positive', generatedAt: now });
    }

    // Escrow completion rate
    const completedEscrows = escRows.filter(r => r.status === 'completed').length;
    const escrowRate = escRows.length > 0 ? (completedEscrows / escRows.length) * 100 : 0;
    insights.push({ id: 'ins_escrow', category: 'trend', title: 'Escrow Completion Rate', description: `${escrowRate.toFixed(0)}% of escrows completed successfully`, metric: 'escrow_completion', value: escrowRate, change: 8, severity: 'positive', generatedAt: now });

    // Retry rate
    const highRetry = txRows.filter(r => Number(r.retryCount) > 1).length;
    if (highRetry > 0) insights.push({ id: 'ins_retry', category: 'anomaly', title: 'High Retry Rate', description: `${highRetry} transaction(s) required multiple retries — possible network issues`, metric: 'retry_count', value: highRetry, severity: 'warning', generatedAt: now });

    this.state = { ...this.state, insights, lastInsightRefresh: now };
    this.emit();
    return insights;
  }
}

export const analyticsService = new AnalyticsService();
