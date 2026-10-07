import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Icon, cx } from "../../ui";
import { useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { CampaignData, CampaignDeltas, CampaignStatus } from "./data";

/* ------------------------------------------------------------
   Campaign Performance Snapshot
   Navy hero (ROAS against spend → revenue) + light metrics panel
   with a hoverable, keyboard-steppable daily results chart.
   ------------------------------------------------------------ */

export interface CampaignDayPoint {
  index: number;
  /** "12 Sep", or "Day 12" when no start date is known. */
  label: string;
  value: number;
}

export interface CampaignPerformanceProps extends CampaignData {
  className?: string;
  /** Fires when a day is highlighted in the chart (hover, touch or arrow keys), and with null when it clears. */
  onDayFocus?: (day: CampaignDayPoint | null) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS: Record<CampaignStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "#5EE59A" },
  learning: { label: "Learning", color: "#9DB0FF" },
  paused: { label: "Paused", color: "#F4C261" },
  ended: { label: "Ended", color: "#A3ADBF" },
};
/** Which direction counts as an improvement (0 = neutral). */
const BETTER: Record<keyof CampaignDeltas, -1 | 0 | 1> = { spend: 0, results: 1, cost: -1, ctr: 1, roas: 1 };

const parseDate = (s?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
const dayLabel = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const trimZeros = (s: string) => s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const decimalsOf = (v: number, max = 2) => { const s = trimZeros(v.toFixed(max)); const i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; };
const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function formatRange(a: Date | null, b: Date | null) {
  if (!a) return "";
  if (!b) return `From ${dayLabel(a)} ${a.getUTCFullYear()}`;
  const sameY = a.getUTCFullYear() === b.getUTCFullYear();
  if (sameY && a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  if (sameY) return `${dayLabel(a)} – ${dayLabel(b)} ${b.getUTCFullYear()}`;
  return `${dayLabel(a)} ${a.getUTCFullYear()} – ${dayLabel(b)} ${b.getUTCFullYear()}`;
}

function money(v: number, currency: string, digits: number) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  } catch {
    return `${currency} ${v.toFixed(digits)}`;
  }
}

/** Monotone cubic path through points (no overshoot above the peak or below zero). */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function useWidth(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.clientWidth || fallback);
    set();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}

/* ---------------- small pieces ---------------- */

const mono = "font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.1em]";

function Delta({ value, better, onDark = false }: { value?: number; better: -1 | 0 | 1; onDark?: boolean }) {
  if (!isNum(value)) return null;
  const dir = Math.sign(value);
  const tone = !dir || !better ? "neutral" : dir === better ? "good" : "bad";
  const abs = trimZeros(Math.abs(value).toFixed(1));
  const toneCls = onDark
    ? tone === "good" ? "bg-[#5EE59A]/12 text-[#7BEDB0]" : tone === "bad" ? "bg-[#FF9A8C]/14 text-[#FFB0A5]" : "bg-white/8 text-[#B8C2D6]"
    : tone === "good" ? "bg-[color-mix(in_oklab,var(--cps-good)_11%,transparent)] text-[var(--cps-good)]"
      : tone === "bad" ? "bg-[color-mix(in_oklab,var(--cps-bad)_11%,transparent)] text-[var(--cps-bad)]" : "bg-sunken text-ink-3";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span aria-hidden className={cx("inline-flex items-center gap-0.5 rounded-md px-1.5 py-[3px] text-[11.5px] font-semibold leading-none tabular", toneCls)}>
        <Icon name={dir > 0 ? "arrowUp" : dir < 0 ? "arrowDown" : "arrowRight"} className="size-3" strokeWidth={2} />
        {abs}%
      </span>
      <span aria-hidden className={cx("text-[11px]", onDark ? "text-[#A5B0C6]" : "text-ink-3")}>vs prev. period</span>
      <span className="sr-only">{dir > 0 ? "Up" : dir < 0 ? "Down" : "Flat"} {abs}% versus previous period{tone !== "neutral" ? ` (${tone === "good" ? "better" : "worse"})` : ""}</span>
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const preview = usePreviewMode();
  const key = status.toLowerCase();
  const meta = STATUS[key as CampaignStatus] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), color: "#A3ADBF" };
  const dot: ReactNode =
    key === "active" ? (
      <span className="relative size-[7px]">
        {!preview && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--st)] opacity-60 motion-reduce:hidden" />}
        <span className="absolute inset-0 rounded-full bg-[var(--st)] shadow-[0_0_8px_var(--st)]" />
      </span>
    ) : key === "learning" ? (
      <span className="size-[9px] rounded-full border-[1.5px] border-[var(--st)] border-r-transparent border-b-transparent rotate-45" />
    ) : key === "paused" ? (
      <span className="flex h-[8px] gap-[2px]"><span className="w-[2.5px] rounded-[1px] bg-[var(--st)]" /><span className="w-[2.5px] rounded-[1px] bg-[var(--st)]" /></span>
    ) : (
      <span className="size-[7px] rounded-[2px] bg-[var(--st)]" />
    );
  return (
    <motion.span layout transition={{ type: "spring", stiffness: 420, damping: 34 }} style={{ "--st": meta.color } as CSSProperties}
      className="inline-flex items-center gap-2 overflow-hidden rounded-full bg-white/[0.07] py-1.5 pl-2.5 pr-3 text-[12px] font-medium leading-none text-[#F3F5F9] ring-1 ring-inset ring-white/12">
      <span className="sr-only">Status: </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={key} className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          <span aria-hidden className="grid size-[9px] place-items-center">{dot}</span>
          {meta.label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/* ---------------- daily chart ---------------- */

function DailyChart({ series, start, resultLabel, show, onDayFocus }: {
  series: number[]; start: Date | null; resultLabel: string; show: boolean; onDayFocus?: (d: CampaignDayPoint | null) => void;
}) {
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const w = useWidth(plotRef, 480);
  const h = 132;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hi, setHi] = useState<number | null>(null);
  const lower = resultLabel.toLowerCase();
  const n = series.length;
  const day = (i: number) => (start ? dayLabel(addDays(start, i)) : `Day ${i + 1}`);

  const geo = useMemo(() => {
    const top = 26, bot = 6, px = 8;
    const max = Math.max(...series, 1);
    const X = (i: number) => (n === 1 ? w / 2 : px + (i * (w - 2 * px)) / (n - 1));
    const Y = (v: number) => top + (1 - v / max) * (h - top - bot);
    const pts = series.map((v, i) => [X(i), Y(v)] as [number, number]);
    const line = monotonePath(pts);
    const base = h - bot;
    const area = n > 1 ? `${line}L${X(n - 1).toFixed(1)},${base}L${X(0).toFixed(1)},${base}Z` : "";
    const pk = series.indexOf(max);
    return { X, Y, line, area, base, top, px, max, pk };
  }, [series, w, n]);

  // keep the tooltip inside the plot
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || hi == null) return;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.max(half, Math.min(w - half, geo.X(hi)))}px`;
  }, [hi, w, geo]);

  const set = (i: number | null) => {
    setHi(i);
    onDayFocus?.(i == null ? null : { index: i, label: day(i), value: series[i] });
  };
  const idxAt = (e: PointerEvent) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || !n) return null;
    const scale = r.width / (w || 1); // the preview thumbnail is scaled down
    const x = (e.clientX - r.left) / scale;
    return Math.max(0, Math.min(n - 1, Math.round(((x - geo.px) / (w - 2 * geo.px)) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    const cur = hi ?? n - 1;
    const next = e.key === "ArrowLeft" ? Math.max(0, cur - 1) : e.key === "ArrowRight" ? Math.min(n - 1, cur + 1)
      : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "Escape" ? -1 : null;
    if (next == null) return;
    e.preventDefault();
    set(next < 0 ? null : next);
  };

  if (!n) return null;
  const total = series.reduce((t, v) => t + v, 0);
  const { X, Y, line, area, base, top, max, pk } = geo;
  const pkX = X(pk);
  const anchor = pkX < 44 ? "start" : pkX > w - 44 ? "end" : "middle";
  const hv = hi != null ? series[hi] : null;
  const prev = hi != null && hi > 0 ? series[hi - 1] : null;
  const animate = !preview;
  const midIdx = Math.floor((n - 1) / 2);

  return (
    <figure className="m-0 grid gap-2.5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className={cx(mono, "text-ink-3")}>Daily {lower}</span>
        <span className="text-[12.5px] text-ink-2 tabular"><span className="font-semibold text-ink">{total.toLocaleString("en-US")}</span> across {n} days</span>
      </figcaption>
      <div ref={plotRef} tabIndex={0} role="group"
        aria-label={`Daily ${lower} chart, ${n} days. Use the arrow keys to step through days.`}
        onPointerMove={e => { const i = idxAt(e); if (i != null && i !== hi) set(i); }}
        onPointerDown={e => { const i = idxAt(e); if (i != null) set(i); }}
        onPointerLeave={() => { if (document.activeElement !== plotRef.current) set(null); }}
        onFocus={() => set(hi ?? n - 1)} onBlur={() => set(null)} onKeyDown={onKey}
        className="relative cursor-crosshair touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cps)] focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        style={{ height: h }}>
        <svg aria-hidden focusable="false" viewBox={`0 0 ${w} ${h}`} className="block size-full overflow-visible">
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cps)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--cps)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.5].map(f => <line key={f} x1={0} x2={w} y1={top + (1 - f) * (base - top)} y2={top + (1 - f) * (base - top)} className="stroke-line" strokeDasharray="2 4" />)}
          <line x1={0} x2={w} y1={base} y2={base} className="stroke-line-strong" />
          <motion.path d={area} fill={`url(#${uid}-fill)`}
            initial={animate ? { opacity: 0 } : false} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.8, delay: reduced ? 0 : 0.35 }} />
          <motion.path d={line} fill="none" stroke="var(--cps)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
            initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: show ? 1 : 0 }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
          {pk !== n - 1 && <circle cx={pkX} cy={Y(max)} r={3.2} className="fill-surface" stroke="var(--cps)" strokeWidth={1.6} />}
          <text x={pkX} y={Y(max) - 10} textAnchor={anchor} className="fill-ink-2 font-mono text-[10.5px] font-medium">Peak {max}</text>
          <circle cx={X(n - 1)} cy={Y(series[n - 1])} r={4.5} fill="var(--cps)" className="stroke-surface" strokeWidth={2} />
          {hi != null && hv != null && (
            <g>
              <line x1={X(hi)} x2={X(hi)} y1={top - 10} y2={base} className="stroke-ink-3" strokeDasharray="2 3" />
              <circle cx={X(hi)} cy={Y(hv)} r={7} fill="var(--cps)" opacity={0.18} />
              <circle cx={X(hi)} cy={Y(hv)} r={4.5} fill="var(--cps)" className="stroke-surface" strokeWidth={2} />
            </g>
          )}
        </svg>
        <AnimatePresence>
          {hi != null && hv != null && (
            <motion.div ref={tipRef} key="tip" aria-hidden
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-tight text-canvas shadow-lg tabular"
              style={{ left: X(hi) }}>
              <span className="opacity-70">{day(hi)}</span>
              <span className="mx-1.5 opacity-40">·</span>
              <b className="font-semibold">{hv.toLocaleString("en-US")}</b> {lower}
              {prev != null && hv !== prev && (
                <span className={cx("ml-2 font-medium", hv > prev ? "text-[#7BEDB0] dark:text-[#15804A]" : "text-[#FFB0A5] dark:text-[#C23B2B]")}>
                  {hv > prev ? "▲" : "▼"} {Math.abs(hv - prev)}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div aria-hidden className={cx(mono, "relative flex justify-between text-ink-3")}>
        <span>{day(0)}</span>
        {n > 4 && <span className="absolute -translate-x-1/2" style={{ left: X(midIdx) }}>{day(midIdx)}</span>}
        <span>{day(n - 1)}</span>
      </div>
      <p className="sr-only" aria-live="polite">{hi != null && hv != null ? `${day(hi)}: ${hv} ${lower}` : ""}</p>
      <table className="sr-only">
        <caption>Daily {lower}</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">{resultLabel}</th></tr></thead>
        <tbody>{series.map((v, i) => <tr key={i}><th scope="row">{day(i)}</th><td>{v}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ---------------- main component ---------------- */

export function CampaignPerformance({
  name, platform, status, start, end, currency: cur = "USD", spend, results, resultLabel = "Conversions",
  cost: costIn, costLabel: costLabelIn, ctr, roas, series, deltas = {}, className, onDayFocus,
}: CampaignPerformanceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const preview = usePreviewMode();
  const inView = useInView(rootRef, { amount: 0.25 });
  const show = inView || preview;
  const currency = (cur || "USD").toUpperCase();

  const costLabel = costLabelIn || (/^leads?$/i.test(resultLabel) ? "CPL" : "CPA");
  const cost = isNum(costIn) ? costIn : isNum(spend) && results ? spend / results : null;
  const revenue = isNum(spend) && isNum(roas) ? spend * roas : null;
  const s = parseDate(start), e = parseDate(end);
  const days = s && e ? Math.round((e.getTime() - s.getTime()) / 864e5) + 1 : null;
  const max = isNum(spend) && isNum(revenue) ? Math.max(spend, revenue) || 1 : 1;
  const spendPct = isNum(spend) ? (spend / max) * 100 : 0;
  const revPct = isNum(revenue) ? (revenue / max) * 100 : 0;
  const roasDigits = isNum(roas) ? decimalsOf(roas) : 0;
  const mark = (platform || "?").charAt(0).toUpperCase();
  const ease = [0.16, 1, 0.3, 1] as const;
  const [heroHover, setHeroHover] = useState(false);

  const metrics: { key: keyof CampaignDeltas; label: string; value: number | null; fmt: (v: number) => string }[] = [
    { key: "spend", label: "Total spend", value: spend, fmt: v => money(v, currency, isNum(spend) && spend >= 1000 ? 0 : 2) },
    { key: "results", label: resultLabel, value: results, fmt: v => Math.round(v).toLocaleString("en-US") },
    { key: "cost", label: costLabel, value: cost, fmt: v => money(v, currency, 2) },
    { key: "ctr", label: "CTR", value: ctr, fmt: v => `${isNum(ctr) ? v.toFixed(decimalsOf(ctr)) : trimZeros(v.toFixed(2))}%` },
  ];

  return (
    <article ref={rootRef}
      className={cx("@container group/cps h-fit w-full max-w-[1000px] text-ink",
        "[--cps:#3050E6] [--cps-good:#15804A] [--cps-bad:#C23B2B] dark:[--cps:#8FA3FF] dark:[--cps-good:#4CC985] dark:[--cps-bad:#FF7A6B]",
        className)}>
      <div className="grid overflow-hidden rounded-[22px] border border-line bg-surface elev-3 transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-0.5 motion-reduce:transform-none @3xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        {/* ---------- hero ---------- */}
        <section aria-label="Return on ad spend" onMouseEnter={() => setHeroHover(true)} onMouseLeave={() => setHeroHover(false)}
          className="@container/hero grain relative isolate flex flex-col gap-6 overflow-hidden p-6 text-[#F3F5F9] @md:p-7 [--hero:#0E1726] dark:[--hero:#18223A]"
          style={{ background: "radial-gradient(120% 70% at 100% 0%, rgba(143,163,255,0.20), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(94,229,154,0.07), transparent 65%), var(--hero)" }}>
          <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-16 -top-16 -z-10 size-64 text-white/[0.07]" fill="none" stroke="currentColor">
            {[30, 50, 70, 90].map(r => <circle key={r} cx="100" cy="100" r={r} strokeWidth="0.8" />)}
          </svg>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <span className="inline-flex items-center gap-2.5 text-[13px] font-medium">
              <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-white/10 font-display text-[12.5px] font-semibold ring-1 ring-inset ring-white/12 transition-transform duration-500 group-hover/cps:-rotate-6 motion-reduce:transform-none">{mark}</span>
              {platform || "Ad platform"}
            </span>
            <StatusPill status={status || "active"} />
          </div>
          <h2 className="m-0 font-display text-[clamp(19px,5.2cqi,24px)] font-semibold leading-[1.2] tracking-[-0.012em] text-balance">{name || "Untitled campaign"}</h2>

          <div className="mt-auto grid gap-6 @xl/hero:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @xl/hero:items-end @xl/hero:gap-10">
            <div className="grid gap-2">
              <span className={cx(mono, "text-[#A5B0C6]")}>Return on ad spend</span>
              <div className="flex items-baseline gap-1 font-display text-[76px] font-extralight leading-[0.9] tracking-[-0.05em] @md/hero:text-[96px]">
                {isNum(roas) ? <CountUp value={roas} start={show} duration={1100} format={v => Math.max(0, v).toFixed(roasDigits)} /> : <span>—</span>}
                <motion.span aria-hidden className="inline-block text-[0.5em] font-light tracking-normal text-[#A9B8FF]"
                  animate={{ rotate: heroHover ? 90 : 0, y: heroHover ? -4 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>×</motion.span>
              </div>
              <Delta value={deltas.roas} better={BETTER.roas} onDark />
            </div>

            <div className="grid gap-3.5 border-t border-white/10 pt-5 @xl/hero:border-0 @xl/hero:pt-0">
              {[
                { label: "Spend", pct: spendPct, val: isNum(spend) ? money(spend, currency, 0) : "—", cls: "bg-white/40", delay: 0.1 },
                { label: "Revenue", pct: revPct, val: isNum(revenue) ? money(revenue, currency, 0) : "—", cls: "bg-[linear-gradient(90deg,#6F86FF,#A9B8FF)] shadow-[0_0_14px_rgba(143,163,255,0.45)]", delay: 0.25 },
              ].map((row, i) => (
                <div key={row.label} className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-3">
                  <span className={cx(mono, "text-[#A5B0C6]")}>{row.label}</span>
                  <span className="relative h-2 rounded-full bg-white/[0.08]">
                    <motion.span className={cx("absolute inset-y-0 left-0 rounded-full", row.cls)}
                      initial={preview ? false : { width: 0 }} animate={{ width: show ? `${row.pct}%` : 0 }}
                      transition={{ duration: 0.9, ease, delay: row.delay }} />
                    {i === 1 && isNum(spend) && isNum(revenue) && (
                      <motion.span aria-hidden className="absolute -inset-y-1.5 w-[1.5px] -translate-x-1/2 rounded-full bg-white/70" style={{ left: `${spendPct}%` }}
                        initial={preview ? false : { opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} transition={{ delay: 0.9 }}>
                        <span className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] tracking-[0.06em] text-[#A5B0C6]">break-even</span>
                      </motion.span>
                    )}
                  </span>
                  <span className="min-w-[68px] text-right text-[13px] font-medium tabular">{row.val}</span>
                </div>
              ))}
              {isNum(spend) && isNum(revenue) && isNum(roas) && (
                <p className="m-0 mt-0.5 text-[12.5px] text-[#A5B0C6]">
                  Every <b className="font-semibold text-[#F3F5F9]">{money(1, currency, 0)}</b> spent returned <b className="font-semibold text-[#F3F5F9]">{money(roas, currency, 2)}</b>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---------- body ---------- */}
        <section aria-label="Campaign metrics" className="@container/body flex min-w-0 flex-col gap-5 p-5 @md:p-7">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <span className={cx(mono, "text-ink-3")}>Date range</span>
            <span className="text-[14px] font-medium tabular">
              <time dateTime={[start, end].filter(Boolean).join("/")}>{formatRange(s, e) || "—"}</time>
              {days ? <span className="ml-1.5 font-normal text-ink-3">· {days} days</span> : null}
            </span>
          </header>

          <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line @xl/body:grid-cols-4">
            {metrics.map((m, i) => (
              <motion.div key={m.key}
                initial={preview ? false : { opacity: 0, y: 8 }} animate={show ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, ease, delay: 0.08 * i }}
                className="group/m grid content-start gap-2 bg-surface px-4 py-3.5 transition-colors duration-200 hover:bg-surface-2 @md/body:px-[18px] @md/body:py-4">
                <dt className={cx(mono, "text-ink-3")}>{m.label}</dt>
                <dd className="m-0 font-display text-[clamp(20px,6cqi,26px)] font-semibold leading-[1.05] tracking-[-0.02em] tabular transition-colors duration-200 [overflow-wrap:anywhere] group-hover/m:text-[var(--cps)] @xl/body:text-[22px]">
                  {isNum(m.value) ? <CountUp value={m.value} start={show} duration={900} format={v => m.fmt(Math.max(0, v))} /> : "—"}
                </dd>
                <dd className="m-0"><Delta value={deltas[m.key]} better={BETTER[m.key]} /></dd>
              </motion.div>
            ))}
          </dl>

          <DailyChart series={series} start={s} resultLabel={resultLabel} show={show} onDayFocus={onDayFocus} />
        </section>
      </div>
    </article>
  );
}
