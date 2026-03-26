import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Widget types ─────────────────────────────────────────────────────────────

export type WidgetId =
  | 'token_balance'
  | 'escrow_status'
  | 'tx_count'
  | 'activity_feed'
  | 'export_stats'
  | 'network_status'
  | 'custom_note';

export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetConfig = {
  id: string;           // instance id
  type: WidgetId;
  size: WidgetSize;
  order: number;
  config: Record<string, string>; // user-defined settings
};

export type Dashboard = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  createdAt: number;
  updatedAt: number;
  isTemplate?: boolean;
  sharedBy?: string;
};

export type DashboardAnalytics = {
  views: number;
  lastViewedAt: number | null;
  widgetInteractions: Record<string, number>;
};

// ─── Built-in widget definitions (the "marketplace") ─────────────────────────

export type WidgetMeta = {
  type: WidgetId;
  label: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  defaultConfig: Record<string, string>;
};

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { type: 'token_balance',  label: 'Token Balance',   description: 'Live token balance for an address', icon: '🪙', defaultSize: 'medium', defaultConfig: { address: '' } },
  { type: 'escrow_status',  label: 'Escrow Status',   description: 'Current escrow contract state',     icon: '🔒', defaultSize: 'medium', defaultConfig: { contractId: '' } },
  { type: 'tx_count',       label: 'TX Count',        description: 'Total transactions in history',     icon: '📊', defaultSize: 'small',  defaultConfig: {} },
  { type: 'activity_feed',  label: 'Activity Feed',   description: 'Recent transaction activity',       icon: '📡', defaultSize: 'large',  defaultConfig: { limit: '5' } },
  { type: 'export_stats',   label: 'Export Stats',    description: 'Export analytics summary',          icon: '📤', defaultSize: 'small',  defaultConfig: {} },
  { type: 'network_status', label: 'Network Status',  description: 'Testnet connectivity indicator',    icon: '🌐', defaultSize: 'small',  defaultConfig: {} },
  { type: 'custom_note',    label: 'Custom Note',     description: 'Free-text note widget',             icon: '📝', defaultSize: 'medium', defaultConfig: { text: 'My note' } },
];

// ─── Built-in templates ───────────────────────────────────────────────────────

export const TEMPLATES: Dashboard[] = [
  {
    id: 'tpl_overview',
    name: 'Overview',
    isTemplate: true,
    createdAt: 0, updatedAt: 0,
    widgets: [
      { id: 'w1', type: 'token_balance',  size: 'medium', order: 0, config: {} },
      { id: 'w2', type: 'escrow_status',  size: 'medium', order: 1, config: {} },
      { id: 'w3', type: 'network_status', size: 'small',  order: 2, config: {} },
    ],
  },
  {
    id: 'tpl_analytics',
    name: 'Analytics',
    isTemplate: true,
    createdAt: 0, updatedAt: 0,
    widgets: [
      { id: 'w1', type: 'tx_count',      size: 'small',  order: 0, config: {} },
      { id: 'w2', type: 'export_stats',  size: 'small',  order: 1, config: {} },
      { id: 'w3', type: 'activity_feed', size: 'large',  order: 2, config: { limit: '10' } },
    ],
  },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

const DASHBOARDS_KEY = '@soroban_dashboards';
const ANALYTICS_KEY  = '@soroban_dash_analytics';

export async function saveDashboards(dashboards: Dashboard[]) {
  await AsyncStorage.setItem(DASHBOARDS_KEY, JSON.stringify(dashboards));
}

export async function loadDashboards(): Promise<Dashboard[]> {
  const raw = await AsyncStorage.getItem(DASHBOARDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function trackDashboardView(dashboardId: string, widgetType?: WidgetId) {
  const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
  const all: Record<string, DashboardAnalytics> = raw ? JSON.parse(raw) : {};
  const entry = all[dashboardId] ?? { views: 0, lastViewedAt: null, widgetInteractions: {} };
  entry.views += 1;
  entry.lastViewedAt = Date.now();
  if (widgetType) entry.widgetInteractions[widgetType] = (entry.widgetInteractions[widgetType] ?? 0) + 1;
  all[dashboardId] = entry;
  await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(all));
}

export async function loadAnalytics(): Promise<Record<string, DashboardAnalytics>> {
  const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
  return raw ? JSON.parse(raw) : {};
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

export function moveWidget(widgets: WidgetConfig[], fromOrder: number, toOrder: number): WidgetConfig[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex(w => w.order === fromOrder);
  const toIdx = sorted.findIndex(w => w.order === toOrder);
  if (fromIdx === -1 || toIdx === -1) return widgets;
  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved);
  return sorted.map((w, i) => ({ ...w, order: i }));
}

export function addWidget(widgets: WidgetConfig[], meta: WidgetMeta): WidgetConfig[] {
  const w: WidgetConfig = {
    id: Date.now().toString(),
    type: meta.type,
    size: meta.defaultSize,
    order: widgets.length,
    config: { ...meta.defaultConfig },
  };
  return [...widgets, w];
}

export function removeWidget(widgets: WidgetConfig[], id: string): WidgetConfig[] {
  return widgets.filter(w => w.id !== id).map((w, i) => ({ ...w, order: i }));
}

export function shareDashboard(dashboard: Dashboard, userId: string): Dashboard {
  return { ...dashboard, id: `shared_${Date.now()}`, sharedBy: userId, isTemplate: false };
}
