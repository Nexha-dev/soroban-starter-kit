const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k: string, v: string) => { store[k] = v; return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
}));

import {
  moveWidget, addWidget, removeWidget, shareDashboard,
  saveDashboards, loadDashboards, trackDashboardView, loadAnalytics,
  WIDGET_REGISTRY, TEMPLATES, WidgetConfig, Dashboard,
} from '../src/utils/dashboard';

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

const makeWidget = (order: number): WidgetConfig => ({
  id: String(order), type: 'tx_count', size: 'small', order, config: {},
});

describe('moveWidget', () => {
  it('moves a widget down', () => {
    const widgets = [makeWidget(0), makeWidget(1), makeWidget(2)];
    const result = moveWidget(widgets, 0, 1);
    expect(result.find(w => w.id === '0')?.order).toBeGreaterThan(0);
  });

  it('moves a widget up', () => {
    const widgets = [makeWidget(0), makeWidget(1), makeWidget(2)];
    const result = moveWidget(widgets, 2, 1);
    expect(result.find(w => w.id === '2')?.order).toBeLessThan(2);
  });

  it('reassigns contiguous orders', () => {
    const widgets = [makeWidget(0), makeWidget(1), makeWidget(2)];
    const result = moveWidget(widgets, 0, 2);
    const orders = result.map(w => w.order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1, 2]);
  });
});

describe('addWidget', () => {
  it('appends a new widget instance', () => {
    const meta = WIDGET_REGISTRY[0];
    const result = addWidget([], meta);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(meta.type);
    expect(result[0].order).toBe(0);
  });

  it('copies default config', () => {
    const meta = WIDGET_REGISTRY.find(m => m.type === 'custom_note')!;
    const result = addWidget([], meta);
    expect(result[0].config.text).toBe('My note');
  });
});

describe('removeWidget', () => {
  it('removes by id and reorders', () => {
    const widgets = [makeWidget(0), makeWidget(1), makeWidget(2)];
    const result = removeWidget(widgets, '1');
    expect(result).toHaveLength(2);
    const orders = result.map(w => w.order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1]);
  });
});

describe('shareDashboard', () => {
  it('creates a new id and sets sharedBy', () => {
    const d: Dashboard = { id: 'orig', name: 'Test', widgets: [], createdAt: 0, updatedAt: 0 };
    const shared = shareDashboard(d, 'alice');
    expect(shared.id).not.toBe('orig');
    expect(shared.sharedBy).toBe('alice');
  });
});

describe('persistence', () => {
  it('saves and loads dashboards', async () => {
    const d: Dashboard = { id: 'd1', name: 'My Dash', widgets: [], createdAt: 0, updatedAt: 0 };
    await saveDashboards([d]);
    const loaded = await loadDashboards();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('My Dash');
  });
});

describe('analytics', () => {
  it('tracks views and increments counter', async () => {
    await trackDashboardView('d1');
    await trackDashboardView('d1');
    const a = await loadAnalytics();
    expect(a['d1'].views).toBe(2);
    expect(a['d1'].lastViewedAt).not.toBeNull();
  });

  it('tracks widget interactions', async () => {
    await trackDashboardView('d1', 'tx_count');
    await trackDashboardView('d1', 'tx_count');
    const a = await loadAnalytics();
    expect(a['d1'].widgetInteractions['tx_count']).toBe(2);
  });
});

describe('templates', () => {
  it('TEMPLATES are marked as templates', () => {
    expect(TEMPLATES.every(t => t.isTemplate)).toBe(true);
  });

  it('WIDGET_REGISTRY covers all widget types', () => {
    expect(WIDGET_REGISTRY.length).toBeGreaterThanOrEqual(7);
    expect(WIDGET_REGISTRY.every(m => m.type && m.label && m.icon)).toBe(true);
  });
});
