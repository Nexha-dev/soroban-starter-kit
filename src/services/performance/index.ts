export { performanceMetricsCollector, type CoreWebVitals, type PerformanceSnapshot } from './metricsCollector';
export { performanceBudgetManager, type PerformanceBudget, type BudgetAlert } from './budgetManager';
export { performanceAnalyzer, type PerformanceRecommendation, type PerformanceAnalysis } from './analyzer';
export { performanceComparator, type PerformanceComparison } from './comparator';
export { bundleAnalyzer, type BundleReport, type ChunkInfo, type SplitOpportunity } from './bundleAnalyzer';
export { imageOptimizer, type ImageOptimizationReport, type ImageRecommendation } from './imageOptimizer';
export { cacheStrategyManager, type CacheRule, type CacheStrategy, type CacheStats } from './cacheStrategyManager';
export { uxCorrelator, type UXCorrelation, type PerformanceInsight, type UXEvent } from './uxCorrelator';

// New framework services
export { Profiler, profiler } from './profiler';
export { Monitor, monitor } from './monitor';
export { Optimizer, optimizer } from './optimizer';
export { LoadTester } from './loadTester';
export { StressTester } from './stressTester';
export { Reporter, reporter } from './reporter';

// New types
export type {
  BenchmarkResult,
  BenchmarkStats,
  Bottleneck,
  Recommendation,
  RecommendationCategory,
  LoadTestConfig,
  LoadTestResult,
  StressTestConfig,
  StressTestStep,
  StressTestResult,
  RuntimeMetric,
  ThresholdViolationEvent,
  Budget,
  BudgetViolation,
  PerformanceReport,
} from './types';

// New error classes
export { InvalidConfigError, InvalidBudgetError, ReportDeserializationError } from './types';
