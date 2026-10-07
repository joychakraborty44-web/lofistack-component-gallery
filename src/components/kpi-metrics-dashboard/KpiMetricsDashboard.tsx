import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { Segmented, cx } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { KpiData, KpiMetric, KpiPeriod } from "./data";
import {
  SAMPLES, VB_H, calcMetric, deltaOf, formatValue, geometry, pointLabel, rangeLabel, resample, paths,
  type Geometry, type KpiCalc, type KpiDelta,
} from "./model";

/* ------------------------------------------------------------
   KPI Metrics Dashboard — a bento grid with one hero metric and
   compact tiles. Period switch tweens numbers + morphs sparklines;
   clicking a tile pins it into the hero slot (FLIP via `layout`).
   ------------------------------------------------------------ */

export interface KpiSelectDetail {
  id: string;
  label: string;
  period: string;
  value: number | null;
  previous: number | null;
}

export interface KpiMetricsDashboardProps {
  data: KpiData;
  /** Controlled period id. */
  period?: string;
  /** Initial period id when uncontrolled (default: the first period). */
  defaultPeriod?: string;
  onPeriodChange?: (period: string) => void;
  /** Controlled id of the metric in the hero slot. */
  hero?: string;
  /** Initial hero metric when uncontrolled (default: the first visible metric). */
  defaultHero?: string;
  /** Fires when a tile is pinned into the hero slot. */
  onSelect?: (detail: KpiSelectDetail) => void;
  className?: string;
}

const THEME = [
  "[--acc:#0891b2] [--acc-ink:#0e7490] [--good:#15803d] [--bad:#b91c1c] [--well:#eaecef] [--grid:rgb(17_19_24/0.09)]",
  "dark:[--acc:#22d3ee] dark:[--acc-ink:#67e8f9] dark:[--good:#4ade80] dark:[--bad:#f87171] dark:[--well:#0b0c10] dark:[--grid:rgb(255_255_255/0.08)]",
].join(" ");

const EASE: [number, number, number, number] = [0.2, 0.75, 0.2, 1];
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/* ---------- number + sparkline tween ---------- */
interface MorphState { v: number | null; s: number[]; running: boolean; target: number[] }
function useMorph(value: number | null, ys: number[], animate: boolean): MorphState {
  const target = useMemo(() => resample(ys, SAMPLES), [ys]);
  const [state, setState] = useState<MorphState>({ v: value, s: target, running: false, target });
  const cur = useRef(state);
  useEffect(() => {
    const from = cur.current;
    if (from.target === target && from.v === value) return;
    const done = { v: value, s: target, running: false, target };
    if (!animate) { cur.current = done; setState(done); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / 460));
      if (k >= 1) { cur.current = done; setState(done); return; }
      const n: MorphState = {
        v: from.v !== null && value !== null ? from.v + (value - from.v) * k : value,
        s: target.map((y, i) => from.s[i] + (y - from.s[i]) * k),
        running: true,
        target,
      };
      cur.current = n;
      setState(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, target, animate]);
  return state;
}

/* ---------- small glyphs ---------- */
const TriUp = () => <svg viewBox="0 0 10 10" className="size-2" aria-hidden><path d="M5 1.5 9 8H1z" fill="currentColor" /></svg>;
const TriDown = () => <svg viewBox="0 0 10 10" className="size-2" aria-hidden><path d="M5 8.5 1 2h8z" fill="currentColor" /></svg>;
const PinGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-2.5" aria-hidden>
    <path d="M4.2 1.5h3.6L7.3 4.6l2 1.9H2.7l2-1.9zM6 6.5v4" />
  </svg>
);

function DeltaBadge({ d, big }: { d: KpiDelta | null; big?: boolean }) {
  if (!d) return null;
  return (
    <span className={cx(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-md font-semibold tabular",
      big ? "px-2 py-1 text-[13px]" : "px-1.5 py-[3px] text-[11.5px]",
      d.tone === "good" && "bg-[color-mix(in_oklab,var(--good)_12%,transparent)] text-[var(--good)]",
      d.tone === "bad" && "bg-[color-mix(in_oklab,var(--bad)_12%,transparent)] text-[var(--bad)]",
      d.tone === "flat" && "bg-sunken text-ink-2",
    )}>
      {d.r > 0 ? <TriUp /> : d.r < 0 ? <TriDown /> : null}
      {d.text}
    </span>
  );
}

/* ---------- sparkline ---------- */
interface SparkProps {
  data: KpiData;
  metric: KpiMetric;
  period: KpiPeriod;
  calc: KpiCalc;
  geo: Geometry;
  morph: MorphState;
  hero: boolean;
  onActivate: () => void;
  onRead: (text: string) => void;
  className?: string;
}

function Sparkline({ data, metric, period, calc, geo, morph, hero, onActivate, onRead, className }: SparkProps) {
  const gid = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const focused = useRef(false);
  const n = calc.points.length;
  const unit = (period.bucket || 1) === 1 ? "day" : `${period.bucket}-day block`;

  const shownYs = morph.running ? morph.s : geo.ys;
  const p = useMemo(() => paths(shownYs), [shownYs]);
  const i = idx === null ? null : Math.min(Math.max(0, idx), n - 1);
  const x = i === null || !n ? 0 : n === 1 ? 50 : (i / (n - 1)) * 100;
  const y = i === null ? 0 : geo.ys[i] ?? 0;
  const showRead = reading && i !== null && n > 0 && !morph.running;

  const fromX = (e: PointerEvent) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || !r.width || !n) return 0;
    return Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (n - 1));
  };
  const read = (k: number) => {
    if (!n) return null;
    const j = Math.max(0, Math.min(n - 1, k));
    setIdx(j);
    setReading(true);
    return j;
  };
  const onKey = (e: KeyboardEvent) => {
    const cur = i ?? n - 1;
    const map: Record<string, number> = { ArrowLeft: cur - 1, ArrowDown: cur - 1, ArrowRight: cur + 1, ArrowUp: cur + 1, Home: 0, End: n - 1 };
    if (e.key in map) {
      e.preventDefault();
      const j = read(map[e.key]);
      if (j !== null) onRead(`${formatValue(data, metric, calc.points[j])}, ${pointLabel(data, period, j, n)}`);
    } else if ((e.key === "Enter" || e.key === " ") && !hero) {
      e.preventDefault();
      onActivate();
    }
  };

  const tx = x < 18 ? "-12%" : x > 82 ? "-88%" : "-50%";

  return (
    <div
      tabIndex={0}
      role="group"
      aria-roledescription="sparkline"
      aria-label={`${metric.label} by ${unit}, ${n} points. Use the arrow keys to read values.`}
      onPointerMove={e => read(fromX(e))}
      onPointerDown={e => read(fromX(e))}
      onPointerLeave={() => { if (!focused.current) setReading(false); }}
      onFocus={() => { focused.current = true; read(i ?? n - 1); }}
      onBlur={() => { focused.current = false; setReading(false); }}
      onClick={() => { if (!hero) onActivate(); }}
      onKeyDown={onKey}
      className={cx("group/chart relative z-[1] cursor-crosshair touch-pan-y outline-none", className)}
    >
      <div ref={plotRef} className="relative h-full rounded-md group-focus-visible/chart:outline-2 group-focus-visible/chart:outline-offset-4 group-focus-visible/chart:outline-[var(--acc)]">
        {hero && [10, 50, 90].map(t => (
          <span key={t} aria-hidden className="absolute inset-x-0 h-0 border-t border-dashed border-[var(--grid)]" style={{ top: `${t}%` }} />
        ))}
        <svg viewBox={`0 0 100 ${VB_H}`} preserveAspectRatio="none" aria-hidden
          className={cx("absolute inset-0 size-full overflow-visible transition-colors duration-300",
            hero ? "text-[var(--acc)]" : "text-ink-3/80 group-hover:text-[var(--acc)] group-focus-visible/chart:text-[var(--acc)]")}>
          <defs>
            <linearGradient id={`${gid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={hero ? 0.26 : 0.16} />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={p.area} fill={`url(#${gid}-fill)`} />
          <path d={p.line} fill="none" stroke="currentColor" strokeWidth={hero ? 2.25 : 1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {hero && geo.prevY !== null && (
          <span aria-hidden className="absolute inset-x-0 h-0 border-t-[1.5px] border-dashed border-ink-3/60 transition-[top] duration-500 ease-out motion-reduce:transition-none"
            style={{ top: `${(geo.prevY / VB_H) * 100}%` }}>
            <span className="absolute bottom-1 right-0 whitespace-nowrap rounded bg-surface/90 px-1.5 py-0.5 font-mono text-[10.5px] tabular text-ink-3">
              Prev. avg {formatValue(data, metric, geo.prevAvg)}
            </span>
          </span>
        )}

        <span aria-hidden className={cx("pointer-events-none absolute inset-y-0 w-0 border-l border-ink/30 transition-opacity duration-150", showRead ? "opacity-100" : "opacity-0")} style={{ left: `${x}%` }} />
        <span aria-hidden
          className={cx("pointer-events-none absolute box-border rounded-full border-[var(--acc)] bg-surface transition-opacity duration-150",
            hero ? "-ml-1.5 -mt-1.5 size-3 border-[2.5px] shadow-[0_0_0_4px_color-mix(in_oklab,var(--acc)_18%,transparent)]" : "-ml-[4.5px] -mt-[4.5px] size-[9px] border-2",
            showRead ? "opacity-100" : "opacity-0")}
          style={{ left: `${x}%`, top: `${(y / VB_H) * 100}%` }} />
        <span aria-hidden
          className={cx("pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-canvas shadow-lg transition-[opacity,translate] duration-150",
            showRead ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")}
          style={{ left: `${x}%`, transform: `translateX(${tx})` }}>
          {i !== null && n > 0 && (
            <>
              <b className="block text-[13px] font-semibold tabular">{formatValue(data, metric, calc.points[i])}</b>
              <small className="block text-[10.5px] opacity-75">{pointLabel(data, period, i, n)}</small>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* ---------- tile ---------- */
interface TileProps {
  data: KpiData;
  metric: KpiMetric;
  period: KpiPeriod;
  calc: KpiCalc;
  hero: boolean;
  wide: boolean;
  index: number;
  animate: boolean;
  entrance: boolean;
  onPick: () => void;
  onRead: (t: string) => void;
}

function noteFor(data: KpiData, m: KpiMetric, c: KpiCalc, days: number) {
  if (c.parts) {
    const of = `${formatValue(data, c.parts.of, c.parts.ofValue)} ${c.parts.of.label.toLowerCase()}`;
    const per = `${formatValue(data, c.parts.per, c.parts.perValue)} ${c.parts.per.label.toLowerCase()}`;
    return m.format === "percent" ? `${of} of ${per}` : `${of} ÷ ${per}`;
  }
  return c.previous !== null ? `vs ${formatValue(data, m, c.previous)} previous ${days} days` : "";
}

function Tile({ data, metric, period, calc, hero, wide, index, animate, entrance, onPick, onRead }: TileProps) {
  const geo = useMemo(() => geometry(metric, calc), [metric, calc]);
  const morph = useMorph(calc.value, geo.ys, animate);
  const d = deltaOf(metric, calc);
  const note = noteFor(data, metric, calc, period.days);
  const summary = `${formatValue(data, metric, calc.value)}${d ? `, ${d.r > 0 ? "up" : d.r < 0 ? "down" : "unchanged"} ${d.text}` : ""}. ${note}`;
  const label = metric.label;
  const n = calc.points.length;
  const hiI = n ? calc.points.indexOf(Math.max(...calc.points)) : -1;
  const loI = n ? calc.points.indexOf(Math.min(...calc.points)) : -1;
  const unit = (period.bucket || 1) === 1 ? "day" : `${period.bucket}-day block`;
  const shownValue = formatValue(data, metric, morph.v);

  const pick = (
    <button type="button" onClick={onPick} aria-pressed={hero}
      aria-label={`${hero ? `${label} is in the main tile` : `Move ${label} into the main tile`}. ${summary}`}
      className={cx("inline-flex min-w-0 items-center gap-2 text-left font-semibold outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--acc)]",
        hero ? "cursor-default text-[14px] text-ink" : "text-[13px] text-ink-2")}>
      <span aria-hidden className={cx("size-2 shrink-0 rounded-full transition-colors duration-300",
        hero ? "bg-[var(--acc)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc)_18%,transparent)]" : "bg-ink-3/70 group-hover:bg-[var(--acc)]")} />
      <span className="truncate">{label}</span>
    </button>
  );
  const pin = (
    <span aria-hidden className={cx("shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200",
      hero ? "inline-flex bg-[color-mix(in_oklab,var(--acc)_14%,transparent)] text-[var(--acc-ink)]"
        : "hidden translate-y-[-2px] bg-sunken text-ink-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 @md:inline-flex")}>
      <PinGlyph />{hero ? "Pinned" : "Pin"}
    </span>
  );

  return (
    <motion.article
      layout
      style={{ borderRadius: 16 }}
      initial={entrance ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: { duration: 0.45, ease: EASE }, default: { duration: 0.5, ease: EASE, delay: entrance ? 0.06 * index : 0 } }}
      className={cx("group relative flex min-w-0 flex-col border bg-surface",
        hero
          ? "col-span-2 border-[color-mix(in_oklab,var(--acc)_28%,var(--line))] elev-2 @3xl:row-span-2"
          : "border-line elev-1 transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_oklab,var(--acc)_45%,var(--line))] hover:shadow-[0_14px_28px_-22px_rgb(15_23_42/0.45)]",
        wide && !hero && "col-span-2 @3xl:col-span-1")}
    >
      {hero && (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(120%_75%_at_100%_0%,color-mix(in_oklab,var(--acc)_14%,transparent),transparent_60%)]" />
      )}
      <motion.div
        layout
        key={hero ? "hero" : "tile"}
        initial={animate && !entrance ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ opacity: { duration: 0.3, delay: 0.16 }, layout: { duration: 0.45, ease: EASE } }}
        className={cx("relative flex flex-1 flex-col",
          hero ? "p-4 @md:p-5 @3xl:p-6" : "p-3 @md:p-4",
          wide && !hero && "@max-3xl:grid @max-3xl:grid-cols-[minmax(0,1fr)_42%] @max-3xl:gap-x-4")}
      >
        {hero ? (
          <>
            <div className="flex items-center justify-between gap-2">{pick}{pin}</div>
            <div className="mt-3 grid gap-x-6 gap-y-4 @xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0" aria-hidden>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <span className="whitespace-nowrap font-display text-[40px] font-semibold leading-none tracking-[-0.04em] tabular @3xl:text-[54px]">{shownValue}</span>
                  <DeltaBadge d={d} big />
                </div>
                <p className="mt-2.5 text-[13px] text-ink-2 tabular">{note}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 @xl:min-w-[150px] @xl:grid-cols-1 @xl:self-end @xl:border-l @xl:border-t-0 @xl:pl-5 @xl:pt-0">
                {([["High", hiI], ["Low", loI]] as const).map(([k, at]) => (
                  <div key={k} className="grid min-w-0 gap-1">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{k} · {unit}</dt>
                    <dd className="text-[14px] font-semibold tabular">
                      {formatValue(data, metric, at >= 0 ? calc.points[at] : null)}
                      <small className="block text-[11.5px] font-normal text-ink-3">{at >= 0 ? pointLabel(data, period, at, n) : ""}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <Sparkline data={data} metric={metric} period={period} calc={calc} geo={geo} morph={morph} hero onActivate={onPick} onRead={onRead}
              className="mt-5 h-[150px] @xl:h-[170px] @3xl:h-auto @3xl:min-h-[130px] @3xl:flex-1" />
            <div aria-hidden className="mt-2.5 flex justify-between gap-2 font-mono text-[10.5px] text-ink-3 tabular">
              <span>{n ? pointLabel(data, period, 0, n) : ""}</span>
              <span>{n > 1 ? pointLabel(data, period, n - 1, n) : ""}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-[22px] items-center justify-between gap-2">{pick}{pin}</div>
            <div aria-hidden className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1.5 @md:mt-2.5">
              <span className="whitespace-nowrap font-display text-[21px] font-semibold leading-none tracking-[-0.03em] tabular @md:text-[27px]">{shownValue}</span>
              <DeltaBadge d={d} />
            </div>
            <p aria-hidden className="mt-1.5 text-[11.5px] leading-snug text-ink-3 tabular [overflow-wrap:anywhere] @md:text-[12px]">{note}</p>
            <Sparkline data={data} metric={metric} period={period} calc={calc} geo={geo} morph={morph} hero={false} onActivate={onPick} onRead={onRead}
              className={cx(wide ? "@max-3xl:col-start-2 @max-3xl:row-span-3 @max-3xl:row-start-1 @max-3xl:my-auto @max-3xl:h-14" : "", "mt-auto h-11 shrink-0 pt-3 @md:h-14")} />
          </>
        )}
      </motion.div>
    </motion.article>
  );
}

/* ---------- dashboard ---------- */
export function KpiMetricsDashboard({ data, period, defaultPeriod, onPeriodChange, hero, defaultHero, onSelect, className }: KpiMetricsDashboardProps) {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const titleId = useId();
  const periods = data.periods.length ? data.periods : [{ id: "30d", label: "30D", days: 30, bucket: 1 }];
  const visible = useMemo(() => data.metrics.filter(m => !m.hidden), [data]);

  const [innerPeriod, setInnerPeriod] = useState(() => period ?? defaultPeriod ?? periods[0].id);
  const pid = periods.some(p => p.id === (period ?? innerPeriod)) ? (period ?? innerPeriod) : periods[0].id;
  const pObj = periods.find(p => p.id === pid) ?? periods[0];

  const initialHero = hero ?? defaultHero ?? visible[0]?.id;
  const [order, setOrder] = useState<string[]>(() => {
    const h = visible.some(m => m.id === initialHero) ? initialHero : visible[0]?.id;
    return h ? [h, ...visible.map(m => m.id).filter(id => id !== h)] : [];
  });
  const swapIn = (list: string[], id: string) => {
    const i = list.indexOf(id);
    if (i <= 0) return list;
    const next = [...list];
    next[i] = next[0];
    next[0] = id;
    return next;
  };
  // follow a controlled `hero` prop (e.g. "Reset layout")
  const [seenHero, setSeenHero] = useState(hero);
  if (hero !== seenHero) {
    setSeenHero(hero);
    if (hero && order[0] !== hero && order.includes(hero)) setOrder(swapIn(order, hero));
  }
  const heroId = order[0];

  const [announce, setAnnounce] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const calcs = useMemo(() => {
    const out: Record<string, KpiCalc> = {};
    visible.forEach(m => { out[m.id] = calcMetric(data, m, pid); });
    return out;
  }, [data, visible, pid]);

  const choosePeriod = (id: string) => {
    if (id === pid) return;
    setInnerPeriod(id);
    const p = periods.find(x => x.id === id);
    setAnnounce(`Showing the last ${p?.days ?? ""} days`);
    onPeriodChange?.(id);
  };

  const pin = (id: string) => {
    if (id === heroId) return;
    const m = visible.find(x => x.id === id);
    if (!m) return;
    if (hero === undefined) setOrder(o => swapIn(o, id));
    setAnnounce(`${m.label} moved to the main tile`);
    const c = calcs[id];
    onSelect?.({ id, label: m.label, period: pid, value: c.value, previous: c.previous });
  };

  const smallCount = order.length - 1;
  const animate = !reduced && !preview && mounted;
  const entrance = !preview && !mounted;

  return (
    <div className={cx("@container w-full max-w-[1080px]", className)}>
      <section aria-labelledby={titleId}
        className={cx(THEME, "relative w-full rounded-[22px] border border-line bg-[var(--well)] p-2.5 text-ink elev-3 @md:p-4 @3xl:p-5")}>
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1.5 pb-4 pt-1.5 @3xl:pb-5">
          <div className="grid min-w-0 gap-1.5">
            {data.eyebrow && (
              <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--acc-ink)]">
                <span aria-hidden className="size-[7px] rounded-[2px] bg-[var(--acc)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc)_18%,transparent)]" />
                {data.eyebrow}
              </span>
            )}
            {data.title && <h2 id={titleId} className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] @3xl:text-[24px]">{data.title}</h2>}
            {data.subtitle && <p className="text-[13.5px] text-ink-2">{data.subtitle}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 @lg:w-auto @lg:justify-end">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink-2 tabular">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3.5 text-ink-3" aria-hidden>
                <rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
              </svg>
              <motion.span key={pid} initial={animate ? { opacity: 0, y: 3 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                {rangeLabel(data, pObj)}
              </motion.span>
            </span>
            <Segmented
              ariaLabel="Period"
              value={pid}
              onChange={choosePeriod}
              options={periods.map(p => ({
                value: p.id,
                label: <><span aria-hidden>{p.label}</span><span className="sr-only">Last {p.days} days</span></>,
              }))}
              className="border-line bg-surface"
              buttonClassName="min-w-[46px] font-mono text-[12.5px]! font-semibold tracking-[0.02em]"
              activeClassName="text-surface!"
              indicatorClassName="bg-ink!"
            />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 @md:gap-2.5 @3xl:grid-cols-3 @3xl:auto-rows-[minmax(150px,auto)] @3xl:gap-3">
          {order.map((id, i) => {
            const m = visible.find(x => x.id === id);
            if (!m) return null;
            const isHero = i === 0;
            const wide = !isHero && smallCount % 2 === 1 && i === order.length - 1;
            return (
              <Tile key={id} data={data} metric={m} period={pObj} calc={calcs[id]} hero={isHero} wide={wide} index={i}
                animate={animate} entrance={entrance} onPick={() => pin(id)} onRead={setAnnounce} />
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-1.5 pb-0.5 pt-4 text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <PinGlyph />Click a tile to pin it · arrow keys read a chart
          </span>
          {data.source && <span>{data.source}</span>}
        </footer>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </section>
    </div>
  );
}
