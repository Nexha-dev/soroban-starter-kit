import { LoadTestConfig, LoadTestResult, InvalidConfigError } from './types';

export class LoadTester {
  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    if (config.concurrency <= 0) {
      throw new InvalidConfigError('concurrency must be greater than 0');
    }
    if (config.durationSeconds <= 0) {
      throw new InvalidConfigError('durationSeconds must be greater than 0');
    }

    const latencies: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    const startTime = Date.now();
    const durationMs = config.durationSeconds * 1000;

    while (Date.now() - startTime < durationMs) {
      const batch = Array.from({ length: config.concurrency }, () => {
        const opStart = Date.now();
        return config.operation().then(
          () => ({ success: true, latency: Date.now() - opStart, error: null }),
          (err: unknown) => ({
            success: false,
            latency: Date.now() - opStart,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      });

      const results = await Promise.allSettled(batch);

      for (const settled of results) {
        if (settled.status === 'fulfilled') {
          const { success, latency, error } = settled.value;
          latencies.push(latency);
          if (success) {
            successCount++;
          } else {
            failureCount++;
            if (errors.length < 100 && error !== null) {
              errors.push(error);
            }
          }
        }
      }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const totalOps = successCount + failureCount;

    const throughputOps = successCount / elapsedSeconds;
    const errorRate = totalOps > 0 ? failureCount / totalOps : 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const meanLatencyMs =
      sorted.length > 0 ? sorted.reduce((sum, v) => sum + v, 0) / sorted.length : 0;
    const p95LatencyMs = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const p99LatencyMs = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

    return {
      config: {
        operationName: config.operationName,
        concurrency: config.concurrency,
        durationSeconds: config.durationSeconds,
      },
      throughputOps,
      meanLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      errorRate,
      errors,
      passed: errorRate <= 0.01,
      timestamp: Date.now(),
    };
  }
}
