import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useReducer, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Segmented, cx } from "../../ui";
import { useCountUp, useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { LeadMetric, LeadSource } from "./data";

/* ------------------------------------------------------------
   Lead Source Breakdown — donut + legend table. Colour follows
   the source (slot order is colour-blind checked), not its rank.
   ------------------------------------------------------------ */

export const LEAD_SOURCE_LABELS = {
  metricGroup: "Measure", leads: "Leads", revenue: "Revenue", cpl: "Cost per lead",
  colSource: "Source", colShare: "Share", colShareSpend: "Share of spend",
  totalLeads: "total leads", totalRevenue: "total revenue", blended: "blended cost per lead",
  ofSources: "{n} of {total} sources", total: "Total", visible: "Visible total",
  shareOf: "{pct} of {what}", spendWord: "spend", leadsWord: "leads", revenueWord: "revenue",
  ringLeads: "Ring: share of leads", ringRevenue: "Ring: share of revenue", ringCpl: "Ring: share of spend",
  insTop: "Largest share", insRpl: "Most revenue per lead", insCheap: "Cheapest leads", insPricey: "Priciest leads",
  perLead: "{v} per lead", hiddenN: "{n} hidden", showAll: "Show all",
  keepOne: "At least one source stays visible.", hidden: "{name} hidden", shown: "{name} shown",
  other: "Other", chart: "Share by source. Use the arrow keys to move between segments.",
  hint: "Select a source to hide or show it",
};
export type LeadSourceLabels = typeof LEAD_SOURCE_LABELS;

export interface LeadSourceToggleDetail { id: string; label: string; visible: boolean; visibleIds: string[] }

export interface LeadSourceBreakdownHandle {
  /** Hide / show a source (omit `visible` to flip it). Returns false when it would hide the last visible source. */
  toggleSource: (id: string, visible?: boolean) => boolean;
  showAll: () => void;
  /** Sweep the ring in again. */
  replay: () => void;
  visibleSources: () => string[];
}

export interface LeadSourceBreakdownProps {
  /** Up to six; any more are folded into "Other". */
  sources: LeadSource[];
  eyebrow?: string;
  title?: string;
  period?: string;
  /** ISO currency (default USD). */
  currency?: string;
  /** Number locale (default en-US). */
  locale?: string;
  /** Footer note, e.g. where the data comes from. */
  footnote?: string;
  metric?: LeadMetric;
  defaultMetric?: LeadMetric;
  onMetricChange?: (metric: LeadMetric) => void;
  onSourceToggle?: (detail: LeadSourceToggleDetail) => void;
  labels?: Partial<LeadSourceLabels>;
  className?: string;
  ref?: Ref<LeadSourceBreakdownHandle>;
}

/* ---------------- geometry ---------------- */
const SIZE = 260, C = 130, R_OUT = 122, R_IN = 86, GAP = 2.5, SLOTS = 6, TOP = -Math.PI / 2;
const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
const f2 = (n: number) => n.toFixed(2);
/** Annular sector with a constant-width gap on both edges. */
function arc(a0: number, a1: number): string {
  const span = a1 - a0;
  if (span <= 0.0005) return "";
  if (span >= Math.PI * 2 - 1e-6) {
    return `M${C - R_OUT} ${C}A${R_OUT} ${R_OUT} 0 1 1 ${C + R_OUT} ${C}A${R_OUT} ${R_OUT} 0 1 1 ${C - R_OUT} ${C}Z` +
      `M${C - R_IN} ${C}A${R_IN} ${R_IN} 0 1 0 ${C + R_IN} ${C}A${R_IN} ${R_IN} 0 1 0 ${C - R_IN} ${C}Z`;
  }
  const go = GAP / 2 / R_OUT, gi = GAP / 2 / R_IN;
  if (span <= gi * 2 + 0.002) return "";
  const large = span - go * 2 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(R_OUT, a0 + go), [x1, y1] = pt(R_OUT, a1 - go), [x2, y2] = pt(R_IN, a1 - gi), [x3, y3] = pt(R_IN, a0 + gi);
  return `M${f2(x0)} ${f2(y0)}A${R_OUT} ${R_OUT} 0 ${large} 1 ${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}A${R_IN} ${R_IN} 0 ${large} 0 ${f2(x3)} ${f2(y3)}Z`;
}

/** Largest-remainder rounding so the shown shares add up to exactly 100.0. */
function shares(values: number[]): number[] {
  const total = values.reduce((a, v) => a + v, 0);
  if (!(total > 0)) return values.map(() => 0);
  const raw = values.map(v => (v / total) * 1000);
  const base = raw.map(Math.floor);
  let left = 1000 - base.reduce((a, v) => a + v, 0);
  raw.map((v, i) => [v - base[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && values[i] > 0) { base[i]++; left--; } });
  return base.map(v => v / 10);
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/* colour slots: validated order (adjacent pairs incl. the 6 → 1 wrap, light + dark) */
const PALETTE = [
  "[--c1:#2A78D6] [--c2:#EB6834] [--c3:#1BAF7A] [--c4:#EDA100] [--c5:#E87BA4] [--c6:#008300]",
  "dark:[--c1:#3987E5] dark:[--c2:#D95926] dark:[--c3:#199E70] dark:[--c4:#C98500] dark:[--c5:#D55181] dark:[--c6:#008300]",
  "[--focus:#1F5FAF] dark:[--focus:#7FB2F0] [--track:#EEF0F2] dark:[--track:#23262B] [--ring:var(--focus)]",
].join(" ");

interface Item extends LeadSource { color: string; slot: number }
type Angles = Record<string, [number, number]>;

/* ---------------- donut with tweened segments ---------------- */
function Donut({ items, targets, start, replay, instant, active, off, focusId, labelFor, onActive, onFocusSeg, chartLabel }: {
  items: Item[]; targets: Angles; start: boolean; replay: number; instant: boolean; active: string | null; off: Set<string>; focusId: string | null;
  labelFor: (id: string) => string; onActive: (id: string | null) => void; onFocusSeg: (id: string) => void; chartLabel: string;
}) {
  const collapsed = useCallback((t: Angles): Angles => Object.fromEntries(Object.keys(t).map(k => [k, [TOP, TOP]])), []);
  const angles = useRef<Angles>(instant ? targets : collapsed(targets));
  const [, paint] = useReducer((x: number) => x + 1, 0);
  const lastReplay = useRef(replay);
  const key = JSON.stringify(targets);
  const segRefs = useRef<Record<string, SVGPathElement | null>>({});

  useEffect(() => {
    if (!start) return;
    const to: Angles = JSON.parse(key);
    if (lastReplay.current !== replay) { lastReplay.current = replay; if (!instant) angles.current = collapsed(to); }
    const from: Angles = {};
    Object.keys(to).forEach(id => { from[id] = angles.current[id] ?? [to[id][0], to[id][0]]; });
    if (instant) { angles.current = to; paint(); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / 560));
      const next: Angles = {};
      Object.keys(to).forEach(id => { next[id] = [from[id][0] + (to[id][0] - from[id][0]) * k, from[id][1] + (to[id][1] - from[id][1]) * k]; });
      angles.current = next;
      paint();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, start, replay, instant, collapsed]);

  const vis = items.filter(s => !off.has(s.id)).map(s => s.id);
  const onKey = (e: KeyboardEvent<SVGPathElement>, id: string) => {
    const cur = vis.indexOf(id);
    if (cur < 0) return;
    let n: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (cur + 1) % vis.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (cur - 1 + vis.length) % vis.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = vis.length - 1;
    else if (e.key === "Escape") { onActive(null); return; }
    if (n == null) return;
    e.preventDefault();
    onFocusSeg(vis[n]);
    segRefs.current[vis[n]]?.focus();
  };
  const tabStop = focusId && vis.includes(focusId) ? focusId : vis[0];

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label={chartLabel} className="block h-auto w-full overflow-visible" onPointerLeave={() => onActive(null)}>
      <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} strokeWidth={R_OUT - R_IN} className="fill-none stroke-[var(--track)]" />
      <circle cx={C} cy={C} r={R_IN - 7} className="fill-none stroke-line" strokeDasharray="1.5 4" />
      {items.map(s => {
        const a = angles.current[s.id];
        const hidden = off.has(s.id);
        const on = active === s.id;
        const mid = a ? (a[0] + a[1]) / 2 : 0;
        return (
          <path key={s.id} ref={el => { segRefs.current[s.id] = el; }}
            d={a && !hidden ? arc(a[0], a[1]) : ""}
            fill={s.color} role="img" aria-label={labelFor(s.id)}
            tabIndex={hidden ? -1 : s.id === tabStop ? 0 : -1}
            aria-hidden={hidden || undefined}
            onPointerEnter={() => onActive(s.id)}
            onClick={() => onActive(s.id)}
            onFocus={() => { onFocusSeg(s.id); onActive(s.id); }}
            onBlur={() => onActive(null)}
            onKeyDown={e => onKeyDownGuard(e) && onKey(e, s.id)}
            style={{
              transform: on ? `translate(${f2(Math.cos(mid) * 5)}px, ${f2(Math.sin(mid) * 5)}px)` : "none",
              opacity: active && !on ? 0.3 : 1,
              filter: on ? "saturate(1.08) brightness(1.04) drop-shadow(0 6px 10px rgb(0 0 0 / 0.18))" : "none",
              transformBox: "view-box", transformOrigin: "50% 50%",
            }}
            className={cx("cursor-pointer outline-none transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] [paint-order:stroke] motion-reduce:transition-none",
              "focus-visible:stroke-[var(--focus)] focus-visible:[stroke-width:2.5px] focus-visible:outline-none", hidden && "pointer-events-none")} />
        );
      })}
    </svg>
  );
}
const onKeyDownGuard = (e: KeyboardEvent) => !e.altKey && !e.ctrlKey && !e.metaKey;

/* ---------------- main ---------------- */
export function LeadSourceBreakdown({
  sources, eyebrow, title, period, currency = "USD", locale = "en-US", footnote,
  metric: metricProp, defaultMetric = "leads", onMetricChange, onSourceToggle, labels, className, ref,
}: LeadSourceBreakdownProps) {
  const L = useMemo(() => ({ ...LEAD_SOURCE_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const instant = preview || reduced;

  const [innerMetric, setInnerMetric] = useState<LeadMetric>(defaultMetric);
  const metric: LeadMetric = metricProp ?? innerMetric;
  const setMetric = (m: LeadMetric) => { if (m === metric) return; if (metricProp === undefined) setInnerMetric(m); onMetricChange?.(m); };

  /* normalise: ≤ 6 slots, the rest folded into "Other" */
  const items = useMemo<Item[]>(() => {
    let list: LeadSource[] = (sources ?? []).filter(Boolean).map((s, i) => ({
      id: String(s.id || s.label || `source-${i + 1}`), label: s.label || `Source ${i + 1}`,
      leads: num(s.leads), revenue: num(s.revenue), spend: num(s.spend), hidden: !!s.hidden,
    }));
    if (list.length > SLOTS) {
      const keep = list.slice(0, SLOTS - 1), rest = list.slice(SLOTS - 1);
      keep.push({ id: "other", label: L.other, leads: rest.reduce((a, s) => a + s.leads, 0), revenue: rest.reduce((a, s) => a + s.revenue, 0), spend: rest.reduce((a, s) => a + s.spend, 0) });
      list = keep;
    }
    return list.map((s, i) => ({ ...s, slot: i + 1, color: `var(--c${i + 1})` }));
  }, [sources, L.other]);

  /* hidden set survives data swaps for ids that still exist */
  const [off, setOff] = useState<Set<string>>(() => new Set(items.filter(s => s.hidden).map(s => s.id)));
  const [seenItems, setSeenItems] = useState(items);
  if (seenItems !== items) {
    setSeenItems(items);
    const ids = new Set(items.map(s => s.id));
    const next = new Set([...off].filter(id => ids.has(id)));
    if (next.size >= items.length && items.length) next.delete(items[0].id);
    if (next.size !== off.size) setOff(next);
  }

  const [active, setActive] = useState<string | null>(null);
  const [focusSeg, setFocusSeg] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const [toast, setToast] = useState("");
  const [live, setLive] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const activeId = active && !off.has(active) ? active : null;

  /* ---------- money / number formatting ---------- */
  const money = useCallback((v: number, opts: Intl.NumberFormatOptions = {}) => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0, ...opts }).format(v); }
    catch { return "$" + Math.round(v).toLocaleString(); }
  }, [locale, currency]);
  const fmt = useCallback((m: LeadMetric, v: number | null, compact = false) => {
    if (v == null) return "—";
    if (m === "leads") return Math.round(v).toLocaleString(locale);
    if (m === "cpl") return money(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return compact && v >= 100000 ? money(v, { notation: "compact", maximumFractionDigits: 1 }) : money(v);
  }, [locale, money]);
  const pct = (p: number) => p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  /* ---------- model ---------- */
  const model = useMemo(() => {
    const vis = items.filter(s => !off.has(s.id));
    const ringKey = metric === "cpl" ? "spend" : metric;
    const ringVals = items.map(s => (off.has(s.id) ? 0 : s[ringKey]));
    const sh = shares(ringVals);
    const ringTotal = ringVals.reduce((a, v) => a + v, 0);
    const totLeads = vis.reduce((a, s) => a + s.leads, 0);
    const totRev = vis.reduce((a, s) => a + s.revenue, 0);
    const totSpend = vis.reduce((a, s) => a + s.spend, 0);
    const rows = items.map((s, i) => ({
      s, share: sh[i], ring: ringVals[i],
      value: metric === "leads" ? s.leads : metric === "revenue" ? s.revenue : s.leads > 0 ? s.spend / s.leads : null,
    }));
    const total = metric === "leads" ? totLeads : metric === "revenue" ? totRev : totLeads > 0 ? totSpend / totLeads : null;
    const targets: Angles = {};
    let a = TOP;
    rows.forEach(r => { const span = ringTotal > 0 ? (r.ring / ringTotal) * Math.PI * 2 : 0; targets[r.s.id] = [a, a + span]; a += span; });
    return { vis, rows, total, targets };
  }, [items, off, metric]);

  const what = metric === "cpl" ? L.spendWord : metric === "revenue" ? L.revenueWord : L.leadsWord;
  const rowById = (id: string) => model.rows.find(r => r.s.id === id);
  const labelFor = (id: string) => {
    const r = rowById(id);
    if (!r) return "";
    return `${r.s.label}: ${fmt(metric, r.value)}${metric === "cpl" ? " per lead" : ""}, ${fill(L.shareOf, { pct: pct(r.share), what })}`;
  };

  /* ---------- actions ---------- */
  const visibleIds = useCallback((o: Set<string>) => items.filter(s => !o.has(s.id)).map(s => s.id), [items]);
  const say = (t: string) => { setLive(""); requestAnimationFrame(() => setLive(t)); };
  const toggleSource = useCallback((id: string, visible?: boolean) => {
    const s = items.find(x => x.id === id);
    if (!s) return false;
    const want = visible == null ? off.has(id) : !!visible;
    if (want === !off.has(id)) return true;
    if (!want && visibleIds(off).length <= 1) {
      say(L.keepOne);
      setToast(L.keepOne);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 2600);
      return false;
    }
    const next = new Set(off);
    if (want) next.delete(id); else next.add(id);
    setOff(next);
    say(fill(want ? L.shown : L.hidden, { name: s.label }));
    onSourceToggle?.({ id, label: s.label, visible: want, visibleIds: visibleIds(next) });
    return true;
  }, [items, off, visibleIds, onSourceToggle, L.keepOne, L.shown, L.hidden]);

  const showAll = useCallback(() => {
    const was = [...off];
    if (!was.length) return;
    const next = new Set<string>();
    setOff(next);
    was.forEach(id => { const s = items.find(x => x.id === id); onSourceToggle?.({ id, label: s ? s.label : id, visible: true, visibleIds: visibleIds(next) }); });
  }, [off, items, onSourceToggle, visibleIds]);

  useImperativeHandle(ref, () => ({ toggleSource, showAll, replay: () => setReplay(r => r + 1), visibleSources: () => visibleIds(off) }), [toggleSource, showAll, visibleIds, off]);

  /* ---------- centre ---------- */
  const act = activeId ? rowById(activeId) : null;
  const centreValue = act ? act.value : model.total;
  const counted = useCountUp(centreValue ?? 0, { duration: 480, start: inView });
  const centreText = centreValue == null ? "—" : fmt(metric, metric === "leads" ? Math.round(counted) : counted, true);

  /* ---------- insights ---------- */
  const insights = useMemo(() => {
    const vis = model.rows.filter(r => !off.has(r.s.id));
    type R = (typeof vis)[number];
    const by = (f: (r: R) => number | null, dir: 1 | -1) =>
      vis.filter(r => f(r) != null).reduce<R | null>((a, r) => (!a || (dir > 0 ? f(r)! > f(a)! : f(r)! < f(a)!) ? r : a), null);
    const cplOf = (r: R) => (r.s.leads > 0 ? r.s.spend / r.s.leads : null);
    const out: { label: string; r: R | null; value: string }[] = [];
    if (metric === "cpl") {
      const cheap = by(r => r.value, -1), pricey = by(r => r.value, 1);
      out.push({ label: L.insCheap, r: cheap, value: cheap ? fill(L.perLead, { v: fmt("cpl", cheap.value) }) : "" });
      out.push({ label: L.insPricey, r: pricey, value: pricey ? fill(L.perLead, { v: fmt("cpl", pricey.value) }) : "" });
    } else {
      const top = by(r => r.share, 1);
      out.push({ label: L.insTop, r: top, value: top ? fill(L.shareOf, { pct: pct(top.share), what }) : "" });
      const cheap = by(cplOf, -1);
      out.push({ label: L.insCheap, r: cheap, value: cheap ? fill(L.perLead, { v: fmt("cpl", cplOf(cheap)) }) : "" });
    }
    const rplOf = (r: R) => (r.s.leads > 0 ? r.s.revenue / r.s.leads : null);
    const rpl = by(rplOf, 1);
    out.push({ label: L.insRpl, r: rpl, value: rpl ? fill(L.perLead, { v: money(rplOf(rpl)!) }) : "" });
    return out;
  }, [model, off, metric, L, fmt, money]);

  const hidden = off.size;
  const caption = metric === "leads" ? L.ringLeads : metric === "revenue" ? L.ringRevenue : L.ringCpl;

  return (
    <div ref={rootRef} className={cx("@container w-full max-w-[960px]", PALETTE, className)}>
      <article className="relative overflow-hidden rounded-[22px] border border-line bg-surface p-4 elev-3 @md:p-5 @2xl:px-7 @2xl:pt-6 @2xl:pb-5">
        <span aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--c1)_10%,transparent),transparent)]" />
        <span aria-hidden className="pointer-events-none absolute -right-24 -bottom-40 size-96 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--c2)_7%,transparent),transparent)]" />

        {/* ---------- header ---------- */}
        <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="grid min-w-0 gap-1.5">
            {eyebrow && (
              <span className="flex items-center gap-2 font-mono text-[11px] leading-none font-semibold tracking-[0.1em] text-ink-3 uppercase">
                <span aria-hidden className="inline-flex gap-[3px]">{[1, 2, 3].map(i => <i key={i} className="size-1.5 rounded-full" style={{ background: `var(--c${i})` }} />)}</span>
                {eyebrow}
              </span>
            )}
            {title && <h2 className="m-0 font-display text-[21px] leading-[1.15] font-semibold tracking-[-0.018em] text-balance text-ink @2xl:text-[25px]">{title}</h2>}
            {period && <p className="m-0 text-[13.5px] text-ink-2 tabular">{period}</p>}
          </div>
          <Segmented<LeadMetric> ariaLabel={L.metricGroup} value={metric} onChange={setMetric}
            className="w-full @lg:w-auto" buttonClassName="flex-1 @lg:flex-none px-2 @sm:px-3.5"
            activeClassName="text-canvas!" indicatorClassName="bg-ink!"
            options={(["leads", "revenue", "cpl"] as const).map(m => ({ value: m, label: L[m] }))} />
        </header>

        {/* ---------- body ---------- */}
        <div className="relative mt-5 grid items-center gap-5 @2xl:mt-6 @xl:grid-cols-[200px_minmax(0,1fr)] @xl:gap-6 @2xl:grid-cols-[220px_minmax(0,1fr)] @4xl:grid-cols-[290px_minmax(0,1fr)] @4xl:gap-9">
          <div className="grid justify-items-center gap-2.5">
            <div className="relative w-full max-w-[236px] @xl:max-w-none">
              <Donut items={items} targets={model.targets} start={inView} replay={replay} instant={instant}
                active={activeId} off={off} focusId={focusSeg} labelFor={labelFor} chartLabel={L.chart}
                onActive={id => setActive(id)} onFocusSeg={setFocusSeg} />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="grid max-w-[60%] justify-items-center gap-1 text-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={act ? act.s.id : `t-${metric}-${model.vis.length}`}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-1.5 font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] text-ink-3 uppercase @4xl:text-[11px]">
                      {act && <i className="size-2 flex-none rounded-[2px]" style={{ background: act.s.color }} />}
                      {act ? act.s.label : model.vis.length < items.length ? fill(L.ofSources, { n: model.vis.length, total: items.length }) : L[metric]}
                    </motion.span>
                  </AnimatePresence>
                  <span className="font-display text-[25px] leading-none font-[650] tracking-[-0.025em] text-ink tabular @4xl:text-[33px]">{centreText}</span>
                  <span className="text-[12px] leading-tight text-ink-2 tabular @4xl:text-[12.5px]">
                    {act
                      ? metric === "cpl" ? `per lead · ${fill(L.shareOf, { pct: pct(act.share), what })}` : fill(L.shareOf, { pct: pct(act.share), what })
                      : metric === "leads" ? L.totalLeads : metric === "revenue" ? L.totalRevenue : L.blended}
                  </span>
                </div>
              </div>
            </div>
            <p className="m-0 text-center text-[12px] text-ink-3">{caption}</p>
          </div>

          {/* ---------- legend table ---------- */}
          <div className="min-w-0" onPointerLeave={() => setActive(null)}>
            <table className="w-full border-collapse text-[13.5px] tabular @lg:text-[14px]">
              <caption className="sr-only">{(title || L.colSource) + (period ? `, ${period}` : "") + `. ${L.hint}.`}</caption>
              <thead>
                <tr className="border-b border-line font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] text-ink-3 uppercase">
                  <th scope="col" className="pb-2.5 text-left font-semibold">{L.colSource}</th>
                  <th scope="col" className="px-1.5 pb-2.5 text-right font-semibold @lg:px-2.5">{L[metric]}</th>
                  <th scope="col" className="pb-2.5 pl-1.5 text-right font-semibold @lg:pl-2.5">{metric === "cpl" ? L.colShareSpend : L.colShare}</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map(r => {
                  const isOff = off.has(r.s.id);
                  const on = activeId === r.s.id;
                  const dim = !!activeId && !on;
                  return (
                    <tr key={r.s.id} onPointerEnter={() => setActive(isOff ? null : r.s.id)}
                      className={cx("border-b border-line transition-[background-color,opacity] duration-200", on && "bg-sunken/70", (isOff || dim) && "opacity-55")}
                      style={on ? { boxShadow: `inset 3px 0 0 ${r.s.color}` } : undefined}>
                      <th scope="row" className="p-0 text-left font-normal">
                        <button type="button" aria-pressed={!isOff} onClick={() => toggleSource(r.s.id)}
                          onFocus={() => setActive(isOff ? null : r.s.id)} onBlur={() => setActive(null)}
                          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg pr-1 pl-1.5 text-left text-[13.5px] font-semibold text-ink focus-visible:outline-offset-[-2px] @lg:gap-3 @lg:pl-2.5 @lg:text-[14px]">
                          <span className="relative grid size-3.5 flex-none place-items-center rounded-[4px] transition-[background-color,box-shadow] duration-200"
                            style={isOff ? { boxShadow: `inset 0 0 0 1.5px ${r.s.color}` } : { background: r.s.color, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}>
                            <motion.svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3"
                              initial={false} animate={{ opacity: isOff ? 0 : 1, scale: isOff ? 0.5 : 1 }} transition={{ duration: 0.18 }}>
                              <path d="M2.6 6.2 5 8.5 9.4 3.7" />
                            </motion.svg>
                          </span>
                          <span className={cx("min-w-0 [overflow-wrap:anywhere]", isOff && "line-through decoration-ink-3")}>{r.s.label}</span>
                        </button>
                      </th>
                      <td className={cx("px-1.5 text-right font-semibold whitespace-nowrap text-ink @lg:px-2.5", isOff && "line-through decoration-ink-3")}>{fmt(metric, r.value)}</td>
                      <td className="pl-1.5 text-right @lg:w-[36%] @lg:pl-2.5">
                        <div className="flex items-center justify-end gap-2.5">
                          <span aria-hidden className="hidden h-1.5 max-w-[120px] flex-1 overflow-hidden rounded-full bg-[var(--track)] @lg:block">
                            <span className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none"
                              style={{ width: `${isOff || !inView ? 0 : r.share}%`, background: r.s.color }} />
                          </span>
                          <span className={cx("min-w-[46px] whitespace-nowrap text-ink-2", isOff && "line-through decoration-ink-3")}>{isOff ? "—" : pct(r.share)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 text-left text-[13px] font-medium text-ink-2">
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                      {hidden ? L.visible : L.total}
                      {hidden > 0 && (
                        <button type="button" onClick={() => { showAll(); requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("tbody button")?.focus()); }}
                          className="rounded-sm text-[13px] font-semibold text-[var(--focus)] underline underline-offset-[3px] hover:no-underline">
                          {fill(L.hiddenN, { n: hidden })} · {L.showAll}
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-1.5 pt-3 text-right font-semibold whitespace-nowrap text-ink @lg:px-2.5">{fmt(metric, model.total)}</td>
                  <td className="pt-3 pl-1.5 text-right font-medium text-ink-2 @lg:pl-2.5">{model.vis.length ? "100.0%" : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ---------- insights ---------- */}
        <dl className="relative mt-5 mb-0 grid gap-2.5 @lg:grid-cols-2 @3xl:grid-cols-3 @2xl:mt-6">
          {insights.map((ins, i) => (
            <div key={ins.label} className={cx("grid min-w-0 gap-1.5 rounded-xl border border-line bg-surface-2 px-3.5 py-3", i === 2 && "@lg:col-span-2 @3xl:col-span-1")}>
              <dt className="font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] text-ink-3 uppercase">{ins.label}</dt>
              <dd className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] font-semibold text-ink tabular">
                {ins.r ? <><i aria-hidden className="size-[9px] flex-none self-center rounded-[2px]" style={{ background: ins.r.s.color }} />{ins.r.s.label}</> : "—"}
                {ins.value && <span className="text-[13px] font-medium text-ink-2">{ins.value}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <footer className="relative mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-[12px] text-ink-3">
          <span>{footnote}</span>
          <AnimatePresence>
            {toast && (
              <motion.span key="toast" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1.5 font-medium text-ink-2">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--c2)]" />{toast}
              </motion.span>
            )}
          </AnimatePresence>
        </footer>
        <p id={`${uid}-live`} className="sr-only" aria-live="polite">{live}</p>
      </article>
    </div>
  );
}
