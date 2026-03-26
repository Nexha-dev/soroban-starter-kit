import { describe, it, expect, beforeEach } from 'vitest';
import { stackTraceAnalyzer } from '../stackTraceAnalyzer';
import { ErrorTrendAnalyzer } from '../errorTrendAnalyzer';
import { UserImpactTracker } from '../userImpactTracker';
import { DeveloperNotifier } from '../developerNotifier';
import type { ErrorInfo } from '../errorHandler';

function makeError(overrides: Partial<ErrorInfo> = {}): ErrorInfo {
  return {
    id: `e-${Math.random()}`,
    message: 'test error',
    category: 'network',
    severity: 'medium',
    timestamp: Date.now(),
    retryable: true,
    retryCount: 0,
    ...overrides,
  };
}

// ─── StackTraceAnalyzer ───────────────────────────────────────────────────────
describe('StackTraceAnalyzer', () => {
  it('should return empty frames for undefined stack', () => {
    const result = stackTraceAnalyzer.analyze(undefined);
    expect(result.frames).toEqual([]);
    expect(result.reproductionSteps.length).toBeGreaterThan(0);
  });

  it('should parse stack frames', () => {
    const stack = `Error: test
  at myFunction (src/app.ts:10:5)
  at node_modules/react/index.js:20:3`;
    const result = stackTraceAnalyzer.analyze(stack);
    expect(result.frames.length).toBe(2);
    expect(result.frames[0].fn).toBe('myFunction');
    expect(result.frames[0].line).toBe(10);
  });

  it('should identify app origin (non-library frame)', () => {
    const stack = `Error: test
  at myComponent (src/components/App.tsx:42:8)
  at node_modules/react-dom/index.js:5:1`;
    const result = stackTraceAnalyzer.analyze(stack);
    expect(result.origin).toContain('myComponent');
    expect(result.isLibraryError).toBe(false);
  });

  it('should flag library-only errors', () => {
    const stack = `Error: test
  at node_modules/react/index.js:10:5
  at node_modules/react-dom/index.js:20:3`;
    const result = stackTraceAnalyzer.analyze(stack);
    expect(result.isLibraryError).toBe(true);
    expect(result.debugHints.some(h => h.includes('third-party'))).toBe(true);
  });

  it('should include context in reproduction steps', () => {
    const result = stackTraceAnalyzer.analyze(undefined, { url: 'http://localhost/test', action: 'click button' });
    expect(result.reproductionSteps.some(s => s.includes('localhost/test'))).toBe(true);
    expect(result.reproductionSteps.some(s => s.includes('click button'))).toBe(true);
  });

  it('should format stack output', () => {
    const stack = `Error: test\n  at fn (src/a.ts:1:1)\n  at fn2 (src/b.ts:2:2)`;
    const { frames } = stackTraceAnalyzer.analyze(stack);
    const formatted = stackTraceAnalyzer.formatStack(frames, 2);
    expect(formatted).toContain('at fn');
    expect(formatted.split('\n').length).toBe(2);
  });
});

// ─── ErrorTrendAnalyzer ───────────────────────────────────────────────────────
describe('ErrorTrendAnalyzer', () => {
  let analyzer: ErrorTrendAnalyzer;

  beforeEach(() => {
    analyzer = new (ErrorTrendAnalyzer as any)();
  });

  it('should record errors into buckets', () => {
    analyzer.record(makeError());
    analyzer.record(makeError());
    const summary = analyzer.getSummary();
    expect(summary.buckets.length).toBeGreaterThan(0);
    expect(summary.buckets[summary.buckets.length - 1].count).toBe(2);
  });

  it('should return stable trend with single bucket', () => {
    analyzer.record(makeError());
    expect(analyzer.getSummary().trend).toBe('stable');
  });

  it('should detect spike when count exceeds threshold', () => {
    // 15 errors in one bucket: latest(15) > threshold(max(15*1.5,5)=22.5)? No.
    // With no earlier buckets, spike fires when latest >= 10 AND > threshold(max(avg*1.5,5))
    // avg=15, threshold=22.5, latest=15 < 22.5 → won't spike via avg path
    // Use absolute threshold: spike when latest >= 10 and no earlier data
    for (let i = 0; i < 10; i++) analyzer.record(makeError());
    const summary = analyzer.getSummary();
    expect(summary.spike).toBe(true);
  });

  it('should include prevention strategies for top categories', () => {
    analyzer.record(makeError({ category: 'network' }));
    const summary = analyzer.getSummary();
    expect(summary.preventionStrategies.length).toBeGreaterThan(0);
  });

  it('should clear all data', () => {
    analyzer.record(makeError());
    analyzer.clear();
    expect(analyzer.getSummary().buckets.length).toBe(0);
  });
});

// ─── UserImpactTracker ────────────────────────────────────────────────────────
describe('UserImpactTracker', () => {
  let tracker: UserImpactTracker;

  beforeEach(() => {
    tracker = new (UserImpactTracker as any)();
  });

  it('should record errors and create impact records', () => {
    tracker.record(makeError({ message: 'connection failed' }));
    expect(tracker.getAll().length).toBe(1);
  });

  it('should increment occurrences for same error key', () => {
    const err = makeError({ message: 'connection failed', category: 'network' });
    tracker.record(err);
    tracker.record({ ...err, id: 'e2' });
    const records = tracker.getAll();
    expect(records[0].occurrences).toBe(2);
  });

  it('should accept user feedback', () => {
    const fb = tracker.submitFeedback('err-1', 'Page crashed on submit', 'high');
    expect(fb.description).toBe('Page crashed on submit');
    expect(tracker.getFeedback().length).toBe(1);
  });

  it('should resolve impact records', () => {
    tracker.record(makeError({ message: 'connection failed', category: 'network' }));
    const key = tracker.getAll()[0].errorKey;
    tracker.resolve(key, 'Fixed in v1.2');
    expect(tracker.getAll().length).toBe(0); // resolved filtered out
    expect(tracker.getAll(true)[0].resolved).toBe(true);
    expect(tracker.getAll(true)[0].resolution).toBe('Fixed in v1.2');
  });

  it('should return top impact sorted by sessions × occurrences', () => {
    tracker.record(makeError({ message: 'a', category: 'network' }));
    tracker.record(makeError({ message: 'a', category: 'network' }));
    tracker.record(makeError({ message: 'b', category: 'auth' }));
    const top = tracker.getTopImpact(2);
    expect(top[0].occurrences).toBeGreaterThanOrEqual(top[1]?.occurrences ?? 0);
  });

  it('should clear all data', () => {
    tracker.record(makeError());
    tracker.clear();
    expect(tracker.getAll().length).toBe(0);
  });
});

// ─── DeveloperNotifier ────────────────────────────────────────────────────────
describe('DeveloperNotifier', () => {
  let notifier: DeveloperNotifier;

  beforeEach(() => {
    notifier = new (DeveloperNotifier as any)();
  });

  it('should fire alert for critical errors', () => {
    notifier.evaluate(makeError({ severity: 'critical', category: 'client' }));
    expect(notifier.getAlerts().length).toBeGreaterThan(0);
  });

  it('should fire alert for auth category', () => {
    notifier.evaluate(makeError({ category: 'auth', severity: 'high' }));
    const alerts = notifier.getAlerts();
    expect(alerts.some(a => a.ruleId === 'auth')).toBe(true);
  });

  it('should not fire alert for low-severity non-matching errors', () => {
    notifier.evaluate(makeError({ severity: 'low', category: 'validation' }));
    expect(notifier.getAlerts().length).toBe(0);
  });

  it('should acknowledge alerts', () => {
    notifier.evaluate(makeError({ severity: 'critical', category: 'client' }));
    const id = notifier.getAlerts()[0].id;
    notifier.acknowledge(id);
    expect(notifier.getAlerts().length).toBe(0); // filtered out
    expect(notifier.getAlerts(true)[0].acknowledged).toBe(true);
  });

  it('should notify subscribers', () => new Promise<void>(resolve => {
    const unsub = notifier.subscribe(alert => {
      expect(alert.ruleId).toBe('critical');
      unsub();
      resolve();
    });
    notifier.evaluate(makeError({ severity: 'critical', category: 'client' }));
  }));

  it('should allow disabling rules', () => {
    notifier.updateRule('critical', { enabled: false });
    notifier.evaluate(makeError({ severity: 'critical', category: 'client' }));
    expect(notifier.getAlerts().length).toBe(0);
  });

  it('should allow adding custom rules', () => {
    notifier.addRule({ id: 'custom', name: 'Custom', condition: 'category', value: 'server', enabled: true });
    notifier.evaluate(makeError({ category: 'server', severity: 'high' }));
    expect(notifier.getAlerts().some(a => a.ruleId === 'custom')).toBe(true);
  });

  it('should clear alerts and rate data', () => {
    notifier.evaluate(makeError({ severity: 'critical', category: 'client' }));
    notifier.clear();
    expect(notifier.getAlerts().length).toBe(0);
  });
});
