import type {
  EnvironmentConfig,
  EnvironmentHealth,
  EnvironmentMetrics,
  EnvironmentStatus,
  EnvironmentTier,
  TestEnvironment,
  CapacityReport,
} from './types';

const DEFAULT_CONFIG: Omit<EnvironmentConfig, 'id'> = {
  tier: 'unit',
  isolated: true,
  timeoutMs: 30_000,
  maxMemoryMb: 256,
};

const MAX_ENVIRONMENTS = 10;

function makeHealth(status: EnvironmentStatus = 'idle'): EnvironmentHealth {
  return { status, memoryUsedMb: 0, uptimeMs: 0, errorCount: 0, lastCheckedAt: Date.now() };
}

function makeMetrics(): EnvironmentMetrics {
  return { provisionTimeMs: 0, teardownTimeMs: 0, peakMemoryMb: 0, testCount: 0, errorCount: 0 };
}

export class TestEnvironmentManager {
  private environments = new Map<string, TestEnvironment>();
  private sharedResources = new Map<string, unknown>();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHealthMonitoring();
  }

  // --- Provisioning ---

  async provision(partial: Partial<EnvironmentConfig> & { id: string }): Promise<TestEnvironment> {
    if (this.environments.size >= MAX_ENVIRONMENTS) {
      throw new Error(`Capacity limit reached (max ${MAX_ENVIRONMENTS} environments)`);
    }
    if (this.environments.has(partial.id)) {
      throw new Error(`Environment "${partial.id}" already exists`);
    }

    const config: EnvironmentConfig = { ...DEFAULT_CONFIG, ...partial };
    const env: TestEnvironment = {
      config,
      health: makeHealth('provisioning'),
      metrics: makeMetrics(),
      createdAt: Date.now(),
      context: {},
    };

    this.environments.set(config.id, env);

    const start = Date.now();
    await this.setupEnvironment(env);
    env.metrics.provisionTimeMs = Date.now() - start;
    env.health.status = 'ready';
    env.health.lastCheckedAt = Date.now();

    return env;
  }

  async teardown(id: string): Promise<void> {
    const env = this.getOrThrow(id);
    env.health.status = 'teardown';

    const start = Date.now();
    await this.cleanupEnvironment(env);
    env.metrics.teardownTimeMs = Date.now() - start;
    env.health.status = 'destroyed';

    this.environments.delete(id);
  }

  async reset(id: string): Promise<void> {
    const env = this.getOrThrow(id);
    env.context = {};
    env.health.errorCount = 0;
    env.health.status = 'ready';
    env.health.lastCheckedAt = Date.now();
  }

  // --- Configuration ---

  getConfig(id: string): EnvironmentConfig {
    return this.getOrThrow(id).config;
  }

  updateConfig(id: string, updates: Partial<Omit<EnvironmentConfig, 'id'>>): void {
    const env = this.getOrThrow(id);
    Object.assign(env.config, updates);
  }

  setContext(id: string, key: string, value: unknown): void {
    this.getOrThrow(id).context[key] = value;
  }

  getContext(id: string, key: string): unknown {
    return this.getOrThrow(id).context[key];
  }

  // --- Resource sharing ---

  shareResource(name: string, resource: unknown): void {
    this.sharedResources.set(name, resource);
  }

  getSharedResource(name: string): unknown {
    return this.sharedResources.get(name);
  }

  // --- Health monitoring ---

  getHealth(id: string): EnvironmentHealth {
    const env = this.getOrThrow(id);
    this.refreshHealth(env);
    return env.health;
  }

  getMetrics(id: string): EnvironmentMetrics {
    return { ...this.getOrThrow(id).metrics };
  }

  // --- Capacity ---

  getCapacity(): CapacityReport {
    const byTier: Record<EnvironmentTier, number> = { unit: 0, integration: 0, e2e: 0 };
    for (const env of this.environments.values()) {
      byTier[env.config.tier]++;
    }
    return {
      total: MAX_ENVIRONMENTS,
      active: this.environments.size,
      available: MAX_ENVIRONMENTS - this.environments.size,
      byTier,
    };
  }

  listEnvironments(): string[] {
    return Array.from(this.environments.keys());
  }

  // --- Lifecycle ---

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.environments.clear();
    this.sharedResources.clear();
  }

  // --- Private helpers ---

  private getOrThrow(id: string): TestEnvironment {
    const env = this.environments.get(id);
    if (!env) throw new Error(`Environment "${id}" not found`);
    return env;
  }

  private async setupEnvironment(env: TestEnvironment): Promise<void> {
    // Load shared resources declared in config
    if (env.config.sharedResources) {
      for (const name of env.config.sharedResources) {
        const resource = this.sharedResources.get(name);
        if (resource !== undefined) env.context[name] = resource;
      }
    }
    // Simulate async provisioning (e.g. DB setup, mock server start)
    await Promise.resolve();
  }

  private async cleanupEnvironment(env: TestEnvironment): Promise<void> {
    env.context = {};
    await Promise.resolve();
  }

  private refreshHealth(env: TestEnvironment): void {
    if (env.health.status === 'destroyed') return;
    env.health.uptimeMs = Date.now() - env.createdAt;
    env.health.lastCheckedAt = Date.now();

    // Mark degraded if error rate is high
    if (env.health.errorCount > 0 && env.metrics.testCount > 0) {
      const errorRate = env.health.errorCount / env.metrics.testCount;
      env.health.status = errorRate > 0.5 ? 'degraded' : 'ready';
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const env of this.environments.values()) {
        this.refreshHealth(env);
      }
    }, 5_000);
  }
}

export const testEnvironmentManager = new TestEnvironmentManager();
