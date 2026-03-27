import React, { useState, useCallback } from 'react';
import { EscrowData, EscrowStatus } from '../services/storage/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: number;
  completed: boolean;
}

interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  uploadedBy: string;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface EscrowFull extends EscrowData {
  milestones: Milestone[];
  documents: Document[];
  messages: Message[];
  title: string;
  description: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<EscrowStatus, string> = {
  initialized: '#6366f1',
  funded:      '#f59e0b',
  delivered:   '#3b82f6',
  completed:   '#10b981',
  cancelled:   '#ef4444',
  refunded:    '#8b5cf6',
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString();
}

function fmtAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ── Wizard ─────────────────────────────────────────────────────────────────

const WIZARD_STEPS = ['Parties', 'Terms', 'Milestones', 'Review'];

interface WizardProps {
  onComplete: (e: EscrowFull) => void;
  onCancel: () => void;
}

function EscrowWizard({ onComplete, onCancel }: WizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: '', description: '',
    buyer: '', seller: '', arbiter: '',
    tokenContractId: '', amount: '',
    deadlineDays: '30',
  });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mDue, setMDue] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const addMilestone = () => {
    if (!mTitle) return;
    setMilestones(ms => [...ms, {
      id: uid(), title: mTitle, description: mDesc,
      dueDate: mDue ? new Date(mDue).getTime() : Date.now() + 7 * 86400000,
      completed: false,
    }]);
    setMTitle(''); setMDesc(''); setMDue('');
  };

  const removeMilestone = (id: string) => setMilestones(ms => ms.filter(m => m.id !== id));

  const submit = () => {
    const now = Date.now();
    onComplete({
      id: uid(),
      contractId: '',
      buyer: form.buyer,
      seller: form.seller,
      arbiter: form.arbiter || undefined,
      tokenContractId: form.tokenContractId,
      amount: form.amount,
      status: 'initialized',
      deadline: now + parseInt(form.deadlineDays) * 86400000,
      createdAt: now,
      lastUpdated: now,
      title: form.title,
      description: form.description,
      milestones,
      documents: [],
      messages: [],
    });
  };

  const canNext = [
    form.buyer && form.seller,
    form.tokenContractId && form.amount && form.deadlineDays,
    true,
    true,
  ][step];

  return (
    <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
              background: i <= step ? 'var(--color-primary, #6366f1)' : 'var(--color-border, #e5e7eb)',
              color: i <= step ? '#fff' : '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
            }}>{i + 1}</div>
            <span style={{ fontSize: 11, color: i === step ? 'var(--color-primary, #6366f1)' : '#6b7280' }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Step 0 – Parties */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Escrow Details & Parties</h3>
          {[['title','Title'],['description','Description'],['buyer','Buyer Address'],['seller','Seller Address'],['arbiter','Arbiter Address (optional)']].map(([k, label]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              {label}
              {k === 'description'
                ? <textarea value={(form as any)[k]} onChange={set(k)} rows={2} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)', resize: 'vertical' }} />
                : <input value={(form as any)[k]} onChange={set(k)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }} />
              }
            </label>
          ))}
        </div>
      )}

      {/* Step 1 – Terms */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Terms & Token</h3>
          {[['tokenContractId','Token Contract ID'],['amount','Amount (stroops)'],['deadlineDays','Deadline (days)']].map(([k, label]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              {label}
              <input value={(form as any)[k]} onChange={set(k)} type={k === 'amount' || k === 'deadlineDays' ? 'number' : 'text'}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }} />
            </label>
          ))}
        </div>
      )}

      {/* Step 2 – Milestones */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Milestones</h3>
          {milestones.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface,#f9fafb)', borderRadius: 6 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{m.description} · Due {fmtDate(m.dueDate)}</div>
              </div>
              <button onClick={() => removeMilestone(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px dashed var(--color-border,#e5e7eb)', borderRadius: 6 }}>
            <input placeholder="Milestone title" value={mTitle} onChange={e => setMTitle(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }} />
            <input placeholder="Description" value={mDesc} onChange={e => setMDesc(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }} />
            <input type="date" value={mDue} onChange={e => setMDue(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }} />
            <button onClick={addMilestone} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>+ Add Milestone</button>
          </div>
        </div>
      )}

      {/* Step 3 – Review */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Review & Confirm</h3>
          {[['Title', form.title],['Buyer', fmtAddr(form.buyer)],['Seller', fmtAddr(form.seller)],['Arbiter', form.arbiter ? fmtAddr(form.arbiter) : 'None'],['Amount', form.amount],['Deadline', `${form.deadlineDays} days`],['Milestones', milestones.length.toString()]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--color-border,#e5e7eb)' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <button className="btn btn-primary" disabled={!canNext} onClick={step === WIZARD_STEPS.length - 1 ? submit : () => setStep(s => s + 1)}>
          {step === WIZARD_STEPS.length - 1 ? 'Create Escrow' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────

function Timeline({ escrow }: { escrow: EscrowFull }) {
  const events = [
    { label: 'Created', date: escrow.createdAt, done: true },
    { label: 'Funded', date: escrow.status !== 'initialized' ? escrow.lastUpdated : null, done: escrow.status !== 'initialized' },
    { label: 'Delivered', date: ['delivered','completed'].includes(escrow.status) ? escrow.lastUpdated : null, done: ['delivered','completed'].includes(escrow.status) },
    { label: 'Completed', date: escrow.status === 'completed' ? escrow.lastUpdated : null, done: escrow.status === 'completed' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '16px 0' }}>
      {events.map((ev, i) => (
        <React.Fragment key={ev.label}>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', margin: '0 auto 4px',
              background: ev.done ? STATUS_COLOR[escrow.status] : '#e5e7eb',
              border: `2px solid ${ev.done ? STATUS_COLOR[escrow.status] : '#d1d5db'}`,
            }} />
            <div style={{ fontSize: 11, fontWeight: 600 }}>{ev.label}</div>
            {ev.date && <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmtDate(ev.date)}</div>}
          </div>
          {i < events.length - 1 && (
            <div style={{ flex: 1, height: 2, background: events[i + 1].done ? STATUS_COLOR[escrow.status] : '#e5e7eb' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Milestones ─────────────────────────────────────────────────────────────

function MilestonePanel({ milestones, onToggle }: { milestones: Milestone[]; onToggle: (id: string) => void }) {
  const done = milestones.filter(m => m.completed).length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Milestones</span>
        <span style={{ color: '#6b7280' }}>{done}/{milestones.length} · {pct}%</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      {milestones.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No milestones defined.</p>}
      {milestones.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border,#e5e7eb)' }}>
          <input type="checkbox" checked={m.completed} onChange={() => onToggle(m.id)} style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textDecoration: m.completed ? 'line-through' : 'none', color: m.completed ? '#9ca3af' : 'inherit' }}>{m.title}</div>
            {m.description && <div style={{ fontSize: 12, color: '#6b7280' }}>{m.description}</div>}
            <div style={{ fontSize: 11, color: new Date(m.dueDate) < new Date() && !m.completed ? '#ef4444' : '#9ca3af' }}>
              Due {fmtDate(m.dueDate)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Documents ──────────────────────────────────────────────────────────────

function DocumentPanel({ documents, onUpload }: { documents: Document[]; onUpload: (f: File) => void }) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(onUpload);
  };

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Documents</div>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        style={{ border: '2px dashed var(--color-border,#e5e7eb)', borderRadius: 8, padding: 16, textAlign: 'center', marginBottom: 12, cursor: 'pointer' }}
        onClick={() => document.getElementById('doc-upload')?.click()}
      >
        <div style={{ fontSize: 24 }}>📎</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Drop files or click to upload</div>
        <input id="doc-upload" type="file" multiple hidden onChange={e => Array.from(e.target.files || []).forEach(onUpload)} />
      </div>
      {documents.map(d => (
        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--color-border,#e5e7eb)' }}>
          <span>📄 {d.name}</span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{(d.size / 1024).toFixed(1)} KB · {fmtDate(d.uploadedAt)}</span>
        </div>
      ))}
      {documents.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No documents uploaded.</p>}
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────

function ChatPanel({ messages, onSend }: { messages: Message[]; onSend: (text: string) => void }) {
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 280 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Communication</div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {messages.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No messages yet.</p>}
        {messages.map(m => (
          <div key={m.id} style={{ background: 'var(--color-surface,#f9fafb)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
              <span style={{ fontWeight: 600 }}>{fmtAddr(m.sender)}</span>
              <span>{fmtDate(m.timestamp)}</span>
            </div>
            <div style={{ fontSize: 13 }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)' }}
        />
        <button className="btn btn-primary" onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ── Dispute ────────────────────────────────────────────────────────────────

function DisputePanel({ escrow, onResolve }: { escrow: EscrowFull; onResolve: (toSeller: boolean, reason: string) => void }) {
  const [reason, setReason] = useState('');
  const canDispute = ['funded', 'delivered'].includes(escrow.status);

  if (!canDispute) return (
    <div style={{ color: '#9ca3af', fontSize: 13 }}>Dispute resolution is only available when escrow is funded or delivered.</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>Dispute Resolution</div>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Describe the reason for dispute resolution…"
        rows={3}
        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border,#e5e7eb)', resize: 'vertical', fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, background: '#10b981' }} onClick={() => onResolve(true, reason)} disabled={!reason}>
          ✓ Release to Seller
        </button>
        <button className="btn btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={() => onResolve(false, reason)} disabled={!reason}>
          ↩ Refund to Buyer
        </button>
      </div>
    </div>
  );
}

// ── Analytics ──────────────────────────────────────────────────────────────

function AnalyticsPanel({ escrows }: { escrows: EscrowFull[] }) {
  const total = escrows.length;
  const byStatus = escrows.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalValue = escrows.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  const completionRate = total ? Math.round(((byStatus['completed'] || 0) / total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {[
        ['Total Escrows', total],
        ['Total Value', totalValue.toLocaleString()],
        ['Completion Rate', `${completionRate}%`],
        ['Active', (byStatus['funded'] || 0) + (byStatus['delivered'] || 0)],
      ].map(([label, value]) => (
        <div key={label as string} style={{ background: 'var(--color-surface,#f9fafb)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        </div>
      ))}
      <div style={{ gridColumn: '1/-1' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>By Status</div>
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[status as EscrowStatus] || '#6b7280' }} />
            <span style={{ fontSize: 13, flex: 1, textTransform: 'capitalize' }}>{status}</span>
            <div style={{ flex: 2, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${(count / total) * 100}%`, background: STATUS_COLOR[status as EscrowStatus] || '#6b7280', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: '#6b7280', minWidth: 20 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail View ────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'milestones' | 'documents' | 'chat' | 'dispute';

function EscrowDetail({ escrow, onBack, onUpdate }: { escrow: EscrowFull; onBack: () => void; onUpdate: (e: EscrowFull) => void }) {
  const [tab, setTab] = useState<DetailTab>('overview');

  const toggleMilestone = (id: string) => onUpdate({
    ...escrow,
    milestones: escrow.milestones.map(m => m.id === id ? { ...m, completed: !m.completed } : m),
  });

  const uploadDoc = (file: File) => onUpdate({
    ...escrow,
    documents: [...escrow.documents, { id: uid(), name: file.name, size: file.size, uploadedAt: Date.now(), uploadedBy: escrow.buyer }],
  });

  const sendMessage = (text: string) => onUpdate({
    ...escrow,
    messages: [...escrow.messages, { id: uid(), sender: escrow.buyer, text, timestamp: Date.now() }],
  });

  const resolveDispute = (toSeller: boolean) => onUpdate({
    ...escrow,
    status: toSeller ? 'completed' : 'refunded',
    lastUpdated: Date.now(),
  });

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'milestones', label: '🎯 Milestones' },
    { id: 'documents', label: '📎 Documents' },
    { id: 'chat', label: '💬 Chat' },
    { id: 'dispute', label: '⚖️ Dispute' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0, flex: 1 }}>{escrow.title || escrow.id}</h2>
        <span style={{ padding: '4px 10px', borderRadius: 12, background: STATUS_COLOR[escrow.status], color: '#fff', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
          {escrow.status}
        </span>
      </div>

      <Timeline escrow={escrow} />

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border,#e5e7eb)', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              borderBottom: tab === t.id ? '2px solid var(--color-primary,#6366f1)' : '2px solid transparent',
              color: tab === t.id ? 'var(--color-primary,#6366f1)' : '#6b7280', fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Buyer', fmtAddr(escrow.buyer)],
            ['Seller', fmtAddr(escrow.seller)],
            ['Arbiter', escrow.arbiter ? fmtAddr(escrow.arbiter) : 'None'],
            ['Amount', escrow.amount],
            ['Deadline', fmtDate(escrow.deadline)],
            ['Created', fmtDate(escrow.createdAt)],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'var(--color-surface,#f9fafb)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
          {escrow.description && (
            <div style={{ gridColumn: '1/-1', background: 'var(--color-surface,#f9fafb)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13 }}>{escrow.description}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'milestones' && <MilestonePanel milestones={escrow.milestones} onToggle={toggleMilestone} />}
      {tab === 'documents' && <DocumentPanel documents={escrow.documents} onUpload={uploadDoc} />}
      {tab === 'chat' && <ChatPanel messages={escrow.messages} onSend={sendMessage} />}
      {tab === 'dispute' && <DisputePanel escrow={escrow} onResolve={resolveDispute} />}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function EscrowManagement() {
  const [escrows, setEscrows] = useState<EscrowFull[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'analytics'>('list');
  const [selected, setSelected] = useState<EscrowFull | null>(null);
  const [filter, setFilter] = useState<EscrowStatus | 'all'>('all');

  const addEscrow = useCallback((e: EscrowFull) => {
    setEscrows(es => [e, ...es]);
    setView('list');
  }, []);

  const updateEscrow = useCallback((updated: EscrowFull) => {
    setEscrows(es => es.map(e => e.id === updated.id ? updated : e));
    setSelected(updated);
  }, []);

  const filtered = filter === 'all' ? escrows : escrows.filter(e => e.status === filter);

  if (selected) return <EscrowDetail escrow={selected} onBack={() => setSelected(null)} onUpdate={updateEscrow} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Escrow Management</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={view === 'analytics' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setView(v => v === 'analytics' ? 'list' : 'analytics')}>
            📊 Analytics
          </button>
          <button className="btn btn-primary" onClick={() => setView('create')}>+ New Escrow</button>
        </div>
      </div>

      {view === 'create' && <EscrowWizard onComplete={addEscrow} onCancel={() => setView('list')} />}

      {view === 'analytics' && <AnalyticsPanel escrows={escrows} />}

      {view === 'list' && (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'initialized', 'funded', 'delivered', 'completed', 'refunded', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === s ? (s === 'all' ? '#6366f1' : STATUS_COLOR[s as EscrowStatus]) : '#e5e7eb',
                  color: filter === s ? '#fff' : '#374151', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
              <div style={{ fontSize: 40 }}>🔐</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>No escrows found. Create one to get started.</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(e => (
              <div key={e.id} onClick={() => setSelected(e)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--color-surface,#f9fafb)', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--color-border,#e5e7eb)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[e.status], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title || e.id}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{fmtAddr(e.buyer)} → {fmtAddr(e.seller)} · {e.amount} stroops</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: STATUS_COLOR[e.status] }}>{e.status}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Due {fmtDate(e.deadline)}</div>
                </div>
                <span style={{ color: '#9ca3af' }}>›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default EscrowManagement;
