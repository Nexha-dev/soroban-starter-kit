/**
 * Documentation Analytics & Optimization Service
 * Tracks usage, measures content effectiveness, identifies gaps,
 * supports A/B testing, and calculates documentation ROI.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComponentUsageEvent {
  componentId: string;
  event: 'view' | 'playground' | 'copy-code' | 'contribution' | 'feedback' | 'time-on-page';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  componentId: string;
  views: number;
  playgroundUses: number;
  codeCopies: number;
  avgTimeOnPage: number; // seconds
  satisfactionScore: number; // 0–5
  helpfulVotes: number;
  notHelpfulVotes: number;
}

export interface SearchEvent {
  query: string;
  resultCount: number;
  timestamp: number;
  clickedResult?: string;
}

export interface SatisfactionEvent {
  pageId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  timestamp: number;
}

export interface ContentGap {
  topic: string;
  searchCount: number;
  zeroResultRate: number; // 0–1
  priority: 'high' | 'medium' | 'low';
}

export interface ABTest {
  id: string;
  name: string;
  variants: { id: string; label: string }[];
  startedAt: number;
  endedAt?: number;
  active: boolean;
}

export interface ABTestEvent {
  testId: string;
  variantId: string;
  pageId: string;
  event: 'impression' | 'engagement' | 'conversion';
  timestamp: number;
}

export interface ABTestResult {
  testId: string;
  variants: {
    id: string;
    label: string;
    impressions: number;
    engagements: number;
    conversions: number;
    conversionRate: number;
  }[];
  winner?: string;
}

export interface OptimizationRecommendation {
  pageId: string;
  type: 'low-engagement' | 'high-bounce' | 'content-gap' | 'low-satisfaction' | 'stale-content';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DocROI {
  totalPageViews: number;
  avgSatisfaction: number;
  supportDeflectionEstimate: number; // estimated support tickets avoided
  contentGapCount: number;
  optimizationOpportunities: number;
  score: number; // 0–100 composite
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DocsAnalytics {
  private events: ComponentUsageEvent[] = [];
  private searches: SearchEvent[] = [];
  private satisfaction: SatisfactionEvent[] = [];
  private abTests: Map<string, ABTest> = new Map();
  private abEvents: ABTestEvent[] = [];
  private readonly maxEvents = 2000;

  // ── Core tracking ──────────────────────────────────────────────────────────

  track(componentId: string, event: ComponentUsageEvent['event'], metadata?: Record<string, unknown>): void {
    this.events.push({ componentId, event, timestamp: Date.now(), metadata });
    if (this.events.length > this.maxEvents) this.events.shift();
  }

  trackSearch(query: string, resultCount: number, clickedResult?: string): void {
    this.searches.push({ query, resultCount, timestamp: Date.now(), clickedResult });
    if (this.searches.length > 500) this.searches.shift();
  }

  trackSatisfaction(pageId: string, rating: SatisfactionEvent['rating'], comment?: string): void {
    this.satisfaction.push({ pageId, rating, comment, timestamp: Date.now() });
  }

  // ── Usage summaries ────────────────────────────────────────────────────────

  getSummary(componentId: string): UsageSummary {
    const relevant = this.events.filter(e => e.componentId === componentId);
    const timeEvents = relevant.filter(e => e.event === 'time-on-page');
    const avgTime = timeEvents.length
      ? timeEvents.reduce((sum, e) => sum + ((e.metadata?.seconds as number) ?? 0), 0) / timeEvents.length
      : 0;

    const ratings = this.satisfaction.filter(s => s.pageId === componentId).map(s => s.rating);
    const satisfactionScore = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const feedbackEvents = relevant.filter(e => e.event === 'feedback');
    const helpfulVotes = feedbackEvents.filter(e => e.metadata?.helpful === true).length;
    const notHelpfulVotes = feedbackEvents.filter(e => e.metadata?.helpful === false).length;

    return {
      componentId,
      views: relevant.filter(e => e.event === 'view').length,
      playgroundUses: relevant.filter(e => e.event === 'playground').length,
      codeCopies: relevant.filter(e => e.event === 'copy-code').length,
      avgTimeOnPage: Math.round(avgTime),
      satisfactionScore: Math.round(satisfactionScore * 10) / 10,
      helpfulVotes,
      notHelpfulVotes,
    };
  }

  getTopComponents(limit = 5): UsageSummary[] {
    const ids = [...new Set(this.events.map(e => e.componentId))];
    return ids
      .map(id => this.getSummary(id))
      .sort((a, b) => (b.views + b.playgroundUses) - (a.views + a.playgroundUses))
      .slice(0, limit);
  }

  // ── Search analytics ───────────────────────────────────────────────────────

  getRecentSearches(limit = 10): SearchEvent[] {
    return this.searches.slice(-limit).reverse();
  }

  getPopularSearches(limit = 5): { query: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const s of this.searches) counts.set(s.query, (counts.get(s.query) ?? 0) + 1);
    return [...counts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ── Content gap identification ─────────────────────────────────────────────

  getContentGaps(limit = 10): ContentGap[] {
    const queryCounts = new Map<string, { total: number; zeroResults: number }>();
    for (const s of this.searches) {
      const entry = queryCounts.get(s.query) ?? { total: 0, zeroResults: 0 };
      entry.total++;
      if (s.resultCount === 0) entry.zeroResults++;
      queryCounts.set(s.query, entry);
    }

    return [...queryCounts.entries()]
      .map(([topic, { total, zeroResults }]) => {
        const zeroResultRate = total > 0 ? zeroResults / total : 0;
        const priority: ContentGap['priority'] =
          zeroResultRate > 0.7 ? 'high' : zeroResultRate > 0.3 ? 'medium' : 'low';
        return { topic, searchCount: total, zeroResultRate, priority };
      })
      .filter(g => g.zeroResultRate > 0)
      .sort((a, b) => b.searchCount * b.zeroResultRate - a.searchCount * a.zeroResultRate)
      .slice(0, limit);
  }

  // ── A/B testing ────────────────────────────────────────────────────────────

  createABTest(id: string, name: string, variants: { id: string; label: string }[]): ABTest {
    const test: ABTest = { id, name, variants, startedAt: Date.now(), active: true };
    this.abTests.set(id, test);
    return test;
  }

  endABTest(testId: string): void {
    const test = this.abTests.get(testId);
    if (test) { test.active = false; test.endedAt = Date.now(); }
  }

  trackABEvent(testId: string, variantId: string, pageId: string, event: ABTestEvent['event']): void {
    this.abEvents.push({ testId, variantId, pageId, event, timestamp: Date.now() });
  }

  getABTestResult(testId: string): ABTestResult | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    const testEvents = this.abEvents.filter(e => e.testId === testId);
    const variants = test.variants.map(v => {
      const vEvents = testEvents.filter(e => e.variantId === v.id);
      const impressions = vEvents.filter(e => e.event === 'impression').length;
      const engagements = vEvents.filter(e => e.event === 'engagement').length;
      const conversions = vEvents.filter(e => e.event === 'conversion').length;
      return {
        id: v.id,
        label: v.label,
        impressions,
        engagements,
        conversions,
        conversionRate: impressions > 0 ? conversions / impressions : 0,
      };
    });

    const winner = variants.reduce((best, v) =>
      v.conversionRate > best.conversionRate ? v : best, variants[0])?.id;

    return { testId, variants, winner };
  }

  // ── Optimization recommendations ───────────────────────────────────────────

  getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const ids = [...new Set(this.events.map(e => e.componentId))];

    for (const id of ids) {
      const summary = this.getSummary(id);

      if (summary.views > 10 && summary.satisfactionScore > 0 && summary.satisfactionScore < 3) {
        recommendations.push({
          pageId: id,
          type: 'low-satisfaction',
          message: `"${id}" has a satisfaction score of ${summary.satisfactionScore}/5. Consider revising content clarity.`,
          priority: 'high',
        });
      }

      if (summary.views > 5 && summary.codeCopies === 0 && summary.playgroundUses === 0) {
        recommendations.push({
          pageId: id,
          type: 'low-engagement',
          message: `"${id}" has ${summary.views} views but no code copies or playground uses. Add interactive examples.`,
          priority: 'medium',
        });
      }

      const notHelpfulRate = summary.helpfulVotes + summary.notHelpfulVotes > 0
        ? summary.notHelpfulVotes / (summary.helpfulVotes + summary.notHelpfulVotes)
        : 0;
      if (notHelpfulRate > 0.5) {
        recommendations.push({
          pageId: id,
          type: 'high-bounce',
          message: `"${id}" has ${Math.round(notHelpfulRate * 100)}% "not helpful" votes. Review content accuracy.`,
          priority: 'high',
        });
      }
    }

    for (const gap of this.getContentGaps(5)) {
      if (gap.priority === 'high') {
        recommendations.push({
          pageId: gap.topic,
          type: 'content-gap',
          message: `"${gap.topic}" is searched frequently (${gap.searchCount}x) with ${Math.round(gap.zeroResultRate * 100)}% zero results. Create documentation for this topic.`,
          priority: 'high',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }

  // ── ROI calculation ────────────────────────────────────────────────────────

  getROI(): DocROI {
    const totalPageViews = this.events.filter(e => e.event === 'view').length;
    const allRatings = this.satisfaction.map(s => s.rating);
    const avgSatisfaction = allRatings.length
      ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
      : 0;

    // Heuristic: each code copy or playground use = 1 avoided support ticket
    const supportDeflectionEstimate =
      this.events.filter(e => e.event === 'copy-code' || e.event === 'playground').length;

    const contentGapCount = this.getContentGaps().length;
    const optimizationOpportunities = this.getOptimizationRecommendations().length;

    // Composite score: weighted average of positive signals
    const viewScore = Math.min(totalPageViews / 100, 1) * 30;
    const satisfactionScore = (avgSatisfaction / 5) * 40;
    const deflectionScore = Math.min(supportDeflectionEstimate / 50, 1) * 20;
    const gapPenalty = Math.min(contentGapCount * 2, 10);
    const score = Math.round(viewScore + satisfactionScore + deflectionScore - gapPenalty);

    return {
      totalPageViews,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      supportDeflectionEstimate,
      contentGapCount,
      optimizationOpportunities,
      score: Math.max(0, Math.min(100, score)),
    };
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  getActiveABTests(): ABTest[] {
    return [...this.abTests.values()].filter(t => t.active);
  }

  getSatisfactionByPage(): { pageId: string; avgRating: number; count: number }[] {
    const grouped = new Map<string, number[]>();
    for (const s of this.satisfaction) {
      const arr = grouped.get(s.pageId) ?? [];
      arr.push(s.rating);
      grouped.set(s.pageId, arr);
    }
    return [...grouped.entries()].map(([pageId, ratings]) => ({
      pageId,
      avgRating: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
      count: ratings.length,
    }));
  }

  clear(): void {
    this.events = [];
    this.searches = [];
    this.satisfaction = [];
    this.abTests.clear();
    this.abEvents = [];
  }
}

export const docsAnalytics = new DocsAnalytics();
export default docsAnalytics;
