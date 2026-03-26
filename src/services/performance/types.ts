/**
 * Shared interfaces and error classes for the Performance Optimization Framework
 */

// --- Benchmark ---

export interface BenchmarkResult {
  operationName: string;
  timestamp: number;
  durationMs: number;
  memoryKb: number;
}

export interface BenchmarkStats {
  operationName: string;
  runs: number;
  meanMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
}

// --- Optimizer ---

export type RecommendationCategory =
  | 'caching'
  | 'batching'
  | 'lazy-loading'
  | 'code-splitting'
  | 'smart-contract';

export interface Bottleneck {
  operationName: string;
  meanDurationMs: number;
  percentileRank: number;
  contributingFactors: string[];
  type: 'frontend' | 'smart-contract';
}

export interface Recommendation {
  id: string;
  affectedOperation: string;
  measuredValue: number;
  threshold: number;
  remediationStrategy: string;
  category: RecommendationCategory;
  confidenceScore: number;
  priority: 'normal' | 'critical';
  consecutiveCycles: number;
}

// --- Load Testing ---

export interface LoadTestConfig {
  operationName: string;
  operation: () => Promise<void>;
  concurrency: number;
  durationSeconds: number;
}

export interface LoadTestResult {
  config: Omit<LoadTestConfig, 'operation'>;
  throughputOps: number;
  meanLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  errors: string[];
  passed: boolean;
  timestamp: number;
}

// --- Stress Testing ---

export interface StressTestConfig {
  operation: () => Promise<void>;
  startConcurrency: number;
  stepIncrement: number;
  stepDurationSeconds: number;
  maxConcurrency: number;
}

export interface StressTestStep {
  concurrency: number;
  throughputOps: number;
  meanLatencyMs: number;
  errorRate: number;
}

export interface StressTestResult {
  config: Omit<StressTestConfig, 'operation'>;
  steps: StressTestStep[];
  maxSustainableConcurrency: number;
  failureThreshold: number | null;
  failureDetails: { concurrency: number; errorType: string; timestamp: number } | null;
  timestamp: number;
}

// --- Monitor ---

export interface RuntimeMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'page' | 'contract';
}

export interface ThresholdViolationEvent {
  metricName: string;
  measuredValue: number;
  thresholdValue: number;
  timestamp: number;
}

// --- Budget ---

export interface Budget {
  metricName: string;
  threshold: number;
}

export interface BudgetViolation {
  metricName: string;
  measuredValue: number;
  thresholdValue: number;
  timestamp: number;
}

// --- Report ---

export interface PerformanceReport {
  generatedAt: number;
  benchmarkResults: BenchmarkStats[];
  bottlenecks: Bottleneck[];
  loadTestResults: LoadTestResult[];
  budgetViolations: BudgetViolation[];
  recommendations: Recommendation[];
}

// --- Error Classes ---

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
    Object.setPrototypeOf(this, InvalidConfigError.prototype);
  }
}

export class InvalidBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBudgetError';
    Object.setPrototypeOf(this, InvalidBudgetError.prototype);
  }
}

export class ReportDeserializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportDeserializationError';
    Object.setPrototypeOf(this, ReportDeserializationError.prototype);
  }
}
