import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  getBuiltInABIs,
  parseCustomABI,
  validateParam,
  simulateTransaction,
  estimateGas,
  pollTransactionStatus,
} from '../services/contractInteraction';
import type {
  ContractABI,
  FunctionDef,
  SimulationResult,
  BatchItem,
  ParamDef,
  GasEstimate,
  TxStatusUpdate,
} from '../services/contractInteraction';
import { useTransactionQueue } from '../context/TransactionQueueContext';
import type { TransactionType } from '../services/storage/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function truncate(s: string, max = 20): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const CATEGORY_COLORS: Record<string, string> = {
  token:  'var(--color-highlight, #6366f1)',
  escrow: '#f59e0b',
  admin:  '#ef4444',
  query:  '#22c55e',
  other:  '#6b7280',
};

const STATUS_COLOR: Record<BatchItem['status'], string> = {
  queued: '#f59e0b', submitted: '#6366f1', done: '#22c55e', error: '#ef4444',
};

const TX_STATUS_ICON: Record<TxStatusUpdate['status'], string> = {
  pending: '⏳', success: '✅', failed: '❌', not_found: '❓',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    border: '1px solid var(--color-border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 10px)',
    padding: '16px',
    background: 'var(--color-bg-secondary, #fff)',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 'var(--radius-md, 6px)',
    border: '1px solid var(--color-border, #d1d5db)',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    background: 'var(--color-bg-tertiary, #f9fafb)',
    color: 'var(--color-text-primary, #111)',
    outline: 'none',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    color: 'var(--color-text-secondary, #6b7280)',
    marginBottom: '4px',
    fontWeight: 500,
  } as React.CSSProperties,
  error: {
    margin: '3px 0 0',
    fontSize: '11px',
    color: 'var(--color-error, #ef4444)',
  } as React.CSSProperties,
  primaryBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-md, 6px)',
    border: 'none',
    cursor: 'pointer',
    background: 'var(--color-highlight, #6366f1)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  secondaryBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-md, 6px)',
    border: '1px solid var(--color-border, #d1d5db)',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--color-text-primary, #374151)',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  ghostBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-highlight, #6366f1)',
    fontSize: '13px',
    padding: '0',
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
  } as React.CSSProperties),
  section: {
    marginBottom: '16px',
  } as React.CSSProperties,
};

// ── ArrayInput: handles vec/list parameters ───────────────────────────────────

function ArrayInput({ def, value, error, onChange }: {
  def: ParamDef; value: string; error?: string; onChange: (v: string) => void;
}) {
  const items: string[] = useMemo(() => {
    try { return JSON.parse(value) as string[]; } catch { return value ? [value] : []; }
  }, [value]);

  const update = (next: string[]) => onChange(JSON.stringify(next));

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            value={item}
            placeholder={def.placeholder ?? `Item ${i + 1}`}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; update(n); }}
            style={{ ...s.input, flex: 1 }}
            aria-label={`${def.label} item ${i + 1}`}
          />
          <button
            onClick={() => update(items.filter((_, j) => j !== i))}
            style={{ ...s.secondaryBtn, padding: '4px 10px', color: 'var(--color-error, #ef4444)' }}
            aria-label={`Remove item ${i + 1}`}
          >✕</button>
        </div>
      ))}
      <button
        onClick={() => update([...items, ''])}
        style={{ ...s.ghostBtn, fontSize: '12px' }}
      >+ Add item</button>
      {error && <p style={s.error} role="alert">{error}</p>}
    </div>
  );
}

// ── ParamInput: renders the right input for each param kind ───────────────────

function ParamInput({ def, value, error, onChange }: {
  def: ParamDef; value: string; error?: string; onChange: (v: string) => void;
}) {
  const inputId = `param-${def.name}`;
  const errorId = `${inputId}-err`;
  const hintId  = `${inputId}-hint`;
  const hasError = !!error;
  const describedBy = [hasError && errorId, def.hint && hintId].filter(Boolean).join(' ') || undefined;

  const inputStyle: React.CSSProperties = {
    ...s.input,
    borderColor: hasError ? 'var(--color-error, #ef4444)' : 'var(--color-border, #d1d5db)',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ marginBottom: '14px' }}>
      <label htmlFor={inputId} style={s.label}>
        {def.label}
        {def.required && <span style={{ color: 'var(--color-error, #ef4444)', marginLeft: 2 }}>*</span>}
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted, #9ca3af)', fontWeight: 400, marginLeft: 6 }}>
          ({def.kind})
        </span>
      </label>

      {def.kind === 'bool' ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          aria-describedby={describedBy}
          aria-invalid={hasError}
        >
          <option value="">Select…</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : def.kind === 'vec' ? (
        <ArrayInput def={def} value={value} error={error} onChange={onChange} />
      ) : def.kind === 'option' ? (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={value !== '' && value !== 'null'}
                onChange={(e) => onChange(e.target.checked ? '' : 'null')}
              />
              Set value
            </label>
          </div>
          {value !== 'null' && (
            <input
              id={inputId}
              type="text"
              placeholder={def.placeholder}
              value={value === 'null' ? '' : value}
              onChange={(e) => onChange(e.target.value)}
              style={inputStyle}
              aria-describedby={describedBy}
              aria-invalid={hasError}
            />
          )}
        </div>
      ) : (
        <input
          id={inputId}
          type={def.kind === 'amount' || def.kind === 'u32' ? 'number' : 'text'}
          placeholder={def.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          style={inputStyle}
          min={def.kind === 'amount' || def.kind === 'u32' ? '0' : undefined}
          step={def.kind === 'amount' || def.kind === 'u32' ? '1' : undefined}
        />
      )}

      {def.hint && !hasError && (
        <p id={hintId} style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-text-muted, #9ca3af)' }}>
          {def.hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" style={s.error}>{error}</p>
      )}
    </div>
  );
}

// ── GasEstimateBar ────────────────────────────────────────────────────────────

function GasEstimateBar({ estimate, loading }: { estimate: GasEstimate | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
        background: 'var(--color-bg-tertiary, #f9fafb)', border: '1px solid var(--color-border, #e5e7eb)', fontSize: 12 }}>
        <span className="spinner" style={{ width: 12, height: 12 }} />
        <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Estimating gas…</span>
      </div>
    );
  }
  if (!estimate) return null;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 6, fontSize: 12,
      background: 'var(--color-bg-tertiary, #f9fafb)', border: '1px solid var(--color-border, #e5e7eb)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary, #111)' }}>⛽ Gas Estimate</span>
        <span style={s.badge('#f59e0b')}>~{estimate.feeXLM} XLM</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 12px', color: 'var(--color-text-secondary, #6b7280)' }}>
        <span>Instructions</span><span>Read bytes</span><span>Write bytes</span>
        <strong style={{ color: 'var(--color-text-primary, #111)' }}>{formatNumber(estimate.instructions)}</strong>
        <strong style={{ color: 'var(--color-text-primary, #111)' }}>{formatNumber(estimate.readBytes)}</strong>
        <strong style={{ color: 'var(--color-text-primary, #111)' }}>{formatNumber(estimate.writeBytes)}</strong>
      </div>
      {estimate.isEstimate && (
        <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--color-text-muted, #9ca3af)' }}>
          * Estimate only — actual fee may vary slightly.
        </p>
      )}
    </div>
  );
}

// ── SimulationPanel ───────────────────────────────────────────────────────────

function SimulationPanel({ result }: { result: SimulationResult }) {
  const [showEvents, setShowEvents] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  const bg = result.success
    ? 'var(--color-success-bg, #f0fdf4)'
    : 'var(--color-error-bg, #fef2f2)';
  const border = result.success
    ? 'var(--color-success-border, #bbf7d0)'
    : 'var(--color-error-border, #fecaca)';

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: bg, border: `1px solid ${border}`, fontSize: 13 }}
      role="status" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{result.success ? '✅ Simulation succeeded' : '❌ Simulation failed'}</strong>
        {result.success && result.feeXLM && (
          <span style={s.badge('#6366f1')}>Fee: {result.feeXLM} XLM</span>
        )}
      </div>

      {result.error && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>Error: {result.errorCode}</p>
          <p style={{ margin: '4px 0 0', color: '#b91c1c' }}>{result.error}</p>
        </div>
      )}

      {result.success && (
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', margin: '10px 0 0' }}>
          {result.returnValue !== undefined && (
            <>
              <dt style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Return value</dt>
              <dd style={{ margin: 0, fontWeight: 600, fontFamily: 'monospace' }}>
                {result.returnValue}
                {result.returnType && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>({result.returnType})</span>}
              </dd>
            </>
          )}
          {result.gasUsed !== undefined && (
            <>
              <dt style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Gas used</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{formatNumber(result.gasUsed)}</dd>
            </>
          )}
          {result.feeStroops !== undefined && (
            <>
              <dt style={{ color: 'var(--color-text-secondary, #6b7280)' }}>Fee (stroops)</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{formatNumber(result.feeStroops)}</dd>
            </>
          )}
        </dl>
      )}

      {result.events && result.events.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowEvents(v => !v)} style={s.ghostBtn}>
            {showEvents ? '▲' : '▼'} {result.events.length} event{result.events.length !== 1 ? 's' : ''}
          </button>
          {showEvents && (
            <div style={{ marginTop: 6 }}>
              {result.events.map((ev, i) => (
                <div key={i} style={{ padding: '6px 8px', borderRadius: 4, background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: 4, fontSize: 11, fontFamily: 'monospace' }}>
                  <div><strong>type:</strong> {ev.type}</div>
                  <div><strong>topics:</strong> {ev.topics.join(', ')}</div>
                  <div><strong>data:</strong> {truncate(ev.data, 60)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result.ledgerChanges && result.ledgerChanges.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowLedger(v => !v)} style={s.ghostBtn}>
            {showLedger ? '▲' : '▼'} {result.ledgerChanges.length} ledger change{result.ledgerChanges.length !== 1 ? 's' : ''}
          </button>
          {showLedger && (
            <div style={{ marginTop: 6 }}>
              {result.ledgerChanges.map((ch, i) => (
                <div key={i} style={{ padding: '6px 8px', borderRadius: 4, background: '#fefce8', border: '1px solid #fde68a', marginBottom: 4, fontSize: 11, fontFamily: 'monospace' }}>
                  <span style={s.badge(ch.type === 'created' ? '#22c55e' : ch.type === 'deleted' ? '#ef4444' : '#f59e0b')}>
                    {ch.type}
                  </span>
                  <span style={{ marginLeft: 8 }}>{ch.key}</span>
                  {ch.before !== undefined && (
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>{ch.before} → {ch.after}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TxStatusTracker ───────────────────────────────────────────────────────────

function TxStatusTracker({ txHash, onDone }: { txHash: string; onDone: () => void }) {
  const [status, setStatus] = useState<TxStatusUpdate | null>(null);
  const [polls, setPolls] = useState(0);
  const maxPolls = 8;

  useEffect(() => {
    if (polls >= maxPolls || status?.status === 'success' || status?.status === 'failed') return;
    const timer = setTimeout(async () => {
      const update = await pollTransactionStatus(txHash);
      setStatus(update);
      setPolls(p => p + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [txHash, polls, status]);

  const current = status?.status ?? 'pending';
  const color = current === 'success' ? '#22c55e' : current === 'failed' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${color}44`, background: `${color}11`, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {current === 'pending' && <span className="spinner" style={{ width: 12, height: 12 }} />}
          <span style={{ fontWeight: 600, color }}>{TX_STATUS_ICON[current]} {current.toUpperCase()}</span>
          <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary, #6b7280)' }}>
            {truncate(txHash, 16)}
          </span>
        </div>
        {(current === 'success' || current === 'failed' || polls >= maxPolls) && (
          <button onClick={onDone} style={s.ghostBtn}>Dismiss</button>
        )}
      </div>
      {status?.ledger && (
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary, #6b7280)' }}>
          Ledger: {formatNumber(status.ledger)}
          {status.timestamp && ` · ${new Date(status.timestamp).toLocaleTimeString()}`}
        </p>
      )}
      {status?.errorMessage && (
        <p style={{ margin: '4px 0 0', color: '#ef4444' }}>{status.errorMessage}</p>
      )}
      {current === 'pending' && polls < maxPolls && (
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted, #9ca3af)' }}>
          Polling… ({polls}/{maxPolls})
        </p>
      )}
    </div>
  );
}

// ── TransactionPreviewModal ───────────────────────────────────────────────────

function TransactionPreviewModal({
  fn, params, contractId, onConfirm, onCancel, simResult,
}: {
  fn: FunctionDef;
  params: Record<string, string>;
  contractId: string;
  onConfirm: () => void;
  onCancel: () => void;
  simResult: SimulationResult | null;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div style={{ ...s.card, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 id="preview-title" style={{ margin: '0 0 16px', fontSize: 16 }}>
          {fn.icon} Confirm Transaction
        </h3>

        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-text-secondary, #6b7280)' }}>Function</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{fn.label}</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-text-secondary, #6b7280)' }}>Contract</p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{contractId}</p>
        </div>

        {Object.keys(params).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-text-secondary, #6b7280)' }}>Parameters</p>
            <div style={{ borderRadius: 6, border: '1px solid var(--color-border, #e5e7eb)', overflow: 'hidden' }}>
              {Object.entries(params).map(([k, v], i) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: 12,
                  background: i % 2 === 0 ? 'var(--color-bg-tertiary, #f9fafb)' : 'transparent',
                }}>
                  <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {simResult?.feeXLM && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', marginBottom: 12, fontSize: 12 }}>
            <strong>⛽ Estimated fee:</strong> {simResult.feeXLM} XLM ({simResult.feeStroops?.toLocaleString()} stroops)
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={s.secondaryBtn}>Cancel</button>
          <button onClick={onConfirm} style={s.primaryBtn}>🚀 Confirm & Submit</button>
        </div>
      </div>
    </div>
  );
}

// ── FunctionList ──────────────────────────────────────────────────────────────

function FunctionList({
  functions, selected, onSelect,
}: {
  functions: FunctionDef[];
  selected: FunctionDef;
  onSelect: (fn: FunctionDef) => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = functions.filter(fn =>
    fn.label.toLowerCase().includes(filter.toLowerCase()) ||
    fn.name.toLowerCase().includes(filter.toLowerCase())
  );

  const grouped = useMemo(() => {
    const map: Record<string, FunctionDef[]> = {};
    for (const fn of filtered) {
      const cat = fn.category ?? 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(fn);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <input
        type="search"
        placeholder="Filter functions…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ ...s.input, marginBottom: 8 }}
        aria-label="Filter contract functions"
      />
      <nav aria-label="Contract functions" style={{ border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 8, overflow: 'hidden' }}>
        {Object.entries(grouped).map(([cat, fns]) => (
          <div key={cat}>
            <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: CATEGORY_COLORS[cat] ?? '#6b7280',
              background: 'var(--color-bg-tertiary, #f9fafb)', borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
              {cat}
            </div>
            {fns.map(fn => {
              const isActive = selected.name === fn.name;
              return (
                <button
                  key={fn.name}
                  onClick={() => onSelect(fn)}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '9px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: isActive ? `${CATEGORY_COLORS[fn.category ?? 'other']}18` : 'transparent',
                    borderLeft: `3px solid ${isActive ? (CATEGORY_COLORS[fn.category ?? 'other'] ?? '#6366f1') : 'transparent'}`,
                    fontSize: 13, color: 'var(--color-text-primary, #111)',
                    borderBottom: '1px solid var(--color-border, #e5e7eb)',
                  }}
                >
                  <span aria-hidden>{fn.icon}</span>
                  <span style={{ flex: 1 }}>{fn.label}</span>
                  {fn.readOnly && (
                    <span style={s.badge('#22c55e')}>view</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-muted, #9ca3af)', textAlign: 'center' }}>
            No functions match "{filter}"
          </p>
        )}
      </nav>
    </div>
  );
}

// ── BatchQueue ────────────────────────────────────────────────────────────────

function BatchQueue({
  batch, running,
  onRun, onClear, onRemove,
}: {
  batch: BatchItem[];
  running: boolean;
  onRun: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}) {
  if (batch.length === 0) return null;
  const done = batch.filter(i => i.status === 'done').length;
  const errors = batch.filter(i => i.status === 'error').length;

  return (
    <div style={{ ...s.card, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Batch Queue ({batch.length})</h3>
          {running && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary, #6b7280)' }}>
              {done} done · {errors} errors
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onRun} disabled={running} style={s.primaryBtn}>
            {running ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Running…</> : '▶ Run All'}
          </button>
          <button onClick={onClear} disabled={running} style={s.secondaryBtn}>Clear</button>
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border, #e5e7eb)', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: errors > 0 ? '#ef4444' : 'var(--color-highlight, #6366f1)',
            width: `${(done + errors) / batch.length * 100}%`,
            transition: 'width 0.3s',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {batch.map((item) => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 6,
            background: 'var(--color-bg-tertiary, #f9fafb)',
            border: `1px solid ${STATUS_COLOR[item.status]}44`,
          }}>
            <span style={{ fontSize: 16 }} aria-hidden>{item.fn.icon}</span>
            <div style={{ flex: 1, fontSize: 12 }}>
              <strong>{item.fn.label}</strong>
              <span style={{ color: 'var(--color-text-secondary, #6b7280)', marginLeft: 8 }}>
                {Object.entries(item.params).map(([k, v]) => `${k}=${truncate(v, 12)}`).join(', ')}
              </span>
              {item.error && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠ {item.error}</span>}
              {item.txHash && <span style={{ color: '#22c55e', marginLeft: 8, fontFamily: 'monospace' }}>✓ {truncate(item.txHash, 12)}</span>}
            </div>
            <span style={{ ...s.badge(STATUS_COLOR[item.status]), minWidth: 60, textAlign: 'center' }}>
              {item.status}
            </span>
            {item.status === 'queued' && (
              <button onClick={() => onRemove(item.id)} aria-label="Remove from batch"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted, #9ca3af)', fontSize: 14 }}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ContractInteractionUI component ──────────────────────────────────────

export function ContractInteractionUI(): JSX.Element {
  const { createTransaction } = useTransactionQueue();

  // ABI state
  const builtIn = useMemo(() => getBuiltInABIs(), []);
  const [selectedABI, setSelectedABI] = useState<ContractABI>(builtIn[0]);
  const [customJSON, setCustomJSON] = useState('');
  const [customError, setCustomError] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [contractId, setContractId] = useState('');

  // Function + params
  const [selectedFn, setSelectedFn] = useState<FunctionDef>(builtIn[0].functions[0]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});

  // Simulation
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Gas estimate
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const gasDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Tx status tracking
  const [trackedTxHashes, setTrackedTxHashes] = useState<string[]>([]);

  // Batch
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  // Docs
  const [showDocs, setShowDocs] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const effectiveContractId = contractId || selectedABI.contractId;

  // ── Gas estimation debounce ────────────────────────────────────────────────

  useEffect(() => {
    if (selectedFn.readOnly) { setGasEstimate(null); return; }
    if (gasDebounceRef.current) clearTimeout(gasDebounceRef.current);
    gasDebounceRef.current = setTimeout(async () => {
      setGasLoading(true);
      const est = await estimateGas(effectiveContractId, selectedFn.name, paramValues);
      setGasEstimate(est);
      setGasLoading(false);
    }, 600);
    return () => { if (gasDebounceRef.current) clearTimeout(gasDebounceRef.current); };
  }, [selectedFn, paramValues, effectiveContractId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const loadCustomABI = useCallback(() => {
    const abi = parseCustomABI(customJSON);
    if (!abi) { setCustomError('Invalid ABI JSON. Expected an array of FunctionDef objects.'); return; }
    setCustomError('');
    setSelectedABI(abi);
    setSelectedFn(abi.functions[0]);
    setParamValues({});
    setSimResult(null);
    setShowCustom(false);
  }, [customJSON]);

  const selectFn = useCallback((fn: FunctionDef) => {
    setSelectedFn(fn);
    setParamValues({});
    setParamErrors({});
    setSimResult(null);
    setGasEstimate(null);
    setShowDocs(false);
  }, []);

  const setParam = useCallback((name: string, value: string) => {
    setParamValues(v => ({ ...v, [name]: value }));
    setParamErrors(e => ({ ...e, [name]: '' }));
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    for (const p of selectedFn.params) {
      const err = validateParam(paramValues[p.name] ?? '', p);
      if (err) errors[p.name] = err;
    }
    setParamErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedFn, paramValues]);

  const handleSimulate = useCallback(async () => {
    if (!validate()) return;
    setSimLoading(true);
    setSimResult(null);
    const result = await simulateTransaction(effectiveContractId, selectedFn.name, paramValues);
    setSimResult(result);
    setSimLoading(false);
  }, [validate, effectiveContractId, selectedFn, paramValues]);

  const handleSubmitConfirmed = useCallback(async () => {
    setShowPreview(false);
    const mockTxHash = `tx-${uid()}`;
    await createTransaction(
      selectedFn.name as TransactionType,
      effectiveContractId,
      selectedFn.name,
      { ...paramValues },
    );
    setTrackedTxHashes(h => [...h, mockTxHash]);
    setParamValues({});
    setSimResult(null);
  }, [selectedFn, effectiveContractId, paramValues, createTransaction]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    setShowPreview(true);
  }, [validate]);

  const addToBatch = useCallback(() => {
    if (!validate()) return;
    setBatch(b => [...b, { id: uid(), fn: selectedFn, params: { ...paramValues }, status: 'queued' }]);
    setParamValues({});
    setSimResult(null);
  }, [validate, selectedFn, paramValues]);

  const runBatch = useCallback(async () => {
    if (!batch.length) return;
    setBatchRunning(true);
    for (const item of batch) {
      setBatch(b => b.map(i => i.id === item.id ? { ...i, status: 'submitted' } : i));
      try {
        await createTransaction(
          item.fn.name as TransactionType,
          effectiveContractId,
          item.fn.name,
          { ...item.params },
        );
        const txHash = `tx-${uid()}`;
        setBatch(b => b.map(i => i.id === item.id ? { ...i, status: 'done', txHash } : i));
      } catch (e) {
        setBatch(b => b.map(i => i.id === item.id ? { ...i, status: 'error', error: String(e) } : i));
      }
    }
    setBatchRunning(false);
  }, [batch, effectiveContractId, createTransaction]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>⚙️ Contract Interaction</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary, #6b7280)' }}>
          Discover, call, and monitor Soroban smart contract functions.
        </p>
      </div>

      {/* Tx status trackers */}
      {trackedTxHashes.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trackedTxHashes.map(hash => (
            <TxStatusTracker
              key={hash}
              txHash={hash}
              onDone={() => setTrackedTxHashes(h => h.filter(x => x !== hash))}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left sidebar ── */}
        <aside>
          {/* ABI selector */}
          <div style={{ ...s.card, marginBottom: 10 }}>
            <label style={s.label}>
              Contract ABI
              <select
                value={selectedABI.contractId}
                onChange={e => {
                  const abi = builtIn.find(a => a.contractId === e.target.value);
                  if (abi) { setSelectedABI(abi); selectFn(abi.functions[0]); }
                }}
                style={{ ...s.input, marginTop: 4 }}
              >
                {builtIn.map(a => <option key={a.contractId} value={a.contractId}>{a.name}</option>)}
              </select>
            </label>
            <button onClick={() => setShowCustom(v => !v)} style={{ ...s.ghostBtn, marginTop: 8, fontSize: 12 }}>
              {showCustom ? '▲ Hide' : '+ Custom ABI'}
            </button>
            {showCustom && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  rows={5}
                  placeholder='[{"name":"fn","label":"Fn","icon":"⚙️","estimatedFee":"0.00001","params":[...]}]'
                  value={customJSON}
                  onChange={e => setCustomJSON(e.target.value)}
                  style={{ ...s.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                  aria-label="Custom ABI JSON"
                />
                {customError && <p style={s.error}>{customError}</p>}
                <button onClick={loadCustomABI} style={{ ...s.primaryBtn, marginTop: 6, width: '100%', justifyContent: 'center' }}>
                  Load ABI
                </button>
              </div>
            )}
          </div>

          {/* Contract ID */}
          <div style={{ ...s.card, marginBottom: 10 }}>
            <label style={s.label}>
              Contract ID (override)
              <input
                placeholder={selectedABI.contractId}
                value={contractId}
                onChange={e => setContractId(e.target.value)}
                style={{ ...s.input, marginTop: 4 }}
                aria-label="Contract ID override"
              />
            </label>
          </div>

          {/* Function list */}
          <FunctionList
            functions={selectedABI.functions}
            selected={selectedFn}
            onSelect={selectFn}
          />
        </aside>

        {/* ── Main panel ── */}
        <main>
          <div style={s.card}>
            {/* Function header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{selectedFn.icon} {selectedFn.label}</h3>
                  {selectedFn.readOnly && <span style={s.badge('#22c55e')}>view</span>}
                  {selectedFn.category && (
                    <span style={s.badge(CATEGORY_COLORS[selectedFn.category] ?? '#6b7280')}>
                      {selectedFn.category}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary, #6b7280)' }}>
                  {selectedFn.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {selectedFn.docs && (
                  <button onClick={() => setShowDocs(v => !v)} style={s.ghostBtn}>
                    {showDocs ? '▲ Docs' : '📖 Docs'}
                  </button>
                )}
              </div>
            </div>

            {/* Docs */}
            {showDocs && selectedFn.docs && (
              <div style={{ padding: '10px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                {selectedFn.docs}
              </div>
            )}

            {/* Params */}
            {selectedFn.params.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted, #9ca3af)', fontSize: 13 }}>No parameters required.</p>
            ) : (
              <div style={{ marginBottom: 4 }}>
                {selectedFn.params.map(p => (
                  <ParamInput
                    key={p.name}
                    def={p}
                    value={paramValues[p.name] ?? ''}
                    error={paramErrors[p.name]}
                    onChange={v => setParam(p.name, v)}
                  />
                ))}
              </div>
            )}

            {/* Gas estimate */}
            {!selectedFn.readOnly && (
              <div style={{ marginBottom: 12 }}>
                <GasEstimateBar estimate={gasEstimate} loading={gasLoading} />
              </div>
            )}

            {/* Simulation result */}
            {simResult && <SimulationPanel result={simResult} />}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button onClick={handleSimulate} disabled={simLoading} style={s.secondaryBtn}>
                {simLoading
                  ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Simulating…</>
                  : '🔍 Simulate'}
              </button>
              {!selectedFn.readOnly && (
                <>
                  <button onClick={handleSubmit} style={s.primaryBtn}>
                    🚀 Submit
                  </button>
                  <button onClick={addToBatch} style={s.secondaryBtn}>
                    + Add to Batch
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Batch queue */}
          <BatchQueue
            batch={batch}
            running={batchRunning}
            onRun={runBatch}
            onClear={() => setBatch([])}
            onRemove={id => setBatch(b => b.filter(i => i.id !== id))}
          />
        </main>
      </div>

      {/* Transaction preview modal */}
      {showPreview && (
        <TransactionPreviewModal
          fn={selectedFn}
          params={paramValues}
          contractId={effectiveContractId}
          simResult={simResult}
          onConfirm={handleSubmitConfirmed}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
