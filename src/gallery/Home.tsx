import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { CATEGORIES, COMPONENTS, type CategoryId, type ComponentMeta } from "./registry";
import { Link } from "../lib/router";
import { CountUp, Icon, cx } from "../ui";
import { LivePreview, prefetch } from "./load";
import { Week02Section } from "./Week02";
import { useReducedMotion } from "../lib/hooks";

const pad = (n: number) => String(n).padStart(2, "0");
const catLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label ?? id;

const CAT_TINT: Record<CategoryId, string> = {
  analytics: "#0e9384", ads: "#e0620d", crm: "#4f6f52", ai: "#6d5ae6", seo: "#15803d", ops: "#475569", sales: "#b4235a",
};

function Card({ c, index }: { c: ComponentMeta; index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.li layout={!reduced} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 8) * 0.03 }} className="list-none">
      <Link href={`/components/${c.slug}`} onMouseEnter={() => prefetch(c.slug)} onFocus={() => prefetch(c.slug)}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-500 ease-out hover:-translate-y-1 hover:border-line-strong elev-2 hover:shadow-[0_30px_60px_-30px_hsl(var(--shadow-color)/0.35)] focus-visible:-translate-y-1">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-canvas dot-grid">
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.025]">
            <LivePreview slug={c.slug} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/90 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full border border-line bg-surface/85 px-2 py-0.5 font-mono text-[10.5px] font-medium text-ink-2 backdrop-blur">{pad(c.num)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <div className="flex items-center gap-2 text-[11.5px] font-medium">
            <span className="size-1.5 rounded-full" style={{ background: CAT_TINT[c.category] }} />
            <span className="text-ink-3">{catLabel(c.category)}</span>
          </div>
          <h3 className="font-display text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ink">{c.title}</h3>
          <p className="line-clamp-2 text-[14px] leading-relaxed text-ink-3">{c.description}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <ul className="flex flex-wrap gap-1.5">
              {c.tags.slice(0, 2).map(t => <li key={t} className="rounded-md bg-sunken px-2 py-0.5 text-[11px] text-ink-3">{t}</li>)}
            </ul>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand">
              Open <Icon name="arrowRight" className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

/* Hero visual: three live components stacked in depth, leaning toward the cursor. */
const FEATURED = ["kpi-metrics-dashboard", "workflow-automation-card", "lead-funnel-analytics"];
function HeroStack() {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 20 }), sy = useSpring(my, { stiffness: 120, damping: 20 });
  const rotY = useTransform(sx, v => (reduced ? -14 : -14 + v * 8));
  const rotX = useTransform(sy, v => (reduced ? 8 : 8 - v * 6));
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5);
  };
  return (
    <div aria-hidden className="pointer-events-auto absolute right-[-6%] top-1/2 hidden h-[460px] w-[620px] -translate-y-1/2 [perspective:1600px] xl:block"
      onPointerMove={onMove} onPointerLeave={() => { mx.set(0); my.set(0); }}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" style={{ rotateY: rotY, rotateX: rotX }}>
        {FEATURED.map((slug, i) => (
          <motion.div key={slug} initial={{ opacity: 0, z: -120 }} animate={{ opacity: 1, z: i * 70 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 + i * 0.12 }}
            className="absolute overflow-hidden rounded-2xl border border-line bg-surface elev-4"
            style={{ width: 420, height: 270, left: 40 + i * 70, top: 40 + i * 55 }}>
            <LivePreview slug={slug} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function HomePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "LofiStack Component Gallery"; }, []);
  // "/" focuses search
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const counts = useMemo(() => COMPONENTS.reduce<Record<string, number>>((m, c) => ((m[c.category] = (m[c.category] ?? 0) + 1), m), {}), []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return COMPONENTS.filter(c => (cat === "all" || c.category === cat) &&
      (!s || `${c.title} ${c.description} ${c.tags.join(" ")} ${catLabel(c.category)} ${pad(c.num)}`.toLowerCase().includes(s)));
  }, [q, cat]);

  return (
    <div className="pb-24">
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="absolute inset-0 dot-grid [mask-image:radial-gradient(70%_80%_at_70%_20%,#000,transparent)]" />
        <div aria-hidden className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_65%)]" />
        <HeroStack />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 md:pb-20 md:pt-20">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
            <span>LofiStack</span><span>/</span><span>Component Gallery</span>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 normal-case tracking-normal text-ink-2">v2 · React + TypeScript</span>
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="mt-6 max-w-4xl font-display text-[clamp(2.6rem,6.4vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink text-balance">
            Reusable UI, <span className="text-ink-3">one component at a time.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}
            className="mt-6 max-w-2xl text-[16.5px] leading-relaxed text-ink-2">
            Thirty production-ready components for marketing, CRM, ads, SEO and AI teams. Every one is a typed React component with its own page — open it to see it working, try its states and copy the usage.
          </motion.p>
          <motion.dl initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              { k: "Components", v: <CountUp value={COMPONENTS.length} /> },
              { k: "Categories", v: <CountUp value={CATEGORIES.length} /> },
              { k: "Themes", v: "Light · Dark" },
              { k: "Built with", v: "React + TS" },
            ].map(s => (
              <div key={s.k} className="bg-surface px-5 py-4">
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{s.k}</dt>
                <dd className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink">{s.v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* toolbar */}
      <section aria-labelledby="all-components" className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="all-components" className="font-display text-[26px] font-semibold tracking-tight text-ink">All components</h2>
            <p className="mt-1 text-[14px] text-ink-3" aria-live="polite">
              {results.length === COMPONENTS.length ? `${COMPONENTS.length} components` : `${results.length} of ${COMPONENTS.length} components`}
            </p>
          </div>
          <label className="relative flex w-full items-center lg:w-80">
            <span className="sr-only">Search components</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 size-4 text-ink-3" />
            <input ref={search} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search components…"
              onKeyDown={e => { if (e.key === "Escape") setQ(""); }}
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-[var(--brand)] elev-1" />
            <kbd className="pointer-events-none absolute right-3 rounded-md border border-line px-1.5 font-mono text-[11px] text-ink-3">/</kbd>
          </label>
        </div>
        <div role="group" aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
          {[{ id: "all" as const, label: "All" }, ...CATEGORIES].map(c => {
            const on = cat === c.id;
            const n = c.id === "all" ? COMPONENTS.length : counts[c.id] ?? 0;
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => setCat(c.id)}
                className={cx("relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink")}>
                {c.id !== "all" && <span className="size-1.5 rounded-full" style={{ background: CAT_TINT[c.id] }} />}
                {c.label}
                <span className={cx("tabular text-[11.5px]", on ? "text-canvas/70" : "text-ink-3")}>{n}</span>
              </button>
            );
          })}
        </div>

        <motion.ul layout className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {results.map((c, i) => <Card key={c.slug} c={c} index={i} />)}
          </AnimatePresence>
        </motion.ul>
        {results.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <Icon name="search" className="size-6 text-ink-3" />
            <p className="text-[15px] font-medium text-ink">No components match “{q}”</p>
            <button type="button" onClick={() => { setQ(""); setCat("all"); }} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink">Clear filters</button>
          </div>
        )}
      </section>

      <div className="mt-24">
        <Week02Section />
      </div>
    </div>
  );
}
