export type EnvironmentStatus = 'idle' | 'provisioning' | 'ready' | 'degraded' | 'teardown' | 'destroyed';
export type EnvironmentTier = 'unit' | 'integration' | 'e2e';

export interface EnvironmentConfig {
  id: string;
  tier: EnvironmentTier;
  isolated: boolean;
  timeoutMs: number;
  maxMemoryMb: number;
  sharedResources?: string[];
}

export interface EnvironmentHealth {
  status: EnvironmentStatus;
  memoryUsedMb: number;
  uptimeMs: number;
  errorCount: number;
  lastCheckedAt: number;
}

export interface EnvironmentMetrics {
  provisionTimeMs: number;
  teardownTimeMs: number;
  peakMemoryMb: number;
  testCount: number;
  errorCount: number;
}

export interface TestEnvironment {
  config: EnvironmentConfig;
  health: EnvironmentHealth;
  metrics: EnvironmentMetrics;
  createdAt: number;
  context: Record<string, unknown>;
}

export interface CapacityReport {
  total: number;
  active: number;
  available: number;
  byTier: Record<EnvironmentTier, number>;
}
