export type ComponentType = 'balances' | 'transactions' | 'sync' | 'actions' | 'storage';

export interface LayoutItem {
  id: string;
  type: ComponentType;
  col: number; // 1-based grid column
  row: number; // 1-based grid row
  colSpan: number; // 1–3
  rowSpan: number; // 1–2
}

export type Layout = LayoutItem[];

export const GRID_COLS = 3;

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  balances: '📊 Balances',
  transactions: '📋 Transactions',
  sync: '🔄 Sync Status',
  actions: '⚡ Quick Actions',
  storage: '💾 Storage',
};

export const DEFAULT_LAYOUT: Layout = [
  { id: 'actions',      type: 'actions',      col: 1, row: 1, colSpan: 3, rowSpan: 1 },
  { id: 'balances',     type: 'balances',     col: 1, row: 2, colSpan: 2, rowSpan: 1 },
  { id: 'sync',         type: 'sync',         col: 3, row: 2, colSpan: 1, rowSpan: 1 },
  { id: 'transactions', type: 'transactions', col: 1, row: 3, colSpan: 2, rowSpan: 1 },
  { id: 'storage',      type: 'storage',      col: 3, row: 3, colSpan: 1, rowSpan: 1 },
];

export const LAYOUT_TEMPLATES: Record<string, Layout> = {
  default: DEFAULT_LAYOUT,
  compact: [
    { id: 'actions',      type: 'actions',      col: 1, row: 1, colSpan: 3, rowSpan: 1 },
    { id: 'balances',     type: 'balances',     col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { id: 'transactions', type: 'transactions', col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    { id: 'sync',         type: 'sync',         col: 3, row: 2, colSpan: 1, rowSpan: 1 },
    { id: 'storage',      type: 'storage',      col: 1, row: 3, colSpan: 3, rowSpan: 1 },
  ],
  focus: [
    { id: 'balances',     type: 'balances',     col: 1, row: 1, colSpan: 3, rowSpan: 2 },
    { id: 'actions',      type: 'actions',      col: 1, row: 3, colSpan: 2, rowSpan: 1 },
    { id: 'sync',         type: 'sync',         col: 3, row: 3, colSpan: 1, rowSpan: 1 },
    { id: 'transactions', type: 'transactions', col: 1, row: 4, colSpan: 2, rowSpan: 1 },
    { id: 'storage',      type: 'storage',      col: 3, row: 4, colSpan: 1, rowSpan: 1 },
  ],
};
