import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TransactionType } from '../services/storage/types';
import { useTransactionQueue } from '../context/TransactionQueueContext';

// ─── ABI / Schema ─────────────────────────────────────────────────────────────

type ParamType = 'address' | 'amount' | 'string' | 'u32' | 'bool' | 'array' | 'bytes';

interface ParamDef {
  name: string;
  type: ParamType;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  itemType?: ParamType; // for array
}

interface FunctionDef {
  type: TransactionType;
  label: string;
  icon: string;
  description: string;
  estimatedFee: string; // in XLM
  params: ParamDef[];
}

const CONTRACT_ABI: FunctionDef[] = [
  {
    type: 'transfer',
    label: 'Transfer',
    icon: '↑',
    description: 'Send tokens to another address.',
    estimatedFee: '0.00001',
    params: [
      { name: 'to', type: 'address', label: 'Recipient Address', placeholder: 'G...', hint: 'Stellar public key (56 chars)', required: true },
      { name: 'amount', type: 'amount', label: 'Amount (stroops)', placeholder: '10000000', hint: '1 token = 10,000,000 stroops', required: true },
    ],
  },
  {
    type: 'mint',
    label: 'Mint',
    icon: '✦',
    description: 'Create new tokens (admin only).',
    estimatedFee: '0.00001',
    params: [
      { name: 'to', type: 'address', label: 'Recipient Address', placeholder: 'G...', required: true },
      { name: 'amount', type: 'amount', label: 'Amount (stroops)', placeholder: '10000000', required: true },
    ],
  },
  {
    type: 'burn',
    label: 'Burn',
    icon: '✧',
    description: 'Destroy tokens from your balance.',
    estimatedFee: '0.00001',
    params: [
      { name: 'amount', type: 'amount', label: 'Amount (stroops)', placeholder: '10000000', required: true },
    ],
  },
  {
    type: 'approve',
    label: 'Approve',
    icon: '✓',
    description: 'Allow a spender to use tokens on your behalf.',
    estimatedFee: '0.00001',
    params: [
      { name: 'spender', type: 'address', label: 'Spender Address', placeholder: 'G...', required: true },
      { name: 'amount', type: 'amount', label: 'Allowance (stroops)', placeholder: '10000000', required: true },
      { name: 'expiration_ledger', type: 'u32', label: 'Expiration Ledger', placeholder: '1000000', hint: 'Ledger number when approval expires', required: true },
    ],
  },
  {
    type: 'escrow_fund',
    label: 'Fund Escrow',
    icon: '◈',
    description: 'Deposit tokens into an escrow contract.',
    estimatedFee: '0.00002',
    params: [
      { name: 'escrowId', type: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
      { name: 'amount', type: 'amount', label: 'Amount (stroops)', placeholder: '10000000', required: true },
    ],
  },
  {
    type: 'escrow_release',
    label: 'Release Escrow',
    icon: '◉',
    description: 'Release escrowed funds to the seller.',
    estimatedFee: '0.00001',
    params: [
      { name: 'escrowId', type: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
    ],
  },
  {
    type: 'escrow_refund',
    label: 'Refund Escrow',
    icon: '↺',
    description: 'Refund escrowed funds back to the buyer.',
    estimatedFee: '0.00001',
    params: [
      { name: 'escrowId', type: 'string', label: 'Escrow Contract ID', placeholder: 'C...', required: true },
    ],
  },
];

// ─── Validation ───────────────────────────────────────────────────────────────

function validateParam(value: string, def: ParamDef): string | null {
  if (def.required && !value.trim()) return `${def.label} is required.`;
  if (!value.trim()) return null;

  switch (def.type) {
    case 'address':
      if (!/^G[A-Z2-7]{55}$/.test(value.trim())) return 'Must be a valid Stellar address (G..., 56 chars).';
      break;
    case 'amount':
    case 'u32': {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) return 'Must be a positive integer.';
      break;
    }
    case 'bytes':
      if (!/^[0-9a-fA-F]*$/.test(value)) return 'Must be a hex string.';
      break;
  }
  return null;
}

// ─── Auto-save ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'tx_form_draft';

function saveDraft(fnType: TransactionType, contractId: string, values: Record<string, string>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ fnType, contractId, values, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

function loadDraft(): { fnType: TransactionType; contractId: string; values: Record<string, string>; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template {
  name: string;
  fnType: TransactionType;
  contractId: string;
  values: Record<string, string>;
}

const BUILT_IN_TEMPLATES: Template[] = [
  { name: 'Demo Transfer (1 token)', fnType: 'transfer', contractId: 'CDEMO...', values: { to: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', amount: '10000000' } },
  { name: 'Demo Mint (100 tokens)', fnType: 'mint', contractId: 'CDEMO...', values: { to: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', amount: '1000000000' } },
];

const TEMPLATES_KEY = 'tx_form_templates';

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const user: Template[] = raw ? JSON.parse(raw) : [];
    return [...BUILT_IN_TEMPLATES, ...user];
  } catch {
    return BUILT_IN_TEMPLATES;
  }
}

function saveTemplate(t: Template) {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const user: Template[] = raw ? JSON.parse(raw) : [];
    user.push(t);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(user));
  } catch { /* ignore */ }
}

// ─── Array input ──────────────────────────────────────────────────────────────

function ArrayInput({ def, value, onChange }: { def: ParamDef; value: string; onChange: (v: string) => void }) {
  const items: string[] = (() => { try { return JSON.parse(value) as string[]; } catch { return ['']; } })();

  const update = (idx: number, v: string) => {
    const next = [...items];
    next[idx] = v;
    onChange(JSON.stringify(next));
  };

  const add = () => onChange(JSON.stringify([...items, '']));
  const remove = (idx: number) => onChange(JSON.stringify(items.filter((_, i) => i !== idx)));

  return (
    <div className="txf-array-input">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-sm" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <input
            className="form-input"
            value={item}
            placeholder={`Item ${idx + 1}`}
            onChange={e => update(idx, e.target.value)}
            aria-label={`${def.label} item ${idx + 1}`}
          />
          <button type="button" className="btn btn-secondary" onClick={() => remove(idx)} aria-label="Remove item">✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={add} style={{ fontSize: '0.8rem' }}>+ Add item</button>
    </div>
  );
}

// ─── Single param field ───────────────────────────────────────────────────────

function ParamField({ def, value, error, onChange }: {
  def: ParamDef;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const id = `txf-${def.name}`;

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {def.label}
        {def.required && <span className="txf-required" aria-hidden="true"> *</span>}
      </label>

      {def.type === 'bool' ? (
        <label className="balance-prefs-toggle" htmlFor={id}>
          <input id={id} type="checkbox" checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} />
          Enabled
        </label>
      ) : def.type === 'array' ? (
        <ArrayInput def={def} value={value} onChange={onChange} />
      ) : (
        <input
          id={id}
          className={`form-input${error ? ' txf-input-error' : ''}`}
          type={def.type === 'amount' || def.type === 'u32' ? 'number' : 'text'}
          min={def.type === 'amount' || def.type === 'u32' ? '1' : undefined}
          step={def.type === 'amount' || def.type === 'u32' ? '1' : undefined}
          value={value}
          placeholder={def.placeholder}
          onChange={e => onChange(e.target.value)}
          aria-describedby={def.hint ? `${id}-hint` : undefined}
          aria-invalid={!!error}
        />
      )}

      {def.hint && <p id={`${id}-hint`} className="txf-hint">{def.hint}</p>}
      {error && <p className="txf-error" role="alert">{error}</p>}
    </div>
  );
}

// ─── Transaction preview ──────────────────────────────────────────────────────

function TxPreview({ fn, contractId, values }: { fn: FunctionDef; contractId: string; values: Record<string, string> }) {
  const params: Record<string, unknown> = {};
  fn.params.forEach(p => {
    if (values[p.name]) {
      if (p.type === 'array') { try { params[p.name] = JSON.parse(values[p.name]); } catch { params[p.name] = []; } }
      else if (p.type === 'bool') params[p.name] = values[p.name] === 'true';
      else if (p.type === 'amount' || p.type === 'u32') params[p.name] = Number(values[p.name]);
      else params[p.name] = values[p.name];
    }
  });

  return (
    <div className="card txf-preview" aria-label="Transaction preview">
      <div className="card-header">
        <span className="card-title">Preview</span>
        <span className="txf-fee">Est. fee: {fn.estimatedFee} XLM</span>
      </div>
      <pre className="txf-preview-code">{JSON.stringify({ type: fn.type, contractId: contractId || '<contract-id>', method: fn.type, params }, null, 2)}</pre>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TransactionFormBuilderProps {
  defaultContractId?: string;
}

export function TransactionFormBuilder({ defaultContractId = '' }: TransactionFormBuilderProps) {
  const { createTransaction } = useTransactionQueue();

  const [selectedType, setSelectedType] = useState<TransactionType>('transfer');
  const [contractId, setContractId] = useState(defaultContractId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [templateName, setTemplateName] = useState('');
  const [draftInfo, setDraftInfo] = useState<string | null>(null);

  const fn = CONTRACT_ABI.find(f => f.type === selectedType)!;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSelectedType(draft.fnType);
      setContractId(draft.contractId);
      setValues(draft.values);
      const age = Math.round((Date.now() - draft.savedAt) / 60000);
      setDraftInfo(`Draft restored (${age}m ago)`);
    }
  }, []);

  // Auto-save draft on change
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft(selectedType, contractId, values);
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [selectedType, contractId, values]);

  const setField = useCallback((name: string, val: string) => {
    setValues(prev => ({ ...prev, [name]: val }));
    setErrors(prev => ({ ...prev, [name]: null }));
    setDraftInfo(null);
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    let valid = true;
    fn.params.forEach(p => {
      const err = validateParam(values[p.name] ?? '', p);
      newErrors[p.name] = err;
      if (err) valid = false;
    });
    if (!contractId.trim()) { newErrors['__contractId'] = 'Contract ID is required.'; valid = false; }
    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState('loading');
    setSubmitError(null);

    const params: Record<string, unknown> = {};
    fn.params.forEach(p => {
      const v = values[p.name] ?? '';
      if (p.type === 'array') { try { params[p.name] = JSON.parse(v); } catch { params[p.name] = []; } }
      else if (p.type === 'bool') params[p.name] = v === 'true';
      else if (p.type === 'amount' || p.type === 'u32') params[p.name] = Number(v);
      else params[p.name] = v;
    });

    try {
      await createTransaction(fn.type, contractId, fn.type, params);
      setSubmitState('success');
      setValues({});
      clearDraft();
      setTimeout(() => setSubmitState('idle'), 3000);
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const applyTemplate = (t: Template) => {
    setSelectedType(t.fnType);
    setContractId(t.contractId);
    setValues(t.values);
    setErrors({});
    setShowTemplates(false);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const t: Template = { name: templateName.trim(), fnType: selectedType, contractId, values };
    saveTemplate(t);
    setTemplates(loadTemplates());
    setTemplateName('');
  };

  const switchFunction = (type: TransactionType) => {
    setSelectedType(type);
    setValues({});
    setErrors({});
    setSubmitState('idle');
    setSubmitError(null);
  };

  return (
    <div className="txf-root">
      {/* Header row */}
      <div className="flex items-center justify-between mb-md" style={{ flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
        <h2>Transaction Builder</h2>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => setShowTemplates(t => !t)} aria-expanded={showTemplates}>
            📋 Templates
          </button>
          <button className="btn btn-secondary" onClick={() => setShowPreview(p => !p)} aria-expanded={showPreview}>
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Draft notice */}
      {draftInfo && (
        <div className="txf-notice" role="status">
          💾 {draftInfo}
          <button className="txf-notice-dismiss" onClick={() => { clearDraft(); setDraftInfo(null); }} aria-label="Dismiss draft">✕</button>
        </div>
      )}

      {/* Templates panel */}
      {showTemplates && (
        <div className="card txf-templates mb-md" role="region" aria-label="Templates">
          <div className="card-header">
            <span className="card-title">Templates</span>
          </div>
          <div className="txf-template-list">
            {templates.map((t, i) => (
              <button key={i} className="btn btn-secondary txf-template-btn" onClick={() => applyTemplate(t)}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: '160px' }}
              placeholder="Template name..."
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              aria-label="New template name"
            />
            <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
              Save current as template
            </button>
          </div>
        </div>
      )}

      <div className="txf-layout">
        {/* Function selector */}
        <nav className="txf-fn-list" aria-label="Contract functions">
          {CONTRACT_ABI.map(f => (
            <button
              key={f.type}
              className={`txf-fn-btn${selectedType === f.type ? ' active' : ''}`}
              onClick={() => switchFunction(f.type)}
              aria-pressed={selectedType === f.type}
            >
              <span className="txf-fn-icon">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </nav>

        {/* Form */}
        <div className="txf-form-area">
          <div className="card mb-md" style={{ padding: 'var(--spacing-md)' }}>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>{fn.description}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate aria-label={`${fn.label} transaction form`}>
            {/* Contract ID */}
            <div className="form-group">
              <label className="form-label" htmlFor="txf-contract-id">
                Contract ID <span className="txf-required" aria-hidden="true">*</span>
              </label>
              <input
                id="txf-contract-id"
                className={`form-input${errors['__contractId'] ? ' txf-input-error' : ''}`}
                value={contractId}
                placeholder="C..."
                onChange={e => { setContractId(e.target.value); setErrors(prev => ({ ...prev, __contractId: null })); }}
                aria-invalid={!!errors['__contractId']}
              />
              {errors['__contractId'] && <p className="txf-error" role="alert">{errors['__contractId']}</p>}
            </div>

            {/* Dynamic params */}
            {fn.params.map(p => (
              <ParamField
                key={p.name}
                def={p}
                value={values[p.name] ?? ''}
                error={errors[p.name] ?? null}
                onChange={v => setField(p.name, v)}
              />
            ))}

            {/* Submit */}
            <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitState === 'loading'}
              >
                {submitState === 'loading' ? (
                  <><span className="spinner" style={{ width: 16, height: 16 }} /> Queuing...</>
                ) : (
                  `${fn.icon} Queue ${fn.label}`
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setValues({}); setErrors({}); clearDraft(); setDraftInfo(null); }}
              >
                Clear
              </button>

              {submitState === 'success' && (
                <span className="text-success" role="status" aria-live="polite">✓ Transaction queued!</span>
              )}
              {submitState === 'error' && submitError && (
                <span className="text-error" role="alert" aria-live="assertive">✕ {submitError}</span>
              )}
            </div>
          </form>

          {/* Preview */}
          {showPreview && (
            <div className="mt-md">
              <TxPreview fn={fn} contractId={contractId} values={values} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionFormBuilder;
