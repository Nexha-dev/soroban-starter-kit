/**
 * Performance Analyzer
 * Analyzes performance data and provides recommendations
 */

export interface PerformanceRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  category: string;
}

export interface PerformanceAnalysis {
  timestamp: number;
  score: number; // 0-100
  recommendations: PerformanceRecommendation[];
  issues: string[];
}

class PerformanceAnalyzer {
  private analyses: PerformanceAnalysis[] = [];
  private maxAnalyses = 50;

  /**
   * Analyze performance data
   */
  analyze(vitals: any, memory: any): PerformanceAnalysis {
    const recommendations: PerformanceRecommendation[] = [];
    const issues: string[] = [];
    let score = 100;

    // LCP Analysis
    if (vitals.lcp) {
      if (vitals.lcp > 4000) {
        score -= 30;
        issues.push('LCP is critical');
        recommendations.push({
          id: 'lcp-1',
          title: 'Optimize Largest Contentful Paint',
          description: 'Reduce server response time and optimize images',
          impact: 'high',
          effort: 'medium',
          category: 'Performance',
        });
      } else if (vitals.lcp > 2500) {
        score -= 15;
        issues.push('LCP needs improvement');
      }
    }

    // FID Analysis
    if (vitals.fid) {
      if (vitals.fid > 300) {
        score -= 25;
        issues.push('FID is critical');
        recommendations.push({
          id: 'fid-1',
          title: 'Reduce First Input Delay',
          description: 'Break up long JavaScript tasks',
          impact: 'high',
          effort: 'medium',
          category: 'Performance',
        });
      } else if (vitals.fid > 100) {
        score -= 10;
        issues.push('FID needs improvement');
      }
    }

    // CLS Analysis
    if (vitals.cls) {
      if (vitals.cls > 0.25) {
        score -= 20;
        issues.push('CLS is critical');
        recommendations.push({
          id: 'cls-1',
          title: 'Reduce Cumulative Layout Shift',
          description: 'Add size attributes to images and videos',
          impact: 'high',
          effort: 'easy',
          category: 'Performance',
        });
      } else if (vitals.cls > 0.1) {
        score -= 10;
        issues.push('CLS needs improvement');
      }
    }

    // Memory Analysis
    if (memory && memory.usedJSHeapSize > 100 * 1024 * 1024) {
      score -= 15;
      issues.push('High memory usage');
      recommendations.push({
        id: 'mem-1',
        title: 'Optimize Memory Usage',
        description: 'Remove unused dependencies and optimize data structures',
        impact: 'medium',
        effort: 'medium',
        category: 'Memory',
      });
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'gen-1',
        title: 'Continue Monitoring',
        description: 'Performance is good, continue monitoring for regressions',
        impact: 'low',
        effort: 'easy',
        category: 'General',
      });
    }

    const analysis: PerformanceAnalysis = {
      timestamp: Date.now(),
      score: Math.max(0, score),
      recommendations,
      issues,
    };

    this.analyses.push(analysis);
    if (this.analyses.length > this.maxAnalyses) {
      this.analyses.shift();
    }

    return analysis;
  }

  /**
   * Get analysis history
   */
  getHistory(): PerformanceAnalysis[] {
    return [...this.analyses];
  }

  /**
   * Get latest analysis
   */
  getLatest(): PerformanceAnalysis | null {
    return this.analyses.length > 0 ? this.analyses[this.analyses.length - 1] : null;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.analyses = [];
  }
}

export const performanceAnalyzer = new PerformanceAnalyzer();
export default performanceAnalyzer;
