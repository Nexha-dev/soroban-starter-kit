/**
 * UX Performance Correlator
 * Correlates performance metrics with user experience signals
 */

export interface UXEvent {
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'error' | 'rage-click';
  timestamp: number;
  target?: string;
  value?: number;
}

export interface UXCorrelation {
  metric: string;
  metricValue: number;
  uxScore: number; // 0-100, higher = better UX
  engagementRate: number; // events per minute
  bounceRisk: 'low' | 'medium' | 'high';
  insight: string;
}

export interface PerformanceInsight {
  category: 'loading' | 'interactivity' | 'visual-stability' | 'resource';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  automatedFix?: string;
}

class UXCorrelator {
  private events: UXEvent[] = [];
  private maxEvents = 500;
  private sessionStart = Date.now();

  constructor() {
    this.attachListeners();
  }

  private attachListeners(): void {
    if (typeof window === 'undefined') return;

    let lastClickTime = 0;
    let lastClickTarget = '';

    document.addEventListener('click', (e) => {
      const target = (e.target as Element)?.tagName?.toLowerCase() || 'unknown';
      const now = Date.now();

      // Detect rage clicks (3+ clicks on same element within 1s)
      if (target === lastClickTarget && now - lastClickTime < 1000) {
        this.record({ type: 'rage-click', timestamp: now, target });
      } else {
        this.record({ type: 'click', timestamp: now, target });
      }

      lastClickTime = now;
      lastClickTarget = target;
    }, { passive: true });

    document.addEventListener('scroll', () => {
      this.record({ type: 'scroll', timestamp: Date.now() });
    }, { passive: true });

    window.addEventListener('error', () => {
      this.record({ type: 'error', timestamp: Date.now() });
    });
  }

  record(event: UXEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
  }

  /**
   * Correlate a performance metric with UX signals
   */
  correlate(metric: string, metricValue: number): UXCorrelation {
    const windowMs = 60_000;
    const now = Date.now();
    const recentEvents = this.events.filter(e => now - e.timestamp < windowMs);

    const engagementRate = (recentEvents.length / ((now - this.sessionStart) / 60_000)) || 0;
    const rageClicks = recentEvents.filter(e => e.type === 'rage-click').length;
    const errors = recentEvents.filter(e => e.type === 'error').length;

    const uxScore = this.computeUXScore(metric, metricValue, rageClicks, errors, engagementRate);
    const bounceRisk = uxScore < 40 ? 'high' : uxScore < 70 ? 'medium' : 'low';

    const insight = this.generateInsight(metric, metricValue, rageClicks, errors);

    return { metric, metricValue, uxScore, engagementRate, bounceRisk, insight };
  }

  private computeUXScore(
    metric: string,
    value: number,
    rageClicks: number,
    errors: number,
    engagement: number
  ): number {
    let score = 100;

    // Metric-based deductions
    const thresholds: Record<string, [number, number]> = {
      lcp: [2500, 4000],
      fid: [100, 300],
      cls: [0.1, 0.25],
      ttfb: [800, 1800],
      fcp: [1800, 3000],
    };

    const [good, poor] = thresholds[metric] ?? [Infinity, Infinity];
    if (value > poor) score -= 40;
    else if (value > good) score -= 20;

    // UX signal deductions
    score -= Math.min(rageClicks * 10, 30);
    score -= Math.min(errors * 15, 30);

    // Engagement bonus (active users tolerate more)
    if (engagement > 5) score = Math.min(score + 10, 100);

    return Math.max(0, score);
  }

  private generateInsight(metric: string, value: number, rageClicks: number, errors: number): string {
    if (rageClicks > 2) return `${rageClicks} rage clicks detected — users are frustrated with unresponsive elements`;
    if (errors > 0) return `${errors} JS errors in the last minute are degrading user experience`;

    const labels: Record<string, string> = {
      lcp: `LCP of ${value.toFixed(0)}ms`,
      fid: `FID of ${value.toFixed(0)}ms`,
      cls: `CLS of ${value.toFixed(3)}`,
      ttfb: `TTFB of ${value.toFixed(0)}ms`,
    };

    const label = labels[metric] ?? `${metric}: ${value}`;
    if (value === 0) return 'No data yet — continue monitoring';

    const thresholds: Record<string, [number, number]> = {
      lcp: [2500, 4000], fid: [100, 300], cls: [0.1, 0.25], ttfb: [800, 1800],
    };
    const [good, poor] = thresholds[metric] ?? [Infinity, Infinity];

    if (value <= good) return `${label} is within good range — users likely have a smooth experience`;
    if (value <= poor) return `${label} needs improvement — some users may experience friction`;
    return `${label} is poor — high risk of user abandonment`;
  }

  /**
   * Generate automated optimization insights
   */
  generateInsights(vitals: Record<string, number>): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    if ((vitals.lcp ?? 0) > 2500) {
      insights.push({
        category: 'loading',
        title: 'Slow Largest Contentful Paint',
        description: `LCP is ${vitals.lcp?.toFixed(0)}ms. Preload hero images and reduce server response time.`,
        impact: vitals.lcp > 4000 ? 'high' : 'medium',
        automatedFix: 'Add <link rel="preload"> for the hero image',
      });
    }

    if ((vitals.cls ?? 0) > 0.1) {
      insights.push({
        category: 'visual-stability',
        title: 'Layout Shift Detected',
        description: `CLS is ${vitals.cls?.toFixed(3)}. Reserve space for dynamic content.`,
        impact: vitals.cls > 0.25 ? 'high' : 'medium',
        automatedFix: 'Set explicit width/height on images and ad slots',
      });
    }

    if ((vitals.fid ?? 0) > 100) {
      insights.push({
        category: 'interactivity',
        title: 'High First Input Delay',
        description: `FID is ${vitals.fid?.toFixed(0)}ms. Break up long JavaScript tasks.`,
        impact: vitals.fid > 300 ? 'high' : 'medium',
        automatedFix: 'Use scheduler.postTask() or setTimeout to yield to the main thread',
      });
    }

    const rageClicks = this.events.filter(e => e.type === 'rage-click').length;
    if (rageClicks > 0) {
      insights.push({
        category: 'interactivity',
        title: 'Rage Clicks Detected',
        description: `${rageClicks} rage click(s) recorded — users are clicking repeatedly on unresponsive elements.`,
        impact: 'high',
      });
    }

    return insights;
  }

  getEvents(): UXEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.sessionStart = Date.now();
  }
}

export const uxCorrelator = new UXCorrelator();
export default uxCorrelator;
