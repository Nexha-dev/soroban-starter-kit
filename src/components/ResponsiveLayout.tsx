/**
 * ResponsiveLayout — adaptive layout primitives for the Fidelis DApp.
 *
 * Exports:
 *  - AppShell          Full-page shell with header / sidebar / main / footer slots
 *  - BottomTabBar      Mobile-only bottom navigation
 *  - Drawer            Off-canvas panel (mobile drawer / desktop sidebar)
 *  - ResponsiveGrid    Auto-responsive grid wrapper
 *  - ResponsiveStack   Vertical stack that switches to horizontal on wider screens
 *  - Show / Hide       Conditional rendering by breakpoint
 *  - ResponsiveModal   Bottom-sheet on mobile, centered modal on desktop
 */
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useResponsive } from '../hooks/useResponsive';

/* ── Types ──────────────────────────────────────────────────── */
interface SlotProps { children?: React.ReactNode; className?: string; style?: React.CSSProperties; }

/* ── AppShell ───────────────────────────────────────────────── */
interface AppShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarRight?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  sidebarVariant?: 'default' | 'compact' | 'right';
  className?: string;
}

export function AppShell({
  header, sidebar, sidebarRight, footer, children,
  sidebarVariant = 'default', className = '',
}: AppShellProps): JSX.Element {
  const hasSidebar = Boolean(sidebar || sidebarRight);
  const variantClass = hasSidebar
    ? sidebarVariant === 'compact' ? 'app-shell--sidebar-compact'
    : sidebarVariant === 'right'   ? 'app-shell--sidebar-right'
    : 'app-shell--sidebar'
    : '';

  return (
    <div className={`app-shell ${variantClass} ${className}`}>
      {header && <header className="app-shell__header">{header}</header>}
      {(sidebar || sidebarRight) && (
        <aside className="app-shell__sidebar">
          {sidebar ?? sidebarRight}
        </aside>
      )}
      <main className="app-shell__main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      {footer && <footer className="app-shell__footer">{footer}</footer>}
    </div>
  );
}

/* ── BottomTabBar ───────────────────────────────────────────── */
export interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface BottomTabBarProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function BottomTabBar({ items, activeId, onChange }: BottomTabBarProps): JSX.Element {
  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={`bottom-tab-bar__item${item.id === activeId ? ' bottom-tab-bar__item--active' : ''}`}
          onClick={() => onChange(item.id)}
          aria-current={item.id === activeId ? 'page' : undefined}
          aria-label={item.label}
        >
          <span className="bottom-tab-bar__item-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
          {item.badge != null && (
            <span
              style={{
                position: 'absolute',
                top: 6, right: 'calc(50% - 18px)',
                background: 'var(--color-highlight)',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '1px 5px',
                lineHeight: 1.4,
              }}
              aria-label={`${item.badge} notifications`}
            >
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/* ── Drawer ─────────────────────────────────────────────────── */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  children: React.ReactNode;
  /** Label for the close button */
  closeLabel?: string;
}

export function Drawer({ open, onClose, side = 'left', children, closeLabel = 'Close menu' }: DrawerProps): JSX.Element {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (!open) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div
        className={`drawer-overlay${open ? ' drawer-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`drawer${side === 'right' ? ' drawer--right' : ''}${open ? ' drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          onClick={onClose}
          aria-label={closeLabel}
          style={{
            position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)',
            background: 'none', border: 'none', color: 'var(--color-text-primary)',
            cursor: 'pointer', fontSize: '1.25rem', padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)', minHeight: 'var(--touch-target)',
            minWidth: 'var(--touch-target)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </>
  );
}

/* ── ResponsiveGrid ─────────────────────────────────────────── */
interface ResponsiveGridProps extends SlotProps {
  /** Minimum column width for auto-fit (default 240px) */
  minColWidth?: string;
  /** Fixed column counts per breakpoint (overrides auto-fit) */
  cols?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: string;
}

export function ResponsiveGrid({
  children, className = '', style, minColWidth = '240px', cols, gap,
}: ResponsiveGridProps): JSX.Element {
  const { width } = useResponsive();

  let colCount: number | undefined;
  if (cols) {
    if (cols.xl && width >= 1280) colCount = cols.xl;
    else if (cols.lg && width >= 1024) colCount = cols.lg;
    else if (cols.md && width >= 768)  colCount = cols.md;
    else if (cols.sm && width >= 640)  colCount = cols.sm;
    else if (cols.xs) colCount = cols.xs;
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: gap ?? 'var(--space-4)',
    gridTemplateColumns: colCount
      ? `repeat(${colCount}, 1fr)`
      : `repeat(auto-fit, minmax(${minColWidth}, 1fr))`,
    ...style,
  };

  return (
    <div className={className} style={gridStyle}>
      {children}
    </div>
  );
}

/* ── ResponsiveStack ────────────────────────────────────────── */
interface ResponsiveStackProps extends SlotProps {
  /** Breakpoint at which to switch from column to row (default 'md') */
  switchAt?: 'sm' | 'md' | 'lg';
  gap?: string;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
}

export function ResponsiveStack({
  children, className = '', style, switchAt = 'md', gap, align, justify,
}: ResponsiveStackProps): JSX.Element {
  const { isMin } = useResponsive();
  const isRow = isMin(switchAt);
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        gap: gap ?? 'var(--space-4)',
        alignItems: align ?? (isRow ? 'center' : 'stretch'),
        justifyContent: justify,
        flexWrap: isRow ? 'wrap' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Show / Hide ────────────────────────────────────────────── */
import type { Breakpoint } from '../hooks/useResponsive';

interface ShowProps { above?: Breakpoint; below?: Breakpoint; on?: Breakpoint; children: React.ReactNode; }

/**
 * Conditionally renders children based on breakpoint.
 * Uses CSS classes for SSR-safe rendering (no layout shift).
 */
export function Show({ above, below, on, children }: ShowProps): JSX.Element {
  let cls = '';
  if (above) cls = `show-${above}`;
  else if (below) cls = `hide-${below}`;
  else if (on) cls = `${on}-only`;
  return <div className={cls} style={{ display: 'contents' }}>{children}</div>;
}

export function Hide({ above, below, on, children }: ShowProps): JSX.Element {
  let cls = '';
  if (above) cls = `hide-${above}`;
  else if (below) cls = `show-${below}`;
  else if (on) cls = `${on}-only`;
  return <div className={cls} style={{ display: 'contents' }}>{children}</div>;
}

/* ── ResponsiveModal ────────────────────────────────────────── */
interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function ResponsiveModal({ open, onClose, title, children, maxWidth = '560px' }: ResponsiveModalProps): JSX.Element | null {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={{ maxWidth }}
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 id="modal-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, margin: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: 'none', border: 'none', color: 'var(--color-text-primary)',
                cursor: 'pointer', fontSize: '1.25rem', padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)', minHeight: 'var(--touch-target)',
                minWidth: 'var(--touch-target)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── SkipLink ───────────────────────────────────────────────── */
/** Accessibility skip-to-content link. Place as first child of <body>. */
export function SkipLink({ target = '#main-content', label = 'Skip to main content' }: { target?: string; label?: string }): JSX.Element {
  return (
    <a href={target} className="skip-link">
      {label}
    </a>
  );
}

/* ── ResponsiveImage ────────────────────────────────────────── */
interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Aspect ratio (e.g. '16/9', '1/1') */
  aspectRatio?: string;
}

export function ResponsiveImage({ src, alt, aspectRatio, style, ...rest }: ResponsiveImageProps): JSX.Element {
  return (
    <div style={{ aspectRatio, overflow: 'hidden', width: '100%' }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
        {...rest}
      />
    </div>
  );
}
