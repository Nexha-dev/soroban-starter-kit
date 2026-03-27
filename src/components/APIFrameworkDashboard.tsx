import React, { useState, useEffect, useCallback } from 'react';
import {
  apiFrameworkService,
  type APIClient,
  type PipelineResponse,
  type RequestLog,
  type ClientMetrics,
  type AuthCredential,
  type CacheEntry,
  type TestSuiteResult,
  type TestResult,
  type IntegrationTest,
  type EndpointStatus,
} from '../services/api/apiFrameworkService';

type Tab = 'clients' | 'playground' | 'monitoring' | 'auth' | 'cache' | 'testing' | 'docs';

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 13px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: active ? '#1e40af' : '#e9ecef',
    color: active ? 'white' : '#374151',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
  };
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#16a34a', POST: '#2563eb', PUT: '#d97706', DELETE: '#dc2626', PATCH: '#7c3aed',
};

const STATUS_COLORS = (code: number): string =>
  code < 300 ? '#16a34a' : code < 400 ? '#2563eb' : code < 500 ? '#d97706' : '#dc2626';

function statusDot(status: EndpointStatus): React.ReactElement {
  const colors: Record<EndpointStatus, string> = { healthy: '#16a34a', degraded: '#d97706', down: '#dc2626', unknown: '#9ca3af' };
  return <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors[status], marginRight: '6px' }} />;
}

function badge(text: string, color: string): React.ReactElement {
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '10px', backgroundColor: color + '22', color, border: `1px solid ${color}44`, fontSize: '11px', fontWeight: 600 }}>
      {text}
    </span>
  );
}

function progressBar(pct: number, color: string): React.ReactElement {
  return (
    <div style={{ backgroundColor: '#e9ecef', borderRadius: '3px', height: '6px' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: '3px', height: '100%' }} />
    </div>
  );
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab({ clients, onSelect }: { clients: APIClient[]; onSelect: (c: APIClient) => void }): React.ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    if (!newName || !newUrl) return;
    apiFrameworkService.registerClient({ name: newName, baseUrl: newUrl, version: 'v1', description: '', authType: 'none', tags: [], lastUsed: undefined });
    setNewName(''); setNewUrl(''); setShowAdd(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding: '6px 14px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          + Register Client
        </button>
      </div>

      {showAdd && (
        <div style={{ ...card, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Register New API Client</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client name…"
              style={{ flex: '1 1 160px', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Base URL…"
              style={{ flex: '2 1 240px', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
            <button onClick={handleAdd}
              style={{ padding: '6px 14px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Add
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '6px 14px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {clients.map((client) => (
        <div key={client.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {statusDot(client.status)}
                <strong style={{ fontSize: '14px' }}>{client.name}</strong>
                {badge(client.version, '#1e40af')}
                {badge(client.authType, '#374151')}
                {client.tags.map((t) => <span key={t} style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px' }}>#{t}</span>)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{client.baseUrl}</div>
              {client.description && <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px' }}>{client.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>
                <div>{client.totalRequests.toLocaleString()} reqs</div>
                <div>{(client.successRate * 100).toFixed(1)}% success</div>
                <div>{fmtMs(client.avgLatencyMs)} avg</div>
              </div>
              <button onClick={() => onSelect(client)}
                style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                Try
              </button>
              <button onClick={() => setExpanded(expanded === client.id ? null : client.id)}
                style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white' }}>
                {expanded === client.id ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {expanded === client.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Endpoints ({client.endpoints.length})
              </div>
              {client.endpoints.map((ep) => (
                <div key={ep.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f9fafb', fontSize: '13px' }}>
                  <span style={{ color: METHOD_COLORS[ep.method] ?? '#374151', fontWeight: 700, fontFamily: 'monospace', width: '50px', flexShrink: 0 }}>{ep.method}</span>
                  <span style={{ fontFamily: 'monospace', color: '#374151', flex: 1 }}>{ep.path}</span>
                  <span style={{ color: '#6b7280', flex: 2 }}>{ep.summary}</span>
                  {ep.cacheable && <span style={{ fontSize: '10px', color: '#16a34a' }}>cached</span>}
                  {ep.deprecated && <span style={{ fontSize: '10px', color: '#dc2626' }}>deprecated</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Playground Tab ───────────────────────────────────────────────────────────

function PlaygroundTab({ initialClient }: { initialClient: APIClient | null }): React.ReactElement {
  const clients = apiFrameworkService.getClients();
  const [clientId, setClientId] = useState(initialClient?.id ?? clients[0]?.id ?? '');
  const [endpointId, setEndpointId] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [skipCache, setSkipCache] = useState(false);
  const [response, setResponse] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PipelineResponse[]>([]);

  const client = clients.find((c) => c.id === clientId);
  const endpoint = client?.endpoints.find((e) => e.id === endpointId);

  useEffect(() => {
    if (initialClient) setClientId(initialClient.id);
  }, [initialClient]);

  useEffect(() => {
    if (client?.endpoints.length) {
      setEndpointId(client.endpoints[0].id);
      setParams({});
    }
  }, [clientId]);

  useEffect(() => {
    if (endpoint?.params) {
      const defaults: Record<string, string> = {};
      endpoint.params.forEach((p) => { if (p.example) defaults[p.name] = p.example; });
      setParams(defaults);
    }
  }, [endpointId]);

  const handleSend = async () => {
    if (!clientId || !endpointId) return;
    setLoading(true);
    try {
      const res = await apiFrameworkService.execute({
        clientId, endpointId, params, skipCache,
        body: body ? JSON.parse(body) : undefined,
      });
      setResponse(res);
      setHistory((h) => [res, ...h].slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* Request panel */}
      <div>
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Request Builder</h3>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>API Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Endpoint</label>
            <select value={endpointId} onChange={(e) => setEndpointId(e.target.value)}
              style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
              {client?.endpoints.map((e) => (
                <option key={e.id} value={e.id}>[{e.method}] {e.path} — {e.summary}</option>
              ))}
            </select>
          </div>

          {endpoint?.params && endpoint.params.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Parameters</label>
              {endpoint.params.map((p) => (
                <div key={p.name} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#374151', width: '100px', flexShrink: 0 }}>
                    {p.name} <span style={{ color: p.required ? '#dc2626' : '#9ca3af' }}>{p.required ? '*' : '?'}</span>
                  </span>
                  <input value={params[p.name] ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                    placeholder={p.example ?? p.type}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} />
                  <span style={{ fontSize: '10px', color: '#9ca3af' }}>{p.in}</span>
                </div>
              ))}
            </div>
          )}

          {endpoint && ['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Request Body (JSON)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                placeholder={JSON.stringify(endpoint.requestBody?.reduce<Record<string, string>>((a, f) => { a[f.name] = String(f.example ?? ''); return a; }, {}) ?? {}, null, 2)}
                style={{ width: '100%', padding: '7px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={skipCache} onChange={(e) => setSkipCache(e.target.checked)} />
              Skip cache
            </label>
            <button onClick={handleSend} disabled={loading || !endpointId}
              style={{ padding: '7px 18px', backgroundColor: loading ? '#9ca3af' : '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {loading ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={card}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 }}>Request History</h4>
            {history.map((h, i) => (
              <div key={h.requestId} onClick={() => setResponse(h)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px', cursor: 'pointer' }}>
                <span style={{ color: STATUS_COLORS(h.statusCode), fontWeight: 600 }}>{h.statusCode}</span>
                <span style={{ color: '#374151', flex: 1, marginLeft: '8px' }}>{h.endpointId}</span>
                <span style={{ color: '#6b7280' }}>{fmtMs(h.latencyMs)}</span>
                {h.fromCache && <span style={{ color: '#16a34a', marginLeft: '6px' }}>cache</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Response panel */}
      <div>
        <div style={card}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Response</h3>
          {!response && !loading && (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>Send a request to see the response here.</p>
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '13px' }}>Executing request…</div>
          )}
          {response && !loading && (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: STATUS_COLORS(response.statusCode) }}>{response.statusCode}</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{fmtMs(response.latencyMs)}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{fmtBytes(response.size)}</span>
                {response.fromCache && badge('Cache HIT', '#16a34a')}
                {response.retryCount > 0 && badge(`${response.retryCount} retry`, '#d97706')}
              </div>

              {response.error && (
                <div style={{ padding: '8px 10px', backgroundColor: '#fef2f2', borderRadius: '4px', color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>
                  {response.error}
                </div>
              )}

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Headers</div>
                <div style={{ backgroundColor: '#f9fafb', padding: '8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k}><span style={{ color: '#6b7280' }}>{k}: </span>{v}</div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Body</div>
                <pre style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '4px', fontSize: '12px', overflow: 'auto', maxHeight: '320px', margin: 0 }}>
                  {response.data !== null ? JSON.stringify(response.data, null, 2) : 'null'}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Monitoring Tab ───────────────────────────────────────────────────────────

function MonitoringTab(): React.ReactElement {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [metrics, setMetrics] = useState<ClientMetrics[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const clients = apiFrameworkService.getClients();

  useEffect(() => {
    const refresh = () => {
      setLogs(apiFrameworkService.getLogs(50));
      setMetrics(apiFrameworkService.getAllMetrics());
    };
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const selected = metrics.find((m) => m.clientId === selectedMetric);

  return (
    <div>
      {/* Client health overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {clients.map((client) => {
          const m = metrics.find((m) => m.clientId === client.id);
          return (
            <div key={client.id} onClick={() => setSelectedMetric(client.id)}
              style={{ ...card, cursor: 'pointer', borderTop: `3px solid ${client.status === 'healthy' ? '#16a34a' : client.status === 'degraded' ? '#d97706' : '#dc2626'}`, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                {statusDot(client.status)}
                <strong style={{ fontSize: '13px' }}>{client.name}</strong>
              </div>
              {m && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px', marginBottom: '6px' }}>
                    <div><span style={{ color: '#6b7280' }}>Avg: </span>{fmtMs(m.avgLatencyMs)}</div>
                    <div><span style={{ color: '#6b7280' }}>P95: </span>{fmtMs(m.p95LatencyMs)}</div>
                    <div><span style={{ color: '#6b7280' }}>Errors: </span><span style={{ color: m.errorRate > 0.05 ? '#dc2626' : '#374151' }}>{(m.errorRate * 100).toFixed(1)}%</span></div>
                    <div><span style={{ color: '#6b7280' }}>SLA: </span><span style={{ color: m.slaCompliance < 95 ? '#d97706' : '#16a34a' }}>{m.slaCompliance}%</span></div>
                  </div>
                  {progressBar(m.slaCompliance, m.slaCompliance >= 99 ? '#16a34a' : m.slaCompliance >= 95 ? '#d97706' : '#dc2626')}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected client detail */}
      {selected && (
        <div style={card}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
            Latency Trend — {clients.find((c) => c.id === selected.clientId)?.name}
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px', marginBottom: '8px' }}>
            {selected.latencySeries.map((point, i) => {
              const maxVal = Math.max(...selected.latencySeries.map((p) => p.p95), 1);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div title={`P95: ${point.p95}ms`}
                    style={{ width: '100%', backgroundColor: '#bfdbfe', borderRadius: '2px 2px 0 0', height: `${(point.p95 / maxVal) * 70}px` }} />
                  <div title={`Avg: ${point.avg}ms`}
                    style={{ width: '60%', backgroundColor: '#1e40af', borderRadius: '2px 2px 0 0', height: `${(point.avg / maxVal) * 70}px`, marginTop: `-${(point.p95 / maxVal) * 70}px` }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
            {selected.latencySeries.filter((_, i) => i % 3 === 0).map((p) => <span key={p.time}>{p.time}</span>)}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#1e40af', borderRadius: '2px' }} /> Avg</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#bfdbfe', borderRadius: '2px' }} /> P95</span>
          </div>
        </div>
      )}

      {/* Request log */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Request Log (last 50)</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Time', 'Client', 'Method', 'Path', 'Status', 'Latency', 'Size', 'Cache'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtTime(log.timestamp)}</td>
                  <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{log.clientName}</td>
                  <td style={{ padding: '6px' }}><span style={{ color: METHOD_COLORS[log.method], fontWeight: 700 }}>{log.method}</span></td>
                  <td style={{ padding: '6px', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.path}</td>
                  <td style={{ padding: '6px', color: STATUS_COLORS(log.statusCode), fontWeight: 600 }}>{log.statusCode}</td>
                  <td style={{ padding: '6px', color: log.latencyMs > 500 ? '#dc2626' : '#374151' }}>{fmtMs(log.latencyMs)}</td>
                  <td style={{ padding: '6px', color: '#6b7280' }}>{fmtBytes(log.size)}</td>
                  <td style={{ padding: '6px' }}>{log.fromCache ? <span style={{ color: '#16a34a', fontWeight: 600 }}>HIT</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Tab ─────────────────────────────────────────────────────────────────

function AuthTab(): React.ReactElement {
  const [creds, setCreds] = useState<AuthCredential[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AuthCredential['type']>('api-key');
  const [newSecret, setNewSecret] = useState('');

  const refresh = () => setCreds(apiFrameworkService.getCredentials());
  useEffect(() => { refresh(); }, []);

  const handleAdd = () => {
    if (!newName || !newSecret) return;
    apiFrameworkService.addCredential({
      name: newName, type: newType,
      maskedSecret: newSecret.slice(0, 4) + '••••••••••••••••' + newSecret.slice(-4),
      scopes: ['read'], linkedClientIds: [],
    });
    setNewName(''); setNewSecret(''); setShowAdd(false);
    refresh();
  };

  const AUTH_LABELS: Record<string, string> = { 'api-key': 'API Key', bearer: 'Bearer Token', basic: 'Basic Auth', oauth2: 'OAuth 2.0', none: 'None' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding: '6px 14px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          + Add Credential
        </button>
      </div>

      {showAdd && (
        <div style={{ ...card, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add Credential</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Credential name…"
              style={{ flex: '1 1 160px', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
            <select value={newType} onChange={(e) => setNewType(e.target.value as AuthCredential['type'])}
              style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
              {Object.entries(AUTH_LABELS).filter(([k]) => k !== 'none').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input value={newSecret} onChange={(e) => setNewSecret(e.target.value)} placeholder="Secret value (will be masked)…" type="password"
              style={{ flex: '2 1 200px', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
            <button onClick={handleAdd}
              style={{ padding: '6px 14px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Save
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '6px 14px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {creds.map((cred) => {
        const isExpired = cred.expiresAt && cred.expiresAt < Date.now();
        const isExpiringSoon = cred.expiresAt && !isExpired && cred.expiresAt < Date.now() + 3 * 86_400_000;
        return (
          <div key={cred.id} style={{ ...card, borderLeft: `4px solid ${isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : '#16a34a'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '14px' }}>{cred.name}</strong>
                  {badge(AUTH_LABELS[cred.type] ?? cred.type, '#1e40af')}
                  {isExpired && badge('Expired', '#dc2626')}
                  {isExpiringSoon && badge('Expiring soon', '#d97706')}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  {cred.maskedSecret}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Scopes: {cred.scopes.join(', ')} · Created: {new Date(cred.createdAt).toLocaleDateString()}
                  {cred.expiresAt && ` · Expires: ${new Date(cred.expiresAt).toLocaleDateString()}`}
                  {cred.lastUsed && ` · Last used: ${fmtTime(cred.lastUsed)}`}
                </div>
              </div>
              <button onClick={() => { apiFrameworkService.revokeCredential(cred.id); refresh(); }}
                style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #fca5a5', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fef2f2', color: '#dc2626' }}>
                Revoke
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cache Tab ────────────────────────────────────────────────────────────────

function CacheTab(): React.ReactElement {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [stats, setStats] = useState({ entries: 0, totalSize: 0, hitRate: 0 });

  const refresh = () => {
    setEntries(apiFrameworkService.getCacheEntries());
    setStats(apiFrameworkService.getCacheStats());
  };
  useEffect(() => { refresh(); }, []);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Cached Entries', value: stats.entries },
          { label: 'Total Size', value: fmtBytes(stats.totalSize) },
          { label: 'Hit Rate', value: `${(stats.hitRate * 100).toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: 'white', padding: '14px', borderRadius: '6px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button onClick={refresh}
          style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', backgroundColor: 'white' }}>
          Refresh
        </button>
        <button onClick={() => { apiFrameworkService.invalidateCache(); refresh(); }}
          style={{ padding: '6px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          Flush All
        </button>
      </div>

      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Cache Entries</h4>
        {entries.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No active cache entries.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Key', 'Size', 'Hits', 'Expires', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '7px 6px', fontFamily: 'monospace', fontSize: '12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.key}</td>
                  <td style={{ padding: '7px 6px', color: '#6b7280' }}>{fmtBytes(e.size)}</td>
                  <td style={{ padding: '7px 6px' }}>{e.hitCount}</td>
                  <td style={{ padding: '7px 6px', color: e.expiresAt - Date.now() < 10_000 ? '#dc2626' : '#374151' }}>
                    {fmtMs(Math.max(0, e.expiresAt - Date.now()))}
                  </td>
                  <td style={{ padding: '7px 6px' }}>
                    <button onClick={() => { apiFrameworkService.invalidateCache(e.key); refresh(); }}
                      style={{ padding: '2px 8px', fontSize: '11px', border: '1px solid #fca5a5', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fef2f2', color: '#dc2626' }}>
                      Evict
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Testing Tab ──────────────────────────────────────────────────────────────

function TestingTab(): React.ReactElement {
  const tests = apiFrameworkService.getTests();
  const [suiteResult, setSuiteResult] = useState<TestSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());

  const toggleTest = (id: string) => {
    const next = new Set(selectedTests);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTests(next);
  };

  const runSuite = async () => {
    setRunning(true);
    const ids = selectedTests.size > 0 ? [...selectedTests] : undefined;
    const result = await apiFrameworkService.runSuite(
      'suite-1',
      selectedTests.size > 0 ? `Selected (${selectedTests.size})` : 'Full Suite',
      ids
    );
    setSuiteResult(result);
    setRunning(false);
  };

  const testByClient: Record<string, IntegrationTest[]> = {};
  tests.forEach((t) => {
    if (!testByClient[t.clientId]) testByClient[t.clientId] = [];
    testByClient[t.clientId].push(t);
  });
  const clients = apiFrameworkService.getClients();

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <button onClick={runSuite} disabled={running}
          style={{ padding: '7px 16px', backgroundColor: running ? '#9ca3af' : '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
          {running ? 'Running…' : selectedTests.size > 0 ? `Run Selected (${selectedTests.size})` : 'Run All Tests'}
        </button>
        {selectedTests.size > 0 && (
          <button onClick={() => setSelectedTests(new Set())}
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', backgroundColor: 'white' }}>
            Clear Selection
          </button>
        )}
        {suiteResult && (
          <span style={{ fontSize: '13px', color: suiteResult.failed > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {suiteResult.passed}/{suiteResult.total} passed · {fmtMs(suiteResult.duration)}
          </span>
        )}
      </div>

      {/* Suite result summary */}
      {suiteResult && (
        <div style={{ ...card, backgroundColor: suiteResult.failed > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${suiteResult.failed > 0 ? '#fca5a5' : '#86efac'}` }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
            <span><strong style={{ color: '#16a34a' }}>✓ {suiteResult.passed}</strong> passed</span>
            <span><strong style={{ color: '#dc2626' }}>✗ {suiteResult.failed}</strong> failed</span>
            <span><strong style={{ color: '#9ca3af' }}>{suiteResult.skipped}</strong> skipped</span>
            <span style={{ color: '#6b7280' }}>Total: {fmtMs(suiteResult.duration)}</span>
          </div>
        </div>
      )}

      {/* Tests grouped by client */}
      {Object.entries(testByClient).map(([clientId, clientTests]) => {
        const client = clients.find((c) => c.id === clientId);
        return (
          <div key={clientId} style={card}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
              {client?.name ?? clientId}
            </h4>
            {clientTests.map((test) => {
              const result = suiteResult?.results.find((r) => r.testId === test.id);
              return (
                <div key={test.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={selectedTests.has(test.id)} onChange={() => toggleTest(test.id)} />
                    <span style={{ flex: 1, fontSize: '13px' }}>{test.name}</span>
                    {test.tags.map((t) => <span key={t} style={{ fontSize: '10px', color: '#6b7280' }}>#{t}</span>)}
                    {result && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: result.status === 'pass' ? '#16a34a' : '#dc2626' }}>
                        {result.status === 'pass' ? '✓ Pass' : '✗ Fail'} ({fmtMs(result.duration)})
                      </span>
                    )}
                  </div>
                  {result && result.assertions.length > 0 && (
                    <div style={{ marginLeft: '24px', marginTop: '6px' }}>
                      {result.assertions.map((a) => (
                        <div key={a.id} style={{ fontSize: '12px', color: a.passed ? '#16a34a' : '#dc2626', marginBottom: '2px' }}>
                          {a.passed ? '✓' : '✗'} {a.description}{!a.passed && a.actual ? ` (got: ${a.actual})` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Docs Tab ─────────────────────────────────────────────────────────────────

function DocsTab(): React.ReactElement {
  const clients = apiFrameworkService.getClients();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [showGenerated, setShowGenerated] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}
          style={{ flex: 1, padding: '7px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setShowGenerated(!showGenerated)}
          style={{ padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', backgroundColor: showGenerated ? '#1e40af' : 'white', color: showGenerated ? 'white' : '#374151' }}>
          {showGenerated ? 'Hide' : 'View'} Generated Client
        </button>
      </div>

      {client && (
        <>
          {/* Overview */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700 }}>{client.name}</h3>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{client.description}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {badge(`Base: ${client.baseUrl}`, '#374151')}
                  {badge(client.version, '#1e40af')}
                  {badge(`Auth: ${client.authType}`, '#6b7280')}
                  {client.tags.map((t) => badge(t, '#16a34a'))}
                </div>
              </div>
              {statusDot(client.status)}
            </div>
          </div>

          {/* Generated client code */}
          {showGenerated && (
            <div style={card}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 }}>Generated TypeScript Client</h4>
              <pre style={{ backgroundColor: '#0f172a', color: '#e2e8f0', padding: '14px', borderRadius: '4px', fontSize: '12px', overflow: 'auto', maxHeight: '280px', margin: 0 }}>
                {apiFrameworkService.generateClientDoc(clientId)}
              </pre>
            </div>
          )}

          {/* Endpoint reference */}
          <div style={card}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Endpoint Reference ({client.endpoints.length})</h4>
            {client.endpoints.map((ep) => (
              <div key={ep.id} style={{ borderBottom: '1px solid #f3f4f6', marginBottom: '4px' }}>
                <div onClick={() => setActiveEndpoint(activeEndpoint === ep.id ? null : ep.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', cursor: 'pointer' }}>
                  <span style={{ color: METHOD_COLORS[ep.method], fontWeight: 700, fontFamily: 'monospace', width: '55px' }}>{ep.method}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', flex: 1 }}>{ep.path}</span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 2 }}>{ep.summary}</span>
                  {ep.cacheable && badge(`TTL ${fmtMs(ep.cacheTtlMs ?? 0)}`, '#16a34a')}
                  {ep.deprecated && badge('deprecated', '#dc2626')}
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>{activeEndpoint === ep.id ? '▲' : '▼'}</span>
                </div>

                {activeEndpoint === ep.id && (
                  <div style={{ paddingLeft: '65px', paddingBottom: '12px' }}>
                    {ep.description && <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 8px 0' }}>{ep.description}</p>}

                    {ep.params && ep.params.length > 0 && (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Parameters</div>
                        {ep.params.map((p) => (
                          <div key={p.name} style={{ fontSize: '12px', marginBottom: '3px' }}>
                            <code style={{ color: '#1e40af' }}>{p.name}</code>
                            <span style={{ color: '#9ca3af' }}> ({p.in})</span>
                            <span style={{ color: p.required ? '#dc2626' : '#9ca3af' }}>{p.required ? ' required' : ' optional'}</span>
                            {p.description && <span style={{ color: '#6b7280' }}> — {p.description}</span>}
                            {p.example && <span style={{ color: '#16a34a' }}> e.g. {p.example}</span>}
                          </div>
                        ))}
                      </>
                    )}

                    {ep.responseSchema && ep.responseSchema.length > 0 && (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '8px 0 4px 0' }}>Response Schema</div>
                        {ep.responseSchema.map((f) => (
                          <div key={f.name} style={{ fontSize: '12px', marginBottom: '2px' }}>
                            <code style={{ color: '#1e40af' }}>{f.name}</code>
                            <span style={{ color: '#9ca3af' }}> {f.type}</span>
                            {f.required && <span style={{ color: '#dc2626' }}> *</span>}
                            {f.description && <span style={{ color: '#6b7280' }}> — {f.description}</span>}
                          </div>
                        ))}
                      </>
                    )}

                    {ep.exampleResponse && (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '8px 0 4px 0' }}>Example Response</div>
                        <pre style={{ backgroundColor: '#f9fafb', padding: '8px', borderRadius: '4px', fontSize: '11px', margin: 0, overflow: 'auto' }}>
                          {JSON.stringify(ep.exampleResponse, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function APIFrameworkDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<APIClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<APIClient | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setClients(apiFrameworkService.getClients());
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleSelectClient = (client: APIClient) => {
    setSelectedClient(client);
    setTab('playground');
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'clients', label: `Clients (${clients.length})` },
    { id: 'playground', label: 'Playground' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'auth', label: 'Auth' },
    { id: 'cache', label: 'Cache' },
    { id: 'testing', label: 'Testing' },
    { id: 'docs', label: 'Docs' },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>API Integration Framework</h2>
        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
          <span>{clients.filter((c) => c.status === 'healthy').length}/{clients.length} healthy</span>
          <span>·</span>
          <span>{clients.reduce((s, c) => s + c.totalRequests, 0).toLocaleString()} total requests</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(({ id, label }) => (
          <button key={id} style={tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'clients' && <ClientsTab key={tick} clients={clients} onSelect={handleSelectClient} />}
      {tab === 'playground' && <PlaygroundTab key={selectedClient?.id} initialClient={selectedClient} />}
      {tab === 'monitoring' && <MonitoringTab key={tick} />}
      {tab === 'auth' && <AuthTab key={tick} />}
      {tab === 'cache' && <CacheTab key={tick} />}
      {tab === 'testing' && <TestingTab key={tick} />}
      {tab === 'docs' && <DocsTab key={tick} />}
    </div>
  );
}

export default APIFrameworkDashboard;
