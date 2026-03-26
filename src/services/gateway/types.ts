// ─── Routes ───────────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRoute {
  id: string;
  name: string;
  pattern: string;           // e.g. "/soroban/*" or "/horizon/accounts/:id"
  upstream: string;          // base URL to proxy to
  version: string;           // e.g. "v1"
  methods: HttpMethod[];
  auth: AuthPolicy;
  rateLimit: RateLimitPolicy;
  transforms: TransformPolicy;
  enabled: boolean;
  tags: string[];
  description?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AuthStrategy = 'none' | 'api_key' | 'bearer' | 'session';

export interface AuthPolicy {
  strategy: AuthStrategy;
  required: boolean;
  scopes?: string[];
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

export interface RateLimitPolicy {
  enabled: boolean;
  requestsPerWindow: number;
  windowMs: number;           // e.g. 60_000 = 1 minute
  burstAllowance?: number;    // extra requests allowed in burst
}

// ─── Transforms ───────────────────────────────────────────────────────────────

export interface TransformPolicy {
  addRequestHeaders?: Record<string, string>;
  removeRequestHeaders?: string[];
  addResponseHeaders?: Record<string, string>;
  stripResponseFields?: string[];
  injectApiVersion?: boolean;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ApiKey {
  id: string;
  name: string;
  key: string;               // masked after creation
  scopes: ApiKeyScope[];
  createdAt: number;
  expiresAt?: number;
  lastUsed?: number;
  requestCount: number;
  enabled: boolean;
  owner: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface RequestLog {
  id: string;
  timestamp: number;
  routeId: string;
  method: HttpMethod;
  path: string;
  statusCode: number;
  latencyMs: number;
  apiKeyId?: string;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface RouteAnalytics {
  routeId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rateLimitHits: number;
  authFailures: number;
  lastRequest?: number;
}

// ─── Gateway state ────────────────────────────────────────────────────────────

export interface GatewayState {
  routes: ApiRoute[];
  apiKeys: ApiKey[];
  requestLog: RequestLog[];
  analytics: Record<string, RouteAnalytics>;
  globalRateLimit: RateLimitPolicy;
  maintenanceMode: boolean;
  defaultVersion: string;
}

// ─── Request context ──────────────────────────────────────────────────────────

export interface GatewayRequest {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  apiKey?: string;
  version?: string;
}

export interface GatewayResponse<T = unknown> {
  data?: T;
  error?: string;
  statusCode: number;
  latencyMs: number;
  routeId?: string;
  version: string;
  rateLimitRemaining?: number;
}
