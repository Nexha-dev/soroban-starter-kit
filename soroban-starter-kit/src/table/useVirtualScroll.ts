import { useCallback, useEffect, useRef, useState } from 'react';

const ROW_HEIGHT = 40; // px

/**
 * Virtual scroll hook — renders only the rows visible in the viewport.
 * Returns the slice of items to render and a spacer height for the hidden rows.
 */
export function useVirtualScroll<T>(items: T[], containerHeight: number, rowHeight = ROW_HEIGHT) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const overscan = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const visibleItems = items.slice(startIndex, endIndex);
  const paddingTop = startIndex * rowHeight;
  const paddingBottom = (items.length - endIndex) * rowHeight;

  return { containerRef, visibleItems, startIndex, paddingTop, paddingBottom };
}
