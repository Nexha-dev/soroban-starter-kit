import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApiDocRegistry,
  ApiDocGenerator,
  ApiDocExporter,
  ApiDocFeedback,
  ApiDocAnalytics,
} from '../apiDocService';
import type { ApiEndpoint } from '../types';

// Fresh instances per test
function make() {
  const registry = new ApiDocRegistry();
  const generator = new ApiDocGenerator(registry);
  const exporter = new ApiDocExporter(registry);
  const feedback = new ApiDocFeedback();
  const analytics = new ApiDocAnalytics();
  return { registry, generator, exporter, feedback, analytics };
}

const SAMPLE: ApiEndpoint = {
  id: 'token-transfer',
  name: 'token::transfer',
  description: 'Transfers tokens between accounts.',
  category: 'contract',
  version: '1.0.0',
  tags: ['token', 'transfer'],
  params: [
    { name: 'from', type: 'Address', required: true, description: 'Sender' },
    { name: 'to', type: 'Address', required: true, description: 'Recipient' },
    { name: 'amount', type: 'i128', required: true, description: 'Amount' },
  ],
  returns: { type: 'void', description: 'Emits Transfer event.' },
  examples: [{ title: 'Basic', code: `client.transfer({ from, to, amount })` }],
  errors: [{ code: 'InsufficientBalance', description: 'Not enough funds.' }],
  changelog: [{ version: '1.0.0', date: '2025-01-01', breaking: false, changes: ['Initial release'] }],
};

// ─── Registry ────────────────────────────────────────────────────────────────

describe('ApiDocRegistry', () => {
  it('registers and retrieves an endpoint', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    expect(registry.get('token-transfer')).toEqual(SAMPLE);
  });

  it('returns undefined for unknown id', () => {
    const { registry } = make();
    expect(registry.get('ghost')).toBeUndefined();
  });

  it('lists all endpoints', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('filters by category', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    registry.register({ ...SAMPLE, id: 'svc', category: 'service' });
    expect(registry.getByCategory('contract')).toHaveLength(1);
    expect(registry.getByCategory('service')).toHaveLength(1);
    expect(registry.getByCategory('hook')).toHaveLength(0);
  });

  it('filters by version', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    registry.register({ ...SAMPLE, id: 'v2', version: '2.0.0' });
    expect(registry.getByVersion('1.0.0')).toHaveLength(1);
    expect(registry.getByVersion('2.0.0')).toHaveLength(1);
  });

  it('searches by name', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    expect(registry.search('transfer')).toHaveLength(1);
    expect(registry.search('xyz')).toHaveLength(0);
  });

  it('searches by description', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    expect(registry.search('between accounts')).toHaveLength(1);
  });

  it('searches by tag', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    expect(registry.search('token')).toHaveLength(1);
  });

  it('returns unique versions', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    registry.register({ ...SAMPLE, id: 'v2', version: '2.0.0' });
    const versions = registry.getVersions();
    expect(versions).toContain('1.0.0');
    expect(versions).toContain('2.0.0');
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('returns unique categories', () => {
    const { registry } = make();
    registry.register(SAMPLE);
    registry.register({ ...SAMPLE, id: 'svc', category: 'service' });
    const cats = registry.getCategories();
    expect(new Set(cats).size).toBe(cats.length);
  });
});

// ─── Generator ───────────────────────────────────────────────────────────────

describe('ApiDocGenerator', () => {
  it('auto-generates and registers an endpoint', () => {
    const { registry, generator } = make();
    const doc = generator.generate('my-fn', 'myFunction', 'utility', ['a', 'b'], 'string', ['util']);
    expect(registry.get('my-fn')).toBeDefined();
    expect(doc.params).toHaveLength(2);
    expect(doc.params[0].name).toBe('a');
    expect(doc.returns.type).toBe('string');
    expect(doc.tags).toContain('util');
  });

  it('sets version to 1.0.0 and today date', () => {
    const { generator } = make();
    const doc = generator.generate('fn2', 'fn2', 'hook', [], 'void');
    expect(doc.version).toBe('1.0.0');
    expect(doc.changelog[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── Exporter ────────────────────────────────────────────────────────────────

describe('ApiDocExporter', () => {
  it('exports to JSON', () => {
    const { registry, exporter } = make();
    registry.register(SAMPLE);
    const out = exporter.export('json');
    const parsed = JSON.parse(out);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('token-transfer');
  });

  it('exports to Markdown with headers and params table', () => {
    const { registry, exporter } = make();
    registry.register(SAMPLE);
    const md = exporter.export('markdown');
    expect(md).toContain('## token::transfer');
    expect(md).toContain('| `from`');
    expect(md).toContain('### Returns');
    expect(md).toContain('```ts');
  });

  it('exports to HTML with section tags', () => {
    const { registry, exporter } = make();
    registry.register(SAMPLE);
    const html = exporter.export('html');
    expect(html).toContain('<section id="token-transfer">');
    expect(html).toContain('<h2>token::transfer</h2>');
    expect(html).toContain('<code>from</code>');
  });

  it('exports only specified ids', () => {
    const { registry, exporter } = make();
    registry.register(SAMPLE);
    registry.register({ ...SAMPLE, id: 'other', name: 'other' });
    const out = JSON.parse(exporter.export('json', ['token-transfer']));
    expect(out).toHaveLength(1);
  });

  it('marks deprecated endpoints in HTML', () => {
    const { registry, exporter } = make();
    registry.register({ ...SAMPLE, deprecated: true });
    expect(exporter.export('html')).toContain('deprecated');
  });

  it('marks deprecated endpoints in Markdown', () => {
    const { registry, exporter } = make();
    registry.register({ ...SAMPLE, deprecated: true });
    expect(exporter.export('markdown')).toContain('deprecated');
  });
});

// ─── Feedback ────────────────────────────────────────────────────────────────

describe('ApiDocFeedback', () => {
  it('records helpful feedback', () => {
    const { feedback } = make();
    feedback.submit('token-transfer', true);
    expect(feedback.getSentiment('token-transfer').helpful).toBe(1);
  });

  it('records not-helpful feedback', () => {
    const { feedback } = make();
    feedback.submit('token-transfer', false, 'Missing example');
    expect(feedback.getSentiment('token-transfer').notHelpful).toBe(1);
  });

  it('stores optional comment', () => {
    const { feedback } = make();
    feedback.submit('token-transfer', true, 'Great docs!');
    expect(feedback.getForEndpoint('token-transfer')[0].comment).toBe('Great docs!');
  });

  it('returns zero sentiment for unknown endpoint', () => {
    const { feedback } = make();
    const s = feedback.getSentiment('ghost');
    expect(s.helpful).toBe(0);
    expect(s.notHelpful).toBe(0);
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

describe('ApiDocAnalytics', () => {
  it('tracks views', () => {
    const { analytics, feedback } = make();
    analytics.trackView('token-transfer');
    analytics.trackView('token-transfer');
    expect(analytics.getSummary('token-transfer', feedback).views).toBe(2);
  });

  it('tracks code copies', () => {
    const { analytics, feedback } = make();
    analytics.trackCopy('token-transfer');
    expect(analytics.getSummary('token-transfer', feedback).copies).toBe(1);
  });

  it('includes feedback sentiment in summary', () => {
    const { analytics, feedback } = make();
    feedback.submit('token-transfer', true);
    feedback.submit('token-transfer', false);
    const s = analytics.getSummary('token-transfer', feedback);
    expect(s.helpfulCount).toBe(1);
    expect(s.notHelpfulCount).toBe(1);
  });

  it('returns top endpoints by views', () => {
    const { analytics } = make();
    analytics.trackView('a');
    analytics.trackView('a');
    analytics.trackView('b');
    const top = analytics.getTopEndpoints(2);
    expect(top[0].endpointId).toBe('a');
    expect(top[1].endpointId).toBe('b');
  });

  it('tracks and ranks popular searches', () => {
    const { analytics } = make();
    analytics.trackSearch('transfer', 3);
    analytics.trackSearch('transfer', 2);
    analytics.trackSearch('escrow', 1);
    const popular = analytics.getPopularSearches(2);
    expect(popular[0].query).toBe('transfer');
    expect(popular[0].count).toBe(2);
  });

  it('returns zero summary for untracked endpoint', () => {
    const { analytics, feedback } = make();
    const s = analytics.getSummary('ghost', feedback);
    expect(s.views).toBe(0);
    expect(s.copies).toBe(0);
  });
});
