import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion as useMotionReduced } from "motion/react";

/* ------------------------------------------------------------
   Shared hooks for every component in the gallery.
   ------------------------------------------------------------ */

/** True when the user asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  return !!useMotionReduced();
}

/**
 * Preview mode: the homepage renders each component as a small live thumbnail.
 * Components should skip timers, auto-playing feeds and entrance delays here.
 */
export const PreviewContext = createContext(false);
export const usePreviewMode = () => useContext(PreviewContext);

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Fires once when the element first scrolls into view (always true in reduced motion). */
export function useInView<T extends Element>(ref: RefObject<T | null>, { amount = 0.2, once = true }: { amount?: number; once?: boolean } = {}): boolean {
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect(); }
      else if (!once) setInView(false);
    }, { threshold: amount });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, amount, once]);
  return inView || reduced;
}

/**
 * setInterval that pauses while the tab is hidden, in preview thumbnails,
 * or when `enabled` is false. The callback is always the latest one.
 */
export function useInterval(callback: () => void, ms: number | null, { enabled = true }: { enabled?: boolean } = {}) {
  const saved = useRef(callback);
  const preview = usePreviewMode();
  saved.current = callback;
  useEffect(() => {
    if (ms === null || !enabled || preview) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") saved.current(); }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled, preview]);
}

/** Animates a number toward `value` (ease-out). Instant with reduced motion or in previews. */
export function useCountUp(value: number, { duration = 900, start = true, from }: { duration?: number; start?: boolean; from?: number } = {}): number {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const [shown, setShown] = useState(reduced || preview ? value : from ?? 0);
  const prev = useRef(from ?? 0);
  useEffect(() => {
    if (!start) return;
    if (reduced || preview) { setShown(value); prev.current = value; return; }
    const a = prev.current, b = value, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration)); // first rAF timestamp can precede t0
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else prev.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); prev.current = b; };
  }, [value, start, duration, reduced, preview]);
  return shown;
}

/** Copy to clipboard with a "copied" flag and a select-text fallback. */
export function useClipboard(resetMs = 1600) {
  const [copied, setCopied] = useState<false | "copied" | "selected">(false);
  const timer = useRef<number | undefined>(undefined);
  const copy = useCallback(async (text: string, fallbackEl?: HTMLElement | null) => {
    const done = (s: "copied" | "selected") => {
      setCopied(s);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), resetMs);
    };
    try {
      await navigator.clipboard.writeText(text);
      done("copied");
      return true;
    } catch {
      if (fallbackEl) {
        const r = document.createRange(); r.selectNodeContents(fallbackEl);
        const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
        done("selected");
      }
      return false;
    }
  }, [resetMs]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { copy, copied };
}

/** Stable-ish pseudo random for demo data (same seed → same numbers). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
