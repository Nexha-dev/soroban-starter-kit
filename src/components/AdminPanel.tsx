import React, { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import type {
  AdminUser, ManagedContract, Role, UserStatus,
  SystemHealth, EmergencyAction,
} from '../services/admin/types';
import { ROLE_PERMISSIONS } from '../services/admin/types';

// ─── Shared primitives ────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  superadmin: '#e94560',
  admin: '#f97316',
  operator: '#ffc107',
  auditor: '#4fc3f7',
  viewer: '#a0a0a0',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--color-success)',
  paused: 'var(--color-warning)',
  suspended: 'var(--color-error)',
  deprecated: 'var(--color-text-muted)',
  upgrading: '#4fc3f7',
  pending: 'var(--color-warning)',
  healthy: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  down: 'var(--color-error)',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
      fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'capitalize',
    }}>
      {label}
    </span>
  );
}

function Btn({ children, onClick, variant = 'default', disabled, small }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; small?: boolean;
}) {
  const bg = { default: 'var(--color-bg-tertiary)', danger: '#dc354522', success: '#00d26a22', warning: '#ffc10722' }[variant];
  const col = { default: 'var(--color-text-primary)', danger: 'var(--color-error)', success: 'var(--color-success)', warning: 'var(--color-warning)' }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '3px 10px' : '6px 14px', fontSize: small ? 11 : 13,
      background: bg, color: col, border: `1px solid ${col}44`,
      borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const { users, currentUser, hasPermission, createUser, updateUser, deleteUser, setUserRole } = useAdmin();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', role: 'viewer' as Role, status: 'active' as UserStatus });
  const [editId, setEditId] = useState<string | null>(null);

  const canWrite = hasPermission('users:write');
  const canDelete = hasPermission('users:delete');

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function handleSubmit() {
    if (!form.username || !form.email) return;
    if (editId) {
      updateUser(editId, { username: form.username, email: form.email, role: form.role, status: form.status });
    } else {
      createUser({ ...form, mfaEnabled: false, permissions: [] });
    }
    setShowForm(false);
    setEditId(null);
    setForm({ username: '', email: '', role: 'viewer', status: 'active' });
  }

  function startEdit(u: AdminUser) {
    setForm({ username: u.username, email: u.email, role: u.role, status: u.status });
    setEditId(u.id);
    setShowForm(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input value={search} onChange={setSearch} placeholder="Search users..." />
        {canWrite && (
          <Btn onClick={() => { setShowForm(true); setEditId(null); setForm({ username: '', email: '', role: 'viewer', status: 'active' }); }}>
            + Add User
          </Btn>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card title={editId ? 'Edit User' : 'New User'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Username</label><Input value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="username" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Email</label><Input value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@example.com" type="email" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Role</label>
              <Select value={form.role} onChange={v => setForm(f => ({ ...f, role: v as Role }))} options={(['superadmin','admin','operator','auditor','viewer'] as Role[]).map(r => ({ value: r, label: r }))} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Status</label>
              <Select value={form.status} onChange={v => setForm(f => ({ ...f, status: v as UserStatus }))} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'pending', label: 'Pending' }]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleSubmit}>{editId ? 'Save' : 'Create'}</Btn>
            <Btn onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['User', 'Role', 'Status', 'MFA', 'Last Login', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', background: u.id === currentUser?.id ? 'var(--color-bg-tertiary)' : 'transparent' }}>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ fontWeight: 600 }}>{u.username} {u.id === currentUser?.id && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>(you)</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{u.email}</div>
                </td>
                <td style={{ padding: '10px 10px' }}><Badge label={u.role} color={ROLE_COLORS[u.role]} /></td>
                <td style={{ padding: '10px 10px' }}><Badge label={u.status} color={STATUS_COLORS[u.status]} /></td>
                <td style={{ padding: '10px 10px', color: u.mfaEnabled ? 'var(--color-success)' : 'var(--color-error)' }}>{u.mfaEnabled ? '✓' : '✗'}</td>
                <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{u.lastLogin ? timeAgo(u.lastLogin) : '—'}</td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {canWrite && <Btn small onClick={() => startEdit(u)}>Edit</Btn>}
                    {canWrite && u.status === 'active' && <Btn small variant="warning" onClick={() => updateUser(u.id, { status: 'suspended' })}>Suspend</Btn>}
                    {canWrite && u.status === 'suspended' && <Btn small variant="success" onClick={() => updateUser(u.id, { status: 'active' })}>Restore</Btn>}
                    {canDelete && u.id !== currentUser?.id && <Btn small variant="danger" onClick={() => { if (confirm(`Delete ${u.username}?`)) deleteUser(u.id); }}>Delete</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role permissions reference */}
      <Card title="Role Permissions Reference">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {(Object.entries(ROLE_PERMISSIONS) as [Role, string[]][]).map(([role, perms]) => (
            <div key={role} style={{ padding: 10, background: 'var(--color-bg-tertiary)', borderRadius: 6, borderLeft: `3px solid ${ROLE_COLORS[role]}` }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: ROLE_COLORS[role], textTransform: 'capitalize' }}>{role}</div>
              {perms.map(p => <div key={p} style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>• {p}</div>)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Contracts ───────────────────────────────────────────────────────────

function ContractsTab() {
  const { contracts, hasPermission, pauseContract, resumeContract, upgradeContract, addContract } = useAdmin();
  const [showForm, setShowForm] = useState(false);
  const [upgradeId, setUpgradeId] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [form, setForm] = useState({ name: '', contractId: '', version: '1.0.0', description: '', admin: '' });

  const canWrite = hasPermission('contracts:write');
  const canPause = hasPermission('contracts:pause');
  const canUpgrade = hasPermission('contracts:upgrade');

  function handleAdd() {
    if (!form.name || !form.contractId) return;
    addContract({ ...form, status: 'active' });
    setShowForm(false);
    setForm({ name: '', contractId: '', version: '1.0.0', description: '', admin: '' });
  }

  function handleUpgrade(id: string) {
    if (!newVersion.trim()) return;
    upgradeContract(id, newVersion.trim());
    setUpgradeId(null);
    setNewVersion('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canWrite && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={() => setShowForm(v => !v)}>+ Register Contract</Btn>
        </div>
      )}

      {showForm && (
        <Card title="Register Contract">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Name</label><Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Token Contract" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Contract ID</label><Input value={form.contractId} onChange={v => setForm(f => ({ ...f, contractId: v }))} placeholder="C..." /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Version</label><Input value={form.version} onChange={v => setForm(f => ({ ...f, version: v }))} placeholder="1.0.0" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Admin</label><Input value={form.admin} onChange={v => setForm(f => ({ ...f, admin: v }))} placeholder="username" /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Description</label><Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Optional description" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleAdd}>Register</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {contracts.map(c => (
          <div key={c.id} className="card" style={{ padding: 16, borderLeft: `3px solid ${STATUS_COLORS[c.status]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{c.contractId}</div>
              </div>
              <Badge label={c.status} color={STATUS_COLORS[c.status]} />
            </div>
            {c.description && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>{c.description}</div>}
            <Row label="Version" value={<code style={{ fontSize: 12 }}>v{c.version}</code>} />
            <Row label="Admin" value={c.admin} />
            <Row label="Deployed" value={timeAgo(c.deployedAt)} />
            {c.lastUpgraded && <Row label="Last upgraded" value={timeAgo(c.lastUpgraded)} />}

            {/* Upgrade inline */}
            {canUpgrade && upgradeId === c.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Input value={newVersion} onChange={setNewVersion} placeholder="New version e.g. 1.3.0" />
                <Btn variant="success" onClick={() => handleUpgrade(c.id)}>Apply</Btn>
                <Btn onClick={() => setUpgradeId(null)}>✕</Btn>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {canPause && c.status === 'active' && <Btn small variant="warning" onClick={() => pauseContract(c.id)}>Pause</Btn>}
              {canPause && c.status === 'paused' && <Btn small variant="success" onClick={() => resumeContract(c.id)}>Resume</Btn>}
              {canUpgrade && c.status !== 'deprecated' && <Btn small onClick={() => { setUpgradeId(c.id); setNewVersion(''); }}>Upgrade</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: System ──────────────────────────────────────────────────────────────

function SystemTab() {
  const { checkHealth } = useAdmin();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    try { setHealth(await checkHealth()); } finally { setLoading(false); }
  }

  useEffect(() => { runCheck(); }, []);

  function fmtUptime(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {health && <Badge label={health.overall} color={STATUS_COLORS[health.overall]} />}
          {health && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Uptime: {fmtUptime(health.uptime)}</span>}
          {health?.memoryMB && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Memory: {health.memoryMB} MB</span>}
        </div>
        <Btn onClick={runCheck} disabled={loading}>{loading ? 'Checking…' : '↻ Refresh'}</Btn>
      </div>

      {/* Health checks */}
      <Card title="Health Checks">
        {!health && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Running checks…</p>}
        {health?.checks.map(c => (
          <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
              {c.message && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>{c.message}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {c.latencyMs !== undefined && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.latencyMs}ms</span>}
              <Badge label={c.status} color={STATUS_COLORS[c.status]} />
            </div>
          </div>
        ))}
      </Card>

      {/* System info */}
      <Card title="Runtime Info">
        <Row label="User Agent" value={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>{navigator.userAgent.slice(0, 60)}…</span>} />
        <Row label="Language" value={navigator.language} />
        <Row label="Online" value={navigator.onLine ? '✓ Yes' : '✗ No'} />
        <Row label="Storage estimate" value={<StorageEstimate />} />
        <Row label="Service Worker" value={'serviceWorker' in navigator ? '✓ Supported' : '✗ Not supported'} />
      </Card>
    </div>
  );
}

function StorageEstimate() {
  const [info, setInfo] = useState<string>('…');
  useEffect(() => {
    if (!navigator.storage?.estimate) { setInfo('N/A'); return; }
    navigator.storage.estimate().then(({ usage, quota }) => {
      if (usage == null || quota == null) { setInfo('N/A'); return; }
      setInfo(`${(usage / 1_048_576).toFixed(1)} MB / ${(quota / 1_048_576).toFixed(0)} MB`);
    });
  }, []);
  return <span style={{ fontSize: 12 }}>{info}</span>;
}

// ─── Tab: Audit ───────────────────────────────────────────────────────────────

const SEV_COLORS = { info: 'var(--color-text-muted)', warning: 'var(--color-warning)', critical: 'var(--color-error)' };
const CAT_ICONS: Record<string, string> = { user: '👤', contract: '📄', system: '⚙️', emergency: '🚨', auth: '🔐' };

function AuditTab() {
  const { auditLog, hasPermission, downloadAuditCSV } = useAdmin();
  const [filter, setFilter] = useState('');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [catFilter, setCatFilter] = useState<string>('all');

  const filtered = auditLog.filter(e => {
    const matchText = !filter || e.action.includes(filter) || e.actor.includes(filter) || e.details.includes(filter);
    const matchSev = sevFilter === 'all' || e.severity === sevFilter;
    const matchCat = catFilter === 'all' || e.category === catFilter;
    return matchText && matchSev && matchCat;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 180 }}><Input value={filter} onChange={setFilter} placeholder="Search actions, actors…" /></div>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
          style={{ padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
          <option value="all">All categories</option>
          {['user','contract','system','emergency','auth'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasPermission('audit:export') && (
          <Btn onClick={downloadAuditCSV}>↓ Export CSV</Btn>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{filtered.length} entries</div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Time', 'Actor', 'Category', 'Action', 'Details', 'Severity'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>No entries yet. Actions will appear here.</td></tr>
            )}
            {filtered.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: 11 }}>{new Date(e.timestamp).toLocaleString()}</td>
                <td style={{ padding: '8px 10px', fontWeight: 500 }}>{e.actor}</td>
                <td style={{ padding: '8px 10px' }}>{CAT_ICONS[e.category]} {e.category}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{e.action}</td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.details}</td>
                <td style={{ padding: '8px 10px', color: SEV_COLORS[e.severity], fontWeight: 600, textTransform: 'capitalize' }}>{e.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Emergency ───────────────────────────────────────────────────────────

const EMERGENCY_ACTIONS: { action: EmergencyAction; label: string; desc: string; variant: 'danger' | 'warning' }[] = [
  { action: 'pause_all', label: '⏸ Pause All Contracts', desc: 'Immediately pause all active contracts. No transactions will be processed.', variant: 'danger' },
  { action: 'resume_all', label: '▶ Resume All Contracts', desc: 'Resume all paused contracts. Use after verifying the issue is resolved.', variant: 'warning' },
  { action: 'revoke_sessions', label: '🔑 Revoke All Sessions', desc: 'Force all users to re-authenticate. Use if credentials may be compromised.', variant: 'danger' },
  { action: 'lock_system', label: '🔒 Lock System', desc: 'Lock the entire system. Only superadmins can unlock.', variant: 'danger' },
];

function EmergencyTab() {
  const { hasPermission, triggerEmergency, resolveEmergency, emergencyEvents, systemLocked, allContractsPaused } = useAdmin();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<EmergencyAction | null>(null);

  const canTrigger = hasPermission('emergency:trigger');

  function handleTrigger(action: EmergencyAction) {
    if (!reason.trim()) return;
    triggerEmergency(action, reason.trim());
    setConfirming(null);
    setReason('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status banner */}
      {(systemLocked || allContractsPaused) && (
        <div style={{ padding: '12px 16px', background: '#dc354522', border: '1px solid var(--color-error)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-error)' }}>Emergency State Active</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {systemLocked && 'System is locked. '}
              {allContractsPaused && 'All contracts are paused.'}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {canTrigger ? (
        <Card title="Emergency Controls">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Reason (required)</label>
            <Input value={reason} onChange={setReason} placeholder="Describe the reason for this emergency action…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {EMERGENCY_ACTIONS.map(ea => (
              <div key={ea.action} style={{ padding: 14, background: 'var(--color-bg-tertiary)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{ea.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>{ea.desc}</div>
                {confirming === ea.action ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="danger" onClick={() => handleTrigger(ea.action)} disabled={!reason.trim()}>Confirm</Btn>
                    <Btn onClick={() => setConfirming(null)}>Cancel</Btn>
                  </div>
                ) : (
                  <Btn variant={ea.variant} onClick={() => setConfirming(ea.action)} disabled={!reason.trim()}>
                    {ea.label}
                  </Btn>
                )}
              </div>
            ))}
          </div>
          {!reason.trim() && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>⚠ Enter a reason before triggering any emergency action.</p>}
        </Card>
      ) : (
        <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          🔒 You don't have permission to trigger emergency actions.
        </div>
      )}

      {/* Event history */}
      <Card title="Emergency Event History">
        {emergencyEvents.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No emergency events recorded.</p>}
        {emergencyEvents.map(e => (
          <div key={e.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Badge label={e.action.replace('_', ' ')} color={e.resolved ? 'var(--color-success)' : 'var(--color-error)'} />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{new Date(e.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>By <strong>{e.triggeredBy}</strong>: {e.reason}</div>
              {e.resolvedAt && <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 2 }}>Resolved {timeAgo(e.resolvedAt)}</div>}
            </div>
            {!e.resolved && canTrigger && (
              <Btn small variant="success" onClick={() => resolveEmergency(e.id)}>Resolve</Btn>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Root AdminPanel ──────────────────────────────────────────────────────────

type AdminTab = 'users' | 'contracts' | 'system' | 'audit' | 'emergency';

export function AdminPanel(): JSX.Element {
  const { currentUser, users, hasPermission, switchUser, systemLocked, emergencyEvents } = useAdmin();
  const [tab, setTab] = useState<AdminTab>('users');

  const activeEmergencies = emergencyEvents.filter(e => !e.resolved).length;

  const tabs: { id: AdminTab; label: string; perm: import('../services/admin/types').Permission }[] = [
    { id: 'users', label: '👤 Users', perm: 'users:read' },
    { id: 'contracts', label: '📄 Contracts', perm: 'contracts:read' },
    { id: 'system', label: '⚙️ System', perm: 'system:read' },
    { id: 'audit', label: '📋 Audit', perm: 'audit:read' },
    { id: 'emergency', label: `🚨 Emergency${activeEmergencies ? ` (${activeEmergencies})` : ''}`, perm: 'emergency:trigger' },
  ];

  const visibleTabs = tabs.filter(t => hasPermission(t.perm) || t.id === 'emergency');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Admin Panel</h2>
          {systemLocked && <Badge label="System Locked" color="var(--color-error)" />}
          {currentUser && <Badge label={currentUser.role} color={ROLE_COLORS[currentUser.role]} />}
        </div>
        {/* Demo: switch current user to test RBAC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Viewing as:</span>
          <select
            value={currentUser?.id ?? ''}
            onChange={e => switchUser(e.target.value)}
            style={{ padding: '5px 10px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 12 }}
            aria-label="Switch admin user"
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
        {visibleTabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--color-highlight)' : 'var(--color-text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {tab === 'users' && <UsersTab />}
        {tab === 'contracts' && <ContractsTab />}
        {tab === 'system' && <SystemTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'emergency' && <EmergencyTab />}
      </div>
    </div>
  );
}
