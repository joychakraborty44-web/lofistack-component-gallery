import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { CountUp, Segmented, cx } from "../../ui";
import { USAGE_LABELS, USAGE_METRICS, type AiUsageData, type UsageLabels, type UsageMetric, type UsageRange } from "./data";

/* ------------------------------------------------------------
   AI Usage Analytics — lilac card with daily stacked bars by
   model tier, plus a charcoal side panel for quota and cost.
   ------------------------------------------------------------ */

export interface UsageFilter { metric: UsageMetric; range: UsageRange; model: string | null }

export interface AiUsageAnalyticsHandle {
  /** Show one model alone; the same id again (or null) shows all. */
  isolate: (id: string | null) => void;
  /** Re-run the bar entrance animation. */
  replay: () => void;
}

export interface AiUsageAnalyticsProps extends AiUsageData {
  metric?: UsageMetric;
  defaultMetric?: UsageMetric;
  range?: UsageRange;
  defaultRange?: UsageRange;
  /** Isolated model id; null / undefined shows all. */
  model?: string | null;
  defaultModel?: string | null;
  /** Fires on every metric, range or isolation change. */
  onFilterChange?: (filter: UsageFilter) => void;
  labels?: Partial<UsageLabels>;
  className?: string;
  ref?: Ref<AiUsageAnalyticsHandle>;
}

interface M { id: string; label: string; price: number; slot: number; tokens: number[]; requests: number[]; cost: number[] }

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? 0 : Math.max(0, Number(v)));
const parseDay = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function niceMax(v: number) {
  if (!(v > 0)) return { max: 1, step: 0.25 };
  const raw = v / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) || 10 * mag;
  return { max: step * Math.ceil(v / step), step };
}
const EASE = [0.2, 0.7, 0.2, 1] as const;
const GAP = 2;

const PALETTE = cx(
  "[--au-card:#FFFFFF] [--au-ink:#1D1B22] [--au-muted:#57535F] [--au-faint:#6E6977] [--au-line:#E8E5EE] [--au-grid:#EEEBF2] [--au-axis:#CFCAD8] [--au-tint:#F6F3FB] [--au-lilac:#6D4BC3] [--au-lilac-soft:#EEE7FB]",
  "[--au-c1:#8B63D9] [--au-c2:#1A9E74] [--au-c3:#D9822B] [--au-tip:#25232B] [--au-tip-ink:#F4F1F8]",
  "[--au-panel:#25232B] [--au-panel-2:#2E2B35] [--au-panel-ink:#F4F1F8] [--au-panel-muted:#BDB7C8] [--au-panel-line:#3C3844] [--au-ring:#B79CF0] [--au-ring-track:#3A3642] [--au-mint:#5FD3AA] [--au-warn:#F3B36B]",
  "[--au-pc1:#9F7AEA] [--au-pc2:#27A880] [--au-pc3:#D27C49]",
  "dark:[--au-card:#1C1B21] dark:[--au-ink:#EEEBF3] dark:[--au-muted:#ADA7B8] dark:[--au-faint:#918B9C] dark:[--au-line:#2E2B35] dark:[--au-grid:#29262F] dark:[--au-axis:#3E3A47] dark:[--au-tint:#24222A] dark:[--au-lilac:#B79CF0] dark:[--au-lilac-soft:rgb(183_156_240/0.14)]",
  "dark:[--au-c1:#9F7AEA] dark:[--au-c2:#27A880] dark:[--au-c3:#D27C49] dark:[--au-tip:#EEEBF3] dark:[--au-tip-ink:#1D1B22]",
  "dark:[--au-panel:#131217] dark:[--au-panel-2:#1B1A20] dark:[--au-panel-ink:#EEEBF3] dark:[--au-panel-muted:#ADA7B8] dark:[--au-panel-line:#2C2932] dark:[--au-ring-track:#2C2932]",
);

const Spark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}><path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6z" /></svg>
);

export function AiUsageAnalytics({
  eyebrow, title, start: startIso, asOf: asOfIso, billingStart, quota: quotaProp, budget: budgetProp, currency = "USD", locale = "en-US",
  models: modelsProp, series, source,
  metric: metricProp, defaultMetric = "tokens", range: rangeProp, defaultRange = 30, model: modelProp, defaultModel = null,
  onFilterChange, labels, className, ref,
}: AiUsageAnalyticsProps) {
  const L = useMemo(() => ({ ...USAGE_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const instant = reduced || preview;

  /* ---------- state (controlled or not) ---------- */
  const [metricIn, setMetricIn] = useState<UsageMetric>(defaultMetric);
  const [rangeIn, setRangeIn] = useState<UsageRange>(defaultRange);
  const [modelIn, setModelIn] = useState<string | null>(defaultModel);
  const metric: UsageMetric = USAGE_METRICS.includes(metricProp ?? metricIn) ? (metricProp ?? metricIn) : "tokens";
  const range: UsageRange = (rangeProp ?? rangeIn) === 14 ? 14 : 30;

  /* ---------- data ---------- */
  const { models, days } = useMemo(() => {
    const ms = (Array.isArray(modelsProp) ? modelsProp : []).filter(Boolean).slice(0, 3);
    const len = Math.max(0, ...ms.map(m => Math.max(series?.[m.id]?.tokens?.length || 0, series?.[m.id]?.requests?.length || 0)));
    let start = parseDay(startIso);
    const asOf = parseDay(asOfIso);
    if (!start && asOf) start = addDays(asOf, -(len - 1));
    if (!start) start = addDays(new Date(), -(len - 1));
    const ds = Array.from({ length: len }, (_, i) => addDays(start as Date, i));
    const out: M[] = ms.map((m, i) => {
      const s = series?.[m.id] || {};
      const tokens = ds.map((_, k) => num(s.tokens?.[k]));
      const price = num(m.pricePerMillion);
      return { id: String(m.id || `model-${i + 1}`), label: m.label || `Model ${i + 1}`, price, slot: i + 1, tokens, requests: ds.map((_, k) => num(s.requests?.[k])), cost: tokens.map(t => t / 1e6 * price) };
    });
    return { models: out, days: ds };
  }, [modelsProp, series, startIso, asOfIso]);
  const modelRaw = modelProp !== undefined ? modelProp : modelIn;
  const model = modelRaw && models.some(m => m.id === modelRaw) ? modelRaw : null;

  const emit = (f: UsageFilter) => onFilterChange?.(f);
  const setMetric = (m: UsageMetric) => { if (m === metric) return; if (metricProp === undefined) setMetricIn(m); emit({ metric: m, range, model }); };
  const setRange = (r: UsageRange) => { if (r === range) return; if (rangeProp === undefined) setRangeIn(r); emit({ metric, range: r, model }); };
  const isolate = (id: string | null) => {
    const next = id && id !== model ? id : null;
    if (modelProp === undefined) setModelIn(next);
    emit({ metric, range, model: next });
  };

  /* ---------- formatting ---------- */
  const money = (v: number, dp = 2) => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v); }
    catch { return "$" + v.toFixed(dp); }
  };
  const compact = (v: number, dp = 1) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: dp }).format(v);
  const fmt = (m: UsageMetric, v: number, short = false) => {
    if (m === "cost") return short && v >= 1000 ? "$" + compact(v) : money(v, v >= 100 && short ? 0 : 2);
    if (m === "tokens") return compact(v, v >= 1e8 ? 0 : 1);
    return short ? compact(v) : Math.round(v).toLocaleString(locale);
  };
  const date = (d: Date, o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => {
    try { return new Intl.DateTimeFormat(locale, o).format(d); } catch { return d.toDateString(); }
  };

  /* ---------- window, KPIs ---------- */
  const n = Math.min(range, days.length);
  const from = days.length - n;
  const wDays = days.slice(from);
  const vis = models.filter(m => !model || m.id === model);
  const totals = wDays.map((_, i) => vis.reduce((a, m) => a + m[metric][from + i], 0));
  const total = totals.reduce((a, v) => a + v, 0);
  const avg = n ? total / n : 0;
  const wk = totals.filter((_, i) => { const g = wDays[i].getDay(); return g !== 0 && g !== 6; });
  const wkAvg = wk.length ? wk.reduce((a, v) => a + v, 0) / wk.length : 0;
  let peak = -1; totals.forEach((v, i) => { if (peak < 0 || v > totals[peak]) peak = i; });
  const isoModel = model ? models.find(m => m.id === model) : undefined;
  const sumRange = (m: M) => m[metric].slice(from).reduce((a, v) => a + v, 0);

  /* ---------- chart geometry ---------- */
  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => { const w = Math.round(el.clientWidth); if (w) setW(prev => (Math.abs(prev - w) > 1 ? w : prev)); };
    measure();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const Wc = Math.max(260, W);
  const H = Wc < 420 ? 210 : 250;
  const pad = { l: 44, r: 6, t: 12, b: 26 };
  const pw = Wc - pad.l - pad.r, ph = H - pad.t - pad.b;
  const { max, step } = niceMax(Math.max(0, ...totals));
  const y = (v: number) => pad.t + ph - v / max * ph;
  const band = n ? pw / n : pw;
  const bw = Math.max(3, Math.min(24, band * 0.64));
  const base = pad.t + ph;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 58))));

  /* ---------- entrance / replay ---------- */
  const card = useRef<HTMLElement>(null);
  const inView = useInView(plotRef, { amount: 0.2 });
  const started = inView || instant;
  /* "reset" snaps bars to the baseline, "grow" staggers them up, "idle" = normal restack transitions */
  const [phase, setPhase] = useState<"reset" | "grow" | "idle">(instant ? "idle" : "grow");
  const entering = phase !== "idle";
  useEffect(() => {
    if (!started || phase !== "grow") return;
    const t = window.setTimeout(() => setPhase("idle"), 520 + n * 14 + 80);
    return () => window.clearTimeout(t);
  }, [started, phase, n]);
  useEffect(() => {
    if (phase !== "reset") return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setPhase("grow")); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [phase]);
  const replay = () => { if (!instant) setPhase("reset"); };

  useImperativeHandle(ref, () => ({ isolate, replay }));

  /* ---------- active day (hover / keyboard) ---------- */
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [live, setLive] = useState("");
  const act = active != null && active < n ? active : null;
  const announce = (i: number) => {
    const d = wDays[i]; if (!d) return;
    const t = vis.reduce((a, m) => a + m[metric][from + i], 0);
    setLive(`${date(d, { weekday: "long", month: "long", day: "numeric" })}: ` + vis.map(m => `${m.label} ${fmt(metric, m[metric][from + i])}`).join(", ") + (vis.length > 1 ? `. ${L.total} ${fmt(metric, t)}.` : "."));
  };
  const idxAt = (e: ReactPointerEvent) => {
    const el = plotRef.current; if (!el || !n) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / (r.width / Wc);
    const i = Math.floor((x - pad.l) / band);
    return i >= 0 && i < n ? i : null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    let i = act == null ? n - 1 : act;
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Escape") { setActive(null); return; }
    else return;
    e.preventDefault();
    setActive(i); announce(i);
  };

  /* ---------- side panel: quota + cost ---------- */
  const asOfDay = days.length ? days[days.length - 1] : new Date();
  const bStart = parseDay(billingStart) || new Date(asOfDay.getFullYear(), asOfDay.getMonth(), 1);
  const bEnd = new Date(bStart.getFullYear(), bStart.getMonth() + 1, bStart.getDate());
  const monthDays = Math.round((+bEnd - +bStart) / 864e5);
  const idx = days.map((d, i) => (d >= bStart && d < bEnd ? i : -1)).filter(i => i >= 0);
  const elapsed = Math.max(1, Math.round((+asOfDay - +bStart) / 864e5) + 1);
  const daysLeft = Math.max(0, monthDays - elapsed);
  const sumIdx = (m: M, k: UsageMetric) => idx.reduce((a, i) => a + m[k][i], 0);
  const usedTok = models.reduce((a, m) => a + sumIdx(m, "tokens"), 0);
  const projTok = usedTok / elapsed * monthDays;
  const quota = num(quotaProp);
  const usedR = quota > 0 ? Math.min(1, usedTok / quota) : 0;
  const projR = quota > 0 ? Math.min(1, projTok / quota) : 0;
  const usedPct = quota > 0 ? Math.round(usedTok / quota * 100) : null;
  const costs = models.map(m => ({ m, v: sumIdx(m, "cost") }));
  const mtd = costs.reduce((a, c) => a + c.v, 0);
  const projCost = mtd / elapsed * monthDays;
  const budget = num(budgetProp);
  const over = budget > 0 && projCost > budget;
  const scaleTo = Math.max(budget, projCost) || 1;
  const ringLabel = `${L.quota}: ${usedPct == null ? "—" : usedPct + "%"} used, ${compact(usedTok)} of ${compact(quota, 0)} tokens. ${L.projected} ${compact(projTok)}.`;

  const chartLabel = fill(L.chart, { metric: L[metric].toLowerCase(), n });
  const tipLeft = act == null ? 0 : (() => {
    const cx0 = pad.l + band * act + band / 2;
    const tw = 196;
    let left = cx0 + 14;
    if (left + tw > Wc) left = cx0 - tw - 14;
    return Math.max(0, left);
  })();

  const seg = "w-full rounded-full border-[var(--au-line)] bg-[var(--au-tint)] @lg:w-auto";
  const segBtn = "flex-1 rounded-full px-3 py-1.5 @lg:flex-none";
  const segInd = "rounded-full bg-[var(--au-card)] shadow-[0_1px_3px_-1px_rgb(29_22_44/0.3),0_0_0_1px_var(--au-line)]";

  return (
    <article
      ref={card}
      className={cx(
        PALETTE,
        "@container relative w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-[var(--au-line)] bg-[var(--au-card)] text-[var(--au-ink)] elev-3",
        className,
      )}
    >
      <div className="grid @4xl:grid-cols-[minmax(0,1fr)_296px]">
      {/* ---------------- main ---------------- */}
      <div className="relative grid min-w-0 content-start gap-5 px-4 pt-5 pb-4 @md:px-6 @md:pt-6 @4xl:px-7 @4xl:pb-5">
        <span aria-hidden className="pointer-events-none absolute -top-28 left-1/4 h-56 w-[28rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--au-lilac)_9%,transparent),transparent)]" />
        <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
          <div className="grid min-w-0 gap-1.5">
            {eyebrow && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--au-lilac)]">
                <Spark className="size-3" />{eyebrow}
              </span>
            )}
            {title && <h2 className="m-0 font-display text-[19px] leading-[1.2] font-semibold tracking-[-0.015em] @2xl:text-[22px]">{title}</h2>}
          </div>
          <div className="grid w-full grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_auto] @lg:flex @lg:w-auto @lg:items-center">
            <Segmented<UsageMetric>
              ariaLabel={L.metricGroup} value={metric} onChange={setMetric} size="sm" className={seg} buttonClassName={segBtn} indicatorClassName={segInd}
              options={USAGE_METRICS.map(m => ({ value: m, label: L[m] }))}
            />
            <Segmented<"14" | "30">
              ariaLabel={L.rangeGroup} value={String(range) as "14" | "30"} onChange={v => setRange(v === "14" ? 14 : 30)} size="sm" className={seg} buttonClassName={segBtn} indicatorClassName={segInd}
              options={[{ value: "14", label: L.range14 }, { value: "30", label: L.range30 }]}
            />
          </div>
        </header>

        {/* KPIs */}
        <dl className="relative m-0 grid grid-cols-2 gap-y-4 @xl:grid-cols-3">
          {[
            { k: fill(L.kTotal, { n }), v: total, s: isoModel ? fill(L.isolated, { name: isoModel.label }) : L[metric], big: true },
            { k: L.kAvg, v: avg, s: fill(L.weekdayAvg, { v: fmt(metric, wkAvg) }) },
            { k: L.kPeak, v: peak >= 0 ? totals[peak] : 0, s: peak >= 0 ? date(wDays[peak], { weekday: "short", month: "short", day: "numeric" }) : "", empty: peak < 0 },
          ].map((c, i) => (
            <div key={i} className={cx(
              "grid min-w-0 content-start gap-1",
              i === 0 ? "col-span-2 @xl:col-span-1 @xl:pr-4" : "px-0 @xl:px-4",
              i === 2 && "border-l border-[var(--au-line)] pl-4",
              i === 1 && "@xl:border-l @xl:border-[var(--au-line)]",
            )}>
              <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--au-faint)]">{c.k}</dt>
              <dd className="m-0">
                {c.empty ? <span className="font-display text-[24px] font-semibold">—</span> : (
                  <CountUp key={metric} value={c.v} format={v => fmt(metric, v)} duration={700} className={cx("font-display leading-none font-semibold tracking-[-0.025em]", c.big ? "text-[34px] @2xl:text-[38px]" : "text-[24px] @2xl:text-[26px]")} />
                )}
              </dd>
              <dd className="m-0 truncate text-[12.5px] text-[var(--au-muted)]">{c.s}</dd>
            </div>
          ))}
        </dl>

        {/* legend */}
        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-2">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {models.map(m => {
              const on = model === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button" aria-pressed={on} onClick={() => isolate(m.id)}
                    style={{ "--c": `var(--au-c${m.slot})` } as CSSProperties}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-[background,border-color,opacity] duration-200",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--au-lilac)]",
                      on ? "border-[color-mix(in_oklab,var(--au-lilac)_45%,transparent)] bg-[var(--au-lilac-soft)]" : "border-[var(--au-line)] hover:bg-[var(--au-tint)]",
                      model && !on && "opacity-50 hover:opacity-80",
                    )}
                  >
                    <i aria-hidden className="size-2.5 rounded-[3px] bg-[var(--c)]" />
                    {m.label}
                    <span className="font-mono text-[11px] text-[var(--au-muted)] tabular">{fmt(metric, sumRange(m), true)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <span className="basis-full text-[12px] text-[var(--au-faint)] @xl:ml-1 @xl:basis-auto">{L.hint}</span>
        </div>

        {/* chart */}
        <div
          ref={plotRef} tabIndex={0} role="group" aria-label={chartLabel}
          onPointerMove={e => { const i = idxAt(e); if (i !== act) setActive(i); }}
          onPointerDown={e => setActive(idxAt(e))}
          onPointerLeave={e => { if (e.pointerType === "touch") return; if (!focused) setActive(null); }}
          onFocus={() => { setFocused(true); if (act == null && n) { setActive(n - 1); announce(n - 1); } }}
          onBlur={() => { setFocused(false); setActive(null); }}
          onKeyDown={onKey}
          className="relative -mx-1 rounded-xl px-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--au-lilac)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--au-card)]"
        >
          {!n || !total ? (
            <p className="m-0 grid h-[210px] place-items-center text-[13px] text-[var(--au-faint)]">{L.noData}</p>
          ) : (
            <svg viewBox={`0 0 ${Wc} ${H}`} width={Wc} height={H} className="block max-w-full" aria-hidden>
              <defs>
                {wDays.map((_, i) => {
                  const abs = from + i;
                  const t = totals[i];
                  const x0 = pad.l + band * i + band / 2 - bw / 2;
                  const top = started && phase !== "reset" ? y(t) : base;
                  return (
                    <clipPath key={abs} id={`${uid}-c${abs}`}>
                      <motion.rect
                        initial={instant ? false : { x: x0, width: bw, y: base, height: 4 }}
                        animate={{ x: x0, width: bw, y: top, height: Math.max(0, base - top) + 4 }}
                        transition={phase === "reset" ? { duration: 0 } : { duration: entering ? 0.5 : 0.45, ease: EASE, delay: entering && started ? i * 0.014 : 0 }}
                        rx={Math.min(4, bw / 2)}
                      />
                    </clipPath>
                  );
                })}
              </defs>
              {/* grid + y labels */}
              <g>
                {ticks.map(v => {
                  const yy = Math.round(y(v)) + 0.5;
                  return (
                    <g key={v}>
                      <line x1={pad.l} x2={Wc - pad.r} y1={yy} y2={yy} stroke={v === 0 ? "var(--au-axis)" : "var(--au-grid)"} strokeDasharray={v === 0 ? undefined : "3 4"} />
                      <text x={pad.l - 8} y={yy + 4} textAnchor="end" className="fill-[var(--au-faint)] font-mono text-[10px] tabular">{v === 0 ? "0" : fmt(metric, v, true)}</text>
                    </g>
                  );
                })}
              </g>
              {/* columns */}
              <g>
                {wDays.map((day, i) => {
                  const abs = from + i;
                  const wd = day.getDay();
                  const weekend = wd === 0 || wd === 6;
                  const cx0 = pad.l + band * i + band / 2;
                  const x0 = cx0 - bw / 2;
                  let acc = 0;
                  const parts = models.map(m => {
                    const v = !model || m.id === model ? m[metric][abs] : 0;
                    const y0 = y(acc); acc += v; const y1 = y(acc);
                    return { m, y0, y1, v };
                  });
                  const topIdx = parts.map(p => p.v > 0).lastIndexOf(true);
                  return (
                    <g key={abs} className={cx("transition-opacity duration-200", act != null && act !== i && "opacity-40")}>
                      <rect
                        x={(pad.l + band * i + 0.5).toFixed(2)} y={pad.t} width={Math.max(1, band - 1).toFixed(2)} height={ph} rx={4}
                        fill={act === i ? "color-mix(in oklab, var(--au-lilac) 9%, transparent)" : weekend ? "color-mix(in oklab, var(--au-tint) 80%, transparent)" : "transparent"}
                        className="transition-[fill] duration-200"
                      />
                      <g clipPath={`url(#${uid}-c${abs})`}>
                        {parts.map((p, k) => {
                          const isTop = k === topIdx;
                          const yTop = p.v > 0 ? (isTop ? p.y1 : p.y1 + GAP) : p.y0;
                          const h = Math.max(0, p.y0 - yTop);
                          return (
                            <motion.rect
                              key={p.m.id}
                              initial={false}
                              animate={{ x: x0, width: bw, y: yTop, height: h }}
                              transition={{ duration: 0.45, ease: EASE }}
                              fill={`var(--au-c${p.m.slot})`}
                            />
                          );
                        })}
                      </g>
                    </g>
                  );
                })}
              </g>
              {/* x labels */}
              <g>
                {wDays.map((day, i) => {
                  if (!(i % labelEvery === (n - 1) % labelEvery || act === i)) return null;
                  const lx = pad.l + band * i + band / 2;
                  const edge = lx > Wc - pad.r - 22;
                  return (
                  <text
                    key={from + i} x={edge ? Wc - pad.r : lx} y={H - 8} textAnchor={edge ? "end" : "middle"}
                    className={cx("font-mono text-[10px] tabular", act === i ? "fill-[var(--au-lilac)] font-semibold" : "fill-[var(--au-faint)]", act != null && act !== i && i % labelEvery !== (n - 1) % labelEvery && "hidden")}
                  >
                    {date(day)}
                  </text>
                  );
                })}
              </g>
            </svg>
          )}

          {/* tooltip */}
          <AnimatePresence>
            {act != null && wDays[act] && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, left: tipLeft }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.16, left: { duration: instant ? 0 : 0.18, ease: EASE } }}
                style={{ top: pad.t + 4 }}
                className="pointer-events-none absolute z-10 grid w-[196px] gap-1.5 rounded-xl bg-[var(--au-tip)] px-3 py-2.5 text-[12px] text-[var(--au-tip-ink)] shadow-[0_18px_36px_-16px_rgb(29_22_44/0.55)]"
              >
                <strong className="text-[12.5px] font-semibold">{date(wDays[act], { weekday: "short", month: "short", day: "numeric" })}</strong>
                {[...vis].reverse().map(m => (
                  <div key={m.id} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2">
                    <i className="size-2.5 rounded-[3px]" style={{ background: `var(--au-c${m.slot})` }} />
                    <span className="truncate opacity-80">{m.label}</span>
                    <b className="font-semibold tabular">{fmt(metric, m[metric][from + act])}</b>
                  </div>
                ))}
                {vis.length > 1 && (
                  <div className="mt-0.5 flex justify-between border-t border-[color-mix(in_oklab,var(--au-tip-ink)_18%,transparent)] pt-1.5 font-semibold tabular">
                    <span>{L.total}</span><span>{fmt(metric, totals[act])}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <table className="sr-only">
          <caption>{chartLabel.split(".")[0]}</caption>
          <thead><tr><th>{L.day}</th>{vis.map(m => <th key={m.id}>{m.label}</th>)}<th>{L.total}</th></tr></thead>
          <tbody>
            {wDays.map((d, i) => (
              <tr key={from + i}>
                <th scope="row">{date(d, { weekday: "short", month: "short", day: "numeric" })}</th>
                {vis.map(m => <td key={m.id}>{fmt(metric, m[metric][from + i])}</td>)}
                <td>{fmt(metric, totals[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {source && <p className="relative m-0 border-t border-[var(--au-line)] pt-3 text-[12px] text-[var(--au-faint)]">{source}</p>}
      </div>

      {/* ---------------- side panel ---------------- */}
      <aside
        className={cx(
          "relative grid content-start gap-5 bg-[var(--au-panel)] px-4 py-5 text-[var(--au-panel-ink)] @md:px-6 @xl:grid-cols-2 @xl:gap-x-7 @4xl:grid-cols-1 @4xl:px-6 @4xl:py-6",
          "[--au-c1:var(--au-pc1)] [--au-c2:var(--au-pc2)] [--au-c3:var(--au-pc3)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_100%_0%,color-mix(in_oklab,var(--au-ring)_14%,transparent),transparent_60%)]" />
        {/* quota */}
        <section className="relative grid content-start gap-3.5">
          <h3 className="m-0 flex items-baseline justify-between gap-3 text-[13px] font-semibold">
            <span>{L.quota}</span>
            <span className="font-mono text-[10.5px] font-medium text-[var(--au-panel-muted)]">{fill(L.resets, { date: date(bEnd) })}</span>
          </h3>
          <div className="grid grid-cols-[108px_minmax(0,1fr)] items-center gap-4">
            <div role="img" aria-label={ringLabel} className="relative size-[108px]">
              <svg viewBox="0 0 124 124" className="size-full -rotate-90" aria-hidden>
                <circle cx={62} cy={62} r={52} fill="none" stroke="var(--au-ring-track)" strokeWidth={11} />
                <motion.circle
                  cx={62} cy={62} r={52} fill="none" stroke="var(--au-ring)" strokeOpacity={0.32} strokeWidth={11}
                  initial={instant ? false : { pathLength: 0 }} animate={{ pathLength: started ? projR : 0 }}
                  transition={{ duration: 0.8, ease: EASE }}
                />
                <motion.circle
                  cx={62} cy={62} r={52} fill="none" stroke="var(--au-ring)" strokeWidth={11} strokeLinecap="round"
                  initial={instant ? false : { pathLength: 0 }} animate={{ pathLength: started ? usedR : 0, opacity: usedR > 0 ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: instant ? 0 : 0.1 }}
                />
              </svg>
              <div aria-hidden className="absolute inset-0 grid place-content-center justify-items-center">
                <b className="font-display text-[26px] leading-none font-semibold tracking-[-0.03em] tabular">
                  {usedPct == null ? "—" : <CountUp value={usedPct} format={v => `${Math.round(v)}%`} duration={800} />}
                </b>
                <span className="mt-1 text-[10.5px] text-[var(--au-panel-muted)]">{L.ofTokens}</span>
              </div>
            </div>
            <dl className="m-0 grid gap-2.5">
              {[
                [L.used, `${compact(usedTok)} / ${compact(quota, 0)}`, ""],
                [L.projected, compact(projTok), quota > 0 ? `${Math.round(projTok / quota * 100)}% ${L.ofQuota}` : ""],
                [L.leftLabel, fill(L.days, { n: daysLeft }), fill(L.through, { date: date(addDays(bEnd, -1)) })],
              ].map(([k, v, s]) => (
                <div key={k} className="grid gap-0.5">
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--au-panel-muted)]">{k}</dt>
                  <dd className="m-0 text-[13.5px] font-semibold tabular">
                    {v} {s && <small className={cx("text-[11.5px] font-medium", k === L.projected && projR >= 1 ? "text-[var(--au-warn)]" : "text-[var(--au-panel-muted)]")}>{s}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* cost */}
        <section className="relative grid content-start gap-3 border-t border-[var(--au-panel-line)] pt-5 @xl:border-t-0 @xl:border-l @xl:pt-0 @xl:pl-7 @4xl:border-t @4xl:border-l-0 @4xl:pt-5 @4xl:pl-0">
          <h3 className="m-0 text-[13px] font-semibold">{L.costHead}</h3>
          <div className="flex items-baseline gap-2">
            <CountUp value={mtd} format={v => money(v)} duration={800} className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em]" />
            <span className="text-[12px] text-[var(--au-panel-muted)]">{L.mtd}</span>
          </div>
          <div className="grid gap-2" style={{ "--b": over ? "var(--au-warn)" : "var(--au-mint)" } as CSSProperties}>
            <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-[var(--au-panel-2)]">
              <motion.i
                className="absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--b)_58%,transparent)_0_3px,transparent_3px_6px)]"
                initial={instant ? false : { width: "0%" }} animate={{ width: started ? `${projCost / scaleTo * 100}%` : "0%" }} transition={{ duration: 0.8, ease: EASE }}
              />
              <motion.i
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--b)]"
                initial={instant ? false : { width: "0%" }} animate={{ width: started ? `${mtd / scaleTo * 100}%` : "0%" }} transition={{ duration: 0.8, ease: EASE, delay: instant ? 0 : 0.1 }}
              />
              {budget > 0 && <span className="absolute inset-y-0 w-px bg-[var(--au-panel-ink)] opacity-50" style={{ left: `${budget / scaleTo * 100}%` }} />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-[var(--au-panel-muted)]">
              <span><b className="font-semibold text-[var(--au-panel-ink)]">{fill(L.projectedCost, { v: money(projCost) })}</b>{budget > 0 && ` · ${fill(L.budget, { v: money(budget, 0) })}`}</span>
              {budget > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--b)]">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[13px]" aria-hidden>
                    {over ? <><path d="M7 1.8 12.8 12H1.2z" /><path d="M7 5.6v2.8M7 10.2v.1" /></> : <><circle cx="7" cy="7" r="5.6" /><path d="M4.6 7.2 6.3 8.8 9.4 5.4" /></>}
                  </svg>
                  {over ? L.over : L.under}
                </span>
              )}
            </div>
          </div>
          <h4 className="m-0 mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--au-panel-muted)]">{L.byModel}</h4>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {costs.map(c => {
              const share = mtd > 0 ? Math.round(c.v / mtd * 100) : 0;
              return (
                <li key={c.m.id} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 text-[13px] tabular">
                  <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: `var(--au-c${c.m.slot})` }} />
                  <span className="truncate">{c.m.label}</span>
                  <b className="font-semibold">{money(c.v)}</b>
                  <small className="col-start-2 col-end-4 text-[11.5px] text-[var(--au-panel-muted)]">{share}% · {fill(L.perM, { v: money(c.m.price) })}</small>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>
    </article>
  );
}
