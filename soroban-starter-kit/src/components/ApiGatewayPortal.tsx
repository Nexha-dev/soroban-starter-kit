import React, { useState, useMemo } from 'react';
import { useGateway } from '../context/GatewayContext';
import type {
  ApiRoute, ApiKey, RouteAnalytics, RequestLog,
  HttpMethod, AuthStrategy, ApiKeyScope,
} from '../services/gateway/types';

// ─── Shared primitives ────────────────────────────────────────────────────────

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#00d26a', POST: '#4fc3f7', PUT: '#ffc107',
  DELETE: '#e94560', PATCH: '#ce93d8',
};

const STATUS_COLOR = (code: number) =>
  code < 300 ? 'var(--color-success)' : code < 400 ? '#4fc3f7' : code < 500 ? 'var(--color-warning)' : 'var(--color-error)';

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function Btn({ children, onClick, variant = 'default', disabled, small }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; small?: boolean;
}) {
  const col = { default: 'var(--color-text-primary)', danger: 'var(--color-error)', success: 'var(--color-success)', warning: 'var(--color-warning)' }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '3px 10px' : '6px 14px', fontSize: small ? 11 : 13,
      background: col + '18', color: col, border: `1px solid ${col}44`,
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

function Input({ value, onChange, placeholder, type = 'text', mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13, boxSizing: 'border-box', fontFamily: mono ? 'monospace' : undefined }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function fmtMs(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }

// ─── Tab: Routes ──────────────────────────────────────────────────────────────

function RoutesTab() {
  const { routes, analytics, addRoute, updateRoute, deleteRoute } = useGateway();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', pattern: '', upstream: '', version: 'v1',
    methods: ['GET'] as HttpMethod[], enabled: true,
    authStrategy: 'none' as AuthStrategy, authRequired: false,
    rlEnabled: true, rlRequests: 100, rlWindow: 60,
    description: '', tags: '',
  });

  function resetForm() {
    setForm({ name: '', pattern: '', upstream: '', version: 'v1', methods: ['GET'], enabled: true, authStrategy: 'none', authRequired: false, rlEnabled: true, rlRequests: 100, rlWindow: 60, description: '', tags: '' });
    setEditId(null);
  }

  function startEdit(r: ApiRoute) {
    setForm({
      name: r.name, pattern: r.pattern, upstream: r.upstream, version: r.version,
      methods: r.methods, enabled: r.enabled, authStrategy: r.auth.strategy,
      authRequired: r.auth.required, rlEnabled: r.rateLimit.enabled,
      rlRequests: r.rateLimit.requestsPerWindow, rlWindow: r.rateLimit.windowMs / 1000,
      description: r.description ?? '', tags: r.tags.join(', '),
    });
    setEditId(r.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name || !form.pattern) return;
    const payload: Omit<ApiRoute, 'id'> = {
      name: form.name, pattern: form.pattern, upstream: form.upstream,
      version: form.version, methods: form.methods, enabled: form.enabled,
      auth: { strategy: form.authStrategy, required: form.authRequired },
      rateLimit: { enabled: form.rlEnabled, requestsPerWindow: form.rlRequests, windowMs: form.rlWindow * 1000 },
      transforms: { injectApiVersion: true },
      description: form.description,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (editId) updateRoute(editId, payload);
    else addRoute(payload);
    setShowForm(false);
    resetForm();
  }

  const toggleMethod = (m: HttpMethod) =>
    setForm(f => ({ ...f, methods: f.methods.includes(m) ? f.methods.filter(x => x !== m) : [...f.methods, m] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => { resetForm(); setShowForm(v => !v); }}>+ Add Route</Btn>
      </div>

      {showForm && (
        <Card title={editId ? 'Edit Route' : 'New Route'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Name</label><Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Soroban RPC" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pattern</label><Input value={form.pattern} onChange={v => setForm(f => ({ ...f, pattern: v }))} placeholder="/soroban/*" mono /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Upstream URL</label><Input value={form.upstream} onChange={v => setForm(f => ({ ...f, upstream: v }))} placeholder="https://..." mono /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Version</label><Input value={form.version} onChange={v => setForm(f => ({ ...f, version: v }))} placeholder="v1" /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Methods</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['GET','POST','PUT','DELETE','PATCH'] as HttpMethod[]).map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.methods.includes(m)} onChange={() => toggleMethod(m)} />
                    <span style={{ color: METHOD_COLORS[m], fontWeight: 600 }}>{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Auth Strategy</label>
              <Select value={form.authStrategy} onChange={v => setForm(f => ({ ...f, authStrategy: v as AuthStrategy }))} options={[{ value: 'none', label: 'None' }, { value: 'api_key', label: 'API Key' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'session', label: 'Session' }]} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
              <Toggle checked={form.authRequired} onChange={v => setForm(f => ({ ...f, authRequired: v }))} label="Auth required" />
              <Toggle checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} label="Enabled" />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Rate limit (req/window)</label><Input value={String(form.rlRequests)} onChange={v => setForm(f => ({ ...f, rlRequests: Number(v) || 100 }))} type="number" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Window (seconds)</label><Input value={String(form.rlWindow)} onChange={v => setForm(f => ({ ...f, rlWindow: Number(v) || 60 }))} type="number" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tags (comma-separated)</label><Input value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="soroban, blockchain" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Description</label><Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Optional" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleSubmit}>{editId ? 'Save' : 'Create'}</Btn>
            <Btn onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {routes.map(r => {
          const a = analytics[r.id];
          return (
            <div key={r.id} className="card" style={{ padding: 14, borderLeft: `3px solid ${r.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                    <Badge label={r.version} color="#4fc3f7" />
                    {!r.enabled && <Badge label="disabled" color="var(--color-text-muted)" />}
                    {r.tags.map(t => <Badge key={t} label={t} color="var(--color-text-muted)" />)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 12, color: 'var(--color-highlight)' }}>{r.pattern}</code>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>→</span>
                    <code style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.upstream}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {r.methods.map(m => <Badge key={m} label={m} color={METHOD_COLORS[m]} />)}
                    <Badge label={r.auth.strategy} color={r.auth.required ? 'var(--color-warning)' : 'var(--color-text-muted)'} />
                    {r.rateLimit.enabled && <Badge label={`${r.rateLimit.requestsPerWindow}/${r.rateLimit.windowMs / 1000}s`} color="#ce93d8" />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {a && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.totalRequests} req · {fmtMs(a.avgLatencyMs)} avg</span>}
                  <Btn small onClick={() => startEdit(r)}>Edit</Btn>
                  <Btn small variant={r.enabled ? 'warning' : 'success'} onClick={() => updateRoute(r.id, { enabled: !r.enabled })}>{r.enabled ? 'Disable' : 'Enable'}</Btn>
                  <Btn small variant="danger" onClick={() => { if (confirm(`Delete route "${r.name}"?`)) deleteRoute(r.id); }}>Delete</Btn>
                </div>
              </div>
              {r.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>{r.description}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const { apiKeys, createApiKey, revokeApiKey, deleteApiKey } = useGateway();
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [form, setForm] = useState({ name: '', owner: '', scopes: ['read'] as ApiKeyScope[], expiresInDays: '' });

  const SCOPES: ApiKeyScope[] = ['read', 'write', 'admin'];

  function handleCreate() {
    if (!form.name || !form.owner) return;
    const key = createApiKey(form.name, form.scopes, form.owner, form.expiresInDays ? Number(form.expiresInDays) : undefined);
    setNewKey(key);
    setShowForm(false);
    setForm({ name: '', owner: '', scopes: ['read'], expiresInDays: '' });
  }

  const toggleScope = (s: ApiKeyScope) =>
    setForm(f => ({ ...f, scopes: f.scopes.includes(s) ? f.scopes.filter(x => x !== s) : [...f.scopes, s] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => { setShowForm(v => !v); setNewKey(null); }}>+ Create API Key</Btn>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div style={{ padding: 14, background: '#00d26a18', border: '1px solid var(--color-success)', borderRadius: 6 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-success)', marginBottom: 8 }}>✓ API Key Created — copy it now, it won't be shown again</div>
          <code style={{ fontSize: 13, wordBreak: 'break-all', display: 'block', padding: '8px 12px', background: 'var(--color-bg-primary)', borderRadius: 4, marginBottom: 8 }}>{newKey.key}</code>
          <Btn small onClick={() => { navigator.clipboard.writeText(newKey.key); }}>Copy</Btn>
          <Btn small onClick={() => setNewKey(null)}>Dismiss</Btn>
        </div>
      )}

      {showForm && (
        <Card title="New API Key">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Key Name</label><Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="My App Key" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Owner</label><Input value={form.owner} onChange={v => setForm(f => ({ ...f, owner: v }))} placeholder="username" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Expires in (days, blank = never)</label><Input value={form.expiresInDays} onChange={v => setForm(f => ({ ...f, expiresInDays: v }))} type="number" placeholder="30" /></div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Scopes</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {SCOPES.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.scopes.includes(s)} onChange={() => toggleScope(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleCreate}>Create</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Name', 'Owner', 'Scopes', 'Status', 'Requests', 'Last Used', 'Expires', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>No API keys yet.</td></tr>
            )}
            {apiKeys.map(k => (
              <tr key={k.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 10px', fontWeight: 500 }}>{k.name}</td>
                <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{k.owner}</td>
                <td style={{ padding: '10px 10px' }}>{k.scopes.map(s => <Badge key={s} label={s} color="#4fc3f7" />)}</td>
                <td style={{ padding: '10px 10px' }}><Badge label={k.enabled ? 'active' : 'revoked'} color={k.enabled ? 'var(--color-success)' : 'var(--color-error)'} /></td>
                <td style={{ padding: '10px 10px' }}>{k.requestCount}</td>
                <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{k.lastUsed ? timeAgo(k.lastUsed) : '—'}</td>
                <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</td>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {k.enabled && <Btn small variant="warning" onClick={() => revokeApiKey(k.id)}>Revoke</Btn>}
                    <Btn small variant="danger" onClick={() => { if (confirm('Delete this key?')) deleteApiKey(k.id); }}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { routes, analytics, requestLog } = useGateway();

  const totals = useMemo(() => {
    const vals = Object.values(analytics);
    return {
      requests: vals.reduce((s, a) => s + a.totalRequests, 0),
      errors: vals.reduce((s, a) => s + a.errorCount, 0),
      rateLimitHits: vals.reduce((s, a) => s + a.rateLimitHits, 0),
      authFailures: vals.reduce((s, a) => s + a.authFailures, 0),
    };
  }, [analytics]);

  // Last 24h request volume by hour
  const hourlyVolume = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 24 }, (_, i) => {
      const start = now - (23 - i) * 3_600_000;
      const end = start + 3_600_000;
      return { hour: new Date(start).getHours(), count: requestLog.filter(r => r.timestamp >= start && r.timestamp < end).length };
    });
  }, [requestLog]);

  const maxHourly = Math.max(...hourlyVolume.map(h => h.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total Requests', value: totals.requests, color: 'var(--color-text-primary)' },
          { label: 'Errors', value: totals.errors, color: 'var(--color-error)' },
          { label: 'Rate Limit Hits', value: totals.rateLimitHits, color: 'var(--color-warning)' },
          { label: 'Auth Failures', value: totals.authFailures, color: '#e94560' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Hourly volume sparkbar */}
      <Card title="Request Volume (last 24h)">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
          {hourlyVolume.map((h, i) => (
            <div key={i} title={`${h.hour}:00 — ${h.count} req`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', background: 'var(--color-highlight)', borderRadius: '2px 2px 0 0', height: `${Math.max(2, (h.count / maxHourly) * 52)}px`, opacity: 0.8 }} />
              {i % 6 === 0 && <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{h.hour}h</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Per-route table */}
      <Card title="Route Analytics">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Route', 'Requests', 'Success', 'Errors', 'Avg Latency', 'p95', 'Rate Limit Hits', 'Last Request'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const a = analytics[r.id];
                const successRate = a ? Math.round((a.successCount / a.totalRequests) * 100) : 100;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '8px 10px' }}>{a?.totalRequests ?? 0}</td>
                    <td style={{ padding: '8px 10px', color: successRate >= 95 ? 'var(--color-success)' : 'var(--color-warning)' }}>{a ? `${successRate}%` : '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-error)' }}>{a?.errorCount ?? 0}</td>
                    <td style={{ padding: '8px 10px' }}>{a ? fmtMs(a.avgLatencyMs) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{a ? fmtMs(a.p95LatencyMs) : '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-warning)' }}>{a?.rateLimitHits ?? 0}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{a?.lastRequest ? timeAgo(a.lastRequest) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Request Log ─────────────────────────────────────────────────────────

function RequestLogTab() {
  const { requestLog, routes, clearRequestLog, downloadRequestLogCSV } = useGateway();
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = requestLog.filter(r => {
    const matchRoute = routeFilter === 'all' || r.routeId === routeFilter;
    const matchStatus = statusFilter === 'all'
      || (statusFilter === '2xx' && r.statusCode >= 200 && r.statusCode < 300)
      || (statusFilter === '4xx' && r.statusCode >= 400 && r.statusCode < 500)
      || (statusFilter === '5xx' && r.statusCode >= 500);
    return matchRoute && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)}
          style={{ padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
          <option value="all">All routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
          <option value="all">All statuses</option>
          <option value="2xx">2xx Success</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{filtered.length} entries</span>
        <Btn onClick={downloadRequestLogCSV}>↓ Export CSV</Btn>
        <Btn variant="danger" onClick={() => { if (confirm('Clear all request logs?')) clearRequestLog(); }}>Clear</Btn>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Time', 'Route', 'Method', 'Path', 'Status', 'Latency', 'Error'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>No requests logged yet. Use the Playground to make requests.</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                <td style={{ padding: '6px 10px' }}>{routes.find(rt => rt.id === r.routeId)?.name ?? r.routeId}</td>
                <td style={{ padding: '6px 10px' }}><Badge label={r.method} color={METHOD_COLORS[r.method]} /></td>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</td>
                <td style={{ padding: '6px 10px', fontWeight: 600, color: STATUS_COLOR(r.statusCode) }}>{r.statusCode}</td>
                <td style={{ padding: '6px 10px' }}>{fmtMs(r.latencyMs)}</td>
                <td style={{ padding: '6px 10px', color: 'var(--color-error)', fontSize: 11 }}>{r.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Playground ─────────────────────────────────────────────────────────

function PlaygroundTab() {
  const { routes, dispatch } = useGateway();
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ status: number; latency: number } | null>(null);

  const selectedRoute = routes.find(r => r.id === routeId);

  async function handleSend() {
    if (!path) return;
    setLoading(true);
    setResponse(null);
    try {
      let parsedBody: unknown;
      if (body.trim()) { try { parsedBody = JSON.parse(body); } catch { parsedBody = body; } }
      const res = await dispatch({ method, path, apiKey: apiKey || undefined, body: parsedBody });
      setMeta({ status: res.statusCode, latency: res.latencyMs });
      setResponse(JSON.stringify(res, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="API Playground">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Route</label>
            <Select value={routeId} onChange={v => { setRouteId(v); const r = routes.find(rt => rt.id === v); if (r) setMethod(r.methods[0]); }}
              options={routes.map(r => ({ value: r.id, label: r.name }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Method</label>
            <Select value={method} onChange={v => setMethod(v as HttpMethod)}
              options={(selectedRoute?.methods ?? ['GET']).map(m => ({ value: m, label: m }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Path</label>
            <Input value={path} onChange={setPath} placeholder={selectedRoute?.pattern.replace('*', 'example') ?? '/api/...'} mono />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>API Key (optional)</label>
            <Input value={apiKey} onChange={setApiKey} placeholder="fidelis_..." mono />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Request Body (JSON)</label>
            <Input value={body} onChange={setBody} placeholder='{"key": "value"}' mono />
          </div>
        </div>
        <Btn variant="success" onClick={handleSend} disabled={loading || !path}>{loading ? 'Sending…' : '▶ Send Request'}</Btn>
      </Card>

      {(response || meta) && (
        <Card title={meta ? `Response — ${meta.status} · ${fmtMs(meta.latency)}` : 'Response'}>
          <pre style={{ fontSize: 12, color: meta && meta.status >= 400 ? 'var(--color-error)' : 'var(--color-success)', background: 'var(--color-bg-primary)', padding: 12, borderRadius: 4, overflow: 'auto', maxHeight: 320, margin: 0 }}>
            {response}
          </pre>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Docs ────────────────────────────────────────────────────────────────

function DocsTab() {
  const { routes, defaultVersion } = useGateway();
  const [selected, setSelected] = useState(routes[0]?.id ?? '');
  const route = routes.find(r => r.id === selected);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600 }}>ROUTES</div>
        {routes.map(r => (
          <button key={r.id} onClick={() => setSelected(r.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13,
            background: selected === r.id ? 'var(--color-bg-tertiary)' : 'none',
            border: 'none', borderRadius: 4, cursor: 'pointer',
            color: r.enabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            borderLeft: selected === r.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
          }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Doc panel */}
      {route && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{route.name}</h3>
            {route.description && <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>{route.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {route.methods.map(m => <Badge key={m} label={m} color={METHOD_COLORS[m]} />)}
            <Badge label={`Version: ${route.version}`} color="#4fc3f7" />
            <Badge label={route.enabled ? 'enabled' : 'disabled'} color={route.enabled ? 'var(--color-success)' : 'var(--color-error)'} />
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Endpoint Pattern</div>
            <code style={{ fontSize: 13, color: 'var(--color-highlight)' }}>{route.pattern}</code>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 4 }}>Upstream</div>
            <code style={{ fontSize: 12 }}>{route.upstream}</code>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Authentication</div>
            <div style={{ fontSize: 13 }}>Strategy: <Badge label={route.auth.strategy} color="#4fc3f7" /></div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Required: <strong>{route.auth.required ? 'Yes' : 'No'}</strong></div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rate Limiting</div>
            {route.rateLimit.enabled
              ? <div style={{ fontSize: 13 }}>{route.rateLimit.requestsPerWindow} requests per {route.rateLimit.windowMs / 1000}s window</div>
              : <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Disabled</div>
            }
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Request Transforms</div>
            {route.transforms.addRequestHeaders && Object.keys(route.transforms.addRequestHeaders).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Added Headers</div>
                {Object.entries(route.transforms.addRequestHeaders).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12, fontFamily: 'monospace' }}>{k}: {v}</div>
                ))}
              </div>
            )}
            {route.transforms.injectApiVersion && <div style={{ fontSize: 12 }}>Injects <code>X-Api-Version: {defaultVersion}</code></div>}
            {route.transforms.stripResponseFields?.length ? <div style={{ fontSize: 12, marginTop: 6 }}>Strips response fields: {route.transforms.stripResponseFields.join(', ')}</div> : null}
          </div>
          {route.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {route.tags.map(t => <Badge key={t} label={t} color="var(--color-text-muted)" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root ApiGatewayPortal ────────────────────────────────────────────────────

type GatewayTab = 'routes' | 'keys' | 'analytics' | 'log' | 'playground' | 'docs';

export function ApiGatewayPortal(): JSX.Element {
  const { routes, apiKeys, requestLog, maintenanceMode, setMaintenanceMode, defaultVersion } = useGateway();
  const [tab, setTab] = useState<GatewayTab>('routes');

  const tabs: { id: GatewayTab; label: string }[] = [
    { id: 'routes', label: `🔀 Routes (${routes.length})` },
    { id: 'keys', label: `🔑 API Keys (${apiKeys.length})` },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'log', label: `📋 Request Log (${requestLog.length})` },
    { id: 'playground', label: '▶ Playground' },
    { id: 'docs', label: '📖 Docs' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>API Gateway</h2>
          <Badge label={`API ${defaultVersion}`} color="#4fc3f7" />
          {maintenanceMode && <Badge label="Maintenance Mode" color="var(--color-warning)" />}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Maintenance:</span>
          <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} aria-label="Toggle maintenance mode" />
        </div>
      </div>

      {maintenanceMode && (
        <div style={{ padding: '10px 14px', background: '#ffc10722', border: '1px solid var(--color-warning)', borderRadius: 6, fontSize: 13, color: 'var(--color-warning)' }}>
          ⚠ Gateway is in maintenance mode. All requests will return 503.
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? 'var(--color-highlight)' : 'var(--color-text-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
            fontWeight: tab === t.id ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {tab === 'routes' && <RoutesTab />}
        {tab === 'keys' && <ApiKeysTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'log' && <RequestLogTab />}
        {tab === 'playground' && <PlaygroundTab />}
        {tab === 'docs' && <DocsTab />}
      </div>
    </div>
  );
}
