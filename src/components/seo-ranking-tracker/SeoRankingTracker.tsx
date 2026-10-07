import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Icon, cx } from "../../ui";
import { useInView, usePreviewMode } from "../../lib/hooks";
import { SEO_LABELS, type SeoFilter, type SeoLabels, type SeoRankingData, type SeoSort, type SeoSortKey } from "./data";
import { FILTERS, SORT_DEFAULT_DIR, SORT_OPTIONS, buildRows, fill, matches, visibleRows, type RankRow } from "./model";
import { RankChart } from "./RankChart";

/* ------------------------------------------------------------
   SEO Ranking Tracker
   Crisp keyword table: position, weekly change, best, volume and an
   inverted 8-week sparkline. Sortable, searchable, filterable; rows
   expand into a full rank-history chart. Stacked cards on phones.
   ------------------------------------------------------------ */

export interface KeywordSelectDetail {
  keyword: string;
  position: number | null;
  change: number | null;
  best: number | null;
  url: string;
  volume: number;
  /** true when the row was opened, false when closed. */
  expanded: boolean;
}

export interface SeoRankingTrackerProps {
  data: SeoRankingData;
  /** Initial sort (default position ascending). */
  defaultSort?: SeoSort;
  /** Initial filter (default "all"). */
  defaultFilter?: SeoFilter;
  /** Override any built-in text. */
  labels?: Partial<SeoLabels>;
  /** Number locale (default en-US). */
  locale?: string;
  /** Distance from the top of the viewport where the table header sticks (e.g. under a fixed nav). */
  stickyOffset?: number;
  className?: string;
  /** A row was opened or closed. */
  onKeywordSelect?: (detail: KeywordSelectDetail) => void;
  onSortChange?: (sort: SeoSort) => void;
  onFilterChange?: (detail: { filter: SeoFilter; shown: number }) => void;
}

const ease = [0.16, 1, 0.3, 1] as const;
const COLS: { key: SeoSortKey | "trend"; sortable: boolean; th: string }[] = [
  { key: "keyword", sortable: true, th: "" },
  { key: "position", sortable: true, th: "w-[96px] text-right" },
  { key: "change", sortable: true, th: "w-[92px] text-right" },
  { key: "best", sortable: true, th: "w-[78px] text-right @max-3xl:hidden" },
  { key: "volume", sortable: true, th: "w-[96px] text-right" },
  { key: "trend", sortable: false, th: "w-[132px] text-right @max-3xl:w-[116px]" },
];
/** Count-up formatter that never shows a negative overshoot on the first frame. */
const int = (v: number) => String(Math.max(0, Math.round(v)));
const monoLabel = "font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.08em] text-ink-3";

const Tri = ({ dir, className }: { dir: "up" | "down"; className?: string }) => (
  <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden className={cx("size-[9px] shrink-0", className)}>
    <path d={dir === "up" ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} />
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden className="size-[13px] shrink-0 text-ink-3">
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </svg>
);

/* ---------------- row pieces ---------------- */

function PosBadge({ pos, L }: { pos: number | null; L: SeoLabels }) {
  const tier = pos == null ? "none" : pos <= 3 ? "top3" : pos <= 10 ? "top10" : "rest";
  return (
    <span title={pos == null ? L.notRankingLong : undefined}
      className={cx("inline-grid h-7 min-w-[38px] place-items-center rounded-lg px-2 font-mono text-[15px] font-semibold leading-none tracking-[-0.02em] tabular @max-xl:h-[26px] @max-xl:min-w-[34px] @max-xl:text-[14px]",
        tier === "top3" && "bg-[var(--srt)] text-[var(--srt-on)] shadow-[0_4px_10px_-4px_var(--srt)]",
        tier === "top10" && "bg-[color-mix(in_oklab,var(--srt)_13%,transparent)] text-[var(--srt-ink)]",
        tier === "rest" && "bg-sunken text-ink",
        tier === "none" && "text-[12px] text-ink-3 ring-1 ring-inset ring-line-strong")}>
      {pos == null ? "—" : pos}
      {pos == null && <span className="sr-only">{L.notRankingLong}</span>}
    </span>
  );
}

function Change({ r, L }: { r: RankRow; L: SeoLabels }) {
  if (r.isNew) return <span className="inline-flex rounded-md bg-[color-mix(in_oklab,var(--srt)_13%,transparent)] px-1.5 py-1 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.07em] text-[var(--srt-ink)]">{L.newLabel}</span>;
  if (r.isLost) return <span className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-[var(--srt-down)]"><Tri dir="down" />{L.lost}</span>;
  if (r.change == null || r.change === 0) return <span className="font-mono text-[13px] font-semibold text-ink-3">—{r.change === 0 && <span className="sr-only">{L.same}</span>}</span>;
  const up = r.change > 0;
  return (
    <span className={cx("inline-flex items-center gap-1 font-mono text-[13px] font-semibold tabular", up ? "text-[var(--srt-up)]" : "text-[var(--srt-down)]")}>
      <Tri dir={up ? "up" : "down"} />{Math.abs(r.change)}<span className="sr-only"> {up ? L.up : L.down}</span>
    </span>
  );
}

function Spark({ r, L, delay }: { r: RankRow; L: SeoLabels; delay: number }) {
  const preview = usePreviewMode();
  const W = 100, H = 28, P = 4, pts = r.history, n = pts.length;
  const tone = r.trend > 0 ? "var(--srt-up)" : r.trend < 0 ? "var(--srt-down)" : "var(--ink-3)";
  let d = "";
  if (n && r.min != null && r.max != null) {
    const lo = r.min, hi = r.max === r.min ? r.min + 1 : r.max;
    const x = (i: number) => (n > 1 ? P + (i * (W - P * 2)) / (n - 1) : W / 2);
    const y = (v: number) => (r.max === r.min ? H / 2 : P + ((v - lo) / (hi - lo)) * (H - P * 2));
    let pen = false;
    pts.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; pen = true; });
    const last = pts[n - 1];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${L.trend}: ${pts.map(v => (v == null ? "–" : v)).join(", ")}`}
        className="ml-auto block h-7 w-[100px] overflow-visible @max-xl:h-[26px] @max-xl:w-16">
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} className="stroke-line" strokeWidth={1} strokeDasharray="2 3" />
        <motion.path d={d.trim()} fill="none" stroke={tone} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
          initial={preview ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease, delay }} />
        {last != null && (
          <motion.circle cx={x(n - 1)} cy={y(last)} r={2.7} fill={tone} className="stroke-surface" strokeWidth={1.5}
            initial={preview ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.25, delay: delay + 0.7 }} />
        )}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${L.trend}: —`} className="ml-auto block h-7 w-[100px] @max-xl:h-[26px] @max-xl:w-16">
      <line x1={0} x2={W} y1={H - 1} y2={H - 1} className="stroke-line" strokeWidth={1} strokeDasharray="2 3" />
    </svg>
  );
}

function Facts({ r, L, weeks, locale }: { r: RankRow; L: SeoLabels; weeks: string[]; locale: string }) {
  const wk = (i: number) => (weeks[i] != null ? String(weeks[i]) : `W${i + 1}`);
  const firstIdx = r.history.findIndex(v => v != null);
  let moved = "—", tone: "up" | "down" | undefined;
  if (firstIdx >= 0 && r.pos != null) {
    const m = (r.history[firstIdx] as number) - r.pos;
    tone = m > 0 ? "up" : m < 0 ? "down" : undefined;
    moved = m === 0 ? L.same : `${m > 0 ? "▲" : "▼"} ${Math.abs(m)} ${Math.abs(m) === 1 ? L.position1 : L.positions}`;
    if (firstIdx > 0) moved += ` (${wk(firstIdx)})`;
  }
  const items: { k: string; v: string; wide?: boolean; mono?: boolean; tone?: "up" | "down" }[] = [
    { k: L.url, v: r.url || "—", wide: true, mono: true },
    { k: L.now, v: r.pos == null ? L.notRankingLong : `#${r.pos}` },
    { k: L.bestEver, v: r.best == null ? "—" : `#${r.best}` },
    { k: L.range, v: r.min == null ? "—" : r.min === r.max ? `#${r.min}` : `#${r.min} – #${r.max}` },
    { k: L.moved, v: moved, tone },
    { k: L.volumeLong, v: Math.round(r.volume).toLocaleString(locale) },
  ];
  return (
    <dl className="m-0 grid grid-cols-2 content-start border-t border-line">
      {items.map((it, i) => (
        <div key={it.k} className={cx("grid min-w-0 gap-1.5 border-b border-line py-3", it.wide ? "col-span-2" : i % 2 === 1 ? "pr-3" : "border-l pl-3")}>
          <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">{it.k}</dt>
          <dd className={cx("m-0 [overflow-wrap:anywhere] tabular", it.mono ? "font-mono text-[12.5px] font-medium" : "text-[14px] font-semibold",
            it.tone === "up" && "text-[var(--srt-up)]", it.tone === "down" && "text-[var(--srt-down)]")}>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- main ---------------- */

export function SeoRankingTracker({
  data, defaultSort = { key: "position", dir: "asc" }, defaultFilter = "all", labels, locale = "en-US", stickyOffset = 0, className,
  onKeywordSelect, onSortChange, onFilterChange,
}: SeoRankingTrackerProps) {
  const L = useMemo<SeoLabels>(() => ({ ...SEO_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const preview = usePreviewMode();
  const rootRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inView = useInView(rootRef, { amount: 0.1 });
  const show = inView || preview;
  const revealed = useRef(false);
  useEffect(() => { if (show) { const t = window.setTimeout(() => { revealed.current = true; }, 900); return () => window.clearTimeout(t); } }, [show]);

  const rows = useMemo(() => buildRows(data), [data]);
  const [filter, setFilterState] = useState<SeoFilter>(defaultFilter);
  const [sort, setSortState] = useState<SeoSort>(defaultSort);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) { setPrevData(data); setOpen(new Set()); }
  const [live, setLive] = useState("");
  const liveT = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(liveT.current), []);
  const announce = (msg: string) => setLive(prev => (prev === msg ? `${msg}​` : msg));

  const visible = useMemo(() => visibleRows(rows, filter, sort, query), [rows, filter, sort, query]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f, rows.filter(r => matches(r, f)).length])) as Record<SeoFilter, number>, [rows]);
  const weeks = data.weeks ?? [];
  const total = rows.length;

  // summary
  const now = rows.filter(r => r.pos != null), before = rows.filter(r => r.prev != null);
  const avg = now.length ? now.reduce((a, r) => a + (r.pos as number), 0) / now.length : null;
  const avgPrev = before.length ? before.reduce((a, r) => a + (r.prev as number), 0) / before.length : null;
  const avgDiff = avg != null && avgPrev != null ? Math.round((avgPrev - avg) * 10) / 10 : null;
  const t3 = counts.top3, t10 = counts.top10, up = counts.improved, dn = counts.declined;
  const buckets = [
    { label: "1–3", c: "var(--srt-d1)", n: rows.filter(r => r.pos != null && r.pos <= 3).length },
    { label: "4–10", c: "var(--srt-d2)", n: rows.filter(r => r.pos != null && r.pos > 3 && r.pos <= 10).length },
    { label: "11–20", c: "var(--srt-d3)", n: rows.filter(r => r.pos != null && r.pos > 10 && r.pos <= 20).length },
    { label: "21–100", c: "var(--srt-d4)", n: rows.filter(r => r.pos != null && r.pos > 20).length },
    { label: L.notRanking, c: "var(--srt-d5)", n: rows.filter(r => r.pos == null).length },
  ];

  const setFilter = (f: SeoFilter) => {
    if (f === filter) return;
    setFilterState(f);
    const shown = visibleRows(rows, f, sort, query).length;
    announce(fill(L.announceFilter, { n: shown }));
    onFilterChange?.({ filter: f, shown });
  };
  const setSort = (s: SeoSort) => {
    setSortState(s);
    announce(fill(L.announceSort, { col: L[s.key], dir: s.dir === "asc" ? L.asc : L.desc }));
    onSortChange?.(s);
  };
  const headerSort = (key: SeoSortKey) => setSort({ key, dir: sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : SORT_DEFAULT_DIR[key] });
  const onSearch = (v: string) => {
    setQuery(v);
    window.clearTimeout(liveT.current);
    liveT.current = window.setTimeout(() => announce(fill(L.announceFilter, { n: visibleRows(rows, filter, sort, v).length })), 500);
  };
  const clearAll = () => { setQuery(""); setFilterState("all"); if (filter !== "all") onFilterChange?.({ filter: "all", shown: visibleRows(rows, "all", sort, "").length }); searchRef.current?.focus(); };
  const toggle = (r: RankRow) => {
    const expanded = !open.has(r.id);
    setOpen(prev => { const next = new Set(prev); if (expanded) next.add(r.id); else next.delete(r.id); return next; });
    onKeywordSelect?.({ keyword: r.keyword, position: r.pos, change: r.change, best: r.best, url: r.url, volume: r.volume, expanded });
  };
  const sortValue = `${sort.key}:${sort.dir}`;
  const selectValue = SORT_OPTIONS.find(o => o[0] === sortValue)?.[0] ?? SORT_OPTIONS.find(o => o[0].startsWith(sort.key + ":"))?.[0] ?? SORT_OPTIONS[0][0];

  const td = "border-line px-3.5 py-3 align-middle tabular @max-xl:block @max-xl:border-0 @max-xl:p-0";
  const cellLabel = (t: string): ReactNode => <span aria-hidden className="mb-1.5 hidden font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.08em] text-ink-3 @max-xl:block">{t}</span>;

  return (
    <section ref={rootRef} aria-label={data.title || "SEO ranking tracker"}
      style={{ "--srt-top": `${stickyOffset}px` } as CSSProperties}
      className={cx("@container h-fit w-full max-w-[1080px] rounded-[22px] border border-line bg-surface p-4 text-ink elev-3 @md:p-5 @2xl:px-7 @2xl:pb-5 @2xl:pt-7",
        "[--srt:#15803D] [--srt-ink:#13703A] [--srt-on:#FFFFFF] [--srt-up:#15803D] [--srt-down:#B91C1C] [--srt-row:#F4F8F5] [--srt-open:#EFF6F1]",
        "[--srt-d1:#15803D] [--srt-d2:#4FAE6E] [--srt-d3:#A7D7B5] [--srt-d4:#D5E3DA] [--srt-d5:#EEF2EF]",
        "dark:[--srt:#4ADE80] dark:[--srt-ink:#6EE7A0] dark:[--srt-on:#062611] dark:[--srt-up:#4ADE80] dark:[--srt-down:#F87171] dark:[--srt-row:#151C18] dark:[--srt-open:#131D17]",
        "dark:[--srt-d1:#4ADE80] dark:[--srt-d2:#2FA65A] dark:[--srt-d3:#1F6B3C] dark:[--srt-d4:#2A3A31] dark:[--srt-d5:#1C2420]",
        className)}>
      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="grid min-w-0 gap-1.5">
          {data.eyebrow && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--srt-ink)]">
              <Icon name="search" className="size-[13px]" />{data.eyebrow}
            </span>
          )}
          {data.title && <h2 className="m-0 text-[clamp(19px,3.2cqi,24px)] font-semibold leading-[1.2] tracking-[-0.015em] text-balance">{data.title}</h2>}
          {data.site && <p className="m-0 font-mono text-[12.5px] leading-snug text-ink-2 [overflow-wrap:anywhere]">{data.site}</p>}
        </div>
        {data.period && (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-[7px] text-[12px] font-medium leading-none text-ink-2 tabular">
            <CalIcon />{data.period}
          </span>
        )}
      </header>

      {/* summary + spread */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-line">
        <dl className="m-0 grid grid-cols-2 @3xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
          <div className="grid content-start gap-2 px-4 py-3.5 @md:px-[18px]">
            <dt className={monoLabel}>{L.avg}</dt>
            <dd className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
              {avg == null ? <span className="font-mono text-[30px] font-semibold">—</span>
                : <CountUp value={avg} start={show} format={v => Math.max(0, v).toFixed(1)} className="font-mono text-[26px] font-semibold leading-none tracking-[-0.04em] @md:text-[30px]" />}
              {avgDiff != null && (
                <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold leading-none tabular",
                  avgDiff > 0 ? "bg-[color-mix(in_oklab,var(--srt-up)_13%,transparent)] text-[var(--srt-ink)]" : avgDiff < 0 ? "bg-[color-mix(in_oklab,var(--srt-down)_12%,transparent)] text-[var(--srt-down)]" : "bg-sunken text-ink-2")}>
                  {avgDiff === 0 ? L.same : <><Tri dir={avgDiff > 0 ? "up" : "down"} />{Math.abs(avgDiff).toFixed(1)} {avgDiff > 0 ? L.better : L.worse}</>}
                </span>
              )}
            </dd>
          </div>
          {[{ k: L.inTop3, v: t3, cls: "border-l" }, { k: L.inTop10, v: t10, cls: "border-t @3xl:border-l @3xl:border-t-0" }].map(s => (
            <div key={s.k} className={cx("grid content-start gap-2 border-line px-4 py-3.5 @md:px-[18px]", s.cls)}>
              <dt className={monoLabel}>{s.k}</dt>
              <dd className="m-0 grid gap-2">
                <span className="flex items-baseline gap-1.5">
                  <CountUp value={s.v} start={show} format={int} className="font-mono text-[26px] font-semibold leading-none tracking-[-0.04em] @md:text-[30px]" />
                  <span className="font-mono text-[12px] font-medium text-ink-3">/ {total}</span>
                </span>
                <span aria-hidden className="h-1 overflow-hidden rounded-full bg-sunken">
                  <motion.span className="block h-full rounded-full bg-[var(--srt)]" initial={preview ? false : { width: 0 }}
                    animate={{ width: show && total ? `${(s.v / total) * 100}%` : 0 }} transition={{ duration: 0.8, ease, delay: 0.2 }} />
                </span>
              </dd>
            </div>
          ))}
          <div className="grid content-start gap-2 border-l border-t border-line px-4 py-3.5 @md:px-[18px] @3xl:border-t-0">
            <dt className={monoLabel}>{L.thisWeek}</dt>
            <dd className="m-0 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              <span className="inline-flex items-baseline gap-1.5 font-mono text-[22px] font-semibold leading-none text-[var(--srt-up)] tabular">
                <Tri dir="up" className="self-center" /><CountUp value={up} start={show} format={int} /><small className="font-sans text-[11px] font-medium text-ink-3">{L.up}</small>
              </span>
              <span className="inline-flex items-baseline gap-1.5 font-mono text-[22px] font-semibold leading-none text-[var(--srt-down)] tabular">
                <Tri dir="down" className="self-center" /><CountUp value={dn} start={show} format={int} /><small className="font-sans text-[11px] font-medium text-ink-3">{L.down}</small>
              </span>
            </dd>
          </div>
        </dl>
        <div className="grid items-center gap-x-4 gap-y-2.5 border-t border-line bg-[color-mix(in_oklab,var(--srt)_4%,var(--surface-2))] px-4 py-3 @xl:grid-cols-[auto_minmax(0,1fr)] @md:px-[18px]">
          <span className={monoLabel}>{L.spread}</span>
          <div className="grid min-w-0 gap-2">
            <div aria-hidden className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-[var(--srt-d5)]">
              {buckets.map(b => (
                <motion.span key={b.label} className="h-full min-w-0 basis-0" style={{ background: b.c }}
                  initial={preview ? false : { flexGrow: 0 }} animate={{ flexGrow: show ? b.n : 0 }} transition={{ duration: 0.7, ease }} />
              ))}
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 text-[11.5px] font-medium text-ink-2">
              {buckets.filter((b, i) => b.n > 0 || i < 4).map(b => (
                <li key={b.label} className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="size-2 rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" style={{ background: b.c }} />
                  {b.label} <b className="font-mono font-semibold text-ink">{b.n}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5">
        <label className="relative min-w-0 flex-[1_1_220px] @3xl:max-w-[300px]">
          <span className="sr-only">{L.searchLabel}</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input ref={searchRef} type="search" value={query} autoComplete="off" spellCheck={false} placeholder={L.searchPlaceholder}
            onChange={e => onSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape" && query) { e.preventDefault(); onSearch(""); } }}
            className="h-9 w-full rounded-[10px] border border-line bg-surface pl-[33px] pr-9 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-[var(--srt)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--srt)_16%,transparent)] [&::-webkit-search-cancel-button]:appearance-none" />
          <AnimatePresence>
            {query && (
              <motion.button type="button" aria-label="Clear search" onClick={() => { onSearch(""); searchRef.current?.focus(); }}
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }}
                className="absolute right-1.5 top-1/2 -mt-3 grid size-6 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
                <Icon name="x" className="size-3" />
              </motion.button>
            )}
          </AnimatePresence>
        </label>
        <div role="group" aria-label={L.filterGroup} className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => {
            const on = f === filter;
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => setFilter(f)}
                className={cx("relative isolate inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-200",
                  on ? "border-transparent text-surface" : "border-line text-ink-2 hover:border-line-strong hover:text-ink")}>
                {on && <motion.span layoutId={`${uid}-chip`} className="absolute inset-0 -z-10 rounded-full bg-ink" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                {L[f]}
                <b className={cx("rounded-[5px] px-[5px] py-[3px] font-mono text-[11px] font-semibold leading-none tabular transition-colors", on ? "bg-surface/20 text-surface" : "bg-sunken text-ink-2")}>{counts[f]}</b>
              </button>
            );
          })}
        </div>
        <label className="flex w-full items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 @xl:hidden">
          {L.sortBy}
          <select value={selectValue} onChange={e => { const [k, d] = e.target.value.split(":"); setSort({ key: k as SeoSortKey, dir: d === "desc" ? "desc" : "asc" }); }}
            className="h-[34px] min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 font-sans text-[13px] font-medium normal-case tracking-normal text-ink">
            {SORT_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>

      {/* table */}
      <div className="mt-3 overflow-clip rounded-2xl border border-line">
        <table className="w-full border-separate border-spacing-0 text-[14px] @max-xl:block">
          <thead className="@max-xl:hidden">
            <tr>
              {COLS.map(c => {
                const on = c.sortable && sort.key === c.key;
                const num = c.key !== "keyword";
                return (
                  <th key={c.key} scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cx("sticky top-[var(--srt-top)] z-10 whitespace-nowrap border-b border-line bg-surface-2 p-0 text-left align-middle font-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3", c.th)}>
                    {c.sortable ? (
                      <button type="button" onClick={() => headerSort(c.key as SeoSortKey)}
                        className={cx("flex w-full items-center gap-1.5 px-3.5 py-3 uppercase tracking-[inherit] transition-colors hover:text-ink focus-visible:-outline-offset-2", num && "justify-end", on && "text-ink")}>
                        <span>{L[c.key as SeoSortKey]}</span>
                        <motion.svg viewBox="0 0 9 11" fill="currentColor" aria-hidden className={cx("h-[11px] w-[9px] shrink-0", on ? "text-[var(--srt)]" : "opacity-45")}
                          animate={{ rotate: on && sort.dir === "desc" ? 180 : 0 }} transition={{ duration: 0.25 }}>
                          <path d="M4.5 0 9 5H0z" /><path d="M4.5 11 0 6h9z" opacity={on ? 0.3 : 0.35} />
                        </motion.svg>
                      </button>
                    ) : <span className="block px-3.5 py-3">{L.trend}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="@max-xl:block">
            {visible.map((r, i) => {
              const isOpen = open.has(r.id);
              const detailId = `${uid}-d${r.id}`;
              const first = i === 0;
              const bt = first ? "" : "border-t";
              const delay = revealed.current || preview ? 0 : Math.min(i, 12) * 0.035;
              return (
                <Fragment key={r.key}>
                  <motion.tr layout="position" initial={preview ? false : { opacity: 0, y: 6 }} animate={show ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.4, ease, delay, layout: { type: "spring", stiffness: 500, damping: 42 } }}
                    className={cx("group/row transition-colors duration-200", isOpen ? "bg-[var(--srt-open)]" : "hover:bg-[var(--srt-row)]",
                      "@max-xl:grid @max-xl:grid-cols-4 @max-xl:gap-x-2 @max-xl:gap-y-3.5 @max-xl:border-line @max-xl:px-3.5 @max-xl:py-3.5", !first && "@max-xl:border-t")}>
                    <td className={cx(td, bt, "@max-xl:col-span-3")}>
                      <button type="button" aria-expanded={isOpen} aria-controls={detailId} aria-label={fill(L.expand, { kw: r.keyword })} onClick={() => toggle(r)}
                        className="group/kw -my-0.5 grid w-full grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5 rounded-lg py-0.5 pr-1 text-left">
                        <motion.span aria-hidden animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className={cx("mt-px grid size-[18px] place-items-center rounded-[5px] transition-colors duration-200",
                            isOpen ? "bg-[var(--srt)] text-[var(--srt-on)]" : "bg-sunken text-ink-3 group-hover/kw:text-[var(--srt-ink)]")}>
                          <Icon name="chevronRight" className="size-2.5" strokeWidth={2} />
                        </motion.span>
                        <span className="grid min-w-0 gap-1">
                          <span className="text-[14px] font-semibold leading-[1.3] decoration-line-strong underline-offset-[3px] [overflow-wrap:anywhere] group-hover/kw:underline">{r.keyword}</span>
                          {(r.url || r.intent) && (
                            <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] leading-[1.3] text-ink-2 [overflow-wrap:anywhere]">
                              {r.url && <span>{r.url}</span>}
                              {r.intent && <span className="rounded-[4px] border border-line px-[5px] py-[3px] font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-3">{r.intent}</span>}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className={cx(td, bt, "text-right @max-xl:text-left")}>{cellLabel(L.position)}<PosBadge pos={r.pos} L={L} /></td>
                    <td className={cx(td, bt, "text-right @max-xl:text-left")}>{cellLabel(L.change)}<Change r={r} L={L} /></td>
                    <td className={cx(td, bt, "text-right @max-3xl:hidden @max-xl:block! @max-xl:text-left")}>
                      {cellLabel(L.best)}
                      <span className="font-mono text-[13px] font-medium text-ink-2">{r.best != null ? <>#<b className="font-semibold text-ink">{r.best}</b></> : "—"}</span>
                    </td>
                    <td className={cx(td, bt, "text-right @max-xl:text-left")}>{cellLabel(L.volume)}<span className="font-mono text-[13px] font-medium text-ink-2">{Math.round(r.volume).toLocaleString(locale)}</span></td>
                    <td className={cx(td, bt, "@max-xl:col-start-4 @max-xl:row-start-1 @max-xl:self-start")}><Spark r={r} L={L} delay={delay + 0.15} /></td>
                  </motion.tr>
                  <motion.tr layout="position" id={detailId} transition={{ layout: { type: "spring", stiffness: 500, damping: 42 } }} className="@max-xl:block">
                    <td colSpan={COLS.length} className="p-0 @max-xl:block">
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key="detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.34, ease }, opacity: { duration: 0.22 } }} className="overflow-hidden bg-[var(--srt-open)]">
                            <div className="grid gap-x-7 gap-y-4 pb-5 pl-4 pr-4 pt-1.5 @xl:pl-12 @xl:pr-5 @3xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] @max-xl:px-3.5 @max-xl:pb-4">
                              <RankChart r={r} weeks={weeks} L={L} announce={announce} />
                              <Facts r={r} L={L} weeks={weeks} locale={locale} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </motion.tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <AnimatePresence initial={false}>
          {visible.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="grid justify-items-center gap-3 px-4 py-9 text-center text-[13.5px] text-ink-2">
              <span aria-hidden className="grid size-10 place-items-center rounded-full bg-sunken text-ink-3"><Icon name="search" className="size-4" /></span>
              <span>{L.empty}</span>
              <button type="button" onClick={clearAll}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-[var(--srt)] hover:text-[var(--srt-ink)]">{L.clear}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-[12px] text-ink-3">
        <span className="tabular">{fill(L.showing, { shown: visible.length, total })}</span>
        {data.source && <span>{data.source}</span>}
      </footer>
      <p className="sr-only" aria-live="polite">{live}</p>
    </section>
  );
}
