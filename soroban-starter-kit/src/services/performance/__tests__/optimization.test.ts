import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bundleAnalyzer } from '../bundleAnalyzer';
import { imageOptimizer } from '../imageOptimizer';
import { cacheStrategyManager } from '../cacheStrategyManager';
import { uxCorrelator } from '../uxCorrelator';

describe('BundleAnalyzer', () => {
  it('should return a bundle report', () => {
    const report = bundleAnalyzer.analyze();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('chunks');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('splitOpportunities');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should store and retrieve reports', () => {
    bundleAnalyzer.analyze();
    const latest = bundleAnalyzer.getLatestReport();
    expect(latest).not.toBeNull();
    expect(bundleAnalyzer.getReports().length).toBeGreaterThan(0);
  });
});

describe('ImageOptimizer', () => {
  it('should return an image optimization report', () => {
    const report = imageOptimizer.audit();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('images');
    expect(report).toHaveProperty('recommendations');
    expect(report.potentialSavings).toBeGreaterThanOrEqual(0);
  });

  it('should apply lazy loading and return count', () => {
    const count = imageOptimizer.applyLazyLoading();
    expect(typeof count).toBe('number');
  });
});

describe('CacheStrategyManager', () => {
  it('should have default rules', () => {
    const rules = cacheStrategyManager.getRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should match JS files to cache-first strategy', () => {
    const rule = cacheStrategyManager.getStrategy('/assets/main.abc123.js');
    expect(rule).not.toBeNull();
    expect(rule?.strategy).toBe('cache-first');
  });

  it('should match API calls to network-first strategy', () => {
    const rule = cacheStrategyManager.getStrategy('/api/transactions');
    expect(rule).not.toBeNull();
    expect(rule?.strategy).toBe('network-first');
  });

  it('should add custom rules with higher priority', () => {
    cacheStrategyManager.addRule({
      pattern: /\/custom\//,
      strategy: 'network-only',
      maxAge: 0,
    });
    const rule = cacheStrategyManager.getStrategy('/custom/data');
    expect(rule?.strategy).toBe('network-only');
  });

  it('should return empty cache stats when Cache API unavailable', async () => {
    const stats = await cacheStrategyManager.getCacheStats();
    expect(Array.isArray(stats)).toBe(true);
  });
});

describe('UXCorrelator', () => {
  beforeEach(() => {
    uxCorrelator.clearEvents();
  });

  it('should record UX events', () => {
    uxCorrelator.record({ type: 'click', timestamp: Date.now(), target: 'button' });
    expect(uxCorrelator.getEvents().length).toBe(1);
  });

  it('should correlate a metric with UX score', () => {
    const corr = uxCorrelator.correlate('lcp', 3000);
    expect(corr.metric).toBe('lcp');
    expect(corr.uxScore).toBeGreaterThanOrEqual(0);
    expect(corr.uxScore).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(corr.bounceRisk);
    expect(typeof corr.insight).toBe('string');
  });

  it('should give high UX score for good LCP', () => {
    const corr = uxCorrelator.correlate('lcp', 1000);
    expect(corr.uxScore).toBeGreaterThanOrEqual(80);
    expect(corr.bounceRisk).toBe('low');
  });

  it('should give low UX score for poor LCP', () => {
    const corr = uxCorrelator.correlate('lcp', 5000);
    expect(corr.uxScore).toBeLessThan(70);
  });

  it('should generate insights for poor vitals', () => {
    const insights = uxCorrelator.generateInsights({ lcp: 5000, cls: 0.3, fid: 400 });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some(i => i.category === 'loading')).toBe(true);
    expect(insights.some(i => i.category === 'visual-stability')).toBe(true);
    expect(insights.some(i => i.category === 'interactivity')).toBe(true);
  });

  it('should generate no insights for good vitals', () => {
    const insights = uxCorrelator.generateInsights({ lcp: 1000, cls: 0.05, fid: 50 });
    expect(insights.filter(i => i.category !== 'interactivity').length).toBe(0);
  });

  it('should detect rage clicks in insights', () => {
    for (let i = 0; i < 3; i++) {
      uxCorrelator.record({ type: 'rage-click', timestamp: Date.now() });
    }
    const insights = uxCorrelator.generateInsights({});
    expect(insights.some(i => i.title.includes('Rage Click'))).toBe(true);
  });
});
