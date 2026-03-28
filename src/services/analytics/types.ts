// ─── Data sources ─────────────────────────────────────────────────────────────

export type DataSourceType = 'transactions' | 'balances' | 'escrows' | 'users' | 'performance' | 'custom';

export interface DataSource {
  id: DataSourceType;
  label: string;
  fields: FieldDef[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregatable: boolean;
}

// ─── Report builder ───────────────────────────────────────────────────────────

export type AggregationFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
export type SortDirection = 'asc' | 'desc';
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'table' | 'kpi';
export type ExportFormat = 'csv' | 'json' | 'pdf_text';

export interface ReportColumn {
  field: string;
  label: string;
  aggregation?: AggregationFn;
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number;
}

export interface ReportSort {
  field: string;
  direction: SortDirection;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  dataSource: DataSourceType;
  columns: ReportColumn[];
  filters: ReportFilter[];
  sort?: ReportSort;
  groupBy?: string;
  chartType: ChartType;
  createdAt: number;
  updatedAt: number;
}

// ─── Scheduled reports ────────────────────────────────────────────────────────

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export interface ScheduledReport {
  id: string;
  reportId: string;
  frequency: ScheduleFrequency;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  recipients: string[];
  exportFormat: ExportFormat;
  runCount: number;
}

// ─── Report results ───────────────────────────────────────────────────────────

export interface ReportRow {
  [key: string]: string | number | boolean | null;
}

export interface ReportResult {
  reportId: string;
  generatedAt: number;
  durationMs: number;
  rows: ReportRow[];
  totalRows: number;
  summary: Record<string, number | string>;
}

// ─── BI Insights ──────────────────────────────────────────────────────────────

export interface BIInsight {
  id: string;
  category: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  metric: string;
  value: number;
  change?: number;
  severity: 'info' | 'warning' | 'positive';
  generatedAt: number;
}

// ─── Comparative analysis ─────────────────────────────────────────────────────

export interface ComparisonMetric {
  field: string;
  label: string;
  current: number;
  previous: number;
  change: number;
  changePct: number;
  trend: 'up' | 'down' | 'flat';
}

export interface ComparisonResult {
  reportId: string;
  currentPeriod: { label: string; rows: ReportRow[]; summary: Record<string, number | string> };
  previousPeriod: { label: string; rows: ReportRow[]; summary: Record<string, number | string> };
  metrics: ComparisonMetric[];
  generatedAt: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface AnalyticsState {
  reports: ReportDefinition[];
  schedules: ScheduledReport[];
  results: Record<string, ReportResult>;
  comparisons: Record<string, ComparisonResult>;
  insights: BIInsight[];
  lastInsightRefresh?: number;
}