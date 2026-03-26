import React, { useEffect, useRef, useState } from 'react';
import { Balance } from '../services/storage/types';
import { useTransactionQueue } from '../context/TransactionQueueContext';
import { useStorage } from '../context/StorageContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const STROOPS = 10_000_000;
const ESTIMATED_FEE_STROOPS = 100; // 0.00001 XLM
const ADDRESS_BOOK_KEY = 'wizard_address_book';
const RECENT_KEY = 'wizard_recent_transfers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddressEntry { label: string; address: string; }
interface RecentTransfer { to: string; toLabel?: string; contractId: string; amount: string; ts: number; }

type Step = 'recipient' | 'amount' | 'review' | 'done';
const STEPS: Step[] = ['recipient', 'amount', 'review', 'done'];
const STEP_LABELS: Record<Step, string> = {
  recipient: 'Recipient',
  amount: 'Amount',
  review: 'Review',
  done: 'Done',
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadAddressBook(): AddressEntry[] {
  try { return JSON.parse(localStorage.getItem(ADDRESS_BOOK_KEY) ?? '[]'); } catch { return []; }
}
function saveAddressBook(book: AddressEntry[]) {
  localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(book));
}
function loadRecent(): RecentTransfer[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function pushRecent(t: RecentTransfer) {
  const list = [t, ...loadRecent().filter(r => r.to !== t.to || r.contractId !== t.contractId)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidAddress = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim());

function stroopsToDisplay(s: string | number): string {
  const n = Number(s);
  return (n / STROOPS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function displayToStroops(v: string): number {
  return Math.round(parseFloat(v) * STROOPS);
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  return (
    <nav className="wizard-progress" aria-label="Transfer steps">
      {STEPS.filter(s => s !== 'done').map((s, i) => (
        <React.Fragment key={s}>
          <div className={`wizard-step-dot${i < idx ? ' completed' : i === idx ? ' active' : ''}`} aria-current={s === step ? 'step' : undefined}>
            <span className="wizard-step-num">{i < idx ? '✓' : i + 1}</span>
            <span className="wizard-step-label">{STEP_LABELS[s]}</span>
          </div>
          {i < 2 && <div className={`wizard-step-line${i < idx ? ' completed' : ''}`} />}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ─── Step 1: Recipient ────────────────────────────────────────────────────────

function StepRecipient({ to, setTo, contractId, setContractId, onNext }: {
  to: string; setTo: (v: string) => void;
  contractId: string; setContractId: (v: string) => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [book] = useState<AddressEntry[]>(loadAddressBook);
  const [recent] = useState<RecentTransfer[]>(loadRecent);
  const [showBook, setShowBook] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const validate = () => {
    let ok = true;
    if (!isValidAddress(to)) { setError('Enter a valid Stellar address (G…, 56 chars).'); ok = false; } else setError(null);
    if (!contractId.trim()) { setContractError('Contract ID is required.'); ok = false; } else setContractError(null);
    return ok;
  };

  const saveToBook = () => {
    if (!isValidAddress(to) || !newLabel.trim()) return;
    const updated = [{ label: newLabel.trim(), address: to.trim() }, ...loadAddressBook().filter(e => e.address !== to.trim())];
    saveAddressBook(updated);
    setNewLabel('');
  };

  const suggestions = to.length >= 2
    ? book.filter(e => e.address.includes(to) || e.label.toLowerCase().includes(to.toLowerCase()))
    : [];

  return (
    <div className="wizard-step-body">
      <h3 className="wizard-step-title">Who are you sending to?</h3>

      {/* Recent transfers */}
      {recent.length > 0 && (
        <div className="wizard-section">
          <p className="wizard-section-label">Recent</p>
          <div className="wizard-chip-row">
            {recent.map((r, i) => (
              <button key={i} className="wizard-chip" onClick={() => { setTo(r.to); setContractId(r.contractId); setError(null); }}>
                {r.toLabel ?? r.to.slice(0, 8) + '…'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Address input */}
      <div className="form-group">
        <label className="form-label" htmlFor="wizard-to">Recipient Address *</label>
        <input
          id="wizard-to"
          ref={inputRef}
          className={`form-input${error ? ' txf-input-error' : ''}`}
          value={to}
          placeholder="G..."
          onChange={e => { setTo(e.target.value); setError(null); }}
          aria-invalid={!!error}
          aria-describedby={error ? 'wizard-to-err' : undefined}
          autoComplete="off"
        />
        {error && <p id="wizard-to-err" className="txf-error" role="alert">{error}</p>}

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <div className="wizard-suggestions" role="listbox" aria-label="Address suggestions">
            {suggestions.map((e, i) => (
              <button key={i} role="option" className="wizard-suggestion-item" onClick={() => { setTo(e.address); setError(null); }}>
                <span className="wizard-suggestion-label">{e.label}</span>
                <span className="wizard-suggestion-addr">{e.address.slice(0, 12)}…</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contract ID */}
      <div className="form-group">
        <label className="form-label" htmlFor="wizard-contract">Token Contract ID *</label>
        <input
          id="wizard-contract"
          className={`form-input${contractError ? ' txf-input-error' : ''}`}
          value={contractId}
          placeholder="C..."
          onChange={e => { setContractId(e.target.value); setContractError(null); }}
          aria-invalid={!!contractError}
        />
        {contractError && <p className="txf-error" role="alert">{contractError}</p>}
      </div>

      {/* Address book */}
      <div className="wizard-section">
        <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setShowBook(b => !b)} aria-expanded={showBook}>
          📒 Address Book ({book.length})
        </button>
        {showBook && (
          <div className="wizard-book mt-md">
            {book.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem' }}>No saved addresses.</p>}
            {book.map((e, i) => (
              <button key={i} className="wizard-book-entry" onClick={() => { setTo(e.address); setError(null); setShowBook(false); }}>
                <span>{e.label}</span>
                <span className="text-muted" style={{ fontSize: '0.78rem' }}>{e.address.slice(0, 16)}…</span>
              </button>
            ))}
            {isValidAddress(to) && (
              <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 1, minWidth: 120 }} placeholder="Label for this address" value={newLabel} onChange={e => setNewLabel(e.target.value)} aria-label="Address label" />
                <button className="btn btn-secondary" onClick={saveToBook} disabled={!newLabel.trim()} style={{ fontSize: '0.85rem' }}>Save address</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="wizard-nav">
        <span />
        <button className="btn btn-primary" onClick={() => { if (validate()) onNext(); }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 2: Amount ───────────────────────────────────────────────────────────

function StepAmount({ amount, setAmount, balance, onBack, onNext }: {
  amount: string; setAmount: (v: string) => void;
  balance: Balance | null;
  onBack: () => void; onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const availableStroops = balance ? Number(balance.amount) : null;
  const amountStroops = amount ? displayToStroops(amount) : 0;
  const totalNeeded = amountStroops + ESTIMATED_FEE_STROOPS;
  const insufficient = availableStroops !== null && totalNeeded > availableStroops;

  const validate = () => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) { setError('Enter a valid amount greater than 0.'); return false; }
    if (!Number.isFinite(displayToStroops(amount))) { setError('Amount is too large.'); return false; }
    if (insufficient) { setError('Insufficient balance (including fee).'); return false; }
    setError(null);
    return true;
  };

  const setMax = () => {
    if (availableStroops === null) return;
    const max = Math.max(0, availableStroops - ESTIMATED_FEE_STROOPS);
    setAmount((max / STROOPS).toFixed(7).replace(/\.?0+$/, ''));
    setError(null);
  };

  return (
    <div className="wizard-step-body">
      <h3 className="wizard-step-title">How much to send?</h3>

      {/* Balance info */}
      {balance && (
        <div className="wizard-balance-info">
          <span>Available: <strong>{stroopsToDisplay(balance.amount)} {balance.tokenSymbol}</strong></span>
          <button className="wizard-max-btn" onClick={setMax}>MAX</button>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="wizard-amount">Amount ({balance?.tokenSymbol ?? 'tokens'})</label>
        <input
          id="wizard-amount"
          ref={inputRef}
          className={`form-input${error ? ' txf-input-error' : ''}`}
          type="number"
          min="0"
          step="any"
          value={amount}
          placeholder="0.00"
          onChange={e => { setAmount(e.target.value); setError(null); }}
          aria-invalid={!!error}
        />
        {error && <p className="txf-error" role="alert">{error}</p>}
      </div>

      {/* Fee breakdown */}
      {amount && !isNaN(parseFloat(amount)) && (
        <div className="wizard-fee-box">
          <div className="wizard-fee-row"><span>Amount</span><span>{stroopsToDisplay(amountStroops)} {balance?.tokenSymbol ?? ''}</span></div>
          <div className="wizard-fee-row"><span>Network fee</span><span>~{stroopsToDisplay(ESTIMATED_FEE_STROOPS)} XLM</span></div>
          <div className="wizard-fee-row wizard-fee-total"><span>Total deducted</span><span>{stroopsToDisplay(totalNeeded)} {balance?.tokenSymbol ?? ''}</span></div>
          {insufficient && <p className="txf-error">Insufficient balance.</p>}
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={() => { if (validate()) onNext(); }}>Next →</button>
      </div>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function StepReview({ to, contractId, amount, balance, onBack, onConfirm, loading, error }: {
  to: string; contractId: string; amount: string; balance: Balance | null;
  onBack: () => void; onConfirm: () => void; loading: boolean; error: string | null;
}) {
  const amountStroops = displayToStroops(amount);
  const book = loadAddressBook();
  const label = book.find(e => e.address === to)?.label;

  return (
    <div className="wizard-step-body">
      <h3 className="wizard-step-title">Confirm transfer</h3>

      <div className="wizard-review-card">
        <div className="wizard-review-row">
          <span className="wizard-review-label">To</span>
          <span className="wizard-review-value">
            {label && <strong>{label} </strong>}
            <span className="wizard-review-addr">{to}</span>
          </span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Contract</span>
          <span className="wizard-review-value wizard-review-addr">{contractId}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Amount</span>
          <span className="wizard-review-value wizard-review-amount">{stroopsToDisplay(amountStroops)} {balance?.tokenSymbol ?? ''}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Fee</span>
          <span className="wizard-review-value">~{stroopsToDisplay(ESTIMATED_FEE_STROOPS)} XLM</span>
        </div>
      </div>

      {error && <p className="txf-error mt-md" role="alert">✕ {error}</p>}

      <div className="wizard-nav">
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>← Back</button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Queuing…</> : '✓ Confirm & Send'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ to, amount, tokenSymbol, onReset }: {
  to: string; amount: string; tokenSymbol: string; onReset: () => void;
}) {
  return (
    <div className="wizard-step-body wizard-done" role="status" aria-live="polite">
      <div className="wizard-done-icon">✓</div>
      <h3 className="wizard-step-title">Transfer queued!</h3>
      <p className="text-muted">
        <strong>{stroopsToDisplay(displayToStroops(amount))} {tokenSymbol}</strong> will be sent to{' '}
        <span className="wizard-review-addr">{to.slice(0, 12)}…</span>
      </p>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 'var(--spacing-sm)' }}>
        The transaction is queued and will be submitted when online.
      </p>
      <button className="btn btn-primary mt-lg" onClick={onReset}>New Transfer</button>
    </div>
  );
}

// ─── Wizard root ──────────────────────────────────────────────────────────────

export function TokenTransferWizard() {
  const { createTransaction } = useTransactionQueue();
  const { balances } = useStorage();

  const [step, setStep] = useState<Step>('recipient');
  const [to, setTo] = useState('');
  const [contractId, setContractId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const balance = balances.find(b => b.contractId === contractId) ?? null;

  const reset = () => { setStep('recipient'); setTo(''); setContractId(''); setAmount(''); setSubmitError(null); };

  const confirm = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      await createTransaction('transfer', contractId, 'transfer', {
        to: to.trim(),
        amount: String(displayToStroops(amount)),
      });
      pushRecent({ to: to.trim(), contractId, amount, ts: Date.now() });
      setStep('done');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to queue transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-root">
      {step !== 'done' && <ProgressBar step={step} />}

      {step === 'recipient' && (
        <StepRecipient
          to={to} setTo={setTo}
          contractId={contractId} setContractId={setContractId}
          onNext={() => setStep('amount')}
        />
      )}
      {step === 'amount' && (
        <StepAmount
          amount={amount} setAmount={setAmount}
          balance={balance}
          onBack={() => setStep('recipient')}
          onNext={() => setStep('review')}
        />
      )}
      {step === 'review' && (
        <StepReview
          to={to} contractId={contractId} amount={amount} balance={balance}
          onBack={() => setStep('amount')}
          onConfirm={confirm}
          loading={loading}
          error={submitError}
        />
      )}
      {step === 'done' && (
        <StepDone to={to} amount={amount} tokenSymbol={balance?.tokenSymbol ?? 'tokens'} onReset={reset} />
      )}
    </div>
  );
}

export default TokenTransferWizard;
