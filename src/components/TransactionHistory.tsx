import React, { useState, useMemo, useCallback } from 'react';
import type { CachedTransaction, TransactionType, TransactionStatus } from '../services/storage/types';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'timeline' | 'list' | 'analytics';
type GroupBy = 'none' | 'date' | 'type' | 'status';
type SortField = 'createdAt' | 'type' | 'status';
type SortDir = 'asc' | 'desc';

interface Filters {
  search: string;
  types: TransactionType[];
  statuses: TransactionStatus[];
  dateFrom: string;
  dateTo: string;
}

interface Props {
  transactions: CachedTransaction[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_TYPES: TransactionType[] = ['transfer', 'mint', 'burn', 'approve', 'escrow_fund', 'escrow_release', 'escrow_refund'];
const ALL_STATUSES: TransactionStatus[] = ['pending', 'syncing', 'synced', 'failed', 'conflict'];

const STATUS_COLOR: Record<TransactionStatus, string> = {
  pending:  '#f59e0b',
  syncing:  '#6366f1',
  synced:   '#22c55e',
  failed:   '#ef4444',
  conflict: '#f97316',
};

const TYPE_ICON: Record<TransactionType, string> = {
  transfer:        '💸',
  mint:            '🪙',
  burn:            '🔥',
  approve:         '✅',
  escrow_fund:     '🔒',
  escrow_release:  '🔓',
  escrow_refund:   '↩️',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString();
}

function fmtDay(ts: number) {
  return new Date(ts).toLocaleDateString();
}

function exportCSV(txs: CachedTransaction[]) {
  const header = 'ID,Type,Status,Contract,Method,Created,Synced,Retries,Error';
  const rows = txs.map((t) =>
    [
      t.id, t.type, t.status, t.contractId, t.method,
      fmtDate(t.createdAt),
      t.syncedAt ? fmtDate(t.syncedAt) : '',
      t.retryCount,
      t.error ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(txs: CachedTransaction[]) {
  const blob = new Blob([JSON.stringify(txs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ───────────────────────────────────────────────────────────

export function TransactionHistory({ transactions }: Props): JSX.Element {
  const [view, setView] = useState<ViewMode>('timeline');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<CachedTransaction | null>(null);
  // tags: txId → string[]
  const [tags, setTags] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('fidelis-tx-tags') ?? '{}'); } catch { return {}; }
  });
  const [filters, setFilters] = useState<Filters>({
    search: '',
    types: [],
    statuses: [],
    dateFrom: '',
    dateTo: '',
  });

  const saveTags = useCallback((next: Record<string, string[]>) => {
    setTags(next);
    localStorage.setItem('fidelis-tx-tags', JSON.stringify(next));
  }, []);

  const addTag = useCallback((txId: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    saveTags({ ...tags, [txId]: [...new Set([...(tags[txId] ?? []), trimmed])] });
  }, [tags, saveTags]);

  const removeTag = useCallback((txId: string, tag: string) => {
    saveTags({ ...tags, [txId]: (tags[txId] ?? []).filter(t => t !== tag) });
  }, [tags, saveTags]);

  // ── Filtering + sorting ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...transactions];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          t.contractId.toLowerCase().includes(q) ||
          t.method.toLowerCase().includes(q) ||
          (t.error ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.types.length) result = result.filter((t) => filters.types.includes(t.type));
    if (filters.statuses.length) result = result.filter((t) => filters.statuses.includes(t.status));
    if (filters.dateFrom) result = result.filter((t) => t.createdAt >= new Date(filters.dateFrom).getTime());
    if (filters.dateTo)   result = result.filter((t) => t.createdAt <= new Date(filters.dateTo).getTime() + 86_399_999);

    result.sort((a, b) => {
      let diff = 0;
      if (sortField === 'createdAt') diff = a.createdAt - b.createdAt;
      else if (sortField === 'type') diff = a.type.localeCompare(b.type);
      else if (sortField === 'status') diff = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? diff : -diff;
    });

    return result;
  }, [transactions, filters, sortField, sortDir]);

  // ── Grouping ─────────────────────────────────────────────────────────────

  const grouped = useMemo<[string, CachedTransaction[]][]>(() => {
    if (groupBy === 'none') return [['All', filtered]];
    const map = new Map<string, CachedTransaction[]>();
    for (const t of filtered) {
      const key =
        groupBy === 'date'   ? fmtDay(t.createdAt) :
        groupBy === 'type'   ? t.type :
        /* status */           t.status;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<TransactionStatus, number>;
    const byType   = Object.fromEntries(ALL_TYPES.map((t) => [t, 0]))   as Record<TransactionType, number>;
    for (const t of transactions) {
      byStatus[t.status]++;
      byType[t.type]++;
    }
    return { byStatus, byType, total: transactions.length };
  }, [transactions]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleFilter = useCallback(<K extends 'types' | 'statuses'>(
    key: K,
    value: K extends 'types' ? TransactionType : TransactionStatus,
  ) => {
    setFilters((f) => {
      const arr = f[key] as string[];
      return {
        ...f,
        [key]: arr.includes(value as string)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Transaction History</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => exportCSV(filtered)}>⬇ CSV</Btn>
          <Btn onClick={() => exportJSON(filtered)}>⬇ JSON</Btn>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatChip label="Total" value={stats.total} color="#6366f1" />
        {ALL_STATUSES.map((s) => stats.byStatus[s] > 0 && (
          <StatChip key={s} label={s} value={stats.byStatus[s]} color={STATUS_COLOR[s]} />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
        {/* Search */}
        <input
          aria-label="Search transactions"
          placeholder="🔍 Search…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          style={inputStyle}
        />

        {/* Date range */}
        <label style={labelStyle}>
          From
          <input type="date" value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            style={inputStyle} />
        </label>
        <label style={labelStyle}>
          To
          <input type="date" value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            style={inputStyle} />
        </label>

        {/* Group by */}
        <label style={labelStyle}>
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} style={inputStyle}>
            <option value="none">None</option>
            <option value="date">Date</option>
            <option value="type">Type</option>
            <option value="status">Status</option>
          </select>
        </label>

        {/* View toggle */}
        <div role="group" aria-label="View mode" style={{ display: 'flex', gap: 4 }}>
          {(['timeline', 'list', 'analytics'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              aria-pressed={view === v}
              style={{ ...btnBase, background: view === v ? '#6366f1' : '#e5e7eb', color: view === v ? '#fff' : '#111' }}>
              {v === 'timeline' ? '⏱ Timeline' : v === 'list' ? '☰ List' : '📊 Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter chips */}
      <div role="group" aria-label="Filter by type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {ALL_TYPES.map((t) => (
          <button key={t} onClick={() => toggleFilter('types', t)}
            aria-pressed={filters.types.includes(t)}
            style={{ ...chipBase, background: filters.types.includes(t) ? '#ddd6fe' : '#f3f4f6', color: filters.types.includes(t) ? '#4f46e5' : '#374151' }}>
            {TYPE_ICON[t]} {t}
          </button>
        ))}
      </div>

      {/* Status filter chips */}
      <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => toggleFilter('statuses', s)}
            aria-pressed={filters.statuses.includes(s)}
            style={{ ...chipBase, background: filters.statuses.includes(s) ? STATUS_COLOR[s] + '33' : '#f3f4f6', color: filters.statuses.includes(s) ? STATUS_COLOR[s] : '#374151', borderColor: filters.statuses.includes(s) ? STATUS_COLOR[s] : 'transparent' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        Showing {filtered.length} of {transactions.length} transactions
      </p>

      {/* Content */}
      {view === 'analytics' ? (
        <AnalyticsView transactions={transactions} filtered={filtered} />
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>No transactions match your filters.</p>
      ) : (
        grouped.map(([group, txs]) => (
          <section key={group} aria-label={`Group: ${group}`} style={{ marginBottom: 24 }}>
            {groupBy !== 'none' && (
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {group} <span style={{ fontWeight: 400 }}>({txs.length})</span>
              </h3>
            )}
            {view === 'timeline'
              ? <TimelineView txs={txs} onSelect={setSelected} selected={selected} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              : <ListView txs={txs} onSelect={setSelected} selected={selected} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
            }
          </section>
        ))
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel tx={selected} onClose={() => setSelected(null)} tags={tags[selected.id] ?? []} onAddTag={(t) => addTag(selected.id, t)} onRemoveTag={(t) => removeTag(selected.id, t)} />
      )}
    </div>
  );
}

// ── Timeline view ────────────────────────────────────────────────────────────

function TimelineView({ txs, onSelect, selected, sortField, sortDir, toggleSort }: {
  txs: CachedTransaction[];
  onSelect: (t: CachedTransaction) => void;
  selected: CachedTransaction | null;
  sortField: SortField; sortDir: SortDir;
  toggleSort: (f: SortField) => void;
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} aria-hidden />
      {txs.map((tx, i) => (
        <div key={tx.id} style={{ position: 'relative', marginBottom: 16 }}>
          {/* Dot */}
          <div style={{
            position: 'absolute', left: -21, top: 12,
            width: 12, height: 12, borderRadius: '50%',
            background: STATUS_COLOR[tx.status],
            border: '2px solid #fff',
            boxShadow: '0 0 0 2px ' + STATUS_COLOR[tx.status] + '44',
          }} aria-hidden />
          <TxCard tx={tx} onSelect={onSelect} isSelected={selected?.id === tx.id} />
        </div>
      ))}
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({ txs, onSelect, selected, sortField, sortDir, toggleSort }: {
  txs: CachedTransaction[];
  onSelect: (t: CachedTransaction) => void;
  selected: CachedTransaction | null;
  sortField: SortField; sortDir: SortDir;
  toggleSort: (f: SortField) => void;
}) {
  const arrow = (f: SortField) => sortField === f ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {([['createdAt', 'Date'], ['type', 'Type'], ['status', 'Status']] as [SortField, string][]).map(([f, label]) => (
              <th key={f} onClick={() => toggleSort(f)}
                style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                {label}{arrow(f)}
              </th>
            ))}
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Contract</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Method</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Retries</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => (
            <tr key={tx.id}
              onClick={() => onSelect(tx)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(tx)}
              aria-selected={selected?.id === tx.id}
              style={{
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                background: selected?.id === tx.id ? '#ede9fe' : 'transparent',
              }}>
              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(tx.createdAt)}</td>
              <td style={{ padding: '8px 12px' }}>{TYPE_ICON[tx.type]} {tx.type}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ color: STATUS_COLOR[tx.status], fontWeight: 600 }}>{tx.status}</span>
              </td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{tx.contractId.slice(0, 12)}…</td>
              <td style={{ padding: '8px 12px' }}>{tx.method}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{tx.retryCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Transaction card (timeline) ──────────────────────────────────────────────

function TxCard({ tx, onSelect, isSelected }: { tx: CachedTransaction; onSelect: (t: CachedTransaction) => void; isSelected: boolean }) {
  return (
    <button
      onClick={() => onSelect(tx)}
      aria-expanded={isSelected}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '10px 14px', borderRadius: 8,
        border: `1px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
        background: isSelected ? '#ede9fe' : '#fff',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
      <span style={{ fontSize: 20 }} aria-hidden>{TYPE_ICON[tx.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{tx.type}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(tx.createdAt)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {tx.method} · <span style={{ fontFamily: 'monospace' }}>{tx.contractId.slice(0, 16)}…</span>
        </div>
        {tx.error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>⚠ {tx.error}</div>}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[tx.status], whiteSpace: 'nowrap' }}>
        {tx.status}
      </span>
    </button>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ tx, onClose, tags, onAddTag, onRemoveTag }: {
  tx: CachedTransaction;
  onClose: () => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState('');

  const downloadReceipt = () => {
    const lines = [
      '=== TRANSACTION RECEIPT ===',
      `ID:       ${tx.id}`,
      `Type:     ${tx.type}`,
      `Status:   ${tx.status}`,
      `Contract: ${tx.contractId}`,
      `Method:   ${tx.method}`,
      `Created:  ${fmtDate(tx.createdAt)}`,
      `Synced:   ${tx.syncedAt ? fmtDate(tx.syncedAt) : '—'}`,
      `Retries:  ${tx.retryCount}`,
      tx.error ? `Error:    ${tx.error}` : '',
      '',
      'Parameters:',
      JSON.stringify(tx.params, null, 2),
      '',
      `Tags: ${tags.join(', ') || 'none'}`,
      '===========================',
    ].filter(l => l !== undefined);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${tx.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div role="dialog" aria-label="Transaction details"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 640, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{TYPE_ICON[tx.type]} {tx.type}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadReceipt} style={{ ...btnBase, fontSize: 12 }} title="Download receipt">🧾 Receipt</button>
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Flow diagram */}
        <FlowDiagram tx={tx} />

        {/* Details */}
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginTop: 16 }}>
          {[
            ['ID', tx.id],
            ['Status', tx.status],
            ['Contract', tx.contractId],
            ['Method', tx.method],
            ['Created', fmtDate(tx.createdAt)],
            ['Synced', tx.syncedAt ? fmtDate(tx.syncedAt) : '—'],
            ['Retries', String(tx.retryCount)],
            ['Error', tx.error ?? '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt style={{ color: '#6b7280', marginBottom: 2 }}>{k}</dt>
              <dd style={{ margin: 0, fontWeight: 500, wordBreak: 'break-all' }}>{v}</dd>
            </div>
          ))}
        </dl>

        {/* Tags */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 13, marginBottom: 8 }}>Tags</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {tags.map(tag => (
              <span key={tag} style={{ ...chipBase, background: '#dbeafe', color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {tag}
                <button onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: '#1d4ed8' }}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onAddTag(tagInput); setTagInput(''); } }}
              placeholder="Add tag…"
              aria-label="New tag"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button style={btnBase} onClick={() => { onAddTag(tagInput); setTagInput(''); }}>Add</button>
          </div>
        </div>

        {/* Params */}
        {Object.keys(tx.params).length > 0 && (
          <>
            <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 13 }}>Parameters</h4>
            <pre style={{ background: '#f9fafb', borderRadius: 6, padding: 10, fontSize: 11, overflowX: 'auto' }}>
              {JSON.stringify(tx.params, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

// ── Flow diagram ─────────────────────────────────────────────────────────────

function FlowDiagram({ tx }: { tx: CachedTransaction }) {
  const steps: { label: string; done: boolean; active: boolean }[] = [
    { label: 'Created',   done: true,                          active: tx.status === 'pending' },
    { label: 'Submitted', done: !!tx.submittedAt,              active: tx.status === 'syncing' },
    { label: 'Synced',    done: tx.status === 'synced',        active: false },
  ];

  return (
    <div role="img" aria-label={`Transaction flow: ${steps.map((s) => s.label).join(' → ')}`}
      style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div style={{ textAlign: 'center', minWidth: 72 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
              background: step.done ? '#22c55e' : step.active ? '#6366f1' : '#e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: step.done || step.active ? '#fff' : '#9ca3af', fontSize: 14,
            }}>
              {step.done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 11, color: step.active ? '#6366f1' : '#6b7280' }}>{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: steps[i + 1].done ? '#22c55e' : '#e5e7eb', marginBottom: 16 }} aria-hidden />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Analytics view ────────────────────────────────────────────────────────────

function AnalyticsView({ transactions, filtered }: { transactions: CachedTransaction[]; filtered: CachedTransaction[] }) {
  // Volume over last 14 days
  const volumeData = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86_400_000;
      days.push({ label, count: transactions.filter(t => t.createdAt >= start && t.createdAt < end).length });
    }
    return days;
  }, [transactions]);

  const maxVol = Math.max(...volumeData.map(d => d.count), 1);

  // Type breakdown
  const typeBreakdown = useMemo(() =>
    ALL_TYPES.map(t => ({ type: t, count: transactions.filter(tx => tx.type === t).length }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count),
    [transactions]);

  const maxType = Math.max(...typeBreakdown.map(d => d.count), 1);

  // Portfolio insights
  const insights = useMemo(() => {
    const total = transactions.length;
    const synced = transactions.filter(t => t.status === 'synced').length;
    const failed = transactions.filter(t => t.status === 'failed').length;
    const avgRetries = total ? (transactions.reduce((s, t) => s + t.retryCount, 0) / total).toFixed(1) : '0';
    const byDay = new Map<string, number>();
    transactions.forEach(t => {
      const d = fmtDay(t.createdAt);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    });
    const busiestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, synced, failed, successRate: total ? ((synced / total) * 100).toFixed(1) : '0', avgRetries, busiestDay };
  }, [transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Portfolio insights */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Portfolio Insights</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Transactions', value: insights.total, color: '#6366f1' },
            { label: 'Success Rate', value: `${insights.successRate}%`, color: '#22c55e' },
            { label: 'Failed', value: insights.failed, color: '#ef4444' },
            { label: 'Avg Retries', value: insights.avgRetries, color: '#f59e0b' },
            { label: 'Busiest Day', value: insights.busiestDay ? `${insights.busiestDay[0]} (${insights.busiestDay[1]})` : '—', color: '#8b5cf6' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px 16px', borderRadius: 10, background: color + '12', border: `1px solid ${color}33`, minWidth: 140 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Volume trend — SVG bar chart */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Transaction Volume (Last 14 Days)
        </h3>
        <svg viewBox="0 0 560 120" style={{ width: '100%', maxWidth: 700, height: 120, display: 'block' }} role="img" aria-label="Transaction volume bar chart">
          {volumeData.map((d, i) => {
            const barH = maxVol > 0 ? (d.count / maxVol) * 80 : 0;
            const x = i * 40 + 4;
            return (
              <g key={d.label}>
                <rect x={x} y={100 - barH} width={32} height={barH} rx={3} fill="#6366f1" opacity={0.8} />
                <text x={x + 16} y={115} textAnchor="middle" fontSize={8} fill="#9ca3af">{d.label.split(' ')[1]}</text>
                {d.count > 0 && <text x={x + 16} y={96 - barH} textAnchor="middle" fontSize={9} fill="#6366f1">{d.count}</text>}
              </g>
            );
          })}
        </svg>
      </section>

      {/* Type breakdown — horizontal bars */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          By Transaction Type
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {typeBreakdown.map(({ type, count }) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 120, fontSize: 12, color: '#374151' }}>{TYPE_ICON[type as TransactionType]} {type}</span>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                <div style={{ width: `${(count / maxType) * 100}%`, height: '100%', background: '#6366f1', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <span style={{ width: 28, fontSize: 12, fontWeight: 600, color: '#6366f1', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Status breakdown */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          By Status
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map(s => {
            const count = transactions.filter(t => t.status === s).length;
            if (!count) return null;
            const pct = ((count / insights.total) * 100).toFixed(0);
            return (
              <div key={s} style={{ padding: '10px 14px', borderRadius: 8, background: STATUS_COLOR[s] + '18', border: `1px solid ${STATUS_COLOR[s]}44`, minWidth: 100 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: STATUS_COLOR[s] }}>{count}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{s} ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '4px 10px', borderRadius: 20, background: color + '1a', border: `1px solid ${color}44`, fontSize: 12 }}>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
      <span style={{ color: '#6b7280', marginLeft: 4 }}>{label}</span>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={btnBase}>{children}</button>
  );
}

const btnBase: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 6, border: 'none',
  cursor: 'pointer', background: '#ede9fe', color: '#4f46e5',
  fontSize: 13, fontWeight: 500,
};

const chipBase: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 20, border: '1px solid transparent',
  cursor: 'pointer', fontSize: 12, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, display: 'block', marginTop: 2,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column',
};
