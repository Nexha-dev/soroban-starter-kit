/**
 * Performance Reporter
 * Assembles a PerformanceReport from in-memory caches of profiler, optimizer, and budget manager.
 */

import {
  PerformanceReport,
  LoadTestResult,
  ReportDeserializationError,
} from './types';
import { Profiler, profiler } from './profiler';
import { Optimizer, optimizer } from './optimizer';
import { performanceBudgetManager } from './budgetManager';

const REQUIRED_FIELDS: (keyof PerformanceReport)[] = [
  'generatedAt',
  'benchmarkResults',
  'bottlenecks',
  'loadTestResults',
  'budgetViolations',
  'recommendations',
];

export class Reporter {
  private loadTestResults: LoadTestResult[];

  constructor(
    private profiler: Profiler,
    private optimizer: Optimizer,
    private budgetManager: typeof performanceBudgetManager,
    loadTestResults: LoadTestResult[] = []
  ) {
    this.loadTestResults = [...loadTestResults];
  }

  addLoadTestResult(result: LoadTestResult): void {
    this.loadTestResults.push(result);
  }

  generate(): PerformanceReport {
    const now = Date.now();
    return {
      generatedAt: now,
      benchmarkResults: this.profiler.getAllStats(),
      bottlenecks: this.optimizer.analyzeBottlenecks(),
      loadTestResults: [...this.loadTestResults],
      budgetViolations: this.budgetManager.getViolations(now - 86400000, now),
      recommendations: this.optimizer.generateRecommendations(),
    };
  }

  toJSON(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  fromJSON(json: string): PerformanceReport {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      throw new ReportDeserializationError(`Invalid JSON: ${(e as Error).message}`);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new ReportDeserializationError('Report must be a JSON object');
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in (parsed as object))) {
        throw new ReportDeserializationError(`Missing required field: "${field}"`);
      }
    }

    return parsed as PerformanceReport;
  }
}

export const reporter = new Reporter(profiler, optimizer, performanceBudgetManager);
export default reporter;
