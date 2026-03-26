import type { TestRun, TestResult, TestAnalytics, QualityGate } from './types';

const SLOW_TEST_THRESHOLD_MS = 1000;
const FLAKY_DETECTION_RUNS = 5;

class TestReportingService {
  private runs: TestRun[] = [];

  addRun(run: TestRun): void {
    this.runs.push(run);
  }

  getHistory(): TestRun[] {
    return [...this.runs];
  }

  getLatestRun(): TestRun | undefined {
    return this.runs[this.runs.length - 1];
  }

  getAnalytics(): TestAnalytics {
    const latest = this.getLatestRun();
    const allResults = this.runs.flatMap(r => r.results);

    const passed = allResults.filter(r => r.status === 'passed').length;
    const passRate = allResults.length ? passed / allResults.length : 0;

    const avgDuration =
      allResults.length
        ? allResults.reduce((s, r) => s + r.duration, 0) / allResults.length
        : 0;

    const slowTests = (latest?.results ?? [])
      .filter(r => r.duration > SLOW_TEST_THRESHOLD_MS)
      .map(r => r.name);

    const flakyTests = this._detectFlakyTests();

    const coverageTrend = this.runs
      .slice(-10)
      .map(r => r.coveragePercent);

    const qualityGates = this._evaluateQualityGates(latest);

    const roi = this._calculateROI();

    return { passRate, avgDuration, flakyTests, slowTests, coverageTrend, qualityGates, roi };
  }

  getFailureAnalysis(): { name: string; suite: string; error: string; occurrences: number }[] {
    const failMap = new Map<string, { name: string; suite: string; error: string; occurrences: number }>();

    for (const run of this.runs) {
      for (const r of run.results) {
        if (r.status === 'failed') {
          const key = r.id;
          const existing = failMap.get(key);
          if (existing) {
            existing.occurrences++;
          } else {
            failMap.set(key, { name: r.name, suite: r.suite, error: r.error ?? '', occurrences: 1 });
          }
        }
      }
    }

    return [...failMap.values()].sort((a, b) => b.occurrences - a.occurrences);
  }

  getTeamMetrics(): { author: string; runs: number; avgPassRate: number; avgCoverage: number }[] {
    const authorMap = new Map<string, { runs: TestRun[] }>();

    for (const run of this.runs) {
      const author = run.author ?? 'unknown';
      if (!authorMap.has(author)) authorMap.set(author, { runs: [] });
      authorMap.get(author)!.runs.push(run);
    }

    return [...authorMap.entries()].map(([author, { runs }]) => {
      const avgPassRate =
        runs.reduce((sum, run) => {
          const total = run.results.length;
          const passed = run.results.filter(r => r.status === 'passed').length;
          return sum + (total ? passed / total : 0);
        }, 0) / runs.length;

      const avgCoverage =
        runs.reduce((s, r) => s + r.coveragePercent, 0) / runs.length;

      return { author, runs: runs.length, avgPassRate, avgCoverage };
    });
  }

  clear(): void {
    this.runs = [];
  }

  // --- private helpers ---

  private _detectFlakyTests(): string[] {
    const recentRuns = this.runs.slice(-FLAKY_DETECTION_RUNS);
    if (recentRuns.length < 2) return [];

    const testStatusHistory = new Map<string, Set<string>>();

    for (const run of recentRuns) {
      for (const r of run.results) {
        if (!testStatusHistory.has(r.id)) testStatusHistory.set(r.id, new Set());
        testStatusHistory.get(r.id)!.add(r.status);
      }
    }

    const flaky: string[] = [];
    for (const [id, statuses] of testStatusHistory) {
      if (statuses.has('passed') && statuses.has('failed')) {
        const name = recentRuns[0].results.find(r => r.id === id)?.name ?? id;
        flaky.push(name);
      }
    }
    return flaky;
  }

  private _evaluateQualityGates(run?: TestRun): QualityGate[] {
    if (!run) return [];

    const total = run.results.length;
    const passed = run.results.filter(r => r.status === 'passed').length;
    const passRate = total ? (passed / total) * 100 : 0;

    return [
      { name: 'Pass Rate ≥ 80%', threshold: 80, actual: passRate, passed: passRate >= 80 },
      { name: 'Coverage ≥ 70%', threshold: 70, actual: run.coveragePercent, passed: run.coveragePercent >= 70 },
      {
        name: 'No slow tests (>1s)',
        threshold: 0,
        actual: run.results.filter(r => r.duration > SLOW_TEST_THRESHOLD_MS).length,
        passed: run.results.every(r => r.duration <= SLOW_TEST_THRESHOLD_MS),
      },
    ];
  }

  private _calculateROI(): TestAnalytics['roi'] {
    const totalTests = this.runs.reduce((s, r) => s + r.results.length, 0);
    const failuresCaught = this.runs.reduce(
      (s, r) => s + r.results.filter(t => t.status === 'failed').length,
      0
    );
    const avgCoverage =
      this.runs.length
        ? this.runs.reduce((s, r) => s + r.coveragePercent, 0) / this.runs.length
        : 0;

    return {
      bugsPreventedEstimate: Math.round(failuresCaught * 0.6),
      timeSavedMs: totalTests * 30_000, // ~30s manual verification per test
      coverageValue: avgCoverage,
    };
  }
}

export const testReportingService = new TestReportingService();
export default testReportingService;
