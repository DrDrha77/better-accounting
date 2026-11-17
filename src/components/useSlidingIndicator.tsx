import { useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { cx } from './format';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A pill that glides to whichever tab is active. Put `ref={containerRef}` on a `relative`
 * container, render `indicator` as its first child, and mark tabs with `data-tab`.
 * The active tab is the one with aria-current="page" (NavLink sets it) or data-active="true".
 */
export function useSlidingIndicator<T extends HTMLElement>(deps: DependencyList) {
  const containerRef = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const c = containerRef.current;
      if (!c) return;
      const el = c.querySelector<HTMLElement>('[data-tab][aria-current="page"], [data-tab][data-active="true"]');
      if (!el || el.offsetParent === null) return setBox(null);
      // Layout units (offset*) are not affected by the page's text-size zoom, unlike getBoundingClientRect.
      const next = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
      setBox((b) => (b && b.left === next.left && b.top === next.top && b.width === next.width && b.height === next.height ? b : next));
    };
    measure();
    // Only glide after the first placement, so the pill doesn't fly in from the corner on load.
    const raf = requestAnimationFrame(() => setAnimate(true));
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    // Re-place the pill whenever the tabs change size (fonts loading, text size, tabs shown or hidden).
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (containerRef.current) {
      ro?.observe(containerRef.current);
      containerRef.current.querySelectorAll('[data-tab]').forEach((t) => ro?.observe(t));
    }
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const indicator = box ? (
    <span
      aria-hidden="true"
      className={cx('pill-active tab-indicator pointer-events-none absolute z-0 rounded-full', animate && 'tab-indicator-animate')}
      style={box}
    />
  ) : null;

  return { containerRef, indicator };
}
