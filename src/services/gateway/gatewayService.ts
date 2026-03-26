import {
  GatewayState, ApiRoute, ApiKey, RequestLog, RouteAnalytics,
  GatewayRequest, GatewayResponse, RateLimitPolicy, ApiKeyScope,
} from './types';

const STORAGE_KEY = 'api_gateway_state';

// ─── Default routes ───────────────────────────────────────────────────────────

const DEFAULT_ROUTES: ApiRoute[] = [
  {
    id: 'soroban-rpc',
    name: 'Soroban RPC',
    pattern: '/soroban/*',
    upstream: 'https://soroban-testnet.stellar.org',
    version: 'v1',
    methods: ['POST'],
    auth: { strategy: 'api_key', required: false },
    rateLimit: { enabled: true, requestsPerWindow: 100, windowMs: 60_000, burstAllowance: 10 },
    transforms: { injectApiVersion: true, addRequestHeaders: { 'X-Gateway': 'fidelis-v1' } },
    enabled: true,
    tags: ['soroban', 'blockchain'],
    description: 'Soroban smart contract RPC endpoint',
  },
  {
    id: 'horizon-api',
    name: 'Horizon API',
    pattern: '/horizon/*',
    upstream: 'https://horizon-testnet.stellar.org',
    version: 'v1',
    methods: ['GET', 'POST'],
    auth: { strategy: 'none', required: false },
    rateLimit: { enabled: true, requestsPerWindow: 200, windowMs: 60_000 },
    transforms: { injectApiVersion: true },
    enabled: true,
    tags: ['horizon', 'stellar'],
    description: 'Stellar Horizon REST API',
  },
  {
    id: 'internal-storage',
    name: 'Internal Storage API',
    pattern: '/api/storage/*',
    upstream: 'internal',
    version: 'v1',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    auth: { strategy: 'session', required: true, scopes: ['read', 'write'] },
    rateLimit: { enabled: true, requestsPerWindow: 500, windowMs: 60_000 },
    transforms: { addResponseHeaders: { 'X-Data-Source': 'indexeddb' } },
    enabled: true,
    tags: ['internal', 'storage'],
    description: 'Internal IndexedDB storage layer',
  },
  {
    id: 'price-feed',
    name: 'Price Feed',
    pattern: '/api/prices/*',
    upstream: 'https://api.stellar.expert',
    version: 'v1',
    methods: ['GET'],
    auth: { strategy: 'api_key', required: false },
    rateLimit: { enabled: true, requestsPerWindow: 60, windowMs: 60_000 },
    transforms: { stripResponseFields: ['_links'], injectApiVersion: true },
    enabled: true,
    tags: ['prices', 'market'],
    description: 'Token price feed from Stellar Expert',
  },
];

// ─── Rate limit buckets (in-memory) ──────────────────────────────────────────

interface RateBucket {
  count: number;
  windowStart: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class GatewayService {
  private state: GatewayState;
  private listeners: Set<(s: GatewayState) => void> = new Set();
  private rateBuckets: Map<string, RateBucket> = new Map();

  constructor() {
    const stored = this.load();
    this.state = stored ?? this.defaultState();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private defaultState(): GatewayState {
    return {
      routes: DEFAULT_ROUTES,
      apiKeys: [],
      requestLog: [],
      analytics: {},
      globalRateLimit: { enabled: true, requestsPerWindow: 1000, windowMs: 60_000 },
      maintenanceMode: false,
      defaultVersion: 'v1',
    };
  }

  private load(): GatewayState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Always merge with default routes to pick up new ones
      return { ...this.defaultState(), ...parsed, routes: parsed.routes ?? DEFAULT_ROUTES };
    } catch { return null; }
  }

  private save() {
    try {
      const { requestLog, ...rest } = this.state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, requestLog: requestLog.slice(-500) }));
    } catch { /* quota */ }
  }

  private emit() {
    const s = this.getState();
    this.listeners.forEach(fn => fn(s));
    this.save();
  }

  subscribe(fn: (s: GatewayState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): GatewayState { return { ...this.state }; }

  // ── Route matching ─────────────────────────────────────────────────────────

  matchRoute(path: string, method: string): ApiRoute | null {
    return this.state.routes.find(r => {
      if (!r.enabled) return false;
      if (!r.methods.includes(method as any)) return false;
      const pattern = r.pattern.replace(/\*/g, '.*').replace(/:[\w]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(path);
    }) ?? null;
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────

  checkRateLimit(bucketKey: string, policy: RateLimitPolicy): { allowed: boolean; remaining: number } {
    if (!policy.enabled) return { allowed: true, remaining: policy.requestsPerWindow };
    const now = Date.now();
    const bucket = this.rateBuckets.get(bucketKey);
    if (!bucket || now - bucket.windowStart > policy.windowMs) {
      this.rateBuckets.set(bucketKey, { count: 1, windowStart: now });
      return { allowed: true, remaining: policy.requestsPerWindow - 1 };
    }
    const limit = policy.requestsPerWindow + (policy.burstAllowance ?? 0);
    if (bucket.count >= limit) return { allowed: false, remaining: 0 };
    bucket.count++;
    return { allowed: true, remaining: limit - bucket.count };
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  validateAuth(route: ApiRoute, apiKey?: string): { valid: boolean; keyId?: string; error?: string } {
    if (!route.auth.required) return { valid: true };
    if (route.auth.strategy === 'none') return { valid: true };
    if (route.auth.strategy === 'api_key') {
      if (!apiKey) return { valid: false, error: 'API key required' };
      const key = this.state.apiKeys.find(k => k.key === apiKey && k.enabled);
      if (!key) return { valid: false, error: 'Invalid or disabled API key' };
      if (key.expiresAt && key.expiresAt < Date.now()) return { valid: false, error: 'API key expired' };
      // Check scopes
      if (route.auth.scopes?.length) {
        const hasScope = route.auth.scopes.some(s => key.scopes.includes(s as ApiKeyScope));
        if (!hasScope) return { valid: false, error: 'Insufficient API key scopes' };
      }
      return { valid: true, keyId: key.id };
    }
    if (route.auth.strategy === 'session') {
      // In a real app, check session token; here we allow if no key required
      return { valid: true };
    }
    return { valid: true };
  }

  // ── Core dispatch ──────────────────────────────────────────────────────────

  async dispatch<T = unknown>(req: GatewayRequest): Promise<GatewayResponse<T>> {
    const start = Date.now();
    const version = req.version ?? this.state.defaultVersion;

    // Maintenance mode
    if (this.state.maintenanceMode) {
      return { statusCode: 503, error: 'Service in maintenance mode', latencyMs: 0, version };
    }

    // Route matching
    const route = this.matchRoute(req.path, req.method);
    if (!route) {
      return { statusCode: 404, error: `No route matched: ${req.method} ${req.path}`, latencyMs: Date.now() - start, version };
    }

    // Auth check
    const authResult = this.validateAuth(route, req.apiKey);
    if (!authResult.valid) {
      this.recordRequest({ routeId: route.id, method: req.method, path: req.path, statusCode: 401, latencyMs: Date.now() - start, error: authResult.error });
      this.updateAnalytics(route.id, 401, Date.now() - start, true);
      return { statusCode: 401, error: authResult.error, latencyMs: Date.now() - start, version, routeId: route.id };
    }

    // Rate limit
    const bucketKey = `${route.id}:${req.apiKey ?? 'anon'}`;
    const rl = this.checkRateLimit(bucketKey, route.rateLimit);
    if (!rl.allowed) {
      this.recordRequest({ routeId: route.id, method: req.method, path: req.path, statusCode: 429, latencyMs: Date.now() - start, error: 'Rate limit exceeded' });
      this.updateAnalytics(route.id, 429, Date.now() - start, false, true);
      return { statusCode: 429, error: 'Rate limit exceeded. Try again later.', latencyMs: Date.now() - start, version, routeId: route.id, rateLimitRemaining: 0 };
    }

    // Apply request transforms
    const headers: Record<string, string> = { ...(req.headers ?? {}), ...(route.transforms.addRequestHeaders ?? {}) };
    if (route.transforms.injectApiVersion) headers['X-Api-Version'] = version;
    (route.transforms.removeRequestHeaders ?? []).forEach(h => delete headers[h]);

    // Dispatch to upstream
    try {
      let data: T;
      let statusCode = 200;

      if (route.upstream === 'internal') {
        // Internal routes are handled by the app itself
        data = { message: 'Internal route — handled by app', path: req.path } as T;
      } else {
        const url = `${route.upstream}${req.path.replace(new RegExp(`^${route.pattern.split('*')[0]}`), '/')}`;
        const fetchOpts: RequestInit = {
          method: req.method,
          headers,
          signal: AbortSignal.timeout(10_000),
        };
        if (req.body && req.method !== 'GET') {
          fetchOpts.body = JSON.stringify(req.body);
          headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(url, fetchOpts);
        statusCode = res.status;
        data = await res.json().catch(() => ({} as T));

        // Strip response fields
        if (route.transforms.stripResponseFields?.length && typeof data === 'object' && data !== null) {
          route.transforms.stripResponseFields.forEach(f => delete (data as Record<string, unknown>)[f]);
        }
      }

      const latencyMs = Date.now() - start;
      this.recordRequest({ routeId: route.id, method: req.method, path: req.path, statusCode, latencyMs, apiKeyId: authResult.keyId });
      this.updateAnalytics(route.id, statusCode, latencyMs);
      if (authResult.keyId) this.touchApiKey(authResult.keyId);

      return { data, statusCode, latencyMs, version, routeId: route.id, rateLimitRemaining: rl.remaining };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const error = err instanceof Error ? err.message : 'Request failed';
      this.recordRequest({ routeId: route.id, method: req.method, path: req.path, statusCode: 502, latencyMs, error });
      this.updateAnalytics(route.id, 502, latencyMs);
      return { statusCode: 502, error, latencyMs, version, routeId: route.id };
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  private recordRequest(entry: Omit<RequestLog, 'id' | 'timestamp'>) {
    const log: RequestLog = { id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), ...entry };
    this.state = { ...this.state, requestLog: [log, ...this.state.requestLog].slice(0, 1000) };
  }

  private updateAnalytics(routeId: string, statusCode: number, latencyMs: number, authFail = false, rateLimitHit = false) {
    const prev = this.state.analytics[routeId] ?? {
      routeId, totalRequests: 0, successCount: 0, errorCount: 0,
      avgLatencyMs: 0, p95LatencyMs: 0, rateLimitHits: 0, authFailures: 0,
    };
    const isSuccess = statusCode >= 200 && statusCode < 400;
    const total = prev.totalRequests + 1;
    const avgLatencyMs = (prev.avgLatencyMs * prev.totalRequests + latencyMs) / total;
    // Approximate p95 with exponential moving average
    const p95LatencyMs = latencyMs > prev.p95LatencyMs
      ? prev.p95LatencyMs * 0.95 + latencyMs * 0.05
      : prev.p95LatencyMs;
    this.state = {
      ...this.state,
      analytics: {
        ...this.state.analytics,
        [routeId]: {
          ...prev,
          totalRequests: total,
          successCount: prev.successCount + (isSuccess ? 1 : 0),
          errorCount: prev.errorCount + (isSuccess ? 0 : 1),
          avgLatencyMs: Math.round(avgLatencyMs),
          p95LatencyMs: Math.round(p95LatencyMs),
          rateLimitHits: prev.rateLimitHits + (rateLimitHit ? 1 : 0),
          authFailures: prev.authFailures + (authFail ? 1 : 0),
          lastRequest: Date.now(),
        },
      },
    };
    this.emit();
  }

  private touchApiKey(keyId: string) {
    this.state = {
      ...this.state,
      apiKeys: this.state.apiKeys.map(k =>
        k.id === keyId ? { ...k, lastUsed: Date.now(), requestCount: k.requestCount + 1 } : k
      ),
    };
  }

  // ── Route management ───────────────────────────────────────────────────────

  addRoute(route: Omit<ApiRoute, 'id'>): ApiRoute {
    const r: ApiRoute = { ...route, id: `route_${Date.now()}` };
    this.state = { ...this.state, routes: [...this.state.routes, r] };
    this.emit();
    return r;
  }

  updateRoute(id: string, patch: Partial<ApiRoute>) {
    this.state = { ...this.state, routes: this.state.routes.map(r => r.id === id ? { ...r, ...patch } : r) };
    this.emit();
  }

  deleteRoute(id: string) {
    this.state = { ...this.state, routes: this.state.routes.filter(r => r.id !== id) };
    this.emit();
  }

  // ── API key management ─────────────────────────────────────────────────────

  createApiKey(name: string, scopes: ApiKeyScope[], owner: string, expiresInDays?: number): ApiKey {
    const raw = `fidelis_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    const key: ApiKey = {
      id: `key_${Date.now()}`,
      name, owner, scopes,
      key: raw,
      createdAt: Date.now(),
      expiresAt: expiresInDays ? Date.now() + expiresInDays * 86_400_000 : undefined,
      requestCount: 0,
      enabled: true,
    };
    this.state = { ...this.state, apiKeys: [...this.state.apiKeys, key] };
    this.emit();
    return key;
  }

  revokeApiKey(id: string) {
    this.state = { ...this.state, apiKeys: this.state.apiKeys.map(k => k.id === id ? { ...k, enabled: false } : k) };
    this.emit();
  }

  deleteApiKey(id: string) {
    this.state = { ...this.state, apiKeys: this.state.apiKeys.filter(k => k.id !== id) };
    this.emit();
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  setMaintenanceMode(enabled: boolean) {
    this.state = { ...this.state, maintenanceMode: enabled };
    this.emit();
  }

  clearRequestLog() {
    this.state = { ...this.state, requestLog: [] };
    this.emit();
  }

  exportRequestLogCSV(): string {
    const rows = [
      ['Timestamp', 'Route', 'Method', 'Path', 'Status', 'Latency (ms)', 'Error'],
      ...this.state.requestLog.map(r => [
        new Date(r.timestamp).toISOString(), r.routeId, r.method,
        r.path, r.statusCode, r.latencyMs, r.error ?? '',
      ]),
    ];
    return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  downloadRequestLogCSV() {
    const csv = this.exportRequestLogCSV();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `gateway-log-${Date.now()}.csv`;
    a.click();
  }
}

export const gatewayService = new GatewayService();
