# Implementation Plan: Performance Optimization Framework

## Overview

Implement the Performance Optimization Framework as TypeScript service classes in `src/services/performance/`, extending the existing infrastructure with benchmarking, bottleneck analysis, load/stress testing, runtime monitoring, budget enforcement, and reporting.

## Tasks

- [x] 1. Set up types and shared interfaces
  - Create `src/services/performance/types.ts` with all shared interfaces: `BenchmarkResult`, `BenchmarkStats`, `Bottleneck`, `Recommendation`, `RecommendationCategory`, `LoadTestConfig`, `LoadTestResult`, `StressTestConfig`, `StressTestStep`, `StressTestResult`, `RuntimeMetric`, `ThresholdViolationEvent`, `Budget`, `BudgetViolation`, `PerformanceReport`
  - Define custom error classes: `InvalidConfigError`, `InvalidBudgetError`, `ReportDeserializationError`
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 3.1, 3.3, 4.1, 4.4, 5.1, 5.3, 6.1, 7.1, 8.1_

- [ ] 2. Implement Profiler
  - [x] 2.1 Create `src/services/performance/profiler.ts` implementing the `Profiler` class
    - `register(name, fn)` stores operation by name
    - `run(name)` measures `durationMs` via `performance.now()` and `memoryKb` via `performance.memory` (with fallback), stores result with timestamp
    - `getResults(name)` returns stored results
    - `getStats(name)` computes mean, median, min, max across all runs; returns `null` for unknown operations
    - `getAllStats()` returns stats for all registered operations
    - Error handling: catch thrown operations, record sentinel `durationMs = -1`, re-throw
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for Profiler — benchmark result completeness
    - **Property 1: Benchmark result completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 2.3 Write property test for Profiler — benchmark stats invariants
    - **Property 2: Benchmark stats invariants**
    - **Validates: Requirements 1.4**

  - [ ]* 2.4 Write property test for Profiler — benchmark retrieval performance
    - **Property 3: Benchmark retrieval performance**
    - **Validates: Requirements 1.6**

- [ ] 3. Implement BudgetManager extensions
  - [x] 3.1 Extend `src/services/performance/budgetManager.ts` with `defineBudget(budget)` persisting to `localStorage` key `perf:budgets`, `getViolations(windowStart, windowEnd)` reading from `perf:violations`, and default thresholds (pageLoadTime=3000ms, contractRead=200ms, contractTx=5000ms)
    - Add `recordViolation(violation: BudgetViolation)` internal method that appends to `perf:violations` and prunes entries older than 24h
    - Throw `InvalidBudgetError` for non-positive thresholds
    - Fall back to defaults and log warning on corrupted localStorage deserialization
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 3.2 Write property test for BudgetManager — budget persistence round-trip
    - **Property 21: Budget persistence round-trip**
    - **Validates: Requirements 7.2**

  - [ ]* 3.3 Write property test for BudgetManager — violation window filtering
    - **Property 22: Violation window filtering**
    - **Validates: Requirements 7.5**

  - [ ]* 3.4 Write unit test for BudgetManager — default thresholds
    - **Property 23: Default thresholds (example)**
    - **Validates: Requirements 7.6**

- [ ] 4. Implement Monitor
  - [x] 4.1 Create `src/services/performance/monitor.ts` implementing the `Monitor` class
    - `start()` attaches navigation event listeners to collect `pageLoadTime`, `timeToInteractive`, `firstContentfulPaint` from `PerformanceObserver`
    - `stop()` removes listeners
    - `recordContractCall(name, latencyMs, success)` stores a `RuntimeMetric` to `perf:metrics` in localStorage (with in-memory fallback), prunes entries older than 24h on each write
    - `getMetrics(windowStart, windowEnd)` returns metrics within the time window
    - `getAggregated(windowStart, windowEnd)` computes mean, p95, p99 using sorted-index percentile method
    - `onViolation(handler)` registers a violation handler; returns unsubscribe function
    - Compare each recorded metric against BudgetManager thresholds; emit `ThresholdViolationEvent` and call `BudgetManager.recordViolation` on breach
    - Overhead constraint: `recordContractCall` must complete in under 5ms
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.2 Write property test for Monitor — contract call round-trip
    - **Property 12: Contract call round-trip**
    - **Validates: Requirements 5.2**

  - [ ]* 4.3 Write property test for Monitor — threshold violation emission
    - **Property 13: Threshold violation emission**
    - **Validates: Requirements 5.3**

  - [ ]* 4.4 Write property test for Monitor — metric retention within 24 hours
    - **Property 14: Metric retention within 24 hours**
    - **Validates: Requirements 5.4**

  - [ ]* 4.5 Write property test for Monitor — aggregation correctness
    - **Property 15: Aggregation correctness**
    - **Validates: Requirements 5.5**

  - [ ]* 4.6 Write property test for Monitor — monitor overhead
    - **Property 16: Monitor overhead**
    - **Validates: Requirements 5.6**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Optimizer
  - [x] 6.1 Create `src/services/performance/optimizer.ts` implementing the `Optimizer` class
    - `analyzeBottlenecks()` reads all `BenchmarkStats` from Profiler; computes 90th percentile of `meanMs` values; returns operations exceeding it sorted by `meanDurationMs` descending; sets `type` based on operation name convention (prefix `contract:` → `'smart-contract'`, else `'frontend'`)
    - `generateRecommendations()` reads bottlenecks and Monitor metrics; generates `Recommendation` objects with `category`, `confidenceScore`, `remediationStrategy`; sorts by estimated impact descending; sets `priority = 'critical'` when `consecutiveCycles >= 3`
    - `recordCycle()` increments `consecutiveCycles` for unresolved recommendations
    - Detect batching opportunities: two or more contract calls with same name within a configurable time window → add batching recommendation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Write property test for Optimizer — bottleneck identification and ordering
    - **Property 4: Bottleneck identification and ordering**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]* 6.3 Write property test for Optimizer — batching detection
    - **Property 5: Batching detection**
    - **Validates: Requirements 2.3**

  - [ ]* 6.4 Write property test for Optimizer — recommendation generation on threshold breach
    - **Property 17: Recommendation generation on threshold breach**
    - **Validates: Requirements 6.1**

  - [ ]* 6.5 Write property test for Optimizer — recommendation shape invariant
    - **Property 18: Recommendation shape invariant**
    - **Validates: Requirements 6.2, 6.4**

  - [ ]* 6.6 Write property test for Optimizer — recommendation ordering
    - **Property 19: Recommendation ordering**
    - **Validates: Requirements 6.3**

  - [ ]* 6.7 Write property test for Optimizer — recommendation escalation
    - **Property 20: Recommendation escalation**
    - **Validates: Requirements 6.5**

- [ ] 7. Implement LoadTester
  - [x] 7.1 Create `src/services/performance/loadTester.ts` implementing the `LoadTester` class
    - `run(config)` validates config (throw `InvalidConfigError` for non-positive concurrency or duration), then launches `config.concurrency` concurrent invocations of `config.operation` in a loop for `config.durationSeconds` seconds
    - Collect per-invocation latencies; compute `throughputOps`, `meanLatencyMs`, `p95LatencyMs`, `p99LatencyMs`, `errorRate`
    - Set `passed = errorRate <= 0.01`; populate `errors[]` with caught error messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 7.2 Write property test for LoadTester — operation invocation count
    - **Property 6: Load test operation invocation count**
    - **Validates: Requirements 3.2**

  - [ ]* 7.3 Write property test for LoadTester — result shape
    - **Property 7: Load test result shape**
    - **Validates: Requirements 3.3**

  - [ ]* 7.4 Write property test for LoadTester — failure flag
    - **Property 8: Load test failure flag**
    - **Validates: Requirements 3.4**

- [ ] 8. Implement StressTester
  - [x] 8.1 Create `src/services/performance/stressTester.ts` implementing the `StressTester` class
    - `run(config)` validates config (throw `InvalidConfigError` for invalid parameters), then iterates concurrency from `startConcurrency` to `maxConcurrency` in steps of `stepIncrement`
    - At each step, run concurrent operations for `stepDurationSeconds`; record `StressTestStep`
    - If `errorRate > 0.05` at any step, record `failureDetails`, set `failureThreshold`, stop iteration
    - Set `maxSustainableConcurrency` to last step with `errorRate <= 0.05`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 8.2 Write property test for StressTester — step sequence
    - **Property 9: Stress test step sequence**
    - **Validates: Requirements 4.2**

  - [ ]* 8.3 Write property test for StressTester — structural invariants
    - **Property 10: Stress test structural invariants**
    - **Validates: Requirements 4.4**

  - [ ]* 8.4 Write property test for StressTester — failure threshold
    - **Property 11: Stress test failure threshold**
    - **Validates: Requirements 4.5**

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Reporter
  - [x] 10.1 Create `src/services/performance/reporter.ts` implementing the `Reporter` class
    - `generate()` reads from in-memory caches of Profiler, Optimizer, LoadTester, StressTester, BudgetManager; assembles `PerformanceReport`; must complete within 500ms
    - `toJSON(report)` serializes to JSON string
    - `fromJSON(json)` deserializes; throws `ReportDeserializationError` on invalid JSON or schema mismatch
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 Write property test for Reporter — report shape completeness
    - **Property 24: Report shape completeness**
    - **Validates: Requirements 8.1**

  - [ ]* 10.3 Write property test for Reporter — serialization round-trip
    - **Property 25: Report serialization round-trip**
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 10.4 Write property test for Reporter — report generation performance
    - **Property 26: Report generation performance**
    - **Validates: Requirements 8.5**

- [ ] 11. Wire up index and integrate with existing consumers
  - [x] 11.1 Update `src/services/performance/index.ts` to re-export `Profiler`, `Optimizer`, `LoadTester`, `StressTester`, `Monitor`, `Reporter`, and all types from `types.ts`
    - Export singleton instances where appropriate (consistent with existing `performanceMetricsCollector` pattern)
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_

  - [x] 11.2 Update `usePerformance.ts` hook to expose Monitor, Optimizer, and Reporter APIs to React components
    - Wire Monitor violation events to component state updates
    - _Requirements: 5.3, 6.1, 8.1_

  - [x] 11.3 Update `PerformanceDashboard.tsx` to display bottlenecks, recommendations, and budget violations from the new services
    - _Requirements: 2.4, 6.3, 7.5_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `{ numRuns: 100 }` and must include the comment tag `// Feature: performance-optimization-framework, Property N: <property_text>`
- Test files live in `src/services/performance/__tests__/`
- Percentile calculations use sorted-index method: `Math.floor(arr.length * percentile)` consistent with existing `performanceMonitor.ts`
