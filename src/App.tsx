import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { RouterProvider, Link, useRouter } from "./lib/router";
import { PreviewContext } from "./lib/hooks";
import { bySlug } from "./gallery/registry";
import { CommandPalette, Footer, Header, PageTransition } from "./gallery/Shell";
import { HomePage } from "./gallery/Home";
import { ComponentPage, PreviewOnly } from "./gallery/ComponentPage";

function NotFound() {
  useEffect(() => { document.title = "Page not found · LofiStack Components"; }, []);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-28">
      <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-3">404</span>
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-semibold leading-tight tracking-tight text-ink">There's no component at this address.</h1>
      <p className="text-ink-2">The link may be mistyped, or the component may have moved.</p>
      <Link href="/" className="rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-canvas">Browse all components →</Link>
    </div>
  );
}

function Routes() {
  const { loc, navigate } = useRouter();
  const [palette, setPalette] = useState(false);
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(loc.search);

  // legacy + convenience redirects (also configured on Vercel)
  useEffect(() => {
    if (path === "/components") navigate("/", { replace: true });
    else if (path === "/components/campaign-snapshot") navigate("/components/campaign-performance", { replace: true });
    else if (path === "/index.html") navigate("/", { replace: true });
  }, [path, navigate]);

  // ?theme=dark|light forces a theme for this view (handy for QA and screenshots)
  useEffect(() => {
    const t = params.get("theme");
    if (t === "dark" || t === "light") document.documentElement.classList.toggle("dark", t === "dark");
  }, [loc.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘K / Ctrl+K opens the component palette
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(p => !p); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const match = /^\/components\/([a-z0-9-]+)$/.exec(path);
  const meta = match ? bySlug(match[1]) : undefined;

  if (meta && params.get("view") === "preview") {
    return <PreviewContext.Provider value={true}><PreviewOnly meta={meta} /></PreviewContext.Provider>;
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-canvas">Skip to content</a>
      <Header onOpenPalette={() => setPalette(true)} />
      <main id="main" className="min-h-[70vh]">
        <PageTransition id={path}>
          {path === "/" ? <HomePage /> : meta ? <ComponentPage meta={meta} /> : <NotFound />}
        </PageTransition>
      </main>
      <Footer />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </MotionConfig>
  );
}
