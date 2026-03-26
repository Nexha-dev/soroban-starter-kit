import { testReportingService } from '../testReportingService';
import type { TestRun } from '../types';

const makeRun = (overrides: Partial<TestRun> = {}): TestRun => ({
  id: `run-${Date.now()}-${Math.random()}`,
  timestamp: Date.now(),
  author: 'alice',
  branch: 'main',
  commit: 'abc123',
  coveragePercent: 75,
  totalDuration: 3000,
  results: [
    { id: 't1', name: 'test A', suite: 'Suite1', status: 'passed', duration: 100, timestamp: Date.now() },
    { id: 't2', name: 'test B', suite: 'Suite1', status: 'passed', duration: 200, timestamp: Date.now() },
    { id: 't3', name: 'test C', suite: 'Suite2', status: 'failed', duration: 150, timestamp: Date.now(), error: 'AssertionError' },
  ],
  ...overrides,
});

describe('TestReportingService', () => {
  beforeEach(() => testReportingService.clear());

  describe('run management', () => {
    it('stores and retrieves runs', () => {
      const run = makeRun();
      testReportingService.addRun(run);
      expect(testReportingService.getHistory()).toHaveLength(1);
      expect(testReportingService.getLatestRun()?.id).toBe(run.id);
    });

    it('returns undefined for latest when empty', () => {
      expect(testReportingService.getLatestRun()).toBeUndefined();
    });
  });

  describe('analytics', () => {
    it('calculates pass rate correctly', () => {
      testReportingService.addRun(makeRun());
      const { passRate } = testReportingService.getAnalytics();
      expect(passRate).toBeCloseTo(2 / 3);
    });

    it('calculates average duration', () => {
      testReportingService.addRun(makeRun());
      const { avgDuration } = testReportingService.getAnalytics();
      expect(avgDuration).toBeCloseTo((100 + 200 + 150) / 3);
    });

    it('identifies slow tests', () => {
      const run = makeRun({
        results: [
          { id: 't1', name: 'fast', suite: 'S', status: 'passed', duration: 200, timestamp: Date.now() },
          { id: 't2', name: 'slow one', suite: 'S', status: 'passed', duration: 1500, timestamp: Date.now() },
        ],
      });
      testReportingService.addRun(run);
      const { slowTests } = testReportingService.getAnalytics();
      expect(slowTests).toContain('slow one');
      expect(slowTests).not.toContain('fast');
    });

    it('builds coverage trend from last 10 runs', () => {
      for (let i = 0; i < 12; i++) {
        testReportingService.addRun(makeRun({ coveragePercent: 60 + i }));
      }
      const { coverageTrend } = testReportingService.getAnalytics();
      expect(coverageTrend).toHaveLength(10);
    });
  });

  describe('quality gates', () => {
    it('passes gates when thresholds met', () => {
      testReportingService.addRun(makeRun({
        coveragePercent: 85,
        results: [
          { id: 't1', name: 'a', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() },
          { id: 't2', name: 'b', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() },
          { id: 't3', name: 'c', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() },
          { id: 't4', name: 'd', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() },
          { id: 't5', name: 'e', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() },
        ],
      }));
      const { qualityGates } = testReportingService.getAnalytics();
      const passRateGate = qualityGates.find(g => g.name.includes('Pass Rate'));
      const coverageGate = qualityGates.find(g => g.name.includes('Coverage'));
      expect(passRateGate?.passed).toBe(true);
      expect(coverageGate?.passed).toBe(true);
    });

    it('fails gates when thresholds not met', () => {
      testReportingService.addRun(makeRun({ coveragePercent: 50 }));
      const { qualityGates } = testReportingService.getAnalytics();
      const coverageGate = qualityGates.find(g => g.name.includes('Coverage'));
      expect(coverageGate?.passed).toBe(false);
    });
  });

  describe('failure analysis', () => {
    it('aggregates failures across runs', () => {
      testReportingService.addRun(makeRun());
      testReportingService.addRun(makeRun());
      const failures = testReportingService.getFailureAnalysis();
      const t3 = failures.find(f => f.name === 'test C');
      expect(t3?.occurrences).toBe(2);
    });

    it('sorts by occurrence count descending', () => {
      testReportingService.addRun(makeRun());
      testReportingService.addRun(makeRun());
      testReportingService.addRun(makeRun({
        results: [{ id: 't3', name: 'test C', suite: 'Suite2', status: 'failed', duration: 100, timestamp: Date.now() }],
      }));
      const failures = testReportingService.getFailureAnalysis();
      expect(failures[0].occurrences).toBeGreaterThanOrEqual(failures[1]?.occurrences ?? 0);
    });
  });

  describe('flaky test detection', () => {
    it('detects tests that both pass and fail across runs', () => {
      testReportingService.addRun(makeRun({
        results: [{ id: 'flaky', name: 'flaky test', suite: 'S', status: 'passed', duration: 100, timestamp: Date.now() }],
      }));
      testReportingService.addRun(makeRun({
        results: [{ id: 'flaky', name: 'flaky test', suite: 'S', status: 'failed', duration: 100, timestamp: Date.now() }],
      }));
      const { flakyTests } = testReportingService.getAnalytics();
      expect(flakyTests).toContain('flaky test');
    });
  });

  describe('team metrics', () => {
    it('groups metrics by author', () => {
      testReportingService.addRun(makeRun({ author: 'alice' }));
      testReportingService.addRun(makeRun({ author: 'bob' }));
      testReportingService.addRun(makeRun({ author: 'alice' }));
      const metrics = testReportingService.getTeamMetrics();
      const alice = metrics.find(m => m.author === 'alice');
      expect(alice?.runs).toBe(2);
    });
  });

  describe('ROI calculation', () => {
    it('estimates bugs prevented from failures', () => {
      testReportingService.addRun(makeRun()); // 1 failure
      const { roi } = testReportingService.getAnalytics();
      expect(roi.bugsPreventedEstimate).toBeGreaterThan(0);
    });

    it('calculates time saved based on test count', () => {
      testReportingService.addRun(makeRun()); // 3 tests
      const { roi } = testReportingService.getAnalytics();
      expect(roi.timeSavedMs).toBe(3 * 30_000);
    });
  });
});
