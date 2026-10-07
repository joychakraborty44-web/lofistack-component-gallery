import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, COMPONENTS } from "./registry";
import { Link, useRouter } from "../lib/router";
import { Icon, cx } from "../ui";
import { prefetch } from "./load";

const REPO = "https://github.com/joychakraborty44-web/lofistack-component-gallery";
const catLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label ?? id;
const pad = (n: number) => String(n).padStart(2, "0");

/* ---------------- theme ---------------- */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    // cross-fade the whole page when the browser supports view transitions
    const apply = () => {
      document.documentElement.classList.toggle("dark", next);
      try { localStorage.setItem("lsg-theme", next ? "dark" : "light"); } catch { /* storage blocked */ }
      setDark(next);
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  };
  return { dark, toggle };
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={dark}
      className="relative grid size-9 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-ink-2 transition-colors hover:text-ink elev-1">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? "moon" : "sun"} initial={{ y: 12, opacity: 0, rotate: -40 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -12, opacity: 0, rotate: 40 }} transition={{ duration: 0.22 }}>
          <Icon name={dark ? "moon" : "sun"} className="size-4" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------------- command palette (⌘K) ---------------- */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = COMPONENTS.filter(c => !s || `${c.title} ${c.nav} ${catLabel(c.category)} ${c.tags.join(" ")} ${pad(c.num)}`.toLowerCase().includes(s));
    return [{ href: "/", title: "Gallery home", sub: "All 30 components", num: "" }, ...list.map(c => ({ href: `/components/${c.slug}`, title: c.title, sub: catLabel(c.category), num: pad(c.num) }))]
      .filter(r => !s || r.href !== "/" || "gallery home".includes(s));
  }, [q]);

  useEffect(() => {
    if (open) { returnFocus.current = document.activeElement as HTMLElement; setQ(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); }
    else returnFocus.current?.focus?.();
  }, [open]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const go = (href: string) => { onClose(); navigate(href); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active].href); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab") { e.preventDefault(); input.current?.focus(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm dark:bg-black/50" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label="Jump to a component" onKeyDown={onKey}
            initial={{ y: -10, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -6, scale: 0.98, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface elev-4">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon name="search" className="size-4 text-ink-3" />
              <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search 30 components…" aria-label="Search components"
                role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={`cmdk-${active}`}
                className="h-13 w-full bg-transparent py-4 text-[15px] text-ink outline-none placeholder:text-ink-3" />
              <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">Esc</kbd>
            </div>
            <ul ref={listRef} id="cmdk-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2">
              {results.length === 1 && q && <li className="px-3 py-8 text-center text-[13px] text-ink-3">No component matches “{q}”.</li>}
              {results.map((r, i) => (
                <li key={r.href} id={`cmdk-${i}`} data-i={i} role="option" aria-selected={i === active}
                  onMouseMove={() => setActive(i)} onClick={() => go(r.href)} onMouseEnter={() => r.href !== "/" && prefetch(r.href.split("/").pop()!)}
                  className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]", i === active ? "bg-sunken text-ink" : "text-ink-2")}>
                  <span className="w-6 font-mono text-[11px] text-ink-3">{r.num || <Icon name="grid" className="size-3.5" />}</span>
                  <span className="flex-1 truncate font-medium">{r.title}</span>
                  <span className="text-[12px] text-ink-3">{r.sub}</span>
                  {i === active && <Icon name="arrowRight" className="size-3.5 text-ink-3" />}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">
              <span><kbd className="font-mono">↑↓</kbd> move</span><span><kbd className="font-mono">↵</kbd> open</span><span className="ml-auto">{results.length - 1} components</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- header + footer ---------------- */
export function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { loc } = useRouter();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className={cx("sticky top-0 z-50 transition-all duration-300", scrolled ? "glass border-b border-line" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 rounded-lg" aria-label="LofiStack Components home">
          <span className="grid size-8 place-items-center rounded-[10px] bg-ink text-canvas transition-transform duration-500 group-hover:-rotate-6">
            <svg viewBox="0 0 32 32" className="size-[18px]" aria-hidden="true"><rect x="5" y="6" width="22" height="5" rx="2.5" fill="currentColor" /><rect x="8" y="13.5" width="19" height="5" rx="2.5" fill="currentColor" opacity=".7" /><rect x="5" y="21" width="16" height="5" rx="2.5" fill="currentColor" opacity=".45" /></svg>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">LofiStack</span>
          <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3 sm:inline">Components</span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          <Link href="/" aria-current={loc.pathname === "/" ? "page" : undefined}
            className={cx("rounded-lg px-3 py-1.5 text-[13.5px] transition-colors", loc.pathname === "/" ? "bg-sunken text-ink" : "text-ink-3 hover:text-ink")}>Gallery</Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13.5px] text-ink-3 transition-colors hover:text-ink">GitHub <Icon name="external" className="size-3" /></a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onOpenPalette} aria-label="Search components" aria-haspopup="dialog"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink elev-1 sm:w-60">
            <Icon name="search" className="size-3.5" />
            <span className="hidden sm:inline">Jump to component…</span>
            <kbd className="ml-auto hidden rounded-md border border-line px-1.5 font-mono text-[10.5px] sm:inline">{isMac ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p><span className="font-medium text-ink-2">LofiStack Component Gallery</span> · {COMPONENTS.length} components</p>
        <p>Built with React, TypeScript & Tailwind CSS</p>
        <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">Source on GitHub <Icon name="external" className="size-3" /></a>
      </div>
    </footer>
  );
}

export function PageTransition({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
