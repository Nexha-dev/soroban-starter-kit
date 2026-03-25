import { performanceMetricsCollector } from '../metricsCollector';
import { performanceBudgetManager } from '../budgetManager';
import { performanceAnalyzer } from '../analyzer';

describe('PerformanceMetricsCollector', () => {
  beforeEach(() => {
    performanceMetricsCollector.clear();
  });

  it('should record custom metrics', () => {
    performanceMetricsCollector.recordMetric('test-metric', 100, 'ms');
    const snapshots = performanceMetricsCollector.getSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('should get Core Web Vitals', () => {
    const vitals = performanceMetricsCollector.getVitals();
    expect(vitals).toBeDefined();
  });

  it('should calculate summary', () => {
    performanceMetricsCollector.recordMetric('test', 100);
    const summary = performanceMetricsCollector.getSummary();
    expect(summary.avgLcp).toBeGreaterThanOrEqual(0);
  });
});

describe('PerformanceBudgetManager', () => {
  beforeEach(() => {
    performanceBudgetManager.clearAlerts();
  });

  it('should check budget violations', () => {
    performanceBudgetManager.checkBudget('lcp', 5000);
    const alerts = performanceBudgetManager.getAlerts();
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should categorize severity', () => {
    performanceBudgetManager.checkBudget('lcp', 5000);
    const alerts = performanceBudgetManager.getAlerts();
    expect(alerts[0].severity).toBe('critical');
  });

  it('should get budgets', () => {
    const budgets = performanceBudgetManager.getBudgets();
    expect(budgets.length).toBeGreaterThan(0);
  });
});

describe('PerformanceAnalyzer', () => {
  it('should analyze performance data', () => {
    const vitals = { lcp: 5000, fid: 200, cls: 0.3 };
    const analysis = performanceAnalyzer.analyze(vitals, null);
    expect(analysis.score).toBeLessThan(100);
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should provide recommendations', () => {
    const vitals = { lcp: 5000 };
    const analysis = performanceAnalyzer.analyze(vitals, null);
    expect(analysis.recommendations.some(r => r.id === 'lcp-1')).toBe(true);
  });

  it('should maintain analysis history', () => {
    performanceAnalyzer.analyze({ lcp: 1000 }, null);
    performanceAnalyzer.analyze({ lcp: 2000 }, null);
    const history = performanceAnalyzer.getHistory();
    expect(history.length).toBe(2);
  });
});
