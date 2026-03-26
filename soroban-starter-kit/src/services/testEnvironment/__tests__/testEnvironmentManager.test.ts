import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestEnvironmentManager } from '../testEnvironmentManager';

describe('TestEnvironmentManager', () => {
  let manager: TestEnvironmentManager;

  beforeEach(() => {
    manager = new TestEnvironmentManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  // --- Provisioning ---

  it('provisions an environment with defaults', async () => {
    const env = await manager.provision({ id: 'env-1' });
    expect(env.health.status).toBe('ready');
    expect(env.config.tier).toBe('unit');
    expect(env.config.isolated).toBe(true);
    expect(env.metrics.provisionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('provisions with custom config', async () => {
    const env = await manager.provision({ id: 'env-2', tier: 'e2e', maxMemoryMb: 512 });
    expect(env.config.tier).toBe('e2e');
    expect(env.config.maxMemoryMb).toBe(512);
  });

  it('throws when provisioning duplicate id', async () => {
    await manager.provision({ id: 'dup' });
    await expect(manager.provision({ id: 'dup' })).rejects.toThrow('already exists');
  });

  it('throws when capacity limit is reached', async () => {
    const provisions = Array.from({ length: 10 }, (_, i) =>
      manager.provision({ id: `env-${i}` })
    );
    await Promise.all(provisions);
    await expect(manager.provision({ id: 'overflow' })).rejects.toThrow('Capacity limit');
  });

  // --- Lifecycle ---

  it('tears down an environment', async () => {
    await manager.provision({ id: 'teardown-env' });
    await manager.teardown('teardown-env');
    expect(manager.listEnvironments()).not.toContain('teardown-env');
  });

  it('throws teardown on unknown id', async () => {
    await expect(manager.teardown('ghost')).rejects.toThrow('not found');
  });

  it('resets environment context and error count', async () => {
    await manager.provision({ id: 'reset-env' });
    manager.setContext('reset-env', 'key', 'value');
    await manager.reset('reset-env');
    expect(manager.getContext('reset-env', 'key')).toBeUndefined();
    expect(manager.getHealth('reset-env').errorCount).toBe(0);
  });

  // --- Configuration ---

  it('updates config after provisioning', async () => {
    await manager.provision({ id: 'cfg-env' });
    manager.updateConfig('cfg-env', { timeoutMs: 60_000 });
    expect(manager.getConfig('cfg-env').timeoutMs).toBe(60_000);
  });

  it('stores and retrieves context values', async () => {
    await manager.provision({ id: 'ctx-env' });
    manager.setContext('ctx-env', 'wallet', { address: 'GABC' });
    expect(manager.getContext('ctx-env', 'wallet')).toEqual({ address: 'GABC' });
  });

  // --- Resource sharing ---

  it('shares resources across environments', async () => {
    manager.shareResource('mockServer', { url: 'http://localhost:8080' });
    await manager.provision({ id: 'share-env', sharedResources: ['mockServer'] });
    expect(manager.getContext('share-env', 'mockServer')).toEqual({ url: 'http://localhost:8080' });
  });

  it('retrieves a shared resource directly', () => {
    manager.shareResource('db', { connected: true });
    expect(manager.getSharedResource('db')).toEqual({ connected: true });
  });

  // --- Health monitoring ---

  it('returns health with uptime', async () => {
    await manager.provision({ id: 'health-env' });
    const health = manager.getHealth('health-env');
    expect(health.status).toBe('ready');
    expect(health.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(health.lastCheckedAt).toBeGreaterThan(0);
  });

  it('returns metrics after provisioning', async () => {
    await manager.provision({ id: 'metrics-env' });
    const metrics = manager.getMetrics('metrics-env');
    expect(metrics.provisionTimeMs).toBeGreaterThanOrEqual(0);
    expect(metrics.testCount).toBe(0);
  });

  // --- Capacity ---

  it('reports capacity correctly', async () => {
    await manager.provision({ id: 'cap-1', tier: 'unit' });
    await manager.provision({ id: 'cap-2', tier: 'integration' });
    const cap = manager.getCapacity();
    expect(cap.active).toBe(2);
    expect(cap.available).toBe(8);
    expect(cap.byTier.unit).toBe(1);
    expect(cap.byTier.integration).toBe(1);
    expect(cap.byTier.e2e).toBe(0);
  });

  it('lists all active environment ids', async () => {
    await manager.provision({ id: 'list-1' });
    await manager.provision({ id: 'list-2' });
    expect(manager.listEnvironments()).toEqual(expect.arrayContaining(['list-1', 'list-2']));
  });

  // --- Isolation ---

  it('context is isolated between environments', async () => {
    await manager.provision({ id: 'iso-a' });
    await manager.provision({ id: 'iso-b' });
    manager.setContext('iso-a', 'secret', 'alpha');
    expect(manager.getContext('iso-b', 'secret')).toBeUndefined();
  });
});
