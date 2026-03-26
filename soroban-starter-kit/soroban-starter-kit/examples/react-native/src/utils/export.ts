import AsyncStorage from '@react-native-async-storage/async-storage';
import { TxRecord } from './history';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'pdf';

export type ExportFilter = {
  contract?: 'token' | 'escrow' | 'all';
  status?: 'success' | 'pending' | 'failed' | 'all';
  from?: number; // timestamp ms
  to?: number;
};

export type ExportOptions = {
  format: ExportFormat;
  filter: ExportFilter;
  includeFields: (keyof TxRecord)[];
  template?: 'default' | 'compact' | 'detailed';
};

export type ExportRecord = {
  id: string;
  options: ExportOptions;
  rowCount: number;
  createdAt: number;
  status: 'done' | 'scheduled' | 'failed';
  scheduledFor?: number; // timestamp ms
  payload: string; // serialized export content
};

export type ExportAnalytics = {
  totalExports: number;
  byFormat: Record<ExportFormat, number>;
  lastExportAt: number | null;
};

const HISTORY_KEY = '@soroban_export_history';
const PREFS_KEY = '@soroban_export_prefs';
const ANALYTICS_KEY = '@soroban_export_analytics';

// ─── Filtering ────────────────────────────────────────────────────────────────

export function filterRecords(records: TxRecord[], filter: ExportFilter): TxRecord[] {
  return records.filter(r => {
    if (filter.contract && filter.contract !== 'all' && r.contract !== filter.contract) return false;
    if (filter.status && filter.status !== 'all' && r.status !== filter.status) return false;
    if (filter.from && r.timestamp < filter.from) return false;
    if (filter.to && r.timestamp > filter.to) return false;
    return true;
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function pickFields(record: TxRecord, fields: (keyof TxRecord)[]): Partial<TxRecord> {
  return fields.reduce((acc, f) => ({ ...acc, [f]: record[f] }), {} as Partial<TxRecord>);
}

export function toCSV(records: TxRecord[], fields: (keyof TxRecord)[]): string {
  const header = fields.join(',');
  const rows = records.map(r =>
    fields.map(f => {
      const v = r[f] ?? '';
      const s = String(v);
      return s.includes(',') ? `"${s}"` : s;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

export function toJSON(records: TxRecord[], fields: (keyof TxRecord)[]): string {
  return JSON.stringify(records.map(r => pickFields(r, fields)), null, 2);
}

// Minimal PDF: plain-text representation (real PDF requires a native lib)
export function toPDF(records: TxRecord[], fields: (keyof TxRecord)[], template: string): string {
  const title = `Soroban Export — ${new Date().toISOString()} [template: ${template}]`;
  const divider = '─'.repeat(60);
  const rows = records.map(r =>
    fields.map(f => `  ${f}: ${r[f] ?? ''}`).join('\n')
  ).join(`\n${divider}\n`);
  return `${title}\n${divider}\n${rows}\n${divider}\nTotal: ${records.length} records`;
}

export function serialize(records: TxRecord[], opts: ExportOptions): string {
  const filtered = filterRecords(records, opts.filter);
  const fields = opts.includeFields;
  const template = opts.template ?? 'default';
  switch (opts.format) {
    case 'csv':  return toCSV(filtered, fields);
    case 'json': return toJSON(filtered, fields);
    case 'pdf':  return toPDF(filtered, fields, template);
  }
}

// ─── Export history persistence ───────────────────────────────────────────────

export async function saveExportRecord(rec: ExportRecord) {
  const history = await loadExportHistory();
  const next = [rec, ...history].slice(0, 100);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function loadExportHistory(): Promise<ExportRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function deleteExportRecord(id: string) {
  const history = await loadExportHistory();
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.filter(r => r.id !== id)));
}

// ─── Scheduled exports ────────────────────────────────────────────────────────

export async function scheduledExportsDue(records: TxRecord[]): Promise<ExportRecord[]> {
  const history = await loadExportHistory();
  const now = Date.now();
  const due = history.filter(r => r.status === 'scheduled' && r.scheduledFor && r.scheduledFor <= now);
  const results: ExportRecord[] = [];
  for (const pending of due) {
    const payload = serialize(records, pending.options);
    const done: ExportRecord = { ...pending, status: 'done', payload, rowCount: filterRecords(records, pending.options.filter).length };
    await saveExportRecord(done);
    results.push(done);
  }
  return results;
}

// ─── User preferences ─────────────────────────────────────────────────────────

export type ExportPrefs = {
  defaultFormat: ExportFormat;
  defaultFields: (keyof TxRecord)[];
  defaultTemplate: ExportOptions['template'];
};

const DEFAULT_PREFS: ExportPrefs = {
  defaultFormat: 'csv',
  defaultFields: ['id', 'type', 'contract', 'amount', 'status', 'timestamp'],
  defaultTemplate: 'default',
};

export async function loadPrefs(): Promise<ExportPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function savePrefs(prefs: Partial<ExportPrefs>) {
  const current = await loadPrefs();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function trackExport(format: ExportFormat) {
  const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
  const analytics: ExportAnalytics = raw
    ? JSON.parse(raw)
    : { totalExports: 0, byFormat: { csv: 0, json: 0, pdf: 0 }, lastExportAt: null };
  analytics.totalExports += 1;
  analytics.byFormat[format] += 1;
  analytics.lastExportAt = Date.now();
  await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

export async function loadAnalytics(): Promise<ExportAnalytics> {
  const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
  return raw ? JSON.parse(raw) : { totalExports: 0, byFormat: { csv: 0, json: 0, pdf: 0 }, lastExportAt: null };
}
