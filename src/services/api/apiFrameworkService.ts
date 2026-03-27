/**
 * API Integration Framework Service
 *
 * Client-side framework for registering API clients, executing requests through
 * a pipeline (auth → cache → rate-limit → retry → transform), monitoring
 * performance, running integration tests, and generating documentation.
 *
 * Complements the server-side ApiGatewayPortal (routing/proxying).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type AuthType = 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2';
export type CacheStrategy = 'no-cache' | 'memory' | 'stale-while-revalidate';
export type APIVersion = 'v1' | 'v2' | 'v3';
export type TestStatus = 'pass' | 'fail' | 'skip' | 'pending';
export type EndpointStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// ── API Client definition ─────────────────────────────────────────────────────

export interface APIEndpoint {
  id: string;
  method: HttpMethod;
  path: string;              // e.g. "/accounts/{id}"
  summary: string;
  description?: string;
  version: APIVersion;
  params?: EndpointParam[];
  requestBody?: SchemaField[];
  responseSchema?: SchemaField[];
  auth: AuthType;
  cacheable: boolean;
  cacheTtlMs?: number;
  tags: string[];
  deprecated?: boolean;
  exampleResponse?: unknown;
}

export interface EndpointParam {
  name: string;
  in: 'path' | 'query' | 'header';
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description?: string;
  example?: string;
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: unknown;
}

export interface APIClient {
  id: string;
  name: string;
  baseUrl: string;
  version: APIVersion;
  description: string;
  authType: AuthType;
  endpoints: APIEndpoint[];
  tags: string[];
  status: EndpointStatus;
  createdAt: number;
  lastUsed?: number;
  totalRequests: number;
  successRate: number; // 0-1
  avgLatencyMs: number;
}

// ── Auth Credentials ──────────────────────────────────────────────────────────

export interface AuthCredential {
  id: string;
  name: string;
  type: AuthType;
  clientId?: string;
  maskedSecret: string;      // always masked in UI
  scopes: string[];
  expiresAt?: number;
  createdAt: number;
  lastUsed?: number;
  linkedClientIds: string[]; // which clients use this
}

// ── Request pipeline ──────────────────────────────────────────────────────────

export interface PipelineRequest {
  clientId: string;
  endpointId: string;
  params?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  skipCache?: boolean;
}

export interface PipelineResponse {
  requestId: string;
  clientId: string;
  endpointId: string;
  statusCode: number;
  data: unknown;
  latencyMs: number;
  fromCache: boolean;
  retryCount: number;
  timestamp: number;
  error?: string;
  headers: Record<string, string>;
  size: number; // bytes (estimated)
}

// ── Cache ─────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  data: unknown;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
  size: number;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

export interface RateLimitState {
  clientId: string;
  windowStart: number;
  count: number;
  limit: number;
  windowMs: number;
}

// ── Monitoring ────────────────────────────────────────────────────────────────

export interface RequestLog {
  id: string;
  clientId: string;
  clientName: string;
  endpointId: string;
  method: HttpMethod;
  path: string;
  statusCode: number;
  latencyMs: number;
  fromCache: boolean;
  retryCount: number;
  timestamp: number;
  error?: string;
  size: number;
}

export interface ClientMetrics {
  clientId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  cacheHits: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  throughput: number; // requests per minute (last hour)
  slaCompliance: number; // % of requests under 500ms
  latencySeries: Array<{ time: string; avg: number; p95: number }>;
}

// ── Integration Tests ─────────────────────────────────────────────────────────

export interface TestAssertion {
  id: string;
  type: 'status' | 'body-contains' | 'latency' | 'header' | 'schema';
  expected: string | number;
  description: string;
}

export interface IntegrationTest {
  id: string;
  name: string;
  clientId: string;
  endpointId: string;
  params?: Record<string, string>;
  body?: unknown;
  assertions: TestAssertion[];
  tags: string[];
}

export interface TestResult {
  testId: string;
  testName: string;
  status: TestStatus;
  duration: number;
  assertions: Array<{ id: string; description: string; passed: boolean; actual?: string }>;
  error?: string;
  timestamp: number;
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  timestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

function minutesAgo(n: number): number {
  return Date.now() - n * 60_000;
}

function simulateLatency(base: number): number {
  return Math.round(base + (Math.random() - 0.3) * base * 0.5);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_CLIENTS: Omit<APIClient, 'id'>[] = [
  {
    name: 'Stellar Horizon',
    baseUrl: 'https://horizon-testnet.stellar.org',
    version: 'v1',
    description: 'Stellar Horizon REST API for accounts, transactions, and ledger data.',
    authType: 'none',
    tags: ['stellar', 'blockchain'],
    status: 'healthy',
    createdAt: daysAgo(30),
    lastUsed: minutesAgo(5),
    totalRequests: 4821,
    successRate: 0.987,
    avgLatencyMs: 180,
    endpoints: [
      {
        id: 'horizon-account',
        method: 'GET',
        path: '/accounts/{account_id}',
        summary: 'Get account details',
        version: 'v1',
        auth: 'none',
        cacheable: true,
        cacheTtlMs: 30_000,
        tags: ['accounts'],
        params: [{ name: 'account_id', in: 'path', type: 'string', required: true, description: 'Stellar account public key', example: 'GABC...' }],
        exampleResponse: { id: 'GABC...', sequence: '12345678', balances: [{ asset_type: 'native', balance: '100.0000000' }] },
        responseSchema: [
          { name: 'id', type: 'string', required: true },
          { name: 'sequence', type: 'string', required: true },
          { name: 'balances', type: 'array', required: true },
        ],
      },
      {
        id: 'horizon-transactions',
        method: 'GET',
        path: '/accounts/{account_id}/transactions',
        summary: 'List account transactions',
        version: 'v1',
        auth: 'none',
        cacheable: true,
        cacheTtlMs: 15_000,
        tags: ['accounts', 'transactions'],
        params: [
          { name: 'account_id', in: 'path', type: 'string', required: true },
          { name: 'limit', in: 'query', type: 'number', required: false, example: '10' },
          { name: 'order', in: 'query', type: 'string', required: false, example: 'desc' },
        ],
        exampleResponse: { _embedded: { records: [] }, _links: {} },
      },
      {
        id: 'horizon-submit-tx',
        method: 'POST',
        path: '/transactions',
        summary: 'Submit a transaction',
        version: 'v1',
        auth: 'none',
        cacheable: false,
        tags: ['transactions'],
        requestBody: [{ name: 'tx', type: 'string', required: true, description: 'Base64-encoded XDR transaction envelope' }],
        exampleResponse: { hash: 'abc123...', ledger: 40000 },
      },
    ],
  },
  {
    name: 'Soroban RPC',
    baseUrl: 'https://soroban-testnet.stellar.org',
    version: 'v1',
    description: 'Soroban JSON-RPC API for smart contract interaction.',
    authType: 'api-key',
    tags: ['soroban', 'contracts'],
    status: 'healthy',
    createdAt: daysAgo(25),
    lastUsed: minutesAgo(2),
    totalRequests: 2134,
    successRate: 0.972,
    avgLatencyMs: 240,
    endpoints: [
      {
        id: 'soroban-simulate',
        method: 'POST',
        path: '/',
        summary: 'Simulate a transaction',
        description: 'Simulates a Soroban transaction and returns footprint and resource estimates.',
        version: 'v1',
        auth: 'api-key',
        cacheable: false,
        tags: ['contracts', 'simulation'],
        requestBody: [
          { name: 'jsonrpc', type: 'string', required: true, example: '2.0' },
          { name: 'method', type: 'string', required: true, example: 'simulateTransaction' },
          { name: 'params', type: 'object', required: true },
        ],
        exampleResponse: { jsonrpc: '2.0', id: 1, result: { transactionData: '...', events: [], minResourceFee: '100000' } },
      },
      {
        id: 'soroban-get-ledger',
        method: 'POST',
        path: '/',
        summary: 'Get latest ledger',
        version: 'v1',
        auth: 'api-key',
        cacheable: true,
        cacheTtlMs: 5_000,
        tags: ['ledger'],
        requestBody: [{ name: 'method', type: 'string', required: true, example: 'getLatestLedger' }],
        exampleResponse: { result: { id: 'abc', sequence: 999, protocolVersion: 20 } },
      },
    ],
  },
  {
    name: 'Stellar Expert',
    baseUrl: 'https://api.stellar.expert',
    version: 'v1',
    description: 'Market data, asset info, and DEX analytics from Stellar Expert.',
    authType: 'api-key',
    tags: ['market', 'prices', 'dex'],
    status: 'degraded',
    createdAt: daysAgo(20),
    lastUsed: minutesAgo(30),
    totalRequests: 892,
    successRate: 0.931,
    avgLatencyMs: 320,
    endpoints: [
      {
        id: 'expert-asset',
        method: 'GET',
        path: '/explorer/public/asset/{asset}',
        summary: 'Get asset info',
        version: 'v1',
        auth: 'api-key',
        cacheable: true,
        cacheTtlMs: 60_000,
        tags: ['assets'],
        params: [{ name: 'asset', in: 'path', type: 'string', required: true, example: 'XLM' }],
        exampleResponse: { asset: 'XLM', price: 0.112, volume: 1234567 },
      },
      {
        id: 'expert-orderbook',
        method: 'GET',
        path: '/explorer/public/orderbook/{base}/{counter}',
        summary: 'Get DEX orderbook',
        version: 'v1',
        auth: 'api-key',
        cacheable: true,
        cacheTtlMs: 10_000,
        tags: ['dex'],
        params: [
          { name: 'base', in: 'path', type: 'string', required: true, example: 'XLM' },
          { name: 'counter', in: 'path', type: 'string', required: true, example: 'USDC-GA5...' },
        ],
        exampleResponse: { bids: [], asks: [] },
        deprecated: false,
      },
    ],
  },
  {
    name: 'Internal Storage API',
    baseUrl: 'internal://indexeddb',
    version: 'v1',
    description: 'Internal abstraction over IndexedDB for balances, escrows, and transactions.',
    authType: 'bearer',
    tags: ['internal', 'storage'],
    status: 'healthy',
    createdAt: daysAgo(15),
    lastUsed: minutesAgo(1),
    totalRequests: 12043,
    successRate: 0.999,
    avgLatencyMs: 8,
    endpoints: [
      {
        id: 'storage-get-balances',
        method: 'GET',
        path: '/balances',
        summary: 'List cached balances',
        version: 'v1',
        auth: 'bearer',
        cacheable: true,
        cacheTtlMs: 5_000,
        tags: ['balances'],
        exampleResponse: [{ assetCode: 'XLM', balance: '100', account: 'GABC...' }],
      },
      {
        id: 'storage-put-balance',
        method: 'PUT',
        path: '/balances/{id}',
        summary: 'Update a cached balance',
        version: 'v1',
        auth: 'bearer',
        cacheable: false,
        tags: ['balances'],
        params: [{ name: 'id', in: 'path', type: 'string', required: true }],
        requestBody: [{ name: 'balance', type: 'string', required: true }],
      },
    ],
  },
];

function makeSeedLogs(clients: APIClient[]): RequestLog[] {
  const logs: RequestLog[] = [];
  clients.forEach((client) => {
    client.endpoints.forEach((ep) => {
      const count = Math.floor(3 + Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const latency = simulateLatency(client.avgLatencyMs);
        const success = Math.random() < client.successRate;
        logs.push({
          id: uid(),
          clientId: client.id,
          clientName: client.name,
          endpointId: ep.id,
          method: ep.method,
          path: ep.path,
          statusCode: success ? (ep.method === 'POST' ? 201 : 200) : (Math.random() > 0.5 ? 429 : 500),
          latencyMs: latency,
          fromCache: ep.cacheable && Math.random() > 0.6,
          retryCount: success ? 0 : Math.random() > 0.7 ? 1 : 0,
          timestamp: minutesAgo(Math.random() * 120),
          error: success ? undefined : 'Request failed',
          size: Math.round(200 + Math.random() * 4000),
        });
      }
    });
  });
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

function makeMetrics(client: APIClient, logs: RequestLog[]): ClientMetrics {
  const clientLogs = logs.filter((l) => l.clientId === client.id);
  const latencies = clientLogs.map((l) => l.latencyMs).sort((a, b) => a - b);
  const successLogs = clientLogs.filter((l) => l.statusCode < 400);
  const cacheHits = clientLogs.filter((l) => l.fromCache).length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  // Throughput: requests per minute over last hour
  const hourAgo = minutesAgo(60);
  const recentLogs = clientLogs.filter((l) => l.timestamp >= hourAgo);
  const throughput = recentLogs.length / 60;

  const sla = latencies.filter((l) => l < 500).length / Math.max(latencies.length, 1);

  // Build 12-point latency series (last 12 hours, 1-hour buckets)
  const latencySeries = Array.from({ length: 12 }, (_, i) => {
    const bucketStart = minutesAgo((12 - i) * 60);
    const bucketEnd = minutesAgo((11 - i) * 60);
    const bucketLogs = clientLogs
      .filter((l) => l.timestamp >= bucketStart && l.timestamp < bucketEnd)
      .map((l) => l.latencyMs)
      .sort((a, b) => a - b);
    const bucketAvg = bucketLogs.length > 0
      ? bucketLogs.reduce((s, v) => s + v, 0) / bucketLogs.length
      : avg + (Math.random() - 0.5) * avg * 0.4;
    const bucketP95 = bucketLogs[Math.floor(bucketLogs.length * 0.95)] ?? p95;
    const hour = new Date(bucketStart).getHours();
    return { time: `${hour}:00`, avg: Math.round(bucketAvg), p95: Math.round(bucketP95) };
  });

  return {
    clientId: client.id,
    totalRequests: clientLogs.length + client.totalRequests,
    successCount: successLogs.length,
    errorCount: clientLogs.length - successLogs.length,
    cacheHits,
    avgLatencyMs: Math.round(avg || client.avgLatencyMs),
    p95LatencyMs: p95 || Math.round(client.avgLatencyMs * 2),
    p99LatencyMs: p99 || Math.round(client.avgLatencyMs * 3),
    errorRate: clientLogs.length > 0 ? (clientLogs.length - successLogs.length) / clientLogs.length : 1 - client.successRate,
    throughput: parseFloat(throughput.toFixed(2)),
    slaCompliance: parseFloat((sla * 100).toFixed(1)),
    latencySeries,
  };
}

function makeSeedTests(clients: APIClient[]): IntegrationTest[] {
  const tests: IntegrationTest[] = [];
  clients.forEach((client) => {
    client.endpoints.slice(0, 2).forEach((ep) => {
      tests.push({
        id: uid(),
        name: `${client.name} — ${ep.summary}`,
        clientId: client.id,
        endpointId: ep.id,
        params: ep.params?.reduce<Record<string, string>>((acc, p) => {
          if (p.example) acc[p.name] = p.example;
          return acc;
        }, {}) ?? {},
        assertions: [
          { id: uid(), type: 'status', expected: ep.method === 'POST' ? 201 : 200, description: `Response status is ${ep.method === 'POST' ? 201 : 200}` },
          { id: uid(), type: 'latency', expected: 2000, description: 'Response within 2000ms' },
          ...(ep.responseSchema ? [{ id: uid(), type: 'schema' as const, expected: 'valid', description: 'Response matches schema' }] : []),
        ],
        tags: ep.tags,
      });
    });
  });
  return tests;
}

function makeSeedCredentials(clients: APIClient[]): AuthCredential[] {
  const creds: AuthCredential[] = [
    {
      id: uid(),
      name: 'Stellar Expert API Key',
      type: 'api-key',
      maskedSecret: 'sk-exp-••••••••••••••••9f4a',
      scopes: ['read'],
      createdAt: daysAgo(20),
      lastUsed: minutesAgo(30),
      linkedClientIds: [clients.find((c) => c.name === 'Stellar Expert')?.id ?? ''],
    },
    {
      id: uid(),
      name: 'Soroban RPC Key',
      type: 'api-key',
      maskedSecret: 'rpc-••••••••••••••••c2b8',
      scopes: ['read', 'write'],
      createdAt: daysAgo(25),
      lastUsed: minutesAgo(2),
      linkedClientIds: [clients.find((c) => c.name === 'Soroban RPC')?.id ?? ''],
    },
    {
      id: uid(),
      name: 'Internal Service Token',
      type: 'bearer',
      maskedSecret: 'eyJhbGc••••••••••••••••iJ9',
      scopes: ['read', 'write', 'admin'],
      expiresAt: Date.now() + 7 * 86_400_000,
      createdAt: daysAgo(15),
      lastUsed: minutesAgo(1),
      linkedClientIds: [clients.find((c) => c.name === 'Internal Storage API')?.id ?? ''],
    },
  ];
  return creds;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

class RequestCache {
  private store = new Map<string, CacheEntry>();

  key(clientId: string, endpointId: string, params?: Record<string, string>): string {
    return `${clientId}:${endpointId}:${JSON.stringify(params ?? {})}`;
  }

  get(key: string): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) this.store.delete(key);
      return null;
    }
    entry.hitCount++;
    return entry;
  }

  set(key: string, data: unknown, ttlMs: number): void {
    const size = JSON.stringify(data).length;
    this.store.set(key, { key, data, cachedAt: Date.now(), expiresAt: Date.now() + ttlMs, hitCount: 0, size });
  }

  invalidate(key: string): void { this.store.delete(key); }
  invalidateAll(): void { this.store.clear(); }

  getAll(): CacheEntry[] {
    const now = Date.now();
    return [...this.store.values()].filter((e) => e.expiresAt > now);
  }

  stats(): { entries: number; totalSize: number; hitRate: number } {
    const all = this.getAll();
    const totalHits = all.reduce((s, e) => s + e.hitCount, 0);
    return {
      entries: all.length,
      totalSize: all.reduce((s, e) => s + e.size, 0),
      hitRate: all.length > 0 ? totalHits / (totalHits + all.length) : 0,
    };
  }
}

// ─── Main Service ─────────────────────────────────────────────────────────────

class APIFrameworkService {
  private clients: APIClient[];
  private credentials: AuthCredential[];
  private logs: RequestLog[];
  private tests: IntegrationTest[];
  private cache = new RequestCache();
  private rateLimits = new Map<string, { count: number; windowStart: number }>();
  private RATE_LIMIT = 60; // requests per minute per client

  constructor() {
    // Assign IDs to seed clients
    this.clients = SEED_CLIENTS.map((c) => ({ ...c, id: uid() }));
    this.logs = makeSeedLogs(this.clients);
    this.credentials = makeSeedCredentials(this.clients);
    this.tests = makeSeedTests(this.clients);

    // Pre-populate cache with a few entries
    this.clients.forEach((client) => {
      client.endpoints
        .filter((ep) => ep.cacheable)
        .slice(0, 1)
        .forEach((ep) => {
          const key = this.cache.key(client.id, ep.id);
          this.cache.set(key, ep.exampleResponse ?? {}, ep.cacheTtlMs ?? 30_000);
        });
    });
  }

  // ── Clients ──────────────────────────────────────────────────────────────

  getClients(): APIClient[] { return [...this.clients]; }

  getClient(id: string): APIClient | undefined {
    return this.clients.find((c) => c.id === id);
  }

  registerClient(partial: Omit<APIClient, 'id' | 'createdAt' | 'totalRequests' | 'successRate' | 'avgLatencyMs' | 'status' | 'endpoints'>): APIClient {
    const client: APIClient = {
      ...partial,
      id: uid(),
      createdAt: Date.now(),
      totalRequests: 0,
      successRate: 1,
      avgLatencyMs: 0,
      status: 'unknown',
      endpoints: [],
    };
    this.clients.push(client);
    return client;
  }

  updateClientStatus(id: string, status: EndpointStatus): void {
    const c = this.clients.find((c) => c.id === id);
    if (c) c.status = status;
  }

  // ── Request Pipeline ─────────────────────────────────────────────────────

  async execute(req: PipelineRequest): Promise<PipelineResponse> {
    const requestId = uid();
    const client = this.clients.find((c) => c.id === req.clientId);
    const endpoint = client?.endpoints.find((e) => e.id === req.endpointId);
    const start = Date.now();

    if (!client || !endpoint) {
      return { requestId, clientId: req.clientId, endpointId: req.endpointId, statusCode: 404, data: null, latencyMs: 1, fromCache: false, retryCount: 0, timestamp: Date.now(), error: 'Client or endpoint not found', headers: {}, size: 0 };
    }

    // 1. Rate limit check
    const rl = this.rateLimits.get(req.clientId) ?? { count: 0, windowStart: Date.now() };
    if (Date.now() - rl.windowStart > 60_000) { rl.count = 0; rl.windowStart = Date.now(); }
    if (rl.count >= this.RATE_LIMIT) {
      this._log(client, endpoint, 429, Date.now() - start, false, 0);
      return { requestId, clientId: req.clientId, endpointId: req.endpointId, statusCode: 429, data: null, latencyMs: Date.now() - start, fromCache: false, retryCount: 0, timestamp: Date.now(), error: 'Rate limit exceeded', headers: {}, size: 0 };
    }
    rl.count++;
    this.rateLimits.set(req.clientId, rl);

    // 2. Cache check
    if (endpoint.cacheable && !req.skipCache) {
      const cacheKey = this.cache.key(req.clientId, req.endpointId, req.params);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const latency = 2 + Math.round(Math.random() * 3); // cache is fast
        this._log(client, endpoint, 200, latency, true, 0);
        return { requestId, clientId: req.clientId, endpointId: req.endpointId, statusCode: 200, data: cached.data, latencyMs: latency, fromCache: true, retryCount: 0, timestamp: Date.now(), headers: { 'x-cache': 'HIT' }, size: cached.size };
      }
    }

    // 3. Simulate execution with realistic latency + occasional errors
    const baseLatency = client.avgLatencyMs || 200;
    await new Promise((r) => setTimeout(r, Math.min(simulateLatency(baseLatency), 1500)));

    const success = Math.random() < client.successRate;
    const statusCode = success ? (endpoint.method === 'POST' ? 201 : 200) : (Math.random() > 0.5 ? 500 : 503);
    const data = success ? (endpoint.exampleResponse ?? { ok: true }) : null;
    const latencyMs = Date.now() - start;
    const size = JSON.stringify(data).length;

    // 4. Store in cache if cacheable
    if (success && endpoint.cacheable) {
      const cacheKey = this.cache.key(req.clientId, req.endpointId, req.params);
      this.cache.set(cacheKey, data, endpoint.cacheTtlMs ?? 30_000);
    }

    // 5. Update client stats
    client.totalRequests++;
    client.lastUsed = Date.now();
    client.successRate = success
      ? Math.min(1, client.successRate + 0.001)
      : Math.max(0, client.successRate - 0.005);
    client.avgLatencyMs = Math.round((client.avgLatencyMs * 0.95) + (latencyMs * 0.05));

    this._log(client, endpoint, statusCode, latencyMs, false, 0, success ? undefined : 'Request failed');

    return { requestId, clientId: req.clientId, endpointId: req.endpointId, statusCode, data, latencyMs, fromCache: false, retryCount: 0, timestamp: Date.now(), headers: { 'content-type': 'application/json', 'x-cache': 'MISS' }, size };
  }

  private _log(client: APIClient, endpoint: APIEndpoint, statusCode: number, latencyMs: number, fromCache: boolean, retryCount: number, error?: string): void {
    this.logs.unshift({
      id: uid(),
      clientId: client.id,
      clientName: client.name,
      endpointId: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      statusCode,
      latencyMs,
      fromCache,
      retryCount,
      timestamp: Date.now(),
      error,
      size: Math.round(200 + Math.random() * 2000),
    });
    if (this.logs.length > 500) this.logs.pop();
  }

  // ── Monitoring ────────────────────────────────────────────────────────────

  getLogs(limit = 100): RequestLog[] { return this.logs.slice(0, limit); }

  getMetrics(clientId: string): ClientMetrics {
    const client = this.clients.find((c) => c.id === clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);
    return makeMetrics(client, this.logs);
  }

  getAllMetrics(): ClientMetrics[] {
    return this.clients.map((c) => makeMetrics(c, this.logs));
  }

  // ── Credentials ───────────────────────────────────────────────────────────

  getCredentials(): AuthCredential[] { return [...this.credentials]; }

  addCredential(cred: Omit<AuthCredential, 'id' | 'createdAt'>): AuthCredential {
    const full: AuthCredential = { ...cred, id: uid(), createdAt: Date.now() };
    this.credentials.push(full);
    return full;
  }

  revokeCredential(id: string): boolean {
    const idx = this.credentials.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.credentials.splice(idx, 1);
    return true;
  }

  // ── Cache management ──────────────────────────────────────────────────────

  getCacheEntries(): CacheEntry[] { return this.cache.getAll(); }
  getCacheStats() { return this.cache.stats(); }
  invalidateCache(key?: string): void { key ? this.cache.invalidate(key) : this.cache.invalidateAll(); }

  // ── Integration Tests ─────────────────────────────────────────────────────

  getTests(): IntegrationTest[] { return [...this.tests]; }

  async runTest(test: IntegrationTest): Promise<TestResult> {
    const start = Date.now();
    const client = this.clients.find((c) => c.id === test.clientId);
    const endpoint = client?.endpoints.find((e) => e.id === test.endpointId);

    if (!client || !endpoint) {
      return { testId: test.id, testName: test.name, status: 'fail', duration: 0, assertions: [], error: 'Client/endpoint not found', timestamp: Date.now() };
    }

    const response = await this.execute({ clientId: test.clientId, endpointId: test.endpointId, params: test.params, body: test.body });
    const duration = Date.now() - start;

    const assertions = test.assertions.map((assertion) => {
      let passed = false;
      let actual = '';

      switch (assertion.type) {
        case 'status':
          passed = response.statusCode === Number(assertion.expected);
          actual = String(response.statusCode);
          break;
        case 'latency':
          passed = response.latencyMs <= Number(assertion.expected);
          actual = `${response.latencyMs}ms`;
          break;
        case 'body-contains':
          actual = JSON.stringify(response.data).slice(0, 60);
          passed = actual.includes(String(assertion.expected));
          break;
        case 'schema':
          passed = response.data !== null && response.statusCode < 400;
          actual = passed ? 'valid' : 'invalid';
          break;
        case 'header':
          passed = !!response.headers[String(assertion.expected)];
          actual = response.headers[String(assertion.expected)] ?? 'missing';
          break;
        default:
          passed = false;
      }

      return { id: assertion.id, description: assertion.description, passed, actual };
    });

    const allPassed = assertions.every((a) => a.passed);
    return { testId: test.id, testName: test.name, status: allPassed ? 'pass' : 'fail', duration, assertions, timestamp: Date.now() };
  }

  async runSuite(suiteId: string, suiteName: string, testIds?: string[]): Promise<TestSuiteResult> {
    const testsToRun = testIds
      ? this.tests.filter((t) => testIds.includes(t.id))
      : this.tests;

    const start = Date.now();
    const results = await Promise.all(testsToRun.map((t) => this.runTest(t)));

    return {
      suiteId,
      suiteName,
      total: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      skipped: results.filter((r) => r.status === 'skip').length,
      duration: Date.now() - start,
      results,
      timestamp: Date.now(),
    };
  }

  // ── Docs ──────────────────────────────────────────────────────────────────

  generateClientDoc(clientId: string): string {
    const client = this.clients.find((c) => c.id === clientId);
    if (!client) return '// Client not found';

    const lines: string[] = [
      `/**`,
      ` * ${client.name} — Auto-generated API Client`,
      ` * Base URL: ${client.baseUrl}`,
      ` * Version: ${client.version}`,
      ` * Auth: ${client.authType}`,
      ` */`,
      ``,
      `class ${client.name.replace(/\s+/g, '')}Client {`,
      `  private baseUrl = '${client.baseUrl}';`,
      ``,
    ];

    client.endpoints.forEach((ep) => {
      const fnName = ep.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const paramList = (ep.params?.filter((p) => p.required) ?? []).map((p) => `${p.name}: string`).join(', ');
      lines.push(
        `  /** ${ep.summary} */`,
        `  async ${fnName}(${paramList}): Promise<Response> {`,
        `    return fetch(\`\${this.baseUrl}${ep.path.replace(/\{(\w+)\}/g, '${$1}')}\`, {`,
        `      method: '${ep.method}',`,
        `      headers: { 'Content-Type': 'application/json' },`,
        `    });`,
        `  }`,
        ``,
      );
    });

    lines.push(`}`);
    return lines.join('\n');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const apiFrameworkService = new APIFrameworkService();
