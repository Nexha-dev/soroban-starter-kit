/**
 * Performance Monitor Tests
 */

import { performanceMonitor } from '../performanceMonitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  describe('Marking and Measuring', () => {
    it('should mark and measure performance', () => {
      performanceMonitor.mark('test-operation');
      
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      const duration = performanceMonitor.measure('test-operation');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should record metrics directly', () => {
      performanceMonitor.recordMetric('operation', 10.5, { type: 'test' });

      const summary = performanceMonitor.getSummary('operation');
      expect(summary).not.toBeNull();
      expect(summary?.avgTime).toBe(10.5);
    });

    it('should warn on missing mark', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const duration = performanceMonitor.measure('non-existent');
      expect(duration).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Summaries', () => {
    it('should calculate performance summary', () => {
      performanceMonitor.recordMetric('op', 10);
      performanceMonitor.recordMetric('op', 20);
      performanceMonitor.recordMetric('op', 30);

      const summary = performanceMonitor.getSummary('op');
      expect(summary?.count).toBe(3);
      expect(summary?.avgTime).toBe(20);
      expect(summary?.minTime).toBe(10);
      expect(summary?.maxTime).toBe(30);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        performanceMonitor.recordMetric('op', i);
      }

      const summary = performanceMonitor.getSummary('op');
      expect(summary?.p95Time).toBeGreaterThan(90);
      expect(summary?.p99Time).toBeGreaterThan(98);
    });

    it('should get all summaries', () => {
      performanceMonitor.recordMetric('op1', 10);
      performanceMonitor.recordMetric('op2', 20);
      performanceMonitor.recordMetric('op3', 30);

      const summaries = performanceMonitor.getAllSummaries();
      expect(summaries.length).toBe(3);
    });
  });

  describe('Querying', () => {
    it('should get recent metrics', () => {
      for (let i = 0; i < 100; i++) {
        performanceMonitor.recordMetric('op', i);
      }

      const recent = performanceMonitor.getRecent(10);
      expect(recent.length).toBe(10);
    });

    it('should get metrics in time range', () => {
      const now = Date.now();
      
      performanceMonitor.recordMetric('op', 10);
      const metric = performanceMonitor.getRecent(1)[0];

      const inRange = performanceMonitor.getMetricsInRange(now - 1000, now + 1000);
      expect(inRange.length).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    it('should export metrics as JSON', () => {
      performanceMonitor.recordMetric('op', 10);

      const exported = performanceMonitor.export();
      const parsed = JSON.parse(exported);

      expect(parsed.metrics).toBeDefined();
      expect(parsed.summaries).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clear all metrics', () => {
      performanceMonitor.recordMetric('op', 10);
      performanceMonitor.clear();

      const summary = performanceMonitor.getSummary('op');
      expect(summary).toBeNull();
    });
  });
});
