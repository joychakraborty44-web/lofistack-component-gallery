import { useLayoutEffect, useState, type RefObject } from "react";

/** Tracks an element's content width (for layout decisions that CSS container queries can't make, like DOM order). */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>, initial = 1100): number {
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
