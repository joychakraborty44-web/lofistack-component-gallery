import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCountUp, useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { Segmented, cx } from "../../ui";
import type { RevenueChartData, RevenueRange } from "./data";

/* ------------------------------------------------------------
   Revenue Growth Chart — forest-green area chart with a last-year
   comparison, running-total view and a keyboard crosshair.
   ------------------------------------------------------------ */

export interface RevenueGrowthChartHandle {
  /** Re-run the line-draw animation. */
  replay: () => void;
}

export interface RevenueGrowthChartProps {
  data: RevenueChartData;
  /** Controlled range; leave out to let the chart manage it. */
  range?: RevenueRange;
  defaultRange?: RevenueRange;
  /** Show last year as a dashed line. */
  compare?: boolean;
  defaultCompare?: boolean;
  /** Draw a running total instead of monthly values. */
  cumulative?: boolean;
  defaultCumulative?: boolean;
  onRangeChange?: (detail: { range: RevenueRange; total: number; growth: number | null }) => void;
  onViewChange?: (detail: { compare: boolean; cumulative: boolean }) => void;
  ref?: Ref<RevenueGrowthChartHandle>;
  className?: string;
}

const PALETTE = cx(
  "[--rg-card:#fffdf6] [--rg-ink:#14231a] [--rg-muted:#4b584f] [--rg-faint:#5c685f] [--rg-line:#e6e2d3] [--rg-grid:#ece8da] [--rg-tint:#f4f1e6]",
  "[--rg-accent:#166534] [--rg-accent-2:#22a55a] [--rg-prev:#7d857f] [--rg-good:#166534] [--rg-bad:#b42318]",
  "[--rg-tip:#14231a] [--rg-tip-ink:#f4f7f2] [--rg-tip-muted:#b9c6bd] [--rg-tip-good:#86efac] [--rg-tip-bad:#fca5a5]",
  "dark:[--rg-card:#101913] dark:[--rg-ink:#e6efe8] dark:[--rg-muted:#a3b3a8] dark:[--rg-faint:#8a9a90] dark:[--rg-line:#24322a] dark:[--rg-grid:#1b271f] dark:[--rg-tint:#16211a]",
  "dark:[--rg-accent:#4ade80] dark:[--rg-accent-2:#86efac] dark:[--rg-prev:#7a8a80] dark:[--rg-good:#4ade80] dark:[--rg-bad:#ff8a7a]",
  "dark:[--rg-tip:#e6efe8] dark:[--rg-tip-ink:#0f1712] dark:[--rg-tip-muted:#43544a] dark:[--rg-tip-good:#166534] dark:[--rg-tip-bad:#b42318]",
);

/* ---------------- maths ---------------- */
/** Monotone cubic (Fritsch–Carlson): smooth, never overshoots the data. */
function smooth(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(2)},${(pts[i][1] + t[i] * h).toFixed(2)} ${(pts[i + 1][0] - h).toFixed(2)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(2)} ${pts[i + 1][0].toFixed(2)},${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}
function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s >= raw) ?? 10 * p;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

type Frame = { lo: number; hi: number; cur: number[]; prev: number[]; yMax: number };

function useControllable<T>(value: T | undefined, initial: T): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(initial);
  const set = useCallback((n: T) => { if (value === undefined) setInner(n); }, [value]);
  return [value !== undefined ? value : inner, set];
}

/* ============================================================ */
export function RevenueGrowthChart({
  data, range: rangeProp, defaultRange = "12m", compare: compareProp, defaultCompare = false, cumulative: cumProp, defaultCumulative = false,
  onRangeChange, onViewChange, ref, className,
}: RevenueGrowthChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const started = inView || preview;

  const [range, setRange] = useControllable<RevenueRange>(rangeProp, defaultRange);
  const [compare, setCompare] = useControllable<boolean>(compareProp, defaultCompare);
  const [cumulative, setCumulative] = useControllable<boolean>(cumProp, defaultCumulative);
  const [drawKey, setDrawKey] = useState(0);
  useImperativeHandle(ref, () => ({ replay: () => setDrawKey(k => k + 1) }), []);

  /* ---- formatting ---- */
  const locale = data.locale ?? "en-US";
  const currency = (data.currency ?? "USD").toUpperCase();
  const fmt = useMemo(() => {
    const mk = (o: Intl.NumberFormatOptions) => { try { return new Intl.NumberFormat(locale, { style: "currency", currency, ...o }); } catch { return null; } };
    const full = mk({ maximumFractionDigits: 0 }), c1 = mk({ notation: "compact", maximumFractionDigits: 1 });
    const money = (v: number) => full ? full.format(v) : `${currency} ${Math.round(v).toLocaleString()}`;
    const compact = (v: number) => c1 ? c1.format(v) : money(v);
    const month = (m: string, style: "short" | "mid" | "long" = "short") => {
      const r = /^(\d{4})-(\d{2})/.exec(m);
      if (!r) return m;
      const opt: Intl.DateTimeFormatOptions = style === "long" ? { month: "long", year: "numeric" } : style === "mid" ? { month: "short", year: "numeric" } : { month: "short" };
      try { return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opt }).format(Date.UTC(+r[1], +r[2] - 1, 1)); } catch { return m; }
    };
    const pct = (r: number | null, signed = false) => {
      if (r == null || !Number.isFinite(r)) return "—";
      const s = (Math.abs(r) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
      return signed ? (r > 0 ? "+" : r < 0 ? "−" : "") + s : s;
    };
    return { money, compact, month, pct };
  }, [locale, currency]);

  /* ---- data model ---- */
  const all = useMemo(() => (data.series ?? []).filter(p => p && Number.isFinite(p.revenue))
    .map(p => ({ month: String(p.month), revenue: Math.max(0, p.revenue), lastYear: p.lastYear != null && Number.isFinite(p.lastYear) ? p.lastYear : null })), [data.series]);
  const len = all.length;
  const n = Math.min(len, range === "6m" ? 6 : 12);
  const start = len - n;
  const pts = all.slice(start);
  const hasPrev = n > 0 && pts.every(p => p.lastYear != null);
  const showPrev = compare && hasPrev;

  const target = useMemo<Frame>(() => {
    let a = 0, b = 0;
    const cur = all.map((p, i) => (cumulative ? (i < start ? all[start]?.revenue ?? 0 : (a += p.revenue)) : p.revenue));
    const prev = all.map((p, i) => (cumulative ? (i < start ? all[start]?.lastYear ?? 0 : (b += p.lastYear ?? 0)) : p.lastYear ?? 0));
    const winCur = cur.slice(start), winPrev = prev.slice(start);
    const max = Math.max(1, ...winCur, ...(showPrev ? winPrev : []));
    const ticks = niceTicks(max);
    return { lo: start, hi: Math.max(start + 1, len - 1), cur, prev, yMax: ticks[ticks.length - 1] };
  }, [all, start, len, cumulative, showPrev]);
  const ticks = useMemo(() => niceTicks(target.yMax), [target.yMax]);

  /* ---- smooth morph between views (range pans, values + axis tween) ---- */
  const [frame, setFrame] = useState<Frame>(target);
  const frameRef = useRef(frame);
  useEffect(() => {
    const from = frameRef.current;
    if (reduced || preview || from.cur.length !== target.cur.length) { frameRef.current = target; setFrame(target); return; }
    const t0 = performance.now(), dur = 560;
    let raf = 0;
    const tick = (now: number) => {
      const k = easeOut(Math.min(1, (now - t0) / dur));
      const f: Frame = {
        lo: lerp(from.lo, target.lo, k), hi: lerp(from.hi, target.hi, k), yMax: lerp(from.yMax, target.yMax, k),
        cur: target.cur.map((v, i) => lerp(from.cur[i], v, k)), prev: target.prev.map((v, i) => lerp(from.prev[i], v, k)),
      };
      frameRef.current = f; setFrame(f);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, preview]);

  /* ---- size ---- */
  const [W, setW] = useState(900);
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    setW(Math.max(240, Math.round(el.clientWidth)));
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => { const w = Math.round(el.clientWidth); if (w) setW(Math.max(240, w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = W <= 460;
  const H = W > 700 ? 300 : W > 460 ? 260 : 220;
  const g = { left: compact ? 44 : 54, right: 12, top: 14, bottom: 30 };
  const pw = W - g.left - g.right, ph = H - g.top - g.bottom;
  const span = Math.max(1e-6, frame.hi - frame.lo);
  const x = (i: number) => g.left + (n > 1 ? ((i - frame.lo) / span) * pw : pw / 2);
  const y = (v: number) => g.top + ph - (v / (frame.yMax || 1)) * ph;

  /* ---- headline figures ---- */
  const total = pts.reduce((s, p) => s + p.revenue, 0);
  const prevTotal = hasPrev ? pts.reduce((s, p) => s + (p.lastYear ?? 0), 0) : null;
  const growth = prevTotal && prevTotal > 0 ? total / prevTotal - 1 : null;
  const last = pts[n - 1];
  const lyChg = last && last.lastYear && last.lastYear > 0 ? last.revenue / last.lastYear - 1 : null;
  const best = pts.reduce<(typeof pts)[number] | null>((a, p) => (!a || p.revenue > a.revenue ? p : a), null);
  const totalShown = useCountUp(total, { start: started, duration: 900 });

  /* ---- crosshair ---- */
  const [active, setActive] = useState<number | null>(null); // index into the window
  const [live, setLive] = useState("");
  const act = active != null && active < n ? active : null;
  const winCur = (i: number) => target.cur[start + i];
  const winPrev = (i: number) => target.prev[start + i];
  const describe = (i: number) => {
    const p = pts[i];
    const parts = [`${fmt.month(p.month, "long")}: ${fmt.money(winCur(i))}`];
    if (hasPrev) {
      const c = winPrev(i) > 0 ? winCur(i) / winPrev(i) - 1 : null;
      parts.push(`last year ${fmt.money(winPrev(i))}`, `change ${fmt.pct(c, true)}`);
    }
    return parts.join(", ") + ".";
  };
  const place = (i: number | null, announce = false) => {
    if (i == null || !n) { setActive(null); return; }
    const c = Math.max(0, Math.min(n - 1, i));
    if (announce && c !== act) setLive(describe(c));
    setActive(c);
  };
  const indexAt = (clientX: number) => {
    const svg = plotRef.current?.querySelector("svg");
    if (!svg || !n) return null;
    const r = svg.getBoundingClientRect();
    const sx = (clientX - r.left) * (W / (r.width || 1));
    const step = n > 1 ? pw / (n - 1) : 1;
    return Math.round((sx - g.left) / step);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    const i = act ?? n - 1;
    let ni: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") ni = i + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") ni = i - 1;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = n - 1;
    else if (e.key === "Escape") { setActive(null); return; }
    if (ni == null) return;
    e.preventDefault();
    place(ni, true);
  };

  /* ---- events ---- */
  const changeRange = (r: RevenueRange) => {
    if (r === range) return;
    setRange(r);
    const nn = Math.min(len, r === "6m" ? 6 : 12), w = all.slice(len - nn);
    const t = w.reduce((s, p) => s + p.revenue, 0);
    const pt = w.length && w.every(p => p.lastYear != null) ? w.reduce((s, p) => s + (p.lastYear ?? 0), 0) : 0;
    onRangeChange?.({ range: r, total: t, growth: pt > 0 ? t / pt - 1 : null });
  };
  const toggle = (opt: "compare" | "cumulative") => {
    const next = { compare, cumulative, [opt]: opt === "compare" ? !compare : !cumulative };
    if (opt === "compare") setCompare(next.compare); else setCumulative(next.cumulative);
    onViewChange?.(next);
  };

  /* ---- paths ---- */
  const idx = all.map((_, i) => i);
  const linePts: [number, number][] = idx.map(i => [x(i), y(frame.cur[i])]);
  const line = smooth(linePts);
  const base = g.top + ph;
  const area = len ? `${line}L${x(len - 1).toFixed(2)},${base}L${x(0).toFixed(2)},${base}Z` : "";
  const prevLine = hasPrev ? smooth(idx.map(i => [x(i), y(frame.prev[i])] as [number, number])) : "";
  const from = n ? fmt.month(pts[0].month, "long") : "", to = last ? fmt.month(last.month, "long") : "";
  const every = n > 1 && pw / (n - 1) < 40 ? 2 : 1;
  const roomy = n > 1 && (every * pw) / (n - 1) >= 60;
  const clipId = `rg-clip-${uid}`, gradId = `rg-grad-${uid}`, glowId = `rg-glow-${uid}`;

  /* draw-in: remount by drawKey to replay */
  const drawT = { duration: 1.2, ease: [0.45, 0.05, 0.25, 1] as const };
  const firstPaint = preview;

  /* tooltip content */
  const tip = act != null ? (() => {
    const cv = winCur(act), pv = hasPrev ? winPrev(act) : null;
    const chg = pv && pv > 0 ? cv / pv - 1 : null;
    return { month: fmt.month(pts[act].month, "long") + (cumulative ? " · running total" : ""), cv, pv, chg };
  })() : null;
  const tipX = act != null ? (() => { const w = 196, px = x(start + act); const l = px + 14 + w > W ? px - 14 - w : px + 14; return Math.max(0, Math.round(l)); })() : 0;

  return (
    <article ref={rootRef} aria-label={data.title ?? "Revenue growth chart"}
      className={cx("@container relative w-full max-w-[1000px] font-sans text-[var(--rg-ink)]", PALETTE, className)}>
      <div className="grain relative overflow-hidden rounded-[22px] border border-[var(--rg-line)] bg-[var(--rg-card)] px-3.5 pt-5 pb-3.5 elev-3 @md:px-6 @md:pt-6 @md:pb-4 @3xl:px-8 @3xl:pt-7 @3xl:pb-5
        bg-[radial-gradient(70%_60%_at_100%_0%,color-mix(in_oklab,var(--rg-accent)_10%,transparent),transparent_70%),linear-gradient(var(--rg-card),var(--rg-card))]">

        {/* header */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="grid min-w-0 max-w-[60ch] gap-1.5">
            {data.eyebrow && <span className="inline-flex items-center gap-2 font-mono text-[10.5px] leading-none font-medium tracking-[0.1em] text-[var(--rg-accent)] uppercase before:h-0.5 before:w-3.5 before:rounded-full before:bg-current">{data.eyebrow}</span>}
            {data.title && <h2 className="m-0 font-display text-[19px] leading-[1.2] font-semibold tracking-[-0.015em] text-balance @3xl:text-[23px]">{data.title}</h2>}
            {data.subtitle && <p className="m-0 text-[13.5px] text-[var(--rg-muted)]">{data.subtitle}</p>}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 @lg:w-auto">
            <Segmented<RevenueRange> ariaLabel="Date range" value={range} onChange={changeRange} size="md"
              options={[{ value: "6m", label: "6M" }, { value: "12m", label: "12M" }]}
              className="border-[var(--rg-line)]! bg-[var(--rg-tint)]! @max-lg:w-full"
              buttonClassName="min-w-[46px] tabular font-semibold! @max-lg:flex-1 focus-visible:outline-[var(--rg-accent)]!"
              activeClassName="text-[var(--rg-ink)]!"
              indicatorClassName="bg-[var(--rg-card)]! shadow-[0_1px_3px_-1px_rgb(20_35_26/0.3),0_0_0_1px_var(--rg-line)]!" />
            <Switch label="Compare to last year" short="Last year" on={compare} onClick={() => toggle("compare")} disabled={!hasPrev} />
            <Switch label="Cumulative" short="Cumulative" on={cumulative} onClick={() => toggle("cumulative")} />
          </div>
        </header>

        {/* headline stats */}
        <dl className="m-0 mt-6 grid grid-cols-2 gap-y-4 @3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] @3xl:gap-y-0">
          <div className="col-span-2 grid min-w-0 content-start gap-1.5 @3xl:col-span-1 @3xl:pr-6">
            <dt className="font-mono text-[10.5px] leading-[1.2] font-medium tracking-[0.09em] text-[var(--rg-faint)] uppercase">Revenue · last {n} months</dt>
            <dd className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.03em] tabular @md:text-[40px] @3xl:text-[46px]">{fmt.money(totalShown)}</span>
              {growth != null && (
                <motion.span key={range} initial={preview ? false : { opacity: 0, y: 4, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}
                  className={cx("inline-flex items-center gap-1 rounded-full px-2 py-[5px] text-[12px] leading-none font-semibold tabular",
                    growth >= 0 ? "bg-[color-mix(in_oklab,var(--rg-good)_13%,transparent)] text-[var(--rg-good)]" : "bg-[color-mix(in_oklab,var(--rg-bad)_12%,transparent)] text-[var(--rg-bad)]")}>
                  <svg viewBox="0 0 10 10" aria-hidden className={cx("size-2.5", growth < 0 && "rotate-180")}><path d="M5 1.5 9 8H1z" fill="currentColor" /></svg>
                  <span className="sr-only">{growth >= 0 ? "Up" : "Down"} </span>{fmt.pct(growth)}
                </motion.span>
              )}
            </dd>
            {prevTotal != null && <dd className="m-0 text-[12.5px] leading-[1.4] text-[var(--rg-muted)] tabular">vs {fmt.money(prevTotal)} in the same months last year</dd>}
          </div>
          <MiniStat label="Latest month" value={last ? `${fmt.month(last.month, "mid")} · ${fmt.money(last.revenue)}` : "—"}
            sub={lyChg != null && last ? <><b className={cx("font-semibold", lyChg >= 0 ? "text-[var(--rg-good)]" : "text-[var(--rg-bad)]")}>{fmt.pct(lyChg, true)}</b> vs {fmt.month(last.month)} last year</> : null}
            className="@3xl:border-l @3xl:px-6" />
          <MiniStat label="Monthly average" value={n ? fmt.money(total / n) : "—"}
            sub={best ? `Best month: ${fmt.month(best.month)} · ${fmt.compact(best.revenue)}` : null}
            className="border-l pl-4 @3xl:px-6" />
        </dl>

        {/* legend + compact readout */}
        <div className="mt-5 mb-1.5 flex min-h-[22px] flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12.5px] text-[var(--rg-muted)]" aria-hidden>
          <span className="inline-flex items-center gap-2"><i className="block h-0 w-[18px] rounded-sm border-t-[2.5px] border-[var(--rg-accent)]" />This year{cumulative ? " · running total" : ""}</span>
          <AnimatePresence initial={false}>
            {showPrev && (
              <motion.span key="ly" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.25 }}
                className="inline-flex items-center gap-2"><i className="block h-0 w-[18px] border-t-2 border-dashed border-[var(--rg-prev)]" />Last year</motion.span>
            )}
          </AnimatePresence>
          {!compact && <span className="ml-auto text-[12px] text-[var(--rg-faint)] @max-3xl:hidden">Hover the chart or use ← → to read each month</span>}
        </div>
        {compact && (
          <div className="mb-2 flex h-[46px] items-center rounded-xl bg-[var(--rg-tint)] px-3 text-[12px] tabular shadow-[inset_0_0_0_1px_var(--rg-line)]" aria-hidden>
            {tip ? (
              <div className="flex w-full items-center justify-between gap-3">
                <span className="grid gap-0.5"><b className="font-semibold">{tip.month}</b><span className="text-[var(--rg-muted)]">{showPrev && tip.pv != null ? `Last year ${fmt.money(tip.pv)}` : "This year"}</span></span>
                <span className="grid justify-items-end gap-0.5"><b className="font-display text-[15px] font-semibold">{fmt.money(tip.cv)}</b>
                  {tip.chg != null && <span className={tip.chg >= 0 ? "text-[var(--rg-good)]" : "text-[var(--rg-bad)]"}>{fmt.pct(tip.chg, true)} vs last year</span>}</span>
              </div>
            ) : <span className="text-[var(--rg-faint)]">Touch the chart to read each month</span>}
          </div>
        )}

        {/* plot */}
        <div ref={plotRef} tabIndex={0} role="group" aria-roledescription="chart"
          aria-label={`Revenue chart, ${from} to ${to}. Use the left and right arrow keys to read each month.`}
          onKeyDown={onKey}
          onFocus={() => { if (act == null && n) place(n - 1, true); }}
          onBlur={() => setActive(null)}
          onPointerMove={(e: PointerEvent) => place(indexAt(e.clientX))}
          onPointerDown={(e: PointerEvent) => place(indexAt(e.clientX))}
          onPointerLeave={(e: PointerEvent) => { if (e.pointerType !== "touch" && document.activeElement !== plotRef.current) setActive(null); }}
          className="relative cursor-crosshair touch-pan-y rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rg-accent)]">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full overflow-visible" aria-hidden focusable="false">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--rg-accent)" stopOpacity={0.26} />
                <stop offset="0.7" stopColor="var(--rg-accent)" stopOpacity={0.06} />
                <stop offset="1" stopColor="var(--rg-accent)" stopOpacity={0} />
              </linearGradient>
              <filter id={glowId} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
              <clipPath id={clipId}><rect x={g.left - 6} y={0} width={pw + 12 + g.right} height={H} /></clipPath>
            </defs>

            {/* y grid */}
            {ticks.map((v, i) => {
              if (v > frame.yMax * 1.001) return null;
              const yy = Math.round(y(v)) + 0.5;
              return (
                <g key={v}>
                  <line x1={g.left} x2={W - g.right} y1={yy} y2={yy} stroke={i === 0 ? "var(--rg-line)" : "var(--rg-grid)"} strokeDasharray={i === 0 ? undefined : "2 4"} shapeRendering="crispEdges" />
                  <text x={g.left - 10} y={yy + 4} textAnchor="end" className="fill-[var(--rg-faint)] text-[11px] font-medium tabular">{v === 0 ? fmt.money(0) : fmt.compact(v)}</text>
                </g>
              );
            })}
            {!n && <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-[var(--rg-faint)] text-[13px] font-medium">No revenue data to show.</text>}

            <g clipPath={`url(#${clipId})`}>
              {/* area */}
              <motion.path key={`a${drawKey}`} d={area} fill={`url(#${gradId})`}
                initial={firstPaint ? false : { opacity: 0, y: 6 }} animate={started ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={{ duration: 0.95, delay: 0.3, ease: [0.45, 0.05, 0.25, 1] }} />
              {/* last year */}
              {prevLine && (
                <motion.path d={prevLine} fill="none" stroke="var(--rg-prev)" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round"
                  initial={false} animate={{ opacity: showPrev && started ? 1 : 0 }} transition={{ duration: 0.35 }} />
              )}
              {/* glow + line */}
              <motion.path key={`g${drawKey}`} d={line} fill="none" stroke="var(--rg-accent)" strokeWidth={6} strokeOpacity={0.18} filter={`url(#${glowId})`}
                initial={firstPaint ? false : { pathLength: 0 }} animate={{ pathLength: started ? 1 : 0 }} transition={drawT} />
              <motion.path key={`l${drawKey}`} d={line} fill="none" stroke="var(--rg-accent)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round"
                initial={firstPaint ? false : { pathLength: 0 }} animate={{ pathLength: started ? 1 : 0 }} transition={drawT} />
            </g>

            {/* x labels */}
            {pts.map((p, k) => {
              if ((n - 1 - k) % every) return null;
              const i = start + k, xx = x(i);
              const anchor = n > 1 && k === 0 ? "start" : n > 1 && k === n - 1 ? "end" : "middle";
              const label = roomy && (k === 0 || /-01$/.test(p.month)) ? fmt.month(p.month, "mid") : fmt.month(p.month);
              return (
                <text key={p.month} x={xx + (anchor === "start" ? -4 : anchor === "end" ? 4 : 0)} y={H - 8} textAnchor={anchor}
                  className={cx("text-[11px] tabular transition-[fill] duration-150", k === act ? "fill-[var(--rg-ink)] font-semibold" : "fill-[var(--rg-faint)] font-medium")}>{label}</text>
              );
            })}

            {/* crosshair */}
            {act != null && (
              <g pointerEvents="none">
                <line x1={x(start + act)} x2={x(start + act)} y1={g.top} y2={base} stroke="var(--rg-ink)" strokeOpacity={0.35} strokeDasharray="3 3" />
                {showPrev && <circle cx={x(start + act)} cy={y(frame.prev[start + act])} r={4} fill="var(--rg-card)" stroke="var(--rg-prev)" strokeWidth={2} />}
                <circle cx={x(start + act)} cy={y(frame.cur[start + act])} r={5.5} fill="var(--rg-card)" stroke="var(--rg-accent)" strokeWidth={2.6} />
              </g>
            )}
            {/* end marker */}
            {n > 0 && act == null && (
              <motion.circle key={`e${drawKey}`} cx={x(len - 1)} cy={y(frame.cur[len - 1])} r={4.5} fill="var(--rg-accent)" stroke="color-mix(in oklab, var(--rg-accent) 18%, transparent)" strokeWidth={8} paintOrder="stroke"
                initial={firstPaint ? false : { opacity: 0, scale: 0.4 }} animate={started ? { opacity: 1, scale: 1 } : { opacity: 0 }} transition={{ delay: firstPaint ? 0 : 1.1, duration: 0.3 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            )}
          </svg>

          {/* floating tooltip (wide layouts) */}
          {!compact && tip && (
            <div aria-hidden className="pointer-events-none absolute top-1 left-0 z-10 min-w-[180px] rounded-[11px] bg-[var(--rg-tip)] px-3 py-2.5 text-[12.5px] leading-[1.3] text-[var(--rg-tip-ink)] tabular shadow-[0_18px_32px_-16px_rgb(10_20_14/0.55)] transition-transform duration-100 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(${tipX}px)` }}>
              <p className="m-0 mb-2 text-[12.5px] font-semibold">{tip.month}</p>
              <TipRow swatch={<i className="block h-0 w-3 border-t-[2.5px] border-[var(--rg-tip-good)]" />} label="This year" value={fmt.money(tip.cv)} />
              {showPrev && tip.pv != null && <TipRow swatch={<i className="block h-0 w-3 border-t-2 border-dashed border-[var(--rg-tip-muted)]" />} label="Last year" value={fmt.money(tip.pv)} />}
              {tip.chg != null && (
                <div className="mt-1.5 border-t border-[color-mix(in_oklab,var(--rg-tip-muted)_40%,transparent)] pt-1.5">
                  <TipRow label="Change" value={<span className={tip.chg >= 0 ? "text-[var(--rg-tip-good)]" : "text-[var(--rg-tip-bad)]"}>{fmt.pct(tip.chg, true)}</span>} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* screen-reader table */}
        <table className="sr-only">
          <caption>Monthly revenue, {from} to {to}</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">{cumulative ? "Running total" : "Revenue"}</th>{hasPrev && <><th scope="col">Last year</th><th scope="col">Change</th></>}</tr></thead>
          <tbody>
            {pts.map((p, k) => (
              <tr key={p.month}>
                <th scope="row">{fmt.month(p.month, "long")}</th>
                <td>{fmt.money(winCur(k))}</td>
                {hasPrev && <><td>{fmt.money(winPrev(k))}</td><td>{fmt.pct(winPrev(k) > 0 ? winCur(k) / winPrev(k) - 1 : null, true)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>

        {data.source && (
          <footer className="mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-dashed border-[var(--rg-line)] pt-3 text-[12px] text-[var(--rg-faint)]">
            <span>{data.source}</span>
          </footer>
        )}
        <p className="sr-only" aria-live="polite">{live}</p>
      </div>
    </article>
  );
}

/* ---------------- pieces ---------------- */
function MiniStat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("grid min-w-0 content-start gap-1.5 border-[var(--rg-line)]", className)}>
      <dt className="font-mono text-[10.5px] leading-[1.2] font-medium tracking-[0.09em] text-[var(--rg-faint)] uppercase">{label}</dt>
      <dd className="m-0 font-display text-[16px] leading-[1.15] font-semibold tracking-[-0.01em] tabular @md:text-[21px]">{value}</dd>
      {sub ? <dd className="m-0 text-[12.5px] leading-[1.4] text-[var(--rg-muted)] tabular">{sub}</dd> : null}
    </div>
  );
}

function TipRow({ swatch, label, value }: { swatch?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 py-0.5">
      <span className="grid">{swatch}</span>
      <span className="text-[var(--rg-tip-muted)]">{label}</span>
      <b className="font-semibold">{value}</b>
    </div>
  );
}

function Switch({ label, short, on, onClick, disabled }: { label: string; short: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      className={cx("inline-flex items-center gap-2 rounded-[10px] border border-[var(--rg-line)] bg-[var(--rg-card)] py-[7px] pr-3 pl-2 text-[12.5px] leading-none font-medium transition-colors duration-200 hover:border-[var(--rg-faint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rg-accent)] disabled:opacity-50 @max-lg:flex-1 @max-lg:justify-center",
        on ? "text-[var(--rg-ink)]" : "text-[var(--rg-muted)] hover:text-[var(--rg-ink)]")}>
      <span aria-hidden className={cx("relative h-4 w-[26px] shrink-0 rounded-full transition-colors duration-200", on ? "bg-[var(--rg-accent)]" : "bg-[var(--rg-grid)] shadow-[inset_0_0_0_1px_var(--rg-line)]")}>
        <motion.span className="absolute top-0.5 left-0.5 size-3 rounded-full bg-[var(--rg-card)] shadow-[0_1px_2px_rgb(20_35_26/0.35)]"
          initial={false} animate={{ x: on ? 10 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 34 }} />
      </span>
      <span className="@max-lg:hidden">{label}</span><span aria-hidden className="@lg:hidden">{short}</span>
    </button>
  );
}
