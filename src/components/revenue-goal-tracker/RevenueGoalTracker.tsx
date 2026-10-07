import { Fragment, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../ui";
import { useCountUp, useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { RGT_LABELS, type RevenueGoalData, type RgtLabels, type Sale } from "./data";

/* ------------------------------------------------------------
   Revenue Goal Tracker — electric-blue goal hero with milestone
   meter and today's pace, current vs needed run-rate, projection,
   and a validated "Log a sale" form with undo, recent sales,
   milestone toast and a small confetti burst.
   ------------------------------------------------------------ */

export interface GoalProgressDetail {
  kind: "add" | "undo";
  raised: number;
  goal: number;
  /** Percentage of goal, one decimal. */
  pct: number;
  sale: Sale;
  /** Milestones crossed by this change (add only). */
  crossed: number[];
}

/** Imperative API (pass a ref). */
export interface RevenueGoalTrackerHandle {
  /** Adds a sale (date defaults to `today`). Returns false when the amount is not above zero. */
  addSale: (sale: { client?: string; amount: number; date?: string }) => boolean;
  /** Removes the last sale added in this session. */
  undo: () => boolean;
  readonly raised: number;
}

export interface RevenueGoalTrackerProps {
  data: RevenueGoalData;
  labels?: Partial<RgtLabels>;
  className?: string;
  ref?: Ref<RevenueGoalTrackerHandle>;
  /** Every added or undone sale. */
  onProgress?: (detail: GoalProgressDetail) => void;
}

interface Row extends Sale { _id: string; _user?: boolean }

const ease = [0.16, 1, 0.3, 1] as const;
const MAX = 10_000_000;
const CONFETTI = ["#2563EB", "#60A5FA", "#93C5FD", "#F59E0B", "#10B981", "#EC4899", "#818CF8"];
const DAY = 864e5;

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const parseDay = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** Fill a label and turn its <b>…</b> parts into bold nodes (values are inserted as text, never HTML). */
function rich(template: string, vars: Record<string, string | number>, boldClass = "font-semibold text-[var(--rgt-ink)]"): ReactNode {
  return template.split(/(<b>.*?<\/b>)/g).filter(Boolean).map((part, i) => {
    const m = /^<b>(.*)<\/b>$/.exec(part);
    return m ? <b key={i} className={boldClass}>{fill(m[1], vars)}</b> : <Fragment key={i}>{fill(part, vars)}</Fragment>;
  });
}

const normalise = (list: Sale[] | undefined): Row[] =>
  (Array.isArray(list) ? list : []).filter(s => s && (num(s.amount) ?? 0) > 0).map((s, i) => ({ client: s.client || "", amount: Number(s.amount), date: s.date || "", _id: `d${i}` }));

/* ---------------- icons ---------------- */
const Target = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-[13px]"><circle cx="7" cy="7" r="5.5" /><circle cx="7" cy="7" r="2.5" /><circle cx="7" cy="7" r=".6" fill="currentColor" /></svg>;
const Check = ({ className = "size-[9px]" }: { className?: string }) => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d="m2.6 6.3 2.3 2.3 4.6-5" /></svg>;
const Plus = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-3.5"><path d="M7 2.5v9M2.5 7h9" /></svg>;
const Undo = () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[13px]"><path d="M4.5 3 2 5.5 4.5 8" /><path d="M2.5 5.5h6a3.5 3.5 0 0 1 0 7H6" /></svg>;
const Flag = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[15px]"><path d="M3.5 14V2.5M3.5 3h8l-1.6 2.8L11.5 8.5h-8" /></svg>;
const X = () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="size-3"><path d="m3 3 6 6M9 3 3 9" /></svg>;

/* ---------------- confetti ---------------- */
function Burst({ atPct, seed }: { atPct: number; seed: number }) {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const r = (k: number) => { const x = Math.sin(seed * 97 + i * 13.7 + k * 3.1) * 10000; return x - Math.floor(x); };
    const ang = ((-90 + (r(1) * 130 - 65)) * Math.PI) / 180, dist = 70 + r(2) * 90;
    return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, rot: Math.round(r(3) * 720 - 360), dur: 1.1 + r(4) * 0.5, color: CONFETTI[i % CONFETTI.length], round: i % 3 === 0 };
  }), [seed]);
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 z-30 overflow-visible">
      {bits.map((b, i) => (
        <motion.span key={i} className={cx("absolute top-10", b.round ? "size-[7px] rounded-full" : "h-3 w-2 rounded-[2px]")}
          style={{ left: `${atPct}%`, background: b.color, marginLeft: -4 }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 0.6 }}
          animate={{ opacity: [1, 1, 0], x: [0, b.dx, b.dx * 1.25], y: [0, b.dy, b.dy + 110], rotate: [0, b.rot / 2, b.rot], scale: [0.6, 1, 0.9] }}
          transition={{ duration: b.dur, ease: [0.2, 0.6, 0.35, 1], times: [0, 0.45, 1] }} />
      ))}
    </span>
  );
}

/* ---------------- cumulative mini chart ---------------- */
function PaceChart({ sales, start, elapsed, total, goal, raised, projected, show, L, money }: {
  sales: Row[]; start: Date; elapsed: number; total: number; goal: number; raised: number; projected: number; show: boolean; L: RgtLabels; money: (v: number, c?: boolean) => string;
}) {
  const preview = usePreviewMode();
  const clip = useId().replace(/[^a-zA-Z0-9]/g, "") + "pc";
  const perDay = new Array(Math.max(1, elapsed)).fill(0) as number[];
  for (const s of sales) { const d = parseDay(s.date); if (!d) continue; const i = Math.min(perDay.length - 1, Math.max(0, dayDiff(start, d))); perDay[i] += s.amount; }
  let run = 0;
  const cum = [0, ...perDay.map(v => (run += v))];
  const top = Math.max(goal, projected, raised, 1) * 1.08;
  const X = (d: number) => (d / total) * 100, Y = (v: number) => 100 - (v / top) * 100;
  const line = cum.map((v, d) => `${d ? "L" : "M"}${X(d).toFixed(2)} ${Y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${X(cum.length - 1).toFixed(2)} 100 L0 100 Z`;
  return (
    <figure className="m-0 mt-3.5 flex min-h-[132px] flex-1 flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[var(--rgt-faint)]">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.09em]">{L.trend}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><i aria-hidden className="h-0.5 w-3 rounded bg-[var(--rgt-accent)]" />{L.raisedKey}</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden className="w-3 border-t-2 border-dashed border-[var(--rgt-faint)]" />{L.paceKey}</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden className="w-3 border-t-2 border-dotted border-[var(--rgt-accent-2)]" />{L.projKey}</span>
        </span>
      </figcaption>
      <div className="relative min-h-[96px] flex-1" role="img"
        aria-label={`${L.trend}: ${money(raised)} raised by day ${elapsed} of ${total}; pace line to ${money(goal)}; projection ${money(projected)}.`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={`${clip}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--rgt-accent)" stopOpacity="0.22" /><stop offset="1" stopColor="var(--rgt-accent)" stopOpacity="0" /></linearGradient>
            <clipPath id={clip}><motion.rect x={-1} y={-5} height={110} initial={preview ? false : { width: 0 }} animate={{ width: show ? 102 : 0 }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1], delay: 0.3 }} /></clipPath>
          </defs>
          <line x1={0} x2={100} y1={Y(goal)} y2={Y(goal)} vectorEffect="non-scaling-stroke" stroke="var(--rgt-line)" strokeWidth={1} />
          <line x1={0} x2={100} y1={100} y2={100} vectorEffect="non-scaling-stroke" stroke="var(--rgt-line)" strokeWidth={1} />
          <line x1={0} y1={100} x2={100} y2={Y(goal)} vectorEffect="non-scaling-stroke" stroke="var(--rgt-faint)" strokeWidth={1.3} strokeDasharray="4 4" opacity={0.7} />
          <g clipPath={`url(#${clip})`}>
            <path d={area} fill={`url(#${clip}g)`} />
            <path d={line} fill="none" stroke="var(--rgt-accent)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {elapsed < total && <line x1={X(elapsed)} y1={Y(raised)} x2={100} y2={Y(projected)} vectorEffect="non-scaling-stroke" stroke="var(--rgt-accent-2)" strokeWidth={1.6} strokeDasharray="1.5 4" strokeLinecap="round" />}
          </g>
        </svg>
        <span aria-hidden className="absolute right-0 -translate-y-[calc(100%+3px)] font-mono text-[10px] font-medium text-[var(--rgt-faint)]" style={{ top: `${Y(goal)}%` }}>{L.goalKey} {money(goal, true)}</span>
        <motion.span aria-hidden className="absolute -ml-[5px] -mt-[5px] size-2.5 rounded-full border-2 border-[var(--rgt-card)] bg-[var(--rgt-accent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--rgt-accent)_18%,transparent)]"
          style={{ left: `${X(elapsed)}%`, top: `${Y(raised)}%` }} initial={preview ? false : { scale: 0 }} animate={{ scale: show ? 1 : 0 }} transition={{ delay: 1.2, type: "spring", stiffness: 400, damping: 20 }} />
      </div>
    </figure>
  );
}

/* ---------------- main ---------------- */

export function RevenueGoalTracker({ data, labels, className, ref, onProgress }: RevenueGoalTrackerProps) {
  const L = useMemo<RgtLabels>(() => ({ ...RGT_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const show = inView || preview;
  const locale = data.locale || "en-US";
  const currency = (data.currency || "USD").toUpperCase();

  const [sales, setSales] = useState<Row[]>(() => normalise(data.sales));
  const [userIds, setUserIds] = useState<string[]>([]);
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) { setPrevData(data); setSales(normalise(data.sales)); setUserIds([]); }
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const [sr, setSr] = useState("");
  const [toast, setToast] = useState<{ m: number; id: number } | null>(null);
  const [burst, setBurst] = useState<{ at: number; id: number } | null>(null);
  const toastT = useRef<number | undefined>(undefined);
  const burstT = useRef<number | undefined>(undefined);
  useEffect(() => () => { window.clearTimeout(toastT.current); window.clearTimeout(burstT.current); }, []);

  /* ---------- money / dates ---------- */
  const money = (v: number, compact = false) => {
    try {
      const o: Intl.NumberFormatOptions = { style: "currency", currency, maximumFractionDigits: 0 };
      if (compact) Object.assign(o, { notation: "compact", maximumFractionDigits: v >= 100000 ? 0 : 1 });
      else if (v % 1 && Math.abs(v) < 1000) o.minimumFractionDigits = o.maximumFractionDigits = 2;
      return new Intl.NumberFormat(locale, o).format(v);
    } catch { return `${currency} ${Math.round(v)}`; }
  };
  const symbol = useMemo(() => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find(x => x.type === "currency")?.value ?? "$"; }
    catch { return "$"; }
  }, [locale, currency]);
  const dshort = (d: Date) => d.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const pctText = (p: number) => `${p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  /* ---------- maths ---------- */
  const goal = Math.max(0, num(data.goal) ?? 0);
  const raised = sales.reduce((s, x) => s + x.amount, 0);
  const pctOf = (v: number) => (goal > 0 ? (v / goal) * 100 : 0);
  const pct = pctOf(raised);
  const ms = useMemo(() => {
    const m = Array.isArray(data.milestones) ? data.milestones.map(num).filter((v): v is number => v != null && v > 0 && v <= 100) : [25, 50, 75, 100];
    return [...new Set(m)].sort((a, b) => a - b);
  }, [data.milestones]);
  const start = parseDay(data.start), end = parseDay(data.end);
  const range = start && end && end >= start ? { start, end, total: dayDiff(start, end) + 1 } : null;
  const today = parseDay(data.today) ?? (() => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); })();
  let elapsed = 0, left = 0, total = 0, rawDay = 0;
  if (range) { total = range.total; rawDay = dayDiff(range.start, today) + 1; elapsed = Math.max(0, Math.min(total, rawDay)); left = total - elapsed; }
  const runRate = elapsed > 0 ? raised / elapsed : 0;
  const remaining = Math.max(0, goal - raised);
  const need = left > 0 ? remaining / left : remaining;
  const projected = elapsed > 0 ? runRate * total : raised;
  const paceAmt = total ? (goal * elapsed) / total : 0;
  const done = goal > 0 && raised >= goal;
  const onPace = done || raised >= paceAmt;
  const nextM = ms.find(m => pct < m);
  const projPct = goal > 0 ? (projected / goal) * 100 : 0;
  const pacePct = total ? (elapsed / total) * 100 : 0;
  const showPace = !!total && elapsed > 0 && elapsed < total;

  const shownRaised = useCountUp(raised, { start: show, duration: 900 });
  const fillPct = Math.min(100, Math.max(0, pct));

  /* ---------- actions ---------- */
  const celebrate = (m: number) => {
    const id = Date.now();
    setToast({ m, id });
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 4800);
    if (!reduced) {
      setBurst({ at: Math.min(100, m), id });
      window.clearTimeout(burstT.current);
      burstT.current = window.setTimeout(() => setBurst(null), 1800);
    }
  };
  const addSale = (input: { client?: string; amount: number; date?: string }) => {
    const v = num(input.amount);
    if (v == null || !(v > 0)) return false;
    const s: Row = { client: (input.client || "").trim() || L.unnamed, amount: Math.round(v * 100) / 100, date: input.date || isoDay(today), _user: true, _id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    const before = pct, nextRaised = raised + s.amount, after = pctOf(nextRaised);
    const crossed = ms.filter(m => before < m && after >= m);
    setSales(list => [...list, s]);
    setUserIds(ids => [...ids, s._id]);
    setSr(fill(L.added, { v: money(s.amount), total: money(nextRaised), pct: pctText(after) }));
    if (crossed.length) celebrate(crossed[crossed.length - 1]);
    onProgress?.({ kind: "add", raised: nextRaised, goal, pct: Math.round(after * 10) / 10, sale: { client: s.client, amount: s.amount, date: s.date }, crossed });
    return true;
  };
  const undo = () => {
    const id = userIds[userIds.length - 1];
    const s = sales.find(x => x._id === id);
    if (!s) return false;
    const nextRaised = raised - s.amount;
    setSales(list => list.filter(x => x._id !== id));
    setUserIds(ids => ids.slice(0, -1));
    setSr(fill(L.undone, { v: money(s.amount), client: s.client, total: money(nextRaised) }));
    onProgress?.({ kind: "undo", raised: nextRaised, goal, pct: Math.round(pctOf(nextRaised) * 10) / 10, sale: { client: s.client, amount: s.amount, date: s.date }, crossed: [] });
    return true;
  };
  const handle = useRef({ addSale, undo, raised });
  handle.current = { addSale, undo, raised };
  useImperativeHandle(ref, () => ({
    addSale: s => handle.current.addSale(s),
    undo: () => handle.current.undo(),
    get raised() { return handle.current.raised; },
  }), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = num(amount.replace(/[\s,]/g, "").replace(/^[^\d.-]+/, ""));
    const message = v == null || !(v > 0) ? L.errAmount : v > MAX ? fill(L.errBig, { max: money(MAX) }) : "";
    setErr(message);
    if (message) { amountRef.current?.focus(); return; }
    addSale({ client, amount: v as number });
    setAmount(""); setClient("");
    amountRef.current?.focus();
  };

  const quick: [string, number][] = [];
  if (nextM != null) { const gap = Math.ceil((goal * nextM) / 100 - raised); if (gap > 0) quick.push([`${fill(L.toNext, { m: nextM })} · ${money(gap)}`, gap]); }
  [1000, 2500].forEach(v => quick.push([`+${money(v)}`, v]));

  const n = Math.max(1, num(data.recent) ?? 4);
  const recent = sales.map((s, i) => ({ s, i })).sort((a, b) => (b.s.date > a.s.date ? 1 : b.s.date < a.s.date ? -1 : b.i - a.i)).slice(0, n).map(x => x.s);
  const userSet = new Set(userIds);
  const daysTxt = left === 1 ? L.day : fill(L.days, { n: left });
  const verdictVars = { need: money(need), proj: money(projected), pct: pctText(projPct), days: daysTxt };
  const tone = done ? "done" : onPace ? "good" : "warn";
  const box = "flex min-w-0 flex-col rounded-[18px] border border-[var(--rgt-line)] bg-[color-mix(in_oklab,var(--rgt-raise)_86%,transparent)] p-4 backdrop-blur-[6px] @md:p-[18px]";
  const boxH = "m-0 mb-3.5 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--rgt-faint)]";

  return (
    <article ref={rootRef} aria-label={data.title || "Revenue goal"}
      className={cx("@container relative isolate h-fit w-full max-w-[1000px] overflow-hidden rounded-[24px] border border-[var(--rgt-line)] p-[18px] text-[var(--rgt-ink)] elev-3 @md:p-6 @3xl:px-[30px] @3xl:pb-[26px] @3xl:pt-7",
        "[--rgt-card:#FFFFFF] [--rgt-raise:#FFFFFF] [--rgt-ink:#0F172A] [--rgt-muted:#475569] [--rgt-faint:#5A6981] [--rgt-line:#E2E8F2] [--rgt-tint:#F1F5FC] [--rgt-track:#E5ECF8] [--rgt-accent:#2563EB] [--rgt-accent-ink:#1D4ED8] [--rgt-accent-2:#60A5FA] [--rgt-on:#FFFFFF] [--rgt-good:#15803D] [--rgt-warn:#B45309] [--rgt-bad:#B91C1C] [--rgt-m1:rgba(37,99,235,0.13)] [--rgt-m2:rgba(96,165,250,0.16)] [--rgt-m3:rgba(129,140,248,0.10)]",
        "dark:[--rgt-card:#0E1526] dark:[--rgt-raise:#131C30] dark:[--rgt-ink:#E8EEF9] dark:[--rgt-muted:#A7B4CA] dark:[--rgt-faint:#8C9CB6] dark:[--rgt-line:#1F2A40] dark:[--rgt-tint:#141D31] dark:[--rgt-track:#1A2440] dark:[--rgt-accent:#2563EB] dark:[--rgt-accent-ink:#93C5FD] dark:[--rgt-accent-2:#60A5FA] dark:[--rgt-good:#4ADE80] dark:[--rgt-warn:#FBBF24] dark:[--rgt-bad:#F87171] dark:[--rgt-m1:rgba(59,130,246,0.20)] dark:[--rgt-m2:rgba(96,165,250,0.12)] dark:[--rgt-m3:rgba(129,140,248,0.12)]",
        className)}
      style={{ background: "radial-gradient(60% 80% at 0% 0%, var(--rgt-m1), transparent 60%), radial-gradient(45% 60% at 100% 0%, var(--rgt-m2), transparent 65%), radial-gradient(50% 50% at 70% 110%, var(--rgt-m3), transparent 70%), var(--rgt-card)" }}>

      {/* toast */}
      <div role="status" className="pointer-events-none absolute inset-x-4 top-[18px] z-40 flex justify-center">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.id} initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-[14px] bg-[var(--rgt-ink)] py-2.5 pl-3.5 pr-2.5 text-[13.5px] leading-[1.35] text-[var(--rgt-card)] shadow-[0_22px_40px_-18px_rgba(15,35,90,0.5)]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--rgt-accent)] text-white"><Flag /></span>
              <span>{rich(toast.m >= 100 ? L.toastGoal : L.toast, { m: toast.m, v: money((goal * toast.m) / 100) }, "font-semibold")}</span>
              <button type="button" aria-label={L.close} onClick={() => { window.clearTimeout(toastT.current); setToast(null); }}
                className="grid size-7 shrink-0 place-items-center rounded-lg opacity-75 transition hover:bg-[color-mix(in_oklab,var(--rgt-card)_14%,transparent)] hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--rgt-accent-2)]"><X /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="grid min-w-0 gap-1.5">
          {data.eyebrow && <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--rgt-accent-ink)]"><Target />{data.eyebrow}</span>}
          {data.title && <h2 className="m-0 font-display text-[clamp(19px,3cqi,24px)] font-semibold leading-[1.2] tracking-[-0.02em] text-balance">{data.title}</h2>}
        </div>
        {range && (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--rgt-line)] bg-[color-mix(in_oklab,var(--rgt-card)_70%,transparent)] px-3 py-2 text-[12.5px] font-medium leading-none text-[var(--rgt-muted)] backdrop-blur-[6px] tabular @max-md:w-full @max-md:justify-center">
            {dshort(range.start)} – {dshort(range.end)}
            <i aria-hidden className="size-1 rounded-full bg-[var(--rgt-faint)] opacity-60" />
            {rawDay < 1 ? fill(L.notStarted, { date: dshort(range.start) }) : <b className="font-semibold text-[var(--rgt-ink)]">{rawDay > total ? L.ended : fill(L.dayOf, { n: elapsed, total })}</b>}
          </span>
        )}
      </header>

      {/* hero figures */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2.5 @md:mt-6">
        <div className="grid min-w-0 gap-1.5">
          <span className="font-display text-[44px] font-bold leading-[0.95] tracking-[-0.045em] tabular @md:text-[clamp(48px,8.4cqi,72px)]">{money(Math.max(0, shownRaised))}</span>
          <span className="text-[14px] text-[var(--rgt-muted)]">{rich(L.of.replace("{goal}", "<b>{goal}</b>"), { goal: money(goal) })}</span>
        </div>
        <div className="grid justify-items-end gap-1.5 @max-md:grid-flow-col @max-md:items-center @max-md:justify-items-start @max-md:gap-2.5">
          <span className="font-display text-[clamp(30px,5cqi,42px)] font-semibold leading-none tracking-[-0.03em] text-[var(--rgt-accent-ink)] tabular">{pctText(pctOf(Math.max(0, shownRaised)))}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={tone} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}
              className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11.5px] font-semibold leading-none",
                tone === "done" ? "bg-[var(--rgt-accent)] text-white" : tone === "good" ? "bg-[color-mix(in_oklab,var(--rgt-good)_12%,transparent)] text-[var(--rgt-good)]" : "bg-[color-mix(in_oklab,var(--rgt-warn)_12%,transparent)] text-[var(--rgt-warn)]")}>
              {tone === "done" ? <Check className="size-2.5" /> : <i aria-hidden className="size-1.5 rounded-full bg-current" />}
              {done ? L.reached : onPace ? L.onPace : L.behind}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* meter */}
      <div className="relative mt-[46px] pb-[44px] @max-md:mt-11 @max-md:pb-8">
        <div role="meter" aria-label={data.title || "Revenue goal"} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(raised, goal)}
          aria-valuetext={`${money(raised)} of ${money(goal)}, ${pctText(pct)}`}
          className="relative h-[22px] rounded-full bg-[var(--rgt-track)] shadow-[inset_0_1px_2px_rgba(15,35,90,0.14)] @max-md:h-[18px]">
          <motion.div className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-[linear-gradient(90deg,var(--rgt-accent-2),var(--rgt-accent)_70%,color-mix(in_oklab,var(--rgt-accent),#1E1B4B_25%))] shadow-[0_8px_22px_-8px_var(--rgt-accent),inset_0_1px_0_rgba(255,255,255,0.35)]"
            initial={preview ? false : { width: 0 }} animate={{ width: show ? `${fillPct}%` : 0 }} transition={{ duration: 1, ease: [0.2, 0.75, 0.2, 1] }}>
            {show && !preview && !reduced && (
              <motion.span aria-hidden className="absolute inset-0 bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.4)_45%,transparent_70%)]"
                initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.4, delay: 1.1, ease: "easeInOut" }} />
            )}
          </motion.div>
          {showPace && (
            <motion.div aria-hidden className="absolute -top-[30px] bottom-[-8px] w-0" initial={false} animate={{ left: `${pacePct}%` }} transition={{ duration: 0.6, ease }}>
              <span className="absolute bottom-0 left-[-1px] top-5 w-0.5 rounded-sm bg-[var(--rgt-ink)] opacity-70" />
              <span className={cx("absolute top-0 whitespace-nowrap rounded-md bg-[var(--rgt-ink)] px-[7px] py-1 font-mono text-[10.5px] font-semibold leading-none text-[var(--rgt-card)] tabular",
                pacePct > 85 ? "right-[-4px]" : pacePct < 15 ? "left-[-4px]" : "-translate-x-1/2")}>
                {fill(L.pace, { v: money(paceAmt, true) })}
              </span>
            </motion.div>
          )}
          <div aria-hidden>
            {ms.map((m, i) => {
              const hit = pct >= m, isNext = m === nextM, last = i === ms.length - 1;
              return (
                <div key={m} className="absolute top-0 h-full w-0" style={{ left: `${m}%` }}>
                  <motion.span className={cx("absolute left-0 top-1/2 -ml-2 -mt-2 grid size-4 place-items-center rounded-full border-2 bg-[var(--rgt-card)] transition-colors duration-300",
                    hit ? "border-[var(--rgt-card)] text-[var(--rgt-accent)] shadow-[0_2px_6px_-2px_rgba(15,35,90,0.4)]" : isNext ? "border-[var(--rgt-accent)] text-transparent shadow-[0_0_0_5px_color-mix(in_oklab,var(--rgt-accent)_16%,transparent)]" : "border-[color-mix(in_oklab,var(--rgt-faint)_55%,var(--rgt-track))] text-transparent")}
                    animate={{ scale: hit ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                    <Check />
                  </motion.span>
                  <span className={cx("absolute top-[34px] grid gap-[3px] whitespace-nowrap @max-md:top-7", last ? "right-0 justify-items-end" : "left-0 -translate-x-1/2 justify-items-center")}>
                    <b className={cx("text-[12px] font-semibold leading-none tabular", hit ? "text-[var(--rgt-accent-ink)]" : "text-[var(--rgt-muted)]")}>{m}%</b>
                    <span className="font-mono text-[11px] font-medium leading-none text-[var(--rgt-faint)] tabular @max-md:hidden">{money((goal * m) / 100, true)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {burst && <Burst key={burst.id} atPct={burst.at} seed={burst.id % 997} />}
      </div>

      {/* caption */}
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-[13px] text-[var(--rgt-muted)]">
        <span>{nextM != null ? rich(L.next.replace("{left}", "<b>{left}</b>"), { m: nextM, left: money(Math.max(0, (goal * nextM) / 100 - raised)) }) : <b className="font-semibold text-[var(--rgt-ink)]">{L.allHit}</b>}</span>
        {total > 0 && elapsed > 0 && !done && (
          <span>{rich((raised - paceAmt >= 0 ? L.aheadBy : L.behindBy).replace("{v}", "<b>{v}</b>"), { v: money(Math.abs(raised - paceAmt)) })}</span>
        )}
      </div>

      {/* lower panels */}
      <div className="mt-[22px] grid gap-4 @3xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <section aria-labelledby={`${uid}-rate`} className={box}>
          <h3 id={`${uid}-rate`} className={boxH}>{L.runRate}</h3>
          <div className="grid gap-3">
            {[
              { label: L.current, v: runRate, need: false },
              { label: L.needed, v: done ? 0 : need, need: true },
            ].map((r, i, arr) => {
              const maxRate = Math.max(arr[0].v, arr[1].v, 1);
              return (
                <div key={r.label} className="grid grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-3 @max-md:grid-cols-[minmax(0,1fr)_auto] @max-md:gap-y-2">
                  <span className="text-[12.5px] text-[var(--rgt-muted)]">{r.label}</span>
                  <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-[var(--rgt-track)] @max-md:col-span-full @max-md:row-start-2">
                    <motion.i className={cx("block h-full rounded-full", r.need ? "bg-[repeating-linear-gradient(135deg,var(--rgt-ink)_0_3px,color-mix(in_oklab,var(--rgt-ink)_55%,transparent)_3px_6px)] opacity-55" : "bg-[linear-gradient(90deg,var(--rgt-accent-2),var(--rgt-accent))]")}
                      initial={preview ? false : { width: 0 }} animate={{ width: show ? `${(r.v / maxRate) * 100}%` : 0 }} transition={{ duration: 0.8, ease, delay: 0.2 + i * 0.1 }} />
                  </span>
                  <span className="min-w-[82px] whitespace-nowrap text-right text-[15px] font-semibold leading-none tabular">{money(r.v)}<small className="text-[11px] font-medium text-[var(--rgt-faint)]">{L.perDay}</small></span>
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-3.5 rounded-xl bg-[var(--rgt-tint)] px-3 py-2.5 text-[13px] leading-[1.45] text-[var(--rgt-muted)]">
            {rich(done ? L.verdictDone : onPace ? L.verdictAhead : L.verdictBehind, verdictVars)}
          </p>
          {range && elapsed > 0 && <PaceChart sales={sales} start={range.start} elapsed={elapsed} total={total} goal={goal} raised={raised} projected={projected} show={show} L={L} money={money} />}
          <dl className="m-0 mt-auto grid grid-cols-3 gap-2.5 pt-3.5 @max-md:grid-cols-2">
            {[
              { k: L.daysLeft, v: String(left), sub: range ? dshort(range.end) : "" },
              { k: L.remaining, v: money(remaining), sub: fill(L.ofGoal, { pct: pctText(goal ? (remaining / goal) * 100 : 0) }) },
              { k: L.projected, v: money(projected), sub: fill(L.ofGoal, { pct: pctText(projPct) }) },
            ].map((s, i) => (
              <div key={s.k} className={cx("grid min-w-0 gap-[5px] border-t border-[var(--rgt-line)] pt-3", i === 2 && "@max-md:col-span-2")}>
                <dt className="font-mono text-[10px] font-medium uppercase leading-[1.2] tracking-[0.09em] text-[var(--rgt-faint)]">{s.k}</dt>
                <dd className="m-0 font-display text-[18px] font-semibold leading-[1.1] tracking-[-0.01em] [overflow-wrap:anywhere] tabular">
                  {s.v}{s.sub && <small className="mt-[3px] block font-sans text-[11.5px] font-medium tracking-normal text-[var(--rgt-faint)]">{s.sub}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby={`${uid}-log`} className={box}>
          <h3 id={`${uid}-log`} className={boxH}>{L.log}</h3>
          <form noValidate onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto] items-end gap-2 @max-md:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={`${uid}-client`} className="text-[11.5px] font-medium leading-none text-[var(--rgt-muted)]">{L.client}</label>
              <input id={`${uid}-client`} value={client} onChange={e => setClient(e.target.value)} type="text" autoComplete="off" maxLength={60} placeholder={L.clientPh}
                className="h-[42px] w-full min-w-0 rounded-[11px] border border-[var(--rgt-line)] bg-[var(--rgt-card)] px-[11px] text-[14px] text-[var(--rgt-ink)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--rgt-faint)] placeholder:opacity-80 focus:border-[var(--rgt-accent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--rgt-accent)_16%,transparent)]" />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={`${uid}-amount`} className="text-[11.5px] font-medium leading-none text-[var(--rgt-muted)]">{L.amount}</label>
              <motion.div animate={err ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.35 }}
                className={cx("flex h-[42px] items-center rounded-[11px] border bg-[var(--rgt-card)] transition-[border-color,box-shadow] duration-200",
                  err ? "border-[var(--rgt-bad)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--rgt-bad)_14%,transparent)]" : "border-[var(--rgt-line)] focus-within:border-[var(--rgt-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--rgt-accent)_16%,transparent)]")}>
                <span aria-hidden className="pl-[11px] text-[14px] font-semibold text-[var(--rgt-faint)]">{symbol}</span>
                <input ref={amountRef} id={`${uid}-amount`} value={amount} type="text" inputMode="decimal" autoComplete="off" placeholder="0"
                  aria-invalid={!!err} aria-describedby={`${uid}-err`}
                  onChange={e => { setAmount(e.target.value); if (err) setErr(""); }}
                  className="h-full w-full min-w-0 rounded-[11px] bg-transparent pl-1 pr-[11px] text-[14px] font-medium text-[var(--rgt-ink)] outline-none tabular placeholder:text-[var(--rgt-faint)] placeholder:opacity-80" />
              </motion.div>
            </div>
            <button type="submit"
              className="inline-flex h-[42px] items-center justify-center gap-[7px] rounded-[11px] border border-[var(--rgt-accent)] bg-[var(--rgt-accent)] px-4 text-[13.5px] font-semibold text-white shadow-[0_10px_20px_-12px_var(--rgt-accent)] transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_oklab,var(--rgt-accent),#000_12%)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rgt-accent)] @max-md:col-span-2">
              <Plus />{L.add}
            </button>
            <div className="col-span-full flex flex-wrap gap-1.5">
              {quick.map(([label, v]) => (
                <button key={label} type="button" onClick={() => { setAmount(String(v)); setErr(""); amountRef.current?.focus(); }}
                  className="rounded-full border border-dashed border-[color-mix(in_oklab,var(--rgt-accent)_45%,var(--rgt-line))] px-2.5 py-1.5 text-[12px] font-semibold leading-none text-[var(--rgt-accent-ink)] transition-[background-color,border-style] duration-200 hover:border-solid hover:bg-[color-mix(in_oklab,var(--rgt-accent)_10%,transparent)] tabular focus-visible:outline-2 focus-visible:outline-[var(--rgt-accent)]">
                  {label}
                </button>
              ))}
            </div>
            <p id={`${uid}-err`} aria-live="assertive" className="col-span-full m-0 text-[12.5px] text-[var(--rgt-bad)] empty:hidden">{err}</p>
          </form>

          <div className="mb-1.5 mt-4 flex items-center justify-between gap-2 border-t border-[var(--rgt-line)] pt-3.5">
            <h4 className="m-0 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--rgt-faint)]">{L.recent}</h4>
            <button type="button" disabled={!userIds.length} onClick={() => { undo(); if (userIds.length <= 1) amountRef.current?.focus(); }}
              className="inline-flex items-center gap-1.5 rounded-[7px] px-1.5 py-[5px] text-[12.5px] font-semibold leading-none text-[var(--rgt-accent-ink)] transition-colors duration-200 hover:enabled:bg-[color-mix(in_oklab,var(--rgt-accent)_10%,transparent)] disabled:text-[var(--rgt-faint)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--rgt-accent)]">
              <Undo />{L.undo}
            </button>
          </div>
          <ul className="m-0 grid list-none p-0">
            <AnimatePresence initial={false} mode="popLayout">
              {recent.map(s => {
                const d = parseDay(s.date);
                const mine = userSet.has(s._id);
                return (
                  <motion.li key={s._id} layout="position"
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.18 } }} transition={{ duration: 0.45, ease }}
                    className="relative -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-lg border-b border-dashed border-[var(--rgt-line)] px-2 py-2 last:border-b-0">
                    {mine && <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-lg bg-[color-mix(in_oklab,var(--rgt-accent)_13%,transparent)]" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.4, delay: 0.2 }} />}
                    <span className="flex flex-wrap items-center gap-[7px] text-[13.5px] font-medium leading-[1.3] [overflow-wrap:anywhere]">
                      {s.client || L.unnamed}
                      {mine && <em className="rounded-[5px] bg-[var(--rgt-accent)] px-[5px] py-[3px] font-mono text-[9.5px] font-semibold not-italic uppercase leading-none tracking-[0.08em] text-white">{L.fresh}</em>}
                    </span>
                    <span className="text-[13.5px] font-semibold leading-[1.3] tabular">{money(s.amount)}</span>
                    <span className="col-span-full text-[11.5px] text-[var(--rgt-faint)]">{d ? d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : ""}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      </div>
      <p className="sr-only" aria-live="polite">{sr}</p>
    </article>
  );
}
