import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

/* ------------------------------------------------------------
   A tiny History-API router: two real routes (home + component
   page), clean URLs, scroll restoration on back/forward.
   ------------------------------------------------------------ */

type Loc = { pathname: string; search: string; hash: string; key: string };
type Ctx = { loc: Loc; navigate: (to: string, opts?: { replace?: boolean }) => void };

const RouterContext = createContext<Ctx | null>(null);
const read = (): Loc => ({ pathname: location.pathname, search: location.search, hash: location.hash, key: (history.state && history.state.key) || "root" });
const newKey = () => Math.random().toString(36).slice(2, 10);
const scrollMemory = new Map<string, number>();

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(read);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!history.state?.key) history.replaceState({ key: "root" }, "");
    const onPop = () => {
      const next = read();
      setLoc(next);
      requestAnimationFrame(() => window.scrollTo(0, scrollMemory.get(next.key) ?? 0));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, { replace = false }: { replace?: boolean } = {}) => {
    const url = new URL(to, location.href);
    if (url.origin !== location.origin) { location.href = to; return; }
    scrollMemory.set(history.state?.key ?? "root", window.scrollY);
    const key = newKey();
    if (replace) history.replaceState({ key }, "", url.pathname + url.search + url.hash);
    else history.pushState({ key }, "", url.pathname + url.search + url.hash);
    setLoc(read());
    if (url.hash) requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView({ block: "start" }));
    else window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ loc, navigate }), [loc, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): Ctx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <RouterProvider>");
  return ctx;
}

/** <a> that navigates client-side for same-origin, unmodified left clicks. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
    if (!href.startsWith("/")) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
