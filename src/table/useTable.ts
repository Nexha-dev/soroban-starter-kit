import { useCallback, useMemo, useReducer } from 'react';
import type { ColumnDef, ExportFormat, SortDir, TableState } from './types';

type Action =
  | { type: 'SORT'; key: string }
  | { type: 'FILTER'; key: string; value: string }
  | { type: 'PAGE'; page: number }
  | { type: 'PAGE_SIZE'; size: number }
  | { type: 'SELECT'; id: string | number; multi: boolean }
  | { type: 'SELECT_ALL'; ids: (string | number)[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'TOGGLE_COLUMN'; key: string }
  | { type: 'TOGGLE_ROW'; id: string | number };

function reducer(state: TableState, action: Action): TableState {
  switch (action.type) {
    case 'SORT': {
      const sameKey = state.sortKey === action.key;
      const nextDir: SortDir = sameKey
        ? state.sortDir === 'asc' ? 'desc' : state.sortDir === 'desc' ? null : 'asc'
        : 'asc';
      return { ...state, sortKey: nextDir ? action.key : null, sortDir: nextDir, page: 0 };
    }
    case 'FILTER':
      return { ...state, filters: { ...state.filters, [action.key]: action.value }, page: 0 };
    case 'PAGE':
      return { ...state, page: action.page };
    case 'PAGE_SIZE':
      return { ...state, pageSize: action.size, page: 0 };
    case 'SELECT': {
      const next = new Set(state.selectedIds);
      if (action.multi) {
        next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      } else {
        next.clear();
        next.add(action.id);
      }
      return { ...state, selectedIds: next };
    }
    case 'SELECT_ALL':
      return { ...state, selectedIds: new Set(action.ids) };
    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() };
    case 'TOGGLE_COLUMN': {
      const next = new Set(state.hiddenColumns);
      next.has(action.key) ? next.delete(action.key) : next.add(action.key);
      return { ...state, hiddenColumns: next };
    }
    case 'TOGGLE_ROW': {
      const next = new Set(state.expandedRows);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, expandedRows: next };
    }
    default:
      return state;
  }
}

export function useTable<T>(
  data: T[],
  columns: ColumnDef<T>[],
  getRowId: (row: T) => string | number,
  initialPageSize = 20
) {
  const [state, dispatch] = useReducer(reducer, {
    sortKey: null, sortDir: null,
    filters: {},
    page: 0, pageSize: initialPageSize,
    selectedIds: new Set(),
    hiddenColumns: new Set(),
    expandedRows: new Set(),
  } satisfies TableState);

  // Filter
  const filtered = useMemo(() => {
    let rows = data;
    for (const [key, value] of Object.entries(state.filters)) {
      if (!value) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      const lower = value.toLowerCase();
      rows = rows.filter((r) => String(col.accessor(r) ?? '').toLowerCase().includes(lower));
    }
    return rows;
  }, [data, state.filters, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!state.sortKey || !state.sortDir) return filtered;
    const col = columns.find((c) => c.key === state.sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, state.sortKey, state.sortDir, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  const page = Math.min(state.page, totalPages - 1);
  const pageRows = sorted.slice(page * state.pageSize, (page + 1) * state.pageSize);

  const visibleColumns = columns.filter((c) => !state.hiddenColumns.has(c.key));

  // Actions
  const sort = useCallback((key: string) => dispatch({ type: 'SORT', key }), []);
  const filter = useCallback((key: string, value: string) => dispatch({ type: 'FILTER', key, value }), []);
  const setPage = useCallback((p: number) => dispatch({ type: 'PAGE', page: p }), []);
  const setPageSize = useCallback((s: number) => dispatch({ type: 'PAGE_SIZE', size: s }), []);
  const select = useCallback((id: string | number, multi = false) => dispatch({ type: 'SELECT', id, multi }), []);
  const selectAll = useCallback(() => dispatch({ type: 'SELECT_ALL', ids: pageRows.map(getRowId) }), [pageRows, getRowId]);
  const deselectAll = useCallback(() => dispatch({ type: 'DESELECT_ALL' }), []);
  const toggleColumn = useCallback((key: string) => dispatch({ type: 'TOGGLE_COLUMN', key }), []);
  const toggleRow = useCallback((id: string | number) => dispatch({ type: 'TOGGLE_ROW', id }), []);

  const selectedRows = useMemo(
    () => data.filter((r) => state.selectedIds.has(getRowId(r))),
    [data, state.selectedIds, getRowId]
  );

  const exportData = useCallback((format: ExportFormat, rows?: T[]) => {
    const target = rows ?? (state.selectedIds.size > 0 ? selectedRows : sorted);
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json' });
      download(blob, 'export.json');
    } else {
      const headers = visibleColumns.map((c) => c.header).join(',');
      const body = target.map((r) =>
        visibleColumns.map((c) => JSON.stringify(String(c.accessor(r) ?? ''))).join(',')
      ).join('\n');
      const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
      download(blob, 'export.csv');
    }
  }, [sorted, selectedRows, state.selectedIds, visibleColumns]);

  return {
    state: { ...state, page },
    pageRows,
    sorted,
    filtered,
    visibleColumns,
    totalPages,
    totalRows: filtered.length,
    selectedRows,
    sort,
    filter,
    setPage,
    setPageSize,
    select,
    selectAll,
    deselectAll,
    toggleColumn,
    toggleRow,
    exportData,
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
