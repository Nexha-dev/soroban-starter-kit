import React, { useEffect, useRef, useState } from 'react';
import { useLayoutBuilder } from './useLayoutBuilder';
import { DashboardCell } from './DashboardCell';
import { LAYOUT_TEMPLATES, GRID_COLS } from './types';
import type { ComponentType } from './types';

interface Props {
  renderComponent: (type: ComponentType) => React.ReactNode;
}

/** Responsive: collapse to 1 col on narrow screens */
function useGridCols(): number {
  const [cols, setCols] = useState(() => window.innerWidth < 640 ? 1 : GRID_COLS);
  useEffect(() => {
    const handler = () => setCols(window.innerWidth < 640 ? 1 : GRID_COLS);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return cols;
}

export function DashboardBuilder({ renderComponent }: Props) {
  const { layout, moveItem, resizeItem, applyTemplate, undo, redo, canUndo, canRedo, getShareUrl, loadFromUrl, analytics } =
    useLayoutBuilder();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: number; row: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const gridCols = useGridCols();

  // Load shared layout from URL on first render
  const didLoad = useRef(false);
  if (!didLoad.current) {
    didLoad.current = true;
    loadFromUrl();
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const maxRow = Math.max(...layout.map((i) => i.row + i.rowSpan - 1), 1);

  // Build drop zone cells: one per grid cell in the layout area
  const dropCells: { col: number; row: number }[] = [];
  for (let r = 1; r <= maxRow + 1; r++)
    for (let c = 1; c <= gridCols; c++)
      dropCells.push({ col: c, row: r });

  const handleDrop = (col: number, row: number) => {
    if (dragId) moveItem(dragId, col, row);
    setDragId(null);
    setDropTarget(null);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // On mobile (1 col), stack items vertically by row order
  const effectiveCols = gridCols;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button className="btn btn-secondary" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ Redo</button>

        <span style={{ color: 'var(--color-border-light)', margin: '0 4px' }}>|</span>

        {Object.keys(LAYOUT_TEMPLATES).map((name) => (
          <button
            key={name}
            className="btn btn-secondary"
            onClick={() => applyTemplate(LAYOUT_TEMPLATES[name])}
            style={{ textTransform: 'capitalize' }}
          >
            {name}
          </button>
        ))}

        <span style={{ color: 'var(--color-border-light)', margin: '0 4px' }}>|</span>

        <button className="btn btn-secondary" onClick={handleShare}>
          {copied ? '✓ Copied!' : '🔗 Share Layout'}
        </button>

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {analytics.moves} moves · {analytics.resizes} resizes · {analytics.undos} undos
        </span>
      </div>

      {/* Grid — drop zones and cells share the same grid so positions align */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
          gap: 'var(--spacing-md)',
        }}
      >
        {/* Drop zone overlays — placed in the grid so they occupy the correct cells */}
        {dragId && dropCells.map(({ col, row }) => {
          const isActive = dropTarget?.col === col && dropTarget?.row === row;
          return (
            <div
              key={`drop-${col}-${row}`}
              onDragOver={(e) => { e.preventDefault(); setDropTarget({ col, row }); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={() => handleDrop(col, row)}
              style={{
                gridColumn: effectiveCols === 1 ? 1 : col,
                gridRow: row,
                minHeight: 80,
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(233,69,96,0.15)' : 'transparent',
                border: isActive ? '2px dashed var(--color-highlight)' : '2px dashed var(--color-border)',
                transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                zIndex: 10,
              }}
            />
          );
        })}

        {/* Actual cells — rendered on top of drop zones via z-index when not dragging */}
        {layout.map((item) => (
          <DashboardCell
            key={item.id}
            item={item}
            gridCols={effectiveCols}
            onDragStart={setDragId}
            onResize={resizeItem}
            isPreview={dragId === item.id}
          >
            {renderComponent(item.type)}
          </DashboardCell>
        ))}
      </div>
    </div>
  );
}
