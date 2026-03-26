import React, { useState } from 'react';
import type { BulkAction, ColumnDef, ExportFormat } from './types';
import { useTable } from './useTable';
import { useVirtualScroll } from './useVirtualScroll';

const ROW_H = 40;
const VIRTUAL_THRESHOLD = 100; // use virtual scroll above this row count

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string | number;
  /** Render expanded row content */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Inline edit: called with updated row */
  onEdit?: (original: T, field: string, value: string) => void;
  bulkActions?: BulkAction<T>[];
  exportFormats?: ExportFormat[];
  pageSize?: number;
  /** Fixed height for virtual scroll container (px) */
  virtualHeight?: number;
  caption?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  renderExpanded,
  onEdit,
  bulkActions = [],
  exportFormats = [],
  pageSize = 20,
  virtualHeight = 400,
  caption,
}: DataTableProps<T>): JSX.Element {
  const tbl = useTable(data, columns, getRowId, pageSize);
  const [editCell, setEditCell] = useState<{ id: string | number; key: string; value: string } | null>(null);
  const [showColumns, setShowColumns] = useState(false);

  const useVirtual = tbl.sorted.length > VIRTUAL_THRESHOLD;
  const virt = useVirtualScroll(tbl.sorted, virtualHeight);

  const displayRows = useVirtual ? virt.visibleItems : tbl.pageRows;

  const allPageSelected =
    tbl.pageRows.length > 0 && tbl.pageRows.every((r) => tbl.state.selectedIds.has(getRowId(r)));

  const commitEdit = (row: T, key: string) => {
    if (editCell && onEdit) onEdit(row, key, editCell.value);
    setEditCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: T, key: string) => {
    if (e.key === 'Enter') commitEdit(row, key);
    if (e.key === 'Escape') setEditCell(null);
  };

  const sortIcon = (key: string) => {
    if (tbl.state.sortKey !== key) return ' ↕';
    return tbl.state.sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Global filter */}
        <input
          aria-label="Search all columns"
          placeholder="Search…"
          onChange={(e) => columns.filter((c) => c.filterable !== false).forEach((c) => tbl.filter(c.key, e.target.value))}
          style={inputStyle}
        />

        {/* Bulk actions */}
        {tbl.state.selectedIds.size > 0 && bulkActions.map((ba) => (
          <button key={ba.label} onClick={() => ba.action(tbl.selectedRows)} style={btnStyle}>
            {ba.icon} {ba.label} ({tbl.state.selectedIds.size})
          </button>
        ))}

        {/* Export */}
        {exportFormats.map((fmt) => (
          <button key={fmt} onClick={() => tbl.exportData(fmt)} style={btnStyle} aria-label={`Export ${fmt}`}>
            ⬇ {fmt.toUpperCase()}
          </button>
        ))}

        {/* Column customizer */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button onClick={() => setShowColumns((v) => !v)} style={btnStyle} aria-expanded={showColumns}>
            ⚙ Columns
          </button>
          {showColumns && (
            <div role="dialog" aria-label="Column visibility" style={dropdownStyle}>
              {columns.filter((c) => c.hideable !== false).map((c) => (
                <label key={c.key} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={!tbl.state.hiddenColumns.has(c.key)}
                    onChange={() => tbl.toggleColumn(c.key)}
                  />
                  {c.header}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-column filters */}
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        {/* checkbox spacer */}
        <div style={{ width: 32 }} />
        {renderExpanded && <div style={{ width: 28 }} />}
        {tbl.visibleColumns.map((col) => (
          <div key={col.key} style={{ flex: col.width ? `0 0 ${col.width}` : 1 }}>
            {col.filterable !== false && (
              <input
                aria-label={`Filter ${col.header}`}
                placeholder={`Filter…`}
                value={tbl.state.filters[col.key] ?? ''}
                onChange={(e) => tbl.filter(col.key, e.target.value)}
                style={{ ...inputStyle, fontSize: '0.75rem', padding: '2px 6px' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        ref={useVirtual ? virt.containerRef : undefined}
        style={useVirtual ? { height: virtualHeight, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' } : undefined}
      >
        <table
          role="grid"
          aria-rowcount={tbl.totalRows}
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
        >
          {caption && <caption style={{ captionSide: 'top', textAlign: 'left', padding: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>{caption}</caption>}
          <thead style={{ background: 'var(--color-bg-tertiary)', position: useVirtual ? 'sticky' : undefined, top: 0, zIndex: 1 }}>
            <tr>
              {/* Select all */}
              <th style={thStyle} aria-label="Select all">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={() => allPageSelected ? tbl.deselectAll() : tbl.selectAll()}
                  aria-label="Select all rows on page"
                />
              </th>
              {/* Expand toggle spacer */}
              {renderExpanded && <th style={thStyle} />}
              {tbl.visibleColumns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={tbl.state.sortKey === col.key ? (tbl.state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={{ ...thStyle, width: col.width, cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => col.sortable !== false && tbl.sort(col.key)}
                  onKeyDown={(e) => e.key === 'Enter' && col.sortable !== false && tbl.sort(col.key)}
                  tabIndex={col.sortable !== false ? 0 : undefined}
                >
                  {col.header}{col.sortable !== false && <span aria-hidden>{sortIcon(col.key)}</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {useVirtual && <tr><td colSpan={tbl.visibleColumns.length + 2} style={{ height: virt.paddingTop, padding: 0 }} /></tr>}

            {displayRows.map((row, i) => {
              const id = getRowId(row);
              const selected = tbl.state.selectedIds.has(id);
              const expanded = tbl.state.expandedRows.has(id);

              return (
                <React.Fragment key={id}>
                  <tr
                    aria-selected={selected}
                    style={{
                      height: ROW_H,
                      background: selected ? 'rgba(233,69,96,0.1)' : i % 2 === 0 ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
                      borderBottom: '1px solid var(--color-border)',
                      outline: 'none',
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ') { e.preventDefault(); tbl.select(id, true); }
                      if (e.key === 'Enter' && renderExpanded) tbl.toggleRow(id);
                    }}
                  >
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => tbl.select(id, (e.nativeEvent as MouseEvent).shiftKey || (e.nativeEvent as MouseEvent).ctrlKey || (e.nativeEvent as MouseEvent).metaKey)}
                        aria-label={`Select row ${id}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    {renderExpanded && (
                      <td style={tdStyle}>
                        <button
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Collapse row' : 'Expand row'}
                          onClick={() => tbl.toggleRow(id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
                        >{expanded ? '▼' : '▶'}</button>
                      </td>
                    )}

                    {tbl.visibleColumns.map((col) => {
                      const rawValue = col.accessor(row);
                      const isEditing = editCell?.id === id && editCell?.key === col.key;

                      return (
                        <td
                          key={col.key}
                          style={{ ...tdStyle, width: col.width }}
                          onDoubleClick={() => col.editable && onEdit && setEditCell({ id, key: col.key, value: String(rawValue ?? '') })}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editCell!.value}
                              onChange={(e) => setEditCell({ ...editCell!, value: e.target.value })}
                              onBlur={() => commitEdit(row, col.key)}
                              onKeyDown={(e) => handleKeyDown(e, row, col.key)}
                              style={{ ...inputStyle, padding: '2px 4px', fontSize: '0.875rem' }}
                              aria-label={`Edit ${col.header}`}
                            />
                          ) : col.render ? (
                            col.render(rawValue, row, i)
                          ) : (
                            String(rawValue ?? '')
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {expanded && renderExpanded && (
                    <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                      <td colSpan={tbl.visibleColumns.length + 2} style={{ padding: 'var(--spacing-md)' }}>
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {useVirtual && <tr><td colSpan={tbl.visibleColumns.length + 2} style={{ height: virt.paddingBottom, padding: 0 }} /></tr>}

            {displayRows.length === 0 && (
              <tr>
                <td colSpan={tbl.visibleColumns.length + 2} style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-muted)' }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (non-virtual only) */}
      {!useVirtual && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {tbl.totalRows} rows · page {tbl.state.page + 1} of {tbl.totalPages}
          </span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button onClick={() => tbl.setPage(0)} disabled={tbl.state.page === 0} style={btnStyle} aria-label="First page">«</button>
            <button onClick={() => tbl.setPage(tbl.state.page - 1)} disabled={tbl.state.page === 0} style={btnStyle} aria-label="Previous page">‹</button>
            {Array.from({ length: Math.min(5, tbl.totalPages) }, (_, i) => {
              const p = Math.max(0, Math.min(tbl.state.page - 2, tbl.totalPages - 5)) + i;
              return (
                <button
                  key={p}
                  onClick={() => tbl.setPage(p)}
                  aria-current={p === tbl.state.page ? 'page' : undefined}
                  style={{ ...btnStyle, background: p === tbl.state.page ? 'var(--color-highlight)' : undefined }}
                >{p + 1}</button>
              );
            })}
            <button onClick={() => tbl.setPage(tbl.state.page + 1)} disabled={tbl.state.page >= tbl.totalPages - 1} style={btnStyle} aria-label="Next page">›</button>
            <button onClick={() => tbl.setPage(tbl.totalPages - 1)} disabled={tbl.state.page >= tbl.totalPages - 1} style={btnStyle} aria-label="Last page">»</button>
          </div>
          <select
            value={tbl.state.pageSize}
            onChange={(e) => tbl.setPageSize(Number(e.target.value))}
            style={{ ...inputStyle, width: 'auto' }}
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: '100%', zIndex: 20,
  background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm)',
  display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160,
  boxShadow: 'var(--shadow-md)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-tertiary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
};

const btnStyle: React.CSSProperties = {
  background: 'var(--color-bg-tertiary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)',
  padding: '4px 10px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  borderBottom: '1px solid var(--color-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 240,
};
