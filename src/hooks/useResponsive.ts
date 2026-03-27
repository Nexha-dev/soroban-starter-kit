import { useState, useEffect, useCallback } from 'react';

/** Named breakpoints matching the responsive.css token set */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs:  480,
  sm:  640,
  md:  768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';
export type PointerType = 'fine' | 'coarse' | 'none';

export interface ResponsiveState {
  /** Current viewport width */
  width: number;
  /** Current viewport height */
  height: number;
  /** Active breakpoint (largest that fits) */
  breakpoint: Breakpoint;
  /** Semantic device category */
  device: DeviceType;
  /** Screen orientation */
  orientation: Orientation;
  /** Primary pointer precision */
  pointer: PointerType;
  /** True when width < 768 */
  isMobile: boolean;
  /** True when 640 <= width < 1024 */
  isTablet: boolean;
  /** True when width >= 1024 */
  isDesktop: boolean;
  /** True when orientation is landscape */
  isLandscape: boolean;
  /** True when orientation is portrait */
  isPortrait: boolean;
  /** True when pointer is coarse (touch) */
  isTouch: boolean;
  /** Returns true if viewport is at least the given breakpoint */
  isMin: (bp: Breakpoint) => boolean;
  /** Returns true if viewport is below the given breakpoint */
  isMax: (bp: Breakpoint) => boolean;
  /** Returns true if viewport is between two breakpoints (inclusive min, exclusive max) */
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
}

function getBreakpoint(w: number): Breakpoint {
  if (w < BREAKPOINTS.xs)  return 'xs';
  if (w < BREAKPOINTS.sm)  return 'sm';
  if (w < BREAKPOINTS.md)  return 'md';
  if (w < BREAKPOINTS.lg)  return 'lg';
  if (w < BREAKPOINTS.xl)  return 'xl';
  return '2xl';
}

function getPointer(): PointerType {
  if (typeof window === 'undefined') return 'fine';
  if (window.matchMedia('(pointer: coarse)').matches) return 'coarse';
  if (window.matchMedia('(pointer: fine)').matches)   return 'fine';
  return 'none';
}

function buildState(w: number, h: number): Omit<ResponsiveState, 'isMin' | 'isMax' | 'isBetween'> {
  const bp = getBreakpoint(w);
  const orientation: Orientation = w >= h ? 'landscape' : 'portrait';
  const pointer = getPointer();
  const isMobile  = w < BREAKPOINTS.md;
  const isTablet  = w >= BREAKPOINTS.sm && w < BREAKPOINTS.lg;
  const isDesktop = w >= BREAKPOINTS.lg;
  const device: DeviceType = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';
  return {
    width: w, height: h, breakpoint: bp, device, orientation, pointer,
    isMobile, isTablet, isDesktop,
    isLandscape: orientation === 'landscape',
    isPortrait:  orientation === 'portrait',
    isTouch: pointer === 'coarse',
  };
}

/**
 * Hook that tracks viewport dimensions, breakpoint, device type, orientation,
 * and pointer precision. Updates on resize and orientation change.
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<Omit<ResponsiveState, 'isMin' | 'isMax' | 'isBetween'>>(() =>
    typeof window !== 'undefined'
      ? buildState(window.innerWidth, window.innerHeight)
      : buildState(1280, 800)
  );

  useEffect(() => {
    let raf: number;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setState(buildState(window.innerWidth, window.innerHeight));
      });
    };
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  const isMin = useCallback((bp: Breakpoint) => state.width >= BREAKPOINTS[bp], [state.width]);
  const isMax = useCallback((bp: Breakpoint) => state.width < BREAKPOINTS[bp],  [state.width]);
  const isBetween = useCallback(
    (min: Breakpoint, max: Breakpoint) => state.width >= BREAKPOINTS[min] && state.width < BREAKPOINTS[max],
    [state.width]
  );

  return { ...state, isMin, isMax, isBetween };
}

/**
 * Lightweight hook that only returns the current breakpoint string.
 * Useful when you only need to conditionally render based on breakpoint.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'xl'
  );
  useEffect(() => {
    let raf: number;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(getBreakpoint(window.innerWidth)));
    };
    window.addEventListener('resize', update, { passive: true });
    return () => { window.removeEventListener('resize', update); cancelAnimationFrame(raf); };
  }, []);
  return bp;
}

/**
 * Returns true when a CSS media query matches, and updates reactively.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
