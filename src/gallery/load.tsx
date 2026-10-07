import { Component, useEffect, useLayoutEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { loaders, type ComponentModule } from "./registry";
import { PreviewContext } from "../lib/hooks";

/* ------------------------------------------------------------
   Module loading (cached), error boundary and the scaled live
   preview used by homepage cards.
   ------------------------------------------------------------ */

const cache = new Map<string, Promise<ComponentModule>>();
const resolved = new Map<string, ComponentModule>();

export function loadModule(slug: string): Promise<ComponentModule> {
  let p = cache.get(slug);
  if (!p) {
    p = loaders[slug]().then(m => { resolved.set(slug, m); return m; });
    cache.set(slug, p);
  }
  return p;
}

export function useModule(slug: string, enabled = true): { mod: ComponentModule | null; error: Error | null } {
  const [mod, setMod] = useState<ComponentModule | null>(() => resolved.get(slug) ?? null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const hit = resolved.get(slug);
    if (hit) { setMod(hit); return; }
    setMod(null);
    loadModule(slug).then(m => live && setMod(m), e => live && setError(e instanceof Error ? e : new Error(String(e))));
    return () => { live = false; };
  }, [slug, enabled]);
  return { mod, error };
}

/** Warm the chunk on hover/focus so opening a component feels instant. */
export const prefetch = (slug: string) => { void loadModule(slug).catch(() => undefined); };

type BoundaryProps = { children: ReactNode; fallback: (e: Error, reset: () => void) => ReactNode; resetKey?: string };
export class ErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Component crashed:", error, info.componentStack); }
  componentDidUpdate(prev: BoundaryProps) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() { return this.state.error ? this.props.fallback(this.state.error, () => this.setState({ error: null })) : this.props.children; }
}

const PREVIEW_WIDTH = 1100;

/** A live, non-interactive thumbnail: the real component rendered at desktop width and scaled to fit. */
export function LivePreview({ slug }: { slug: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  const { mod } = useModule(slug, visible);

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => setScale(el.clientWidth / PREVIEW_WIDTH);
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Demo = mod?.Demo;
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden" aria-hidden="true" inert>
      {!Demo && (
        <div className="absolute inset-0 grid place-items-center p-8">
          <div className="w-3/4 space-y-3">
            <span className="skeleton block h-4 w-1/3 rounded" />
            <span className="skeleton block h-24 rounded-xl" />
            <span className="skeleton block h-4 w-2/3 rounded" />
          </div>
        </div>
      )}
      {Demo && scale > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}>
          <div className="flex min-h-[640px] items-start justify-center px-10 py-12">
            <PreviewContext.Provider value={true}>
              <ErrorBoundary fallback={() => <p className="text-ink-3">Preview unavailable</p>}>
                <Demo mode="preview" />
              </ErrorBoundary>
            </PreviewContext.Provider>
          </div>
        </div>
      )}
    </div>
  );
}
