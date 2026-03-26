import { StressTestConfig, StressTestResult, StressTestStep, InvalidConfigError } from './types';

export class StressTester {
  async run(config: StressTestConfig): Promise<StressTestResult> {
    if (config.startConcurrency <= 0) {
      throw new InvalidConfigError('startConcurrency must be greater than 0');
    }
    if (config.stepIncrement <= 0) {
      throw new InvalidConfigError('stepIncrement must be greater than 0');
    }
    if (config.stepDurationSeconds <= 0) {
      throw new InvalidConfigError('stepDurationSeconds must be greater than 0');
    }
    if (config.maxConcurrency < config.startConcurrency) {
      throw new InvalidConfigError('maxConcurrency must be >= startConcurrency');
    }

    const steps: StressTestStep[] = [];
    let maxSustainableConcurrency = 0;
    let failureThreshold: number | null = null;
    let failureDetails: { concurrency: number; errorType: string; timestamp: number } | null = null;

    for (
      let concurrency = config.startConcurrency;
      concurrency <= config.maxConcurrency;
      concurrency += config.stepIncrement
    ) {
      const latencies: number[] = [];
      let successCount = 0;
      let failureCount = 0;
      let firstError: string | null = null;

      const startTime = Date.now();
      const durationMs = config.stepDurationSeconds * 1000;

      while (Date.now() - startTime < durationMs) {
        const batch = Array.from({ length: concurrency }, () => {
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
              if (firstError === null && error !== null) {
                firstError = error;
              }
            }
          }
        }
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const totalOps = successCount + failureCount;
      const throughputOps = successCount / elapsedSeconds;
      const errorRate = totalOps > 0 ? failureCount / totalOps : 0;
      const meanLatencyMs =
        latencies.length > 0 ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length : 0;

      steps.push({ concurrency, throughputOps, meanLatencyMs, errorRate });

      if (errorRate > 0.05) {
        failureThreshold = concurrency;
        failureDetails = {
          concurrency,
          errorType: firstError ?? 'unknown error',
          timestamp: Date.now(),
        };
        break;
      }

      maxSustainableConcurrency = concurrency;
    }

    return {
      config: {
        startConcurrency: config.startConcurrency,
        stepIncrement: config.stepIncrement,
        stepDurationSeconds: config.stepDurationSeconds,
        maxConcurrency: config.maxConcurrency,
      },
      steps,
      maxSustainableConcurrency,
      failureThreshold,
      failureDetails,
      timestamp: Date.now(),
    };
  }
}
