/**
 * Performance Optimizer
 * Analyzes profiler stats to identify bottlenecks and generate recommendations.
 */

import { Bottleneck, Recommendation } from './types';
import { Profiler } from './profiler';
import { monitor, Monitor } from './monitor';
import { performanceBudgetManager } from './budgetManager';

export class Optimizer {
  private consecutiveCyclesMap = new Map<string, number>();

  constructor(
    private profiler: Profiler,
    private _monitor: Monitor,
    private budgetManager: typeof performanceBudgetManager
  ) {}

  analyzeBottlenecks(): Bottleneck[] {
    const allStats = this.profiler.getAllStats();
    if (allStats.length === 0) return [];

    const meanValues = allStats.map(s => s.meanMs).sort((a, b) => a - b);
    const p90Index = Math.floor(meanValues.length * 0.9);
    const p90 = meanValues[p90Index];

    const bottlenecks: Bottleneck[] = [];

    for (const stat of allStats) {
      if (stat.meanMs > p90) {
        const type: Bottleneck['type'] = stat.operationName.startsWith('contract:')
          ? 'smart-contract'
          : 'frontend';

        const contributingFactors =
          type === 'smart-contract'
            ? ['high mean duration', 'exceeds 90th percentile', 'smart contract overhead']
            : ['high mean duration', 'exceeds 90th percentile'];

        // Compute percentile rank: fraction of operations with meanMs <= this one
        const rank =
          meanValues.filter(v => v <= stat.meanMs).length / meanValues.length;

        bottlenecks.push({
          operationName: stat.operationName,
          meanDurationMs: stat.meanMs,
          percentileRank: rank,
          contributingFactors,
          type,
        });
      }
    }

    // Sort by meanDurationMs descending
    bottlenecks.sort((a, b) => b.meanDurationMs - a.meanDurationMs);
    return bottlenecks;
  }

  generateRecommendations(): Recommendation[] {
    const bottlenecks = this.analyzeBottlenecks();
    const recommendations: Recommendation[] = [];
    const now = Date.now();

    for (const bottleneck of bottlenecks) {
      const { operationName, meanDurationMs, type } = bottleneck;
      const cycles = this.consecutiveCyclesMap.get(operationName) ?? 0;

      const results = this.profiler.getResults(operationName);
      const confidenceScore = Math.min(1.0, results.length / 10);

      const category: Recommendation['category'] =
        type === 'smart-contract' ? 'smart-contract' : 'caching';

      const remediationStrategy =
        category === 'smart-contract'
          ? 'Optimize smart contract logic, reduce on-chain computation, or cache contract reads'
          : 'Implement caching layer to reduce redundant computations and improve response times';

      recommendations.push({
        id: `${operationName}-${now}`,
        affectedOperation: operationName,
        measuredValue: meanDurationMs,
        threshold: this.budgetManager.getThreshold(operationName),
        category,
        remediationStrategy,
        confidenceScore,
        priority: cycles >= 3 ? 'critical' : 'normal',
        consecutiveCycles: cycles,
      });
    }

    // Detect batching opportunities from monitor metrics
    const windowEnd = Date.now();
    const windowStart = windowEnd - 1000;
    const recentMetrics = this._monitor.getMetrics(windowStart, windowEnd);

    const contractMetrics = recentMetrics.filter(m => m.category === 'contract');
    const nameGroups = new Map<string, number>();
    for (const m of contractMetrics) {
      nameGroups.set(m.name, (nameGroups.get(m.name) ?? 0) + 1);
    }

    for (const [name, count] of nameGroups) {
      if (count > 1) {
        recommendations.push({
          id: `${name}-batch-${now}`,
          affectedOperation: name,
          measuredValue: count,
          threshold: 1,
          category: 'batching',
          remediationStrategy: `Batch multiple calls to "${name}" within a 1000ms window to reduce network overhead`,
          confidenceScore: Math.min(1.0, count / 10),
          priority: 'normal',
          consecutiveCycles: 0,
        });
      }
    }

    // Sort by measuredValue descending (highest impact first)
    recommendations.sort((a, b) => b.measuredValue - a.measuredValue);
    return recommendations;
  }

  recordCycle(): void {
    const bottlenecks = this.analyzeBottlenecks();
    for (const bottleneck of bottlenecks) {
      const current = this.consecutiveCyclesMap.get(bottleneck.operationName) ?? 0;
      this.consecutiveCyclesMap.set(bottleneck.operationName, current + 1);
    }
  }
}

// Singleton instance using default singletons
import { profiler } from './profiler';

export const optimizer = new Optimizer(profiler, monitor, performanceBudgetManager);
export default optimizer;
