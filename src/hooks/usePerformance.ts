import { performanceMetricsCollector } from '../services/performance/metricsCollector';
import { performanceBudgetManager } from '../services/performance/budgetManager';
import { performanceAnalyzer } from '../services/performance/analyzer';
import { performanceComparator } from '../services/performance/comparator';
import { useState, useEffect } from 'react';

/**
 * Hook for performance metrics
 */
export function usePerformanceMetrics() {
  const [vitals, setVitals] = useState<any>({});
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(performanceMetricsCollector.getVitals());
      setSummary(performanceMetricsCollector.getSummary());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { vitals, summary };
}

/**
 * Hook for performance alerts
 */
export function usePerformanceAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = performanceBudgetManager.subscribe((alert) => {
      setAlerts((prev) => [...prev, alert].slice(-20));
    });

    return unsubscribe;
  }, []);

  return alerts;
}

/**
 * Hook for performance analysis
 */
export function usePerformanceAnalysis() {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const snapshots = performanceMetricsCollector.getSnapshots();
      if (snapshots.length > 0) {
        const latest = snapshots[snapshots.length - 1];
        const result = performanceAnalyzer.analyze(latest.vitals, latest.memory);
        setAnalysis(result);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return analysis;
}

/**
 * Hook for performance comparison
 */
export function usePerformanceComparison(metric: string) {
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const vitals = performanceMetricsCollector.getVitals();
      const value = (vitals as any)[metric];
      if (value !== undefined) {
        performanceComparator.recordValue(metric, value);
        const comp = performanceComparator.compare(metric, value);
        setComparison(comp);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [metric]);

  return comparison;
}

/**
 * Hook for performance budgets
 */
export function usePerformanceBudgets() {
  const [budgets, setBudgets] = useState<any[]>([]);

  useEffect(() => {
    setBudgets(performanceBudgetManager.getBudgets());
  }, []);

  return {
    budgets,
    addBudget: performanceBudgetManager.addBudget.bind(performanceBudgetManager),
  };
}
