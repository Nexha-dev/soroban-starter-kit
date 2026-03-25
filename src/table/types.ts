import React from 'react';

export type SortDir = 'asc' | 'desc' | null;

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Derive cell value for sorting/filtering/rendering */
  accessor: (row: T) => unknown;
  /** Custom cell renderer */
  render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  /** If true, column can be hidden via column customizer */
  hideable?: boolean;
  /** Inline edit: return new row on commit */
  editable?: boolean;
}

export interface TableState {
  sortKey: string | null;
  sortDir: SortDir;
  filters: Record<string, string>;
  page: number;
  pageSize: number;
  selectedIds: Set<string | number>;
  hiddenColumns: Set<string>;
  expandedRows: Set<string | number>;
}

export type BulkAction<T> = {
  label: string;
  icon?: string;
  action: (rows: T[]) => void;
};

export type ExportFormat = 'csv' | 'json';
