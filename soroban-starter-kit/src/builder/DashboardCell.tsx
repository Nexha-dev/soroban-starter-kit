import React, { useRef } from 'react';
import type { LayoutItem } from './types';
import { COMPONENT_LABELS } from './types';

interface Props {
  item: LayoutItem;
  children: React.ReactNode;
  gridCols: number;
  onDragStart: (id: string) => void;
  onResize: (id: string, colSpan: number, rowSpan: number) => void;
  isPreview?: boolean;
}

export function DashboardCell({ item, children, gridCols, onDragStart, onResize, isPreview }: Props) {
  const startRef = useRef<{ x: number; y: number; colSpan: number; rowSpan: number } | null>(null);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY, colSpan: item.colSpan, rowSpan: item.rowSpan };

    const onMove = (ev: MouseEvent) => {
      if (!startRef.current) return;
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      const maxColSpan = gridCols - item.col + 1;
      const newColSpan = Math.max(1, Math.min(maxColSpan, startRef.current.colSpan + Math.round(dx / 120)));
      const newRowSpan = Math.max(1, Math.min(2, startRef.current.rowSpan + Math.round(dy / 100)));
      onResize(item.id, newColSpan, newRowSpan);
    };

    const onUp = () => {
      startRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // On single-column layout, ignore col/colSpan and stack by row
  const colStyle = gridCols === 1
    ? { gridColumn: '1', gridRow: item.row }
    : { gridColumn: `${item.col} / span ${item.colSpan}`, gridRow: `${item.row} / span ${item.rowSpan}` };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      style={{
        ...colStyle,
        position: 'relative',
        opacity: isPreview ? 0.4 : 1,
        cursor: 'grab',
        transition: 'opacity var(--transition-fast)',
        zIndex: isPreview ? 0 : 2,
      }}
    >
      <div className="card" style={{ height: '100%', userSelect: 'none' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">{COMPONENT_LABELS[item.type]}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            {item.colSpan}×{item.rowSpan}
          </span>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>{children}</div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          width: 14,
          height: 14,
          cursor: 'se-resize',
          background: 'var(--color-border-light)',
          borderRadius: 2,
          zIndex: 10,
        }}
      />
    </div>
  );
}
