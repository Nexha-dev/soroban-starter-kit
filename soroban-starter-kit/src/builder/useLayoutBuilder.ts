import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layout, LayoutItem } from './types';
import { DEFAULT_LAYOUT, GRID_COLS } from './types';

const STORAGE_KEY = 'soroban_layout';
const MAX_HISTORY = 20;

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Layout) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: Layout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

/** Snap a value to the nearest grid unit */
export function snapToGrid(value: number, unit: number): number {
  return Math.max(1, Math.round(value / unit));
}

/** Clamp colSpan so item doesn't overflow the grid */
function clampItem(item: LayoutItem): LayoutItem {
  const colSpan = Math.min(item.colSpan, GRID_COLS - item.col + 1);
  return { ...item, colSpan: Math.max(1, colSpan), rowSpan: Math.max(1, Math.min(item.rowSpan, 2)) };
}

export function useLayoutBuilder() {
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [history, setHistory] = useState<Layout[]>([]);
  const [future, setFuture] = useState<Layout[]>([]);
  const analyticsRef = useRef({ moves: 0, resizes: 0, undos: 0 });

  // Persist on every change
  useEffect(() => { saveLayout(layout); }, [layout]);

  const commit = useCallback((next: Layout) => {
    setHistory((h) => [...h.slice(-MAX_HISTORY), layout]);
    setFuture([]);
    setLayout(next);
  }, [layout]);

  const moveItem = useCallback((id: string, col: number, row: number) => {
    analyticsRef.current.moves += 1;
    setLayout((prev) => {
      const next = prev.map((item) =>
        item.id === id ? clampItem({ ...item, col: Math.max(1, col), row: Math.max(1, row) }) : item
      );
      saveLayout(next);
      setHistory((h) => [...h.slice(-MAX_HISTORY), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const resizeItem = useCallback((id: string, colSpan: number, rowSpan: number) => {
    analyticsRef.current.resizes += 1;
    commit(layout.map((item) =>
      item.id === id ? clampItem({ ...item, colSpan, rowSpan }) : item
    ));
  }, [commit, layout]);

  const applyTemplate = useCallback((template: Layout) => {
    commit([...template]);
  }, [commit]);

  const undo = useCallback(() => {
    if (!history.length) return;
    analyticsRef.current.undos += 1;
    const prev = history[history.length - 1];
    setFuture((f) => [layout, ...f]);
    setHistory((h) => h.slice(0, -1));
    setLayout(prev);
    saveLayout(prev);
  }, [history, layout]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, layout]);
    setFuture((f) => f.slice(1));
    setLayout(next);
    saveLayout(next);
  }, [future, layout]);

  /** Encode layout as a URL-safe base64 string for sharing */
  const getShareUrl = useCallback((): string => {
    const encoded = btoa(JSON.stringify(layout));
    return `${window.location.origin}${window.location.pathname}?layout=${encoded}`;
  }, [layout]);

  /** Load a shared layout from URL param */
  const loadFromUrl = useCallback(() => {
    const param = new URLSearchParams(window.location.search).get('layout');
    if (!param) return;
    try {
      const shared = JSON.parse(atob(param)) as Layout;
      commit(shared);
    } catch { /* ignore malformed */ }
  }, [commit]);

  return {
    layout,
    moveItem,
    resizeItem,
    applyTemplate,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    getShareUrl,
    loadFromUrl,
    analytics: analyticsRef.current,
  };
}
