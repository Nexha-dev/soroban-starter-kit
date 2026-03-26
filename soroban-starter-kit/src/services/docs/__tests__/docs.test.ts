import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentRegistry, type ComponentDoc } from '../componentRegistry';
import { DocsAnalytics } from '../docsAnalytics';

// Use fresh instances per test to avoid singleton pollution
function makeRegistry() {
  return new (ComponentRegistry as any)() as InstanceType<typeof ComponentRegistry>;
}
function makeAnalytics() {
  return new (DocsAnalytics as any)() as InstanceType<typeof DocsAnalytics>;
}

const SAMPLE_DOC: ComponentDoc = {
  id: 'test-btn',
  name: 'TestButton',
  description: 'A test button component',
  category: 'form',
  version: '1.0.0',
  status: 'stable',
  tags: ['button', 'form', 'interactive'],
  contributions: 0,
  props: [
    { name: 'label', type: 'string', required: true, description: 'Button label text' },
    { name: 'disabled', type: 'boolean', required: false, defaultValue: 'false', description: 'Disables the button' },
  ],
  examples: [
    { title: 'Basic', code: '<TestButton label="Click me" />' },
    { title: 'Disabled', code: '<TestButton label="Click me" disabled />' },
  ],
  changelog: [
    { version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] },
  ],
};

describe('ComponentRegistry', () => {
  let registry: ReturnType<typeof makeRegistry>;

  beforeEach(() => {
    registry = makeRegistry();
  });

  it('should register and retrieve a component', () => {
    registry.register(SAMPLE_DOC);
    expect(registry.get('test-btn')).toEqual(SAMPLE_DOC);
  });

  it('should return undefined for unknown id', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('should list all components', () => {
    registry.register(SAMPLE_DOC);
    expect(registry.getAll().length).toBe(1);
  });

  it('should filter by category', () => {
    registry.register(SAMPLE_DOC);
    registry.register({ ...SAMPLE_DOC, id: 'nav', name: 'Nav', category: 'navigation' });
    expect(registry.getByCategory('form').length).toBe(1);
    expect(registry.getByCategory('navigation').length).toBe(1);
    expect(registry.getByCategory('data').length).toBe(0);
  });

  it('should search by name', () => {
    registry.register(SAMPLE_DOC);
    expect(registry.search('testbutton').length).toBe(1);
    expect(registry.search('xyz').length).toBe(0);
  });

  it('should search by tag', () => {
    registry.register(SAMPLE_DOC);
    expect(registry.search('interactive').length).toBe(1);
  });

  it('should search by description', () => {
    registry.register(SAMPLE_DOC);
    expect(registry.search('test button').length).toBe(1);
  });

  it('should return unique categories', () => {
    registry.register(SAMPLE_DOC);
    registry.register({ ...SAMPLE_DOC, id: 'nav', name: 'Nav', category: 'navigation' });
    const cats = registry.getCategories();
    expect(cats).toContain('form');
    expect(cats).toContain('navigation');
    expect(new Set(cats).size).toBe(cats.length); // unique
  });

  it('should increment contributions', () => {
    registry.register(SAMPLE_DOC);
    registry.addContribution('test-btn');
    expect(registry.get('test-btn')!.contributions).toBe(1);
  });
});

describe('DocsAnalytics', () => {
  let analytics: ReturnType<typeof makeAnalytics>;

  beforeEach(() => {
    analytics = makeAnalytics();
  });

  it('should track view events', () => {
    analytics.track('btn', 'view');
    analytics.track('btn', 'view');
    expect(analytics.getSummary('btn').views).toBe(2);
  });

  it('should track playground events', () => {
    analytics.track('btn', 'playground');
    expect(analytics.getSummary('btn').playgroundUses).toBe(1);
  });

  it('should track copy-code events', () => {
    analytics.track('btn', 'copy-code');
    expect(analytics.getSummary('btn').codeCopies).toBe(1);
  });

  it('should return zero summary for untracked component', () => {
    const s = analytics.getSummary('unknown');
    expect(s.views).toBe(0);
    expect(s.playgroundUses).toBe(0);
    expect(s.codeCopies).toBe(0);
  });

  it('should return top components sorted by engagement', () => {
    analytics.track('a', 'view');
    analytics.track('a', 'view');
    analytics.track('b', 'view');
    const top = analytics.getTopComponents(2);
    expect(top[0].componentId).toBe('a');
    expect(top[1].componentId).toBe('b');
  });

  it('should track searches', () => {
    analytics.trackSearch('button', 3);
    analytics.trackSearch('button', 2);
    analytics.trackSearch('table', 1);
    const popular = analytics.getPopularSearches(2);
    expect(popular[0].query).toBe('button');
    expect(popular[0].count).toBe(2);
  });

  it('should return recent searches in reverse order', () => {
    analytics.trackSearch('first', 1);
    analytics.trackSearch('second', 1);
    const recent = analytics.getRecentSearches(2);
    expect(recent[0].query).toBe('second');
  });

  it('should clear all data', () => {
    analytics.track('btn', 'view');
    analytics.trackSearch('test', 1);
    analytics.clear();
    expect(analytics.getSummary('btn').views).toBe(0);
    expect(analytics.getRecentSearches().length).toBe(0);
  });
});
