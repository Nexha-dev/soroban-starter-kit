import { BenchmarkResult, BenchmarkStats } from './types';

export class Profiler {
  private operations = new Map<string, () => Promise<void> | void>();
  private results = new Map<string, BenchmarkResult[]>();

  register(name: string, fn: () => Promise<void> | void): void {
    this.operations.set(name, fn);
    if (!this.results.has(name)) {
      this.results.set(name, []);
    }
  }

  async run(name: string): Promise<BenchmarkResult> {
    const fn = this.operations.get(name);
    if (!fn) {
      throw new Error(`Operation "${name}" is not registered`);
    }

    const timestamp = Date.now();
    const start = performance.now();

    try {
      await fn();
      const durationMs = performance.now() - start;
      const memoryKb = (performance as any).memory?.usedJSHeapSize / 1024 ?? 0;

      const result: BenchmarkResult = { operationName: name, timestamp, durationMs, memoryKb };
      this.results.get(name)!.push(result);
      return result;
    } catch (err) {
      const result: BenchmarkResult = { operationName: name, timestamp, durationMs: -1, memoryKb: 0 };
      this.results.get(name)!.push(result);
      throw err;
    }
  }

  getResults(name: string): BenchmarkResult[] {
    return this.results.get(name) ?? [];
  }

  getStats(name: string): BenchmarkStats | null {
    if (!this.operations.has(name)) return null;

    const allResults = this.results.get(name) ?? [];
    const durations = allResults.map(r => r.durationMs).filter(d => d >= 0);

    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((sum, d) => sum + d, 0) / count;

    let median: number;
    const mid = Math.floor(sorted.length * 0.5);
    if (count % 2 === 0) {
      median = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      median = sorted[mid];
    }

    return {
      operationName: name,
      runs: count,
      meanMs: mean,
      medianMs: median,
      minMs: Math.min(...sorted),
      maxMs: Math.max(...sorted),
    };
  }

  getAllStats(): BenchmarkStats[] {
    const stats: BenchmarkStats[] = [];
    for (const name of this.operations.keys()) {
      const s = this.getStats(name);
      if (s !== null) stats.push(s);
    }
    return stats;
  }
}

export const profiler = new Profiler();
