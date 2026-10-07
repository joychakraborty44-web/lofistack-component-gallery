import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Icon, cx } from "../../ui";
import { usePreviewMode } from "../../lib/hooks";
import { CreativeArtwork } from "./CreativeArtwork";
import type { Creative, CreativeFormat, CreativeSet, CreativeSort, FormatFilter } from "./data";

/* ------------------------------------------------------------
   Ad Creative Performance — an editorial black / white + lime
   gallery of creatives. Sort, filter by format, compare two.
   ------------------------------------------------------------ */

export interface DerivedCreative {
  c: Creative;
  imp: number; clk: number; sp: number; cv: number;
  ctr: number | null; cpc: number | null; cvr: number | null; cpa: number | null;
}
type MetricKey = "ctr" | "cpc" | "cvr" | "cpa" | "cv" | "sp";

export interface CreativeCompareDetail {
  ids: string[];
  creatives: { id: string; name: string; format: CreativeFormat; impressions: number; clicks: number; spend: number; conversions: number; ctr: number | null; cpc: number | null; cvr: number | null; cpa: number | null }[];
  /** Id of the creative that wins more metrics (null for a tie or fewer than two). */
  winner: string | null;
  wins: Record<string, number> | null;
}

export interface AdCreativePerformanceProps {
  data: CreativeSet;
  /** Controlled sort. Omit to let the component manage it (starts at `defaultSort`). */
  sort?: CreativeSort;
  defaultSort?: CreativeSort;
  /** Controlled format filter. */
  format?: FormatFilter;
  defaultFormat?: FormatFilter;
  /** Fired when the sort or the format filter changes. */
  onSortChange?: (detail: { sort: CreativeSort; format: FormatFilter }) => void;
  /** Controlled comparison (up to two creative ids). */
  compareIds?: string[];
  defaultCompareIds?: string[];
  /** Fired whenever the picked creatives change, with each one's metrics and the winner. */
  onCompare?: (detail: CreativeCompareDetail) => void;
  className?: string;
}

const SORTS: Record<CreativeSort, { key: "ctr" | "cpa" | "sp" | "cv"; dir: 1 | -1; label: string; crown: string }> = {
  ctr: { key: "ctr", dir: -1, label: "CTR", crown: "Best CTR" },
  cpa: { key: "cpa", dir: 1, label: "CPA", crown: "Lowest CPA" },
  spend: { key: "sp", dir: -1, label: "Spend", crown: "Top spend" },
  conversions: { key: "cv", dir: -1, label: "Conversions", crown: "Most conv." },
};
const SORT_KEYS = Object.keys(SORTS) as CreativeSort[];
const FORMATS: FormatFilter[] = ["all", "image", "video", "carousel"];
const FORMAT_LABEL: Record<FormatFilter, string> = { all: "All", image: "Image", video: "Video", carousel: "Carousel" };
const METRICS: { key: MetricKey; label: string; better: 1 | -1 | 0 }[] = [
  { key: "ctr", label: "CTR", better: 1 }, { key: "cpc", label: "Cost per click", better: -1 },
  { key: "cvr", label: "Conv. rate", better: 1 }, { key: "cpa", label: "Cost per conversion", better: -1 },
  { key: "cv", label: "Conversions", better: 1 }, { key: "sp", label: "Spend", better: 0 },
];

const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);

export function deriveCreative(c: Creative): DerivedCreative {
  const imp = n0(c.impressions), clk = n0(c.clicks), sp = n0(c.spend), cv = n0(c.conversions);
  return { c, imp, clk, sp, cv, ctr: imp > 0 ? clk / imp : null, cpc: clk > 0 ? sp / clk : null, cvr: clk > 0 ? cv / clk : null, cpa: cv > 0 ? sp / cv : null };
}

/** The visible creatives for a sort + format, best first (the same order the gallery shows). */
export function rankCreatives(creatives: Creative[], sort: CreativeSort, format: FormatFilter): DerivedCreative[] {
  const cfg = SORTS[sort];
  return creatives.map(deriveCreative).filter(d => format === "all" || d.c.format === format).sort((a, b) => {
    const x = a[cfg.key], y = b[cfg.key];
    if (x == null && y == null) return a.c.name.localeCompare(b.c.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * cfg.dir || a.c.name.localeCompare(b.c.name);
  });
}

function score(a: DerivedCreative, b: DerivedCreative) {
  const wins: Record<string, number> = { [a.c.id]: 0, [b.c.id]: 0 };
  const per: Partial<Record<MetricKey, string | null>> = {};
  let total = 0;
  METRICS.forEach(m => {
    if (!m.better) return;
    const x = a[m.key], y = b[m.key];
    if (x == null || y == null) return;
    total++;
    if (x === y) { per[m.key] = null; return; }
    const w = (x - y) * m.better > 0 ? a.c.id : b.c.id;
    per[m.key] = w; wins[w]++;
  });
  const winner = wins[a.c.id] === wins[b.c.id] ? null : wins[a.c.id] > wins[b.c.id] ? a.c.id : b.c.id;
  return { wins, per, total, winner };
}

function useControlled<T>(value: T | undefined, initial: T): [T, (v: T) => void] {
  const [inner, setInner] = useState(initial);
  return [value !== undefined ? value : inner, setInner];
}

/* ---------------- tiny icons ---------------- */
const FormatIcon = ({ f, className = "size-2.5" }: { f: CreativeFormat; className?: string }) => (
  <svg viewBox="0 0 12 12" className={className} aria-hidden fill={f === "video" ? "currentColor" : "none"} stroke={f === "video" ? "none" : "currentColor"} strokeWidth={1.4}>
    {f === "image" && <><rect x="1.5" y="2" width="9" height="8" rx="1" /><path d="m2 9 3-3 2 2 1.5-1.5L10 8" /></>}
    {f === "video" && <path d="M3 2.2v7.6L9.6 6z" />}
    {f === "carousel" && <><rect x="3" y="2" width="6" height="8" rx="1" /><path d="M1 3.5v5M11 3.5v5" /></>}
  </svg>
);
const Crown = ({ className = "size-3" }: { className?: string }) => (
  <svg viewBox="0 0 12 12" fill="currentColor" className={className} aria-hidden><path d="M1.2 3.6 3.8 6 6 2.2 8.2 6l2.6-2.4-.9 5.6H2.1zM2.2 9.9h7.6v1H2.2z" /></svg>
);

/* ---------------- component ---------------- */
export function AdCreativePerformance({
  data, sort: sortProp, defaultSort = "ctr", format: formatProp, defaultFormat = "all", onSortChange,
  compareIds, defaultCompareIds = [], onCompare, className,
}: AdCreativePerformanceProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const [sort, setSort] = useControlled(sortProp, defaultSort);
  const [format, setFormat] = useControlled(formatProp, defaultFormat);
  const [selRaw, setSel] = useControlled(compareIds, defaultCompareIds);
  const [live, setLive] = useState("");
  const [limitNote, setLimitNote] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const cmpRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const cur = (data.currency || "USD").toUpperCase();
  const loc = data.locale || "en-US";
  const money = (v: number | null, d: number) => {
    if (v == null) return "—";
    try { return new Intl.NumberFormat(loc, { style: "currency", currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    catch { return `${cur} ${v.toFixed(d)}`; }
  };
  const int = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString(loc));
  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
  const fmt = (k: MetricKey, v: number | null) => (k === "ctr" || k === "cvr" ? pct(v) : k === "cpa" || k === "cpc" ? money(v, 2) : k === "sp" ? money(v, 0) : int(v));

  const creatives = useMemo(() => {
    const seen = new Set<string>();
    return (data.creatives || []).filter(Boolean).map((c, i) => {
      let id = String(c.id || `creative-${i + 1}`);
      while (seen.has(id)) id += `-${i}`;
      seen.add(id);
      const format: CreativeFormat = c.format === "video" || c.format === "carousel" ? c.format : "image";
      return { ...c, id, format, name: c.name || `Creative ${i + 1}` };
    });
  }, [data.creatives]);
  const all = useMemo(() => creatives.map(deriveCreative), [creatives]);
  const ordered = useMemo(() => rankCreatives(creatives, sort, format), [creatives, sort, format]);
  const sel = selRaw.filter(id => all.some(d => d.c.id === id)).slice(0, 2);
  const cfg = SORTS[sort];
  const best = ordered.length && ordered[0][cfg.key] != null ? ordered[0].c.id : null;
  const counts = (f: FormatFilter) => (f === "all" ? all.length : all.filter(d => d.c.format === f).length);

  const totals = ordered.reduce((a, d) => ({ imp: a.imp + d.imp, clk: a.clk + d.clk, sp: a.sp + d.sp, cv: a.cv + d.cv }), { imp: 0, clk: 0, sp: 0, cv: 0 });
  const summary: { k: string; v: number | null; f: (v: number) => string }[] = [
    { k: "Spend", v: totals.sp, f: v => money(v, 0) },
    { k: "Conversions", v: totals.cv, f: v => int(v) },
    { k: "Blended CPA", v: totals.cv > 0 ? totals.sp / totals.cv : null, f: v => money(v, 2) },
    { k: "Avg. CTR", v: totals.imp > 0 ? totals.clk / totals.imp : null, f: v => pct(v) },
  ];

  /* narrow containers get a bottom-sheet comparison instead of the inline drawer */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const on = () => setNarrow(el.offsetWidth > 0 && el.offsetWidth < 480);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!limitNote) return;
    const t = window.setTimeout(() => setLimitNote(false), 2800);
    return () => window.clearTimeout(t);
  }, [limitNote]);

  const picked = sel.map(id => all.find(d => d.c.id === id)).filter((d): d is DerivedCreative => !!d);
  const result = picked.length === 2 ? score(picked[0], picked[1]) : null;
  const verdict = (r: ReturnType<typeof score>, a: DerivedCreative, b: DerivedCreative) =>
    r.winner ? `${r.winner === a.c.id ? a.c.name : b.c.name} wins ${r.wins[r.winner]} of ${r.total} metrics` : `Even: each wins ${r.wins[a.c.id]} of ${r.total} metrics`;

  const commitCompare = (ids: string[]) => {
    setSel(ids);
    const p = ids.map(id => all.find(d => d.c.id === id)).filter((d): d is DerivedCreative => !!d);
    const r = p.length === 2 ? score(p[0], p[1]) : null;
    onCompare?.({
      ids: ids.slice(),
      creatives: p.map(d => ({ id: d.c.id, name: d.c.name, format: d.c.format, impressions: d.imp, clicks: d.clk, spend: d.sp, conversions: d.cv, ctr: d.ctr, cpc: d.cpc, cvr: d.cvr, cpa: d.cpa })),
      winner: r ? r.winner : null, wins: r ? r.wins : null,
    });
    if (r) setLive(`${verdict(r, p[0], p[1])}.`);
    else if (p.length === 1) setLive(`${p[0].c.name} picked. Pick one more to compare.`);
    else setLive("Comparison cleared.");
  };
  const toggle = (id: string) => {
    if (sel.includes(id)) return commitCompare(sel.filter(x => x !== id));
    if (sel.length >= 2) { setLive("Two creatives are already picked. Remove one to add another."); setLimitNote(true); return; }
    commitCompare([...sel, id]);
  };
  const clear = () => {
    commitCompare([]);
    const first = ordered[0];
    if (first) requestAnimationFrame(() => cmpRefs.current.get(first.c.id)?.focus());
  };
  const changeSort = (s: CreativeSort) => {
    if (s === sort) return;
    setSort(s); onSortChange?.({ sort: s, format });
    setLive(`Sorted by ${SORTS[s].label}. Showing ${ordered.length} creatives.`);
  };
  const changeFormat = (f: FormatFilter) => {
    if (f === format) return;
    setFormat(f); onSortChange?.({ sort, format: f });
    setLive(`Sorted by ${cfg.label}. Showing ${counts(f)} creatives.`);
  };

  /* roving radio keyboard for sort + format groups */
  const radioKeys = <T,>(list: T[], value: T, set: (v: T) => void) => (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = list.indexOf(value);
    const n = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (i + dir + list.length) % list.length;
    set(list[n]);
    const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    btns[n]?.focus();
  };
  const visibleFormats = FORMATS.filter(f => f === "all" || counts(f) > 0);

  const compareBody = picked.length ? (
    <CompareBody picked={picked} result={result} fmt={fmt} verdict={result ? verdict(result, picked[0], picked[1]) : ""} />
  ) : null;

  return (
    <article ref={rootRef} aria-labelledby={`${uid}-title`}
      className={cx("@container relative w-full max-w-[1040px] rounded-[6px] border border-[var(--hair)] border-t-4 border-t-[var(--rule)] bg-[var(--card)] px-3.5 pb-3.5 pt-[18px] text-ink elev-3 @xl:px-5 @xl:pb-[18px] @xl:pt-[22px] @3xl:px-[26px] @3xl:pb-5 @3xl:pt-6",
        "[--card:#FFFFFF] dark:[--card:#0E0E0D] [--rule:#0B0B0A] dark:[--rule:#F4F4F0] [--hair:#E2E2DB] dark:[--hair:#262624] [--tint:#F4F4EF] dark:[--tint:#171715]",
        "[--lime:#A3E635] [--lime-ink:#1A2E05] [--acc:#4D7C0F] dark:[--acc:#A3E635] [--art-paper:#EFEEE7] dark:[--art-paper:#1C1C1A] [--art-ink:#141413] dark:[--art-ink:#EDEDE7]",
        "[--drawer:#0B0B0A] dark:[--drawer:#171715] [--drawer-line:#2A2A27] dark:[--drawer-line:#33332F]", className)}>

      {/* masthead */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[var(--rule)] pb-3.5 @xl:pb-4">
        <div className="grid min-w-0 gap-1.5">
          {data.eyebrow && <span className="font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--acc)]">{data.eyebrow}</span>}
          {data.title && <h2 id={`${uid}-title`} className="m-0 font-condensed text-[clamp(26px,4.6cqi,40px)] font-bold uppercase leading-[0.95] tracking-[-0.01em] text-balance">{data.title}</h2>}
          {data.subtitle && <p className="m-0 text-[13px] text-ink-2 @xl:text-[13.5px]">{data.subtitle}</p>}
        </div>
        {data.period && <span className="whitespace-nowrap rounded-full border border-[var(--hair)] px-2.5 py-[7px] font-mono text-[11.5px] font-medium leading-none tracking-[0.04em] text-ink-2">{data.period}</span>}
      </header>

      {/* summary strip */}
      <dl className="m-0 grid grid-cols-2 border-b border-[var(--hair)] @2xl:grid-cols-4">
        {summary.map((s, i) => (
          <div key={s.k} className={cx("grid min-w-0 gap-1.5 py-3 pr-2.5 @xl:py-3.5 @xl:pr-4",
            i % 2 === 1 && "border-l border-[var(--hair)] pl-2.5 @xl:pl-4",
            i >= 2 && "@2xl:border-l @2xl:border-[var(--hair)] @2xl:pl-4",
            i < 2 && "border-b border-[var(--hair)] @2xl:border-b-0")}>
            <dt className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-3">{s.k}</dt>
            <dd className="m-0 font-condensed text-[clamp(22px,3.6cqi,30px)] font-semibold leading-none tracking-[-0.01em] [overflow-wrap:anywhere]">
              {s.v == null ? "—" : <CountUp value={s.v} format={s.f} duration={520} />}
            </dd>
          </div>
        ))}
      </dl>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5 pb-4 pt-3.5">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 @xl:w-auto">
          <span id={`${uid}-sortl`} className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-3">Sort</span>
          <div role="radiogroup" aria-labelledby={`${uid}-sortl`} onKeyDown={radioKeys(SORT_KEYS, sort, changeSort)} className="flex flex-wrap gap-0.5">
            {SORT_KEYS.map(k => {
              const on = k === sort;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => changeSort(k)}
                  className={cx("relative rounded-[3px] px-[9px] pb-[9px] pt-2 text-[13px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-[var(--acc)]",
                    on ? "text-ink" : "text-ink-2 hover:text-ink")}>
                  {SORTS[k].label}
                  <span aria-hidden className="ml-1 font-mono text-[10px] font-medium text-ink-3">{SORTS[k].dir < 0 ? "↓" : "↑"}</span>
                  {on && <motion.span layoutId={`${uid}-sortbar`} className="absolute inset-x-[9px] bottom-0.5 h-[3px] bg-[var(--lime)]" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 @xl:w-auto">
          <span id={`${uid}-fmtl`} className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-ink-3">Format</span>
          <div role="radiogroup" aria-labelledby={`${uid}-fmtl`} onKeyDown={radioKeys(visibleFormats, format, changeFormat)} className="flex flex-wrap gap-1">
            {visibleFormats.map(f => {
              const on = f === format;
              return (
                <button key={f} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => changeFormat(f)}
                  className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[7px] text-[12.5px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-[var(--acc)]",
                    on ? "border-ink bg-ink text-[var(--card)]" : "border-[var(--hair)] bg-[var(--card)] text-ink-2 hover:border-ink hover:text-ink")}>
                  {FORMAT_LABEL[f]}
                  <b className={cx("font-condensed text-[11px] font-semibold tabular", on ? "text-[var(--lime)] dark:text-[#3F6212]" : "text-ink-3")}>{counts(f)}</b>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {limitNote && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} aria-hidden
            className="-mt-2 mb-3 flex items-center gap-2 rounded-[3px] bg-[var(--tint)] px-3 py-2 text-[12.5px] text-ink-2">
            <Icon name="info" className="size-3.5 text-[var(--acc)]" />Two creatives are already picked. Remove one to add another.
          </motion.p>
        )}
      </AnimatePresence>

      {/* gallery */}
      {ordered.length ? (
        <ol className="m-0 grid list-none grid-cols-2 gap-x-2.5 gap-y-3 p-0 @md:gap-x-3.5 @md:gap-y-[18px] @xl:grid-cols-3 @4xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {ordered.map((d, i) => {
              const k = sel.indexOf(d.c.id);
              const isBest = d.c.id === best;
              return (
                <motion.li key={d.c.id} layout={!preview} className="relative min-w-0"
                  initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ layout: { type: "spring", stiffness: 380, damping: 36 }, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
                  <Tile d={d} rank={i + 1} sortKey={cfg.key} sortLabel={cfg.label} crown={isBest ? SORTS[sort].crown : null}
                    slot={k} limit={sel.length >= 2 && k < 0} fmt={fmt} onToggle={() => toggle(d.c.id)}
                    btnRef={el => { cmpRefs.current.set(d.c.id, el); }} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      ) : (
        <p className="m-0 rounded-[4px] border border-dashed border-[var(--hair)] py-9 text-center text-[14px] text-ink-2">No creatives match this format.</p>
      )}

      {/* comparison: inline drawer, or a bottom sheet in narrow containers */}
      {!narrow && (
        <AnimatePresence initial={false}>
          {compareBody && (
            <motion.section key="drawer" aria-label="Creative comparison" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
              <div className="pt-5">
                <div className="rounded-[4px] border border-[var(--drawer-line)] bg-[var(--drawer)] px-5 pb-4 pt-[18px] text-[#F4F4F0]">
                  <CompareHead picked={picked} onClear={clear} />
                  {compareBody}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      )}
      {narrow && <CompareSheet open={!!compareBody} picked={picked} onClear={clear} result={result} verdict={result ? verdict(result, picked[0], picked[1]) : ""}>{compareBody}</CompareSheet>}

      {data.source && <p className="mb-0 mt-4 border-t border-[var(--hair)] pt-3 text-[12px] text-ink-3">{data.source}</p>}
      <p className="sr-only" aria-live="polite">{live}</p>
    </article>
  );
}

/* ---------------- tile ---------------- */
function Tile({ d, rank, sortKey, sortLabel, crown, slot, limit, fmt, onToggle, btnRef }: {
  d: DerivedCreative; rank: number; sortKey: MetricKey; sortLabel: string; crown: string | null; slot: number; limit: boolean;
  fmt: (k: MetricKey, v: number | null) => string; onToggle: () => void; btnRef: (el: HTMLButtonElement | null) => void;
}) {
  const c = d.c, picked = slot >= 0;
  const extra = c.format === "video" ? c.duration : c.format === "carousel" && c.slides ? String(c.slides) : "";
  const dots = Math.min(8, Math.max(2, c.slides || 3));
  const mets: [MetricKey, string, string][] = [["ctr", "CTR", "CTR"], ["cpa", "CPA", "CPA"], ["sp", "Spend", "Spend"], ["cv", "Conversions", "Conv."]];
  return (
    <>
    <article className={cx("group/tile relative grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-[4px] border bg-[var(--card)] transition-[border-color,box-shadow] duration-300",
      picked ? "border-ink shadow-[0_0_0_2px_var(--lime),0_18px_32px_-26px_rgb(10_10_9/0.4)]" : "border-[var(--hair)] hover:border-ink-3 hover:shadow-[0_18px_32px_-26px_rgb(10_10_9/0.35)]")}>
      <div className="relative aspect-[4/3] overflow-hidden border-b border-[var(--hair)] bg-[var(--art-paper)]">
        <div className="absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/tile:scale-[1.035] motion-reduce:transition-none">
          <CreativeArtwork creative={c} />
        </div>
        {c.format === "video" && (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-[42%] grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgb(11_11_10/0.72)] text-white transition-transform duration-300 group-hover/tile:scale-[1.08] @md:size-[38px]">
            <svg viewBox="0 0 12 12" className="ml-0.5 size-3.5" fill="currentColor"><path d="M3 1.6v8.8L10.4 6z" /></svg>
          </span>
        )}
        {c.format === "carousel" && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[40px] flex justify-center gap-1 @md:bottom-[44px]">
            {Array.from({ length: dots }, (_, i) => <i key={i} className={cx("h-[5px] rounded-full shadow-[0_0_0_1px_rgb(11_11_10/0.35)]", i === 0 ? "w-3 bg-white" : "w-[5px] bg-white/55")} />)}
          </span>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-[5px] rounded-[3px] bg-[#0B0B0A] px-[6px] py-[5px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-[#F4F4F0] @md:px-[7px]">
          <FormatIcon f={c.format} /><span className="sr-only @md:not-sr-only">{FORMAT_LABEL[c.format]}</span>
          {extra && <span className="hidden normal-case tracking-[0.02em] text-[#A9A9A2] @md:inline">{extra}</span>}
        </span>
        <span aria-hidden className="absolute right-2 top-2 rounded-[3px] bg-[rgb(11_11_10/0.82)] px-1.5 pb-[3px] pt-1 font-condensed text-[13px] font-bold leading-none text-[#F4F4F0] tabular @md:text-[15px]">{String(rank).padStart(2, "0")}</span>
        <AnimatePresence>
          {crown && (
            <motion.span key={crown} initial={{ opacity: 0, y: -4, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
              className="absolute left-2 top-[34px] inline-flex items-center gap-[5px] rounded-[3px] bg-[var(--lime)] px-[5px] py-[5px] font-mono text-[10px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--lime-ink)] shadow-[0_6px_14px_-6px_rgb(0_0_0/0.45)] @md:pl-1.5 @md:pr-2">
              <Crown /><span className="hidden @md:inline">{crown}</span>
            </motion.span>
          )}
        </AnimatePresence>
        {/* overlay: the ranking metric, plus more figures on hover / focus */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(8_8_7/0.9),rgb(8_8_7/0.6)_62%,transparent)] px-2 pb-1.5 pt-4 text-[#F4F4F0] @md:px-2.5 @md:pb-2 @md:pt-[18px]">
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] group-focus-within/tile:grid-rows-[1fr] group-hover/tile:grid-rows-[1fr] motion-reduce:transition-none">
            <div className="min-h-0 overflow-hidden">
              <dl className="m-0 grid grid-cols-2 gap-x-2 gap-y-1 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#C9C9C2]">
                {([["Impr.", fmt("cv", d.imp)], ["Clicks", fmt("cv", d.clk)], ["CPC", fmt("cpc", d.cpc)], ["CVR", fmt("cvr", d.cvr)]] as const).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 justify-between gap-1"><dt>{k}</dt><dd className="m-0 truncate font-condensed text-[12px] font-semibold normal-case tracking-normal text-[#F4F4F0] tabular">{v}</dd></div>
                ))}
              </dl>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="hidden font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[#C9C9C2] @md:inline">{sortLabel}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={sortKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                className="ml-auto font-condensed text-[18px] font-bold leading-none tracking-[-0.01em] text-[#A3E635] tabular @md:text-[24px]">
                {fmt(sortKey, d[sortKey])}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <span className="sr-only">Rank {rank} by {sortLabel}{crown ? `, ${crown}` : ""}.</span>
      </div>

      <div className="grid content-start gap-2 p-2.5 @md:gap-2.5 @md:p-3">
        <h3 className="m-0 text-[13.5px] font-semibold leading-[1.25] tracking-[-0.005em] [overflow-wrap:anywhere] @md:text-[14.5px]">{c.name}</h3>
        {c.copy && <p className="-mt-1 mb-0 hidden text-[12.5px] italic leading-[1.4] text-ink-2 [overflow-wrap:anywhere] @xl:block">{c.copy}</p>}
        <dl className="m-0 grid grid-cols-2 border-t border-[var(--hair)]">
          {mets.map(([k, label, short], i) => {
            const on = k === sortKey;
            return (
              <div key={k} className={cx("relative grid min-w-0 gap-[3px] border-b border-[var(--hair)] pb-1.5 pt-[7px]", i % 2 === 1 && "border-l pl-2 @md:pl-2.5")}>
                {on && <motion.span layoutId={`met-${c.id}`} className={cx("absolute -top-px h-0.5 w-[22px] bg-[var(--lime)]", i % 2 === 1 ? "left-2 @md:left-2.5" : "left-0")} transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                <dt className={cx("font-mono text-[9.5px] font-semibold uppercase leading-[1.1] tracking-[0.08em] [overflow-wrap:anywhere]", on ? "text-[var(--acc)]" : "text-ink-3")}>
                  <span className="@md:hidden">{short}</span><span className="hidden @md:inline">{label}</span>
                </dt>
                <dd className="m-0 font-condensed text-[14.5px] font-semibold leading-none tabular @md:text-[16px]">{fmt(k, d[k])}</dd>
              </div>
            );
          })}
        </dl>
        <button ref={btnRef} type="button" aria-pressed={picked} aria-disabled={limit || undefined} onClick={onToggle}
          className={cx("inline-flex items-center gap-1.5 justify-self-start rounded-[3px] border py-[7px] pl-2 pr-2.5 text-[12px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-[var(--acc)]",
            picked ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--lime-ink)]"
            : limit ? "cursor-not-allowed border-[var(--hair)] text-ink-3 opacity-60"
            : "border-[var(--hair)] text-ink-2 hover:border-ink hover:text-ink")}>
          <Icon name="plus" className={cx("size-3 transition-transform duration-300", picked && "rotate-45")} strokeWidth={1.9} />
          {picked ? "Comparing" : "Compare"}<span className="sr-only"> {c.name}</span>
        </button>
      </div>

    </article>
    {picked && <SlotBadge letter={slot === 0 ? "A" : "B"} />}
    </>
  );
}

function SlotBadge({ letter }: { letter: string }) {
  return (
    <motion.span aria-hidden initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 24 }}
      className="absolute -right-1.5 -top-2 z-[2] grid size-[22px] shadow-[0_0_0_2px_var(--card)] place-items-center rounded-full bg-ink font-condensed text-[11px] font-bold text-[var(--lime)] dark:text-[#1A2E05] dark:bg-[var(--lime)]">
      {letter}
    </motion.span>
  );
}

/* ---------------- comparison ---------------- */
function CompareHead({ picked, onClear }: { picked: DerivedCreative[]; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
      <h3 className="m-0 grid gap-[5px]">
        <small className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-[#A3E635]">Head to head</small>
        <span className="font-condensed text-[20px] font-bold uppercase leading-[1.1]">{picked.map(p => p.c.name).join(" vs ")}</span>
      </h3>
      <button type="button" onClick={onClear}
        className="rounded-[3px] border border-[var(--drawer-line)] px-[11px] py-2 text-[12px] font-semibold leading-none text-[#F4F4F0] transition-colors hover:border-[#A9A9A2] hover:bg-white/5 focus-visible:outline-[#A3E635]">Clear</button>
    </div>
  );
}

function CompareBody({ picked, result, fmt, verdict }: {
  picked: DerivedCreative[]; result: ReturnType<typeof score> | null; fmt: (k: MetricKey, v: number | null) => string; verdict: string;
}) {
  return (
    <div className="mt-3.5 grid gap-3.5">
      <div className="grid grid-cols-2 gap-2 @md:gap-3">
        {[0, 1].map(i => {
          const d = picked[i];
          if (!d) return <div key={i} className="grid min-h-[58px] place-items-center rounded-[4px] border border-dashed border-[var(--drawer-line)] p-2 text-center text-[13px] text-[#A9A9A2]">Pick a second creative to compare</div>;
          return (
            <motion.div key={d.c.id} initial={{ opacity: 0, x: i ? 8 : -8 }} animate={{ opacity: 1, x: 0 }}
              className={cx("grid min-w-0 items-center gap-2.5 rounded-[4px] border border-[var(--drawer-line)] p-2",
                i === 1 ? "@md:grid-cols-[minmax(0,1fr)_56px] @md:text-right" : "@md:grid-cols-[56px_minmax(0,1fr)]")}>
              <div aria-hidden className={cx("relative aspect-[4/3] w-14 overflow-hidden rounded-[2px] [--art-paper:#EFEEE7] [--art-ink:#141413]", i === 1 && "@md:order-2")}><CreativeArtwork creative={d.c} /></div>
              <div className="min-w-0">
                <b className="block text-[13.5px] font-semibold leading-[1.25] [overflow-wrap:anywhere]">{d.c.name}</b>
                <span className="mt-[3px] block font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.06em] text-[#A9A9A2]">{i === 0 ? "A" : "B"} · {FORMAT_LABEL[d.c.format]}</span>
                {result?.winner === d.c.id && <em className="mt-[5px] inline-block rounded-[2px] bg-[#A3E635] px-1.5 py-[3px] font-mono text-[10px] font-bold not-italic uppercase leading-none tracking-[0.06em] text-[#1A2E05]">Leader</em>}
              </div>
            </motion.div>
          );
        })}
      </div>
      {result && picked.length === 2 && (
        <>
          <ul className="m-0 grid list-none p-0">
            {METRICS.map((m, idx) => {
              const [a, b] = picked;
              const x = a[m.key], y = b[m.key], max = Math.max(x || 0, y || 0);
              const w = result.per[m.key];
              const side = (d: DerivedCreative, v: number | null, left: boolean) => {
                const win = !!m.better && w === d.c.id;
                return (
                  <div aria-hidden className={cx("flex min-w-0 items-center gap-2.5", left ? "@md:flex-row-reverse" : "")}>
                    <span className={cx("min-w-0 shrink-0 font-condensed text-[15px] font-bold leading-none tabular @md:min-w-[4.4em] @md:text-[17px]", left && "@md:text-right", win ? "text-[#F4F4F0]" : "text-[#A9A9A2]")}>
                      {win && left && <span className="mr-1 hidden text-[13px] text-[#A3E635] @md:inline">✓</span>}
                      {fmt(m.key, v)}
                      {win && <span className={cx("ml-1 text-[13px] text-[#A3E635]", left && "@md:hidden")}>✓</span>}
                    </span>
                    <span className="relative h-2 min-w-5 flex-1">
                      <motion.i initial={{ width: 0 }} animate={{ width: `${max > 0 ? ((v || 0) / max) * 100 : 0}%` }}
                        transition={{ duration: 0.55, delay: 0.05 + idx * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
                        className={cx("absolute inset-y-0 rounded-[1px]", left ? "left-0 @md:left-auto @md:right-0" : "left-0", win ? "bg-[#A3E635]" : "bg-[#55554F]")} />
                    </span>
                  </div>
                );
              };
              return (
                <li key={m.key} className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 border-t border-[var(--drawer-line)] py-2 [grid-template-areas:'m_m'_'a_b'] @md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] @md:[grid-template-areas:'a_m_b'] @3xl:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
                  <div className="[grid-area:a]">{side(a, x, true)}</div>
                  <div aria-hidden className="flex items-baseline gap-2 [grid-area:m] @md:grid @md:gap-[3px] @md:text-center">
                    <b className="text-[12.5px] font-semibold leading-[1.2]">{m.label}</b>
                    <span className="font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.08em] text-[#A9A9A2]">{m.better > 0 ? "Higher wins" : m.better < 0 ? "Lower wins" : "No winner"}</span>
                  </div>
                  <div className="[grid-area:b]">{side(b, y, false)}</div>
                  <span className="sr-only">{`${m.label}: ${a.c.name} ${fmt(m.key, x)}, ${b.c.name} ${fmt(m.key, y)}.`}{m.better ? (w ? ` ${w === a.c.id ? a.c.name : b.c.name} wins.` : " Even.") : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 text-[12.5px] text-[#A9A9A2]">
            {result.winner ? <><b className="font-semibold text-[#A3E635]">{result.winner === picked[0].c.id ? picked[0].c.name : picked[1].c.name}</b>{verdict.slice((result.winner === picked[0].c.id ? picked[0].c.name : picked[1].c.name).length)}</> : verdict}
          </p>
        </>
      )}
    </div>
  );
}

function CompareSheet({ open, picked, onClear, result, verdict, children }: {
  open: boolean; picked: DerivedCreative[]; onClear: () => void; result: ReturnType<typeof score> | null; verdict: string; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const two = picked.length === 2;
  useEffect(() => { if (two) setExpanded(true); }, [two]);
  return (
    <AnimatePresence>
      {open && (
        <motion.section key="sheet" aria-label="Creative comparison" role="region"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }}
          onKeyDown={e => { if (e.key === "Escape") setExpanded(false); }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[var(--drawer-line)] bg-[var(--drawer)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 text-[#F4F4F0] shadow-[0_-24px_48px_-20px_rgb(0_0_0/0.55)]">
          <span aria-hidden className="mx-auto mb-2.5 block h-1 w-9 rounded-full bg-white/25" />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <small className="block font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-[#A3E635]">Head to head</small>
              <span className="mt-1 block truncate font-condensed text-[17px] font-bold uppercase leading-[1.15]">{picked.map(p => p.c.name).join(" vs ")}</span>
              {!expanded && <span className="mt-0.5 block truncate text-[12px] text-[#A9A9A2]">{result ? verdict : "Pick one more to compare"}</span>}
            </div>
            <button type="button" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(v => !v)}
              className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-[var(--drawer-line)] focus-visible:outline-[#A3E635]">
              <Icon name="chevronDown" className={cx("size-4 transition-transform duration-300", !expanded && "rotate-180")} />
              <span className="sr-only">{expanded ? "Minimise comparison" : "Expand comparison"}</span>
            </button>
            <button type="button" onClick={onClear}
              className="h-9 shrink-0 rounded-[3px] border border-[var(--drawer-line)] px-3 text-[12px] font-semibold focus-visible:outline-[#A3E635]">Clear</button>
          </div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div id={bodyId} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
