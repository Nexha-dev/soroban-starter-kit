const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
}));

import {
  filterRecords, toCSV, toJSON, toPDF, serialize,
  saveExportRecord, loadExportHistory, deleteExportRecord,
  loadPrefs, savePrefs, trackExport, loadAnalytics,
} from '../src/utils/export';
import { TxRecord } from '../src/utils/history';

const sample: TxRecord[] = [
  { id: '1', type: 'transfer', contract: 'token', amount: '100', status: 'success', timestamp: 1000 },
  { id: '2', type: 'fund', contract: 'escrow', status: 'pending', timestamp: 2000 },
  { id: '3', type: 'transfer', contract: 'token', status: 'failed', timestamp: 3000 },
];

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

describe('filterRecords', () => {
  it('filters by contract', () => {
    expect(filterRecords(sample, { contract: 'token' })).toHaveLength(2);
  });
  it('filters by status', () => {
    expect(filterRecords(sample, { status: 'success' })).toHaveLength(1);
  });
  it('filters by time range', () => {
    expect(filterRecords(sample, { from: 1500, to: 2500 })).toHaveLength(1);
  });
  it('returns all when no filter', () => {
    expect(filterRecords(sample, {})).toHaveLength(3);
  });
});

describe('formatters', () => {
  const fields: (keyof TxRecord)[] = ['id', 'type', 'status'];

  it('toCSV produces header + rows', () => {
    const csv = toCSV(sample, fields);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,type,status');
    expect(lines).toHaveLength(4);
  });

  it('toJSON produces valid JSON array', () => {
    const json = toJSON(sample, fields);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toHaveProperty('id');
    expect(parsed[0]).not.toHaveProperty('amount');
  });

  it('toPDF contains title and record count', () => {
    const pdf = toPDF(sample, fields, 'default');
    expect(pdf).toContain('Soroban Export');
    expect(pdf).toContain('Total: 3 records');
  });
});

describe('serialize', () => {
  it('applies filter before formatting', () => {
    const csv = serialize(sample, {
      format: 'csv',
      filter: { contract: 'token' },
      includeFields: ['id', 'type'],
    });
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 token rows
  });
});

describe('export history', () => {
  it('saves and loads export records', async () => {
    await saveExportRecord({ id: 'e1', options: { format: 'csv', filter: {}, includeFields: ['id'] }, rowCount: 2, createdAt: Date.now(), status: 'done', payload: 'id\n1\n2' });
    const h = await loadExportHistory();
    expect(h).toHaveLength(1);
    expect(h[0].id).toBe('e1');
  });

  it('deletes a record by id', async () => {
    await saveExportRecord({ id: 'e2', options: { format: 'json', filter: {}, includeFields: ['id'] }, rowCount: 0, createdAt: Date.now(), status: 'done', payload: '[]' });
    await deleteExportRecord('e2');
    expect(await loadExportHistory()).toHaveLength(0);
  });
});

describe('preferences', () => {
  it('returns defaults when nothing saved', async () => {
    const p = await loadPrefs();
    expect(p.defaultFormat).toBe('csv');
  });

  it('saves and merges prefs', async () => {
    await savePrefs({ defaultFormat: 'json' });
    const p = await loadPrefs();
    expect(p.defaultFormat).toBe('json');
    expect(p.defaultTemplate).toBe('default'); // unchanged
  });
});

describe('analytics', () => {
  it('tracks exports and increments counters', async () => {
    await trackExport('csv');
    await trackExport('csv');
    await trackExport('pdf');
    const a = await loadAnalytics();
    expect(a.totalExports).toBe(3);
    expect(a.byFormat.csv).toBe(2);
    expect(a.byFormat.pdf).toBe(1);
    expect(a.lastExportAt).not.toBeNull();
  });
});
