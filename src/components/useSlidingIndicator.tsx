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
      const cr = c.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setBox({ left: r.left - cr.left + c.scrollLeft, top: r.top - cr.top + c.scrollTop, width: r.width, height: r.height });
    };
    measure();
    // Only glide after the first placement, so the pill doesn't fly in from the corner on load.
    const raf = requestAnimationFrame(() => setAnimate(true));
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const indicator = box ? (
    <span
      aria-hidden="true"
      className={cx('bubble-active tab-indicator pointer-events-none absolute z-0 rounded-full', animate && 'tab-indicator-animate')}
      style={box}
    />
  ) : null;

  return { containerRef, indicator };
}
