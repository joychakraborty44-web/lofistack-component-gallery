import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Segmented, cx } from "../../ui";
import { usePreviewMode } from "../../lib/hooks";
import {
  calendar, paceMetrics, statusOf, tol,
  type BudgetChangeDetail, type BudgetChannel, type BudgetData, type BudgetSort, type BudgetView, type ChannelIcon, type PaceMetrics, type PaceStatus,
} from "./data";

/* ------------------------------------------------------------
   Ad Spend Budget Tracker — per-channel pacing bars against the
   ideal pace for today and the monthly budget, with projections,
   overspend hatching and inline budget editing.
   ------------------------------------------------------------ */

export interface AdSpendBudgetTrackerProps {
  data: BudgetData;
  defaultView?: BudgetView;
  defaultSort?: BudgetSort;
  onViewChange?: (view: BudgetView) => void;
  onSortChange?: (sort: BudgetSort) => void;
  /** Fires after a budget is saved: { id, label, budget, previous, spent, projected, status }. */
  onBudgetChange?: (detail: BudgetChangeDetail) => void;
  className?: string;
}

const THEME = [
  "[--head:#f3f6f9] [--track:#e8edf3] [--tick:#94a3b8] [--budget:#334155]",
  "[--ok:#0d9488] [--ok-ink:#0f766e] [--over:#ea580c] [--over-ink:#b93d08] [--under:#5470a8] [--under-ink:#3f5a8f]",
  "dark:[--head:#151d28] dark:[--track:#1e2835] dark:[--tick:#5b6a80] dark:[--budget:#cbd5e1]",
  "dark:[--ok:#2dd4bf] dark:[--ok-ink:#5eead4] dark:[--over:#fb923c] dark:[--over-ink:#fdba74] dark:[--under:#8ea6d8] dark:[--under-ink:#a9bce4]",
].join(" ");
const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
const STATUS_LABEL: Record<PaceStatus, string> = { ok: "On track", over: "Overpacing", under: "Underpacing" };
const toneVars = (s: PaceStatus) => ({ "--tone": `var(--${s})`, "--tone-ink": `var(--${s}-ink)` }) as CSSProperties;
const HATCH = "repeating-linear-gradient(135deg, var(--over) 0 3px, color-mix(in oklab, var(--over) 40%, var(--surface)) 3px 6px)";

/* ---------- glyphs ---------- */
const CH_ICON: Record<ChannelIcon, ReactNode> = {
  search: <><circle cx="8.6" cy="8.6" r="5.1" /><path d="m12.4 12.4 4.1 4.1" /></>,
  social: <><path d="M3 13.6V5.8A2.3 2.3 0 0 1 5.3 3.5h7.4A2.3 2.3 0 0 1 15 5.8v4.5a2.3 2.3 0 0 1-2.3 2.3H6.6L3 15.5z" /><path d="M17 8.2v6.2l-2.4-1.7" /></>,
  video: <><rect x="2.5" y="4" width="15" height="12" rx="2.6" /><path d="m8.4 7.4 4.4 2.6-4.4 2.6z" fill="currentColor" /></>,
  display: <><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M2.5 7.5h15M8 7.5v9" /></>,
  dot: <circle cx="10" cy="10" r="4" fill="currentColor" />,
};
const ST_ICON: Record<PaceStatus, ReactNode> = {
  ok: <path d="M2.4 6.3 4.9 8.6 9.6 3.6" />,
  over: <path d="M6 9.8V2.4M2.9 5.4 6 2.3l3.1 3.1" />,
  under: <path d="M6 2.2v7.4M2.9 6.6 6 9.7l3.1-3.1" />,
};
const Svg12 = ({ children, className = "size-3" }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden>{children}</svg>
);

function StatusPill({ status }: { status: PaceStatus }) {
  return (
    <span style={toneVars(status)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] py-[5px] pl-1.5 pr-2.5 text-[12px] font-semibold leading-none text-[var(--tone-ink)] transition-colors duration-300">
      <span className="grid size-4 place-items-center rounded-full bg-[var(--tone)] text-surface"><Svg12 className="size-2.5">{ST_ICON[status]}</Svg12></span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={status} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>
          {STATUS_LABEL[status]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ---------- component ---------- */
interface Tip { id: string; x: number; y: number }

export function AdSpendBudgetTracker({ data, defaultView = "spent", defaultSort = "default", onViewChange, onSortChange, onBudgetChange, className }: AdSpendBudgetTrackerProps) {
  const preview = usePreviewMode();
  const uid = useId();
  const loc = data.locale ?? "en-US";
  const cur = (data.currency ?? "USD").toUpperCase();
  const money = (v: number) => {
    try { return new Intl.NumberFormat(loc, { style: "currency", currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(v); }
    catch { return `$${Math.round(v).toLocaleString()}`; }
  };
  const pct = (v: number, dp = 1) => `${v.toLocaleString(loc, { minimumFractionDigits: dp, maximumFractionDigits: dp })}%`;

  const [view, setView] = useState<BudgetView>(defaultView);
  const [sort, setSort] = useState<BudgetSort>(defaultSort);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);
  const [announce, setAnnounce] = useState("");
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editBtns = useRef<Record<string, HTMLButtonElement | null>>({});
  const refocus = useRef<string | null>(null);
  useEffect(() => { setMounted(true); }, []);
  const entrance = !preview && !mounted;

  const cal = useMemo(() => calendar(data), [data]);
  const t = tol(data);
  const channels: BudgetChannel[] = useMemo(() => (data.channels ?? []).filter(Boolean).map((c, i) => ({
    id: String(c.id || c.label || `channel-${i + 1}`), label: c.label || `Channel ${i + 1}`,
    icon: c.icon && CH_ICON[c.icon] ? c.icon : "dot",
    budget: Math.max(0, budgets[String(c.id || c.label)] ?? c.budget ?? 0), spent: Math.max(0, c.spent || 0),
  })), [data, budgets]);
  const rows = channels.map((ch, order) => ({ ch, m: paceMetrics(ch, cal, t), order }));
  const sorted = sort === "used"
    ? [...rows].sort((a, b) => b.m.usedRatio - a.m.usedRatio || a.order - b.order)
    : rows;
  const maxRatio = Math.max(1, ...rows.map(r => (view === "projected" ? r.m.projRatio : r.m.usedRatio)));
  const domain = maxRatio > 1 ? maxRatio * 1.04 : 1;

  /* summary */
  const totBudget = rows.reduce((a, r) => a + r.m.budget, 0);
  const totSpent = rows.reduce((a, r) => a + r.ch.spent, 0);
  const totProj = rows.reduce((a, r) => a + r.m.projected, 0);
  const totStatus = statusOf(totBudget > 0 ? totProj / totBudget : 0, t);
  const totDiff = totProj - totBudget;
  const counts = (["over", "under"] as const).map(s => [s, rows.filter(r => r.m.status === s).length] as const).filter(x => x[1]);
  const paceSub = counts.length
    ? counts.map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(" · ")
    : `${rows.length} channels · ${STATUS_LABEL.ok.toLowerCase()}`;
  const diffText = (d: number) => (Math.abs(d) < 0.5 ? "On budget" : `${money(Math.abs(d))} ${d > 0 ? "over" : "under"} budget`);

  let monthName = "";
  try { monthName = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(new Date(cal.y, cal.m - 1, 1)); } catch { monthName = `${cal.y}-${cal.m}`; }
  const dayLabel = (day: number) => {
    try { return new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" }).format(new Date(cal.y, cal.m - 1, day)); } catch { return `day ${day}`; }
  };

  /* ---- editing ---- */
  const startEdit = (ch: BudgetChannel) => {
    setEditing(ch.id); setDraft(String(ch.budget)); setError(""); setTip(null);
  };
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
    else if (refocus.current) { editBtns.current[refocus.current]?.focus(); refocus.current = null; }
  }, [editing]);
  const finish = (commit: boolean, keepFocus = false) => {
    const ch = channels.find(c => c.id === editing);
    if (!ch) { setEditing(null); return; }
    if (commit) {
      const v = draft.trim() === "" ? NaN : Number(draft);
      if (!Number.isFinite(v) || v <= 0) { setError("Enter a budget above zero."); inputRef.current?.focus(); return; }
      const nb = Math.round(v * 100) / 100;
      if (nb !== ch.budget) {
        setBudgets(b => ({ ...b, [ch.id]: nb }));
        const m = paceMetrics({ ...ch, budget: nb }, cal, t);
        setAnnounce(`${ch.label} budget set to ${money(nb)}. Projected ${pct(m.projRatio * 100)} of budget, ${STATUS_LABEL[m.status].toLowerCase()}.`);
        onBudgetChange?.({ id: ch.id, label: ch.label, budget: nb, previous: ch.budget, spent: ch.spent, projected: Math.round(m.projected), status: m.status });
      }
    }
    if (!keepFocus) refocus.current = ch.id;
    setEditing(null); setError("");
  };
  const onFormBlur = (e: FocusEvent<HTMLFormElement>, ch: BudgetChannel) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    // clicking away with an unchanged value simply closes the editor
    if (Number(draft) === ch.budget) finish(false, true);
  };

  /* ---- tooltip ---- */
  const moveTip = (e: PointerEvent, id: string) => {
    if (e.pointerType === "touch" || editing) return setTip(null);
    const host = cardRef.current?.getBoundingClientRect();
    if (!host) return;
    const w = tipRef.current?.offsetWidth || 190, h = tipRef.current?.offsetHeight || 112;
    let x = e.clientX - host.left + 14, y = e.clientY - host.top - h - 12;
    if (x + w > host.width - 8) x = e.clientX - host.left - w - 14;
    if (y < 8) y = e.clientY - host.top + 18;
    setTip({ id, x: Math.min(Math.max(8, x), Math.max(8, host.width - w - 8)), y });
  };
  const tipRow = tip ? rows.find(r => r.ch.id === tip.id) : null;

  const changeView = (v: BudgetView) => { if (v === view) return; setView(v); onViewChange?.(v); };
  const toggleSort = () => { const s: BudgetSort = sort === "used" ? "default" : "used"; setSort(s); onSortChange?.(s); };

  const figs = (ch: BudgetChannel, m: PaceMetrics) => {
    const editor = editing === ch.id ? (
      <form noValidate onSubmit={e => { e.preventDefault(); finish(true); }} onBlur={e => onFormBlur(e, ch)}
        className="inline-flex flex-wrap items-center justify-end gap-1">
        <input ref={inputRef} type="number" min={0} step={50} inputMode="decimal" value={draft}
          onChange={e => { setDraft(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); } }}
          aria-label={`Monthly budget for ${ch.label}`} aria-invalid={error ? true : undefined} aria-describedby={`${uid}-err-${ch.id}`}
          className={cx("w-24 rounded-lg border bg-surface px-2 py-1.5 text-right font-condensed text-[14px] font-semibold text-ink tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
            error ? "border-[var(--over)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--over)_22%,transparent)]" : "border-[var(--ok-ink)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--ok)_22%,transparent)]")} />
        <button type="submit" aria-label="Save budget"
          className="grid size-7 place-items-center rounded-lg bg-[var(--budget)] text-surface transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ok-ink)]">
          <Svg12>{ST_ICON.ok}</Svg12>
        </button>
        <button type="button" aria-label="Cancel" onClick={() => finish(false)}
          className="grid size-7 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ok-ink)]">
          <Svg12><path d="M3 3l6 6M9 3 3 9" /></Svg12>
        </button>
        <span id={`${uid}-err-${ch.id}`} aria-live="polite" className={cx("basis-full text-right text-[12px] text-[var(--over-ink)]", !error && "hidden")}>{error}</span>
      </form>
    ) : (
      <button ref={el => { editBtns.current[ch.id] = el; }} type="button" onClick={() => startEdit(ch)}
        aria-label={`Edit budget for ${ch.label}, currently ${money(ch.budget)}`}
        className="-mx-0.5 -my-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--tick)] px-1.5 py-1 font-condensed text-[13.5px] font-semibold text-ink tabular transition-colors hover:border-solid hover:bg-[var(--track)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ok-ink)]">
        {money(ch.budget)}
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-[11px] text-ink-3" aria-hidden><path d="M2 10l.5-2.3L8 2.2 9.8 4 4.3 9.5z" /></svg>
      </button>
    );
    return (
      <>
        <div className="font-condensed text-[24px] font-semibold leading-none tabular @md:text-[28px]">
          {view === "projected"
            ? <CountUp value={m.projected} format={money} duration={500} />
            : <><CountUp value={m.usedRatio * 100} format={v => pct(v)} duration={500} /><small className="ml-1 font-sans text-[12.5px] font-medium text-ink-2">used</small></>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[13px] text-ink-2 tabular">
          {view === "projected"
            ? <><b className="font-semibold text-ink">{pct(m.projRatio * 100)}</b> of {editor}</>
            : <><b className="font-semibold text-ink">{money(ch.spent)}</b> of {editor}</>}
        </div>
      </>
    );
  };

  const note = (ch: BudgetChannel, m: PaceMetrics): ReactNode[] => {
    if (view === "projected") {
      const out: ReactNode[] = [<b key="d" className="font-semibold text-[var(--tone-ink)]">{diffText(m.projected - m.budget)}</b>];
      if (m.status === "over" && m.runOutDay && m.runOutDay <= cal.n) out.push(<span key="r">Hits budget on {dayLabel(m.runOutDay)}</span>);
      else out.push(<span key="p">{money(m.daily)}/day now</span>);
      return out;
    }
    const pts = Math.round(m.paceDiff * 10) / 10;
    const out: ReactNode[] = [
      <b key="d" className="font-semibold text-[var(--tone-ink)]">{Math.abs(pts) < 0.05 ? "Right on pace" : `${Math.abs(pts).toFixed(1)} pts ${pts > 0 ? "ahead of" : "behind"} pace`}</b>,
      <span key="p">{money(m.daily)}/day now</span>,
    ];
    if (m.leftDays > 0) out.push(<span key="n">{ch.spent >= m.budget ? "Budget used up" : `${money(m.need)}/day to land on budget`}</span>);
    return out;
  };

  const kpis: { label: string; big: ReactNode; sub: ReactNode }[] = [
    { label: "Total budget", big: <CountUp value={totBudget} format={money} duration={600} />, sub: `${rows.length} channels` },
    { label: "Spent so far", big: <CountUp value={totSpent} format={money} duration={600} />, sub: `${pct(totBudget > 0 ? (totSpent / totBudget) * 100 : 0)} of budget · Ideal today ${money(totBudget * cal.frac)}` },
    { label: "Projected month-end", big: <CountUp value={totProj} format={money} duration={600} />, sub: diffText(totDiff) },
    { label: "Overall pace", big: <StatusPill status={totStatus} />, sub: paceSub },
  ];

  const left = cal.n - cal.day;

  return (
    <div className={cx("@container w-full max-w-[960px]", className)}>
      <article ref={cardRef} className={cx(THEME, "relative w-full overflow-hidden rounded-[18px] border border-line bg-surface text-ink elev-3")}>
        {/* ---------- header ---------- */}
        <header className="grid gap-5 border-b border-line bg-[var(--head)] px-4 pb-5 pt-5 @lg:px-6 @3xl:px-7 @3xl:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="grid min-w-0 gap-1.5">
              {data.eyebrow && <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{data.eyebrow}</span>}
              {data.title && <h2 className="text-[19px] font-semibold leading-tight tracking-[-0.012em] text-balance @3xl:text-[23px]">{data.title}</h2>}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 @lg:w-auto">
              <Segmented<BudgetView> ariaLabel="View" value={view} onChange={changeView}
                options={[{ value: "spent", label: "Spent" }, { value: "projected", label: "Projected" }]}
                className="flex-1 border-line bg-surface @lg:flex-none" buttonClassName="flex-1 @lg:flex-none"
                activeClassName="text-surface!" indicatorClassName="bg-[var(--budget)]!" />
              <button type="button" aria-pressed={sort === "used"} onClick={toggleSort}
                className={cx("inline-flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ok-ink)]",
                  sort === "used" ? "border-[var(--tick)] text-ink" : "border-line text-ink-2 hover:text-ink")}>
                <motion.svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-[13px]" aria-hidden
                  animate={{ scaleY: sort === "used" ? -1 : 1 }} transition={{ duration: 0.3, ease: EASE }}>
                  <path d="M2.5 3.5h9M2.5 7h6M2.5 10.5h3" />
                </motion.svg>
                {sort === "used" ? "Sorted by % used" : "Sort by % used"}
              </button>
            </div>
          </div>

          {/* month progress */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 text-[13px] text-ink-2 @2xl:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span><b className="font-semibold text-ink">{monthName}</b> · Day {cal.day} of {cal.n}</span>
            <div role="img" aria-label={`${monthName}: day ${cal.day} of ${cal.n}`}
              className="col-span-2 row-start-2 grid h-2.5 auto-cols-fr grid-flow-col gap-[2px] @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1">
              {Array.from({ length: cal.n }, (_, i) => {
                const d = i + 1;
                return (
                  <motion.i key={i} initial={entrance ? { opacity: 0, scaleY: 0.3 } : false} animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.3, delay: entrance ? i * 0.012 : 0 }}
                    className={cx("rounded-[2px]",
                      d < cal.day && "bg-[color-mix(in_oklab,var(--budget)_70%,var(--surface))]",
                      d === cal.day && "bg-[var(--budget)] shadow-[0_0_0_2px_var(--head),0_0_0_3px_var(--budget)]",
                      d > cal.day && "bg-[var(--track)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--tick)_25%,transparent)]")} />
                );
              })}
            </div>
            <span className="whitespace-nowrap tabular @2xl:col-start-3">{left > 0 ? `${left} days left` : "Last day"}</span>
          </div>

          {/* summary */}
          <dl className="grid grid-cols-2 gap-y-4 border-t border-line pt-4 @2xl:grid-cols-4">
            {kpis.map((k, i) => (
              <div key={k.label} className={cx("grid min-w-0 content-start gap-1.5 border-line px-3 @lg:px-4",
                i % 2 === 0 ? "pl-0 @lg:pl-0" : "border-l border-line",
                i === 2 && "@2xl:border-l @2xl:pl-4", i === 0 && "@2xl:pl-0")}>
                <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{k.label}</dt>
                <dd className="min-w-0 font-condensed text-[23px] font-semibold leading-none tabular @lg:text-[30px]">{k.big}</dd>
                <dd className="text-[12.5px] leading-snug text-ink-2 tabular">{k.sub}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ---------- channel rows ---------- */}
        <ul className="px-4 @lg:px-6 @3xl:px-7" onPointerLeave={() => setTip(null)}>
          {sorted.map(({ ch, m }, i) => {
            const shown = view === "projected" ? m.projRatio : m.usedRatio;
            const w = (Math.min(shown, 1) / domain) * 100, b = (1 / domain) * 100, o = (Math.max(0, shown - 1) / domain) * 100, p = (cal.frac / domain) * 100;
            return (
              <motion.li key={ch.id} layout="position" transition={{ layout: { duration: 0.42, ease: EASE } }} style={toneVars(m.status)}
                className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 border-b border-line py-4 [grid-template-areas:'name_figs'_'bar_bar'_'note_note'] last:border-b-0 @2xl:grid-cols-[200px_minmax(0,1fr)_176px] @2xl:gap-x-6 @2xl:py-5 @2xl:[grid-template-areas:'name_bar_figs'_'name_note_figs']">
                <div className="flex min-w-0 items-center gap-3 [grid-area:name]">
                  <span aria-hidden className="hidden size-10 shrink-0 place-items-center rounded-[10px] bg-[var(--track)] text-[var(--budget)] @md:grid">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[17px]">{CH_ICON[ch.icon ?? "dot"]}</svg>
                  </span>
                  <div className="grid min-w-0 justify-items-start gap-1.5">
                    <span className="text-[14px] font-semibold leading-tight [overflow-wrap:anywhere] @md:text-[15px]">{ch.label}</span>
                    <StatusPill status={m.status} />
                  </div>
                </div>

                <div aria-hidden className="relative flex h-8 items-center [grid-area:bar]" onPointerMove={e => moveTip(e, ch.id)} onPointerDown={e => moveTip(e, ch.id)}>
                  <div className="relative h-3 w-full rounded-md bg-[var(--track)]">
                    <motion.span className="absolute inset-y-0 left-0 rounded-md bg-[var(--tone)] transition-colors duration-300"
                      initial={entrance ? { width: 0 } : false} animate={{ width: `${w}%` }} transition={{ duration: 0.6, ease: EASE, delay: entrance ? 0.1 + i * 0.07 : 0 }} />
                    <motion.span className="absolute inset-y-0 rounded-r-md" style={{ background: HATCH }}
                      initial={false} animate={{ left: `${b}%`, width: `${o}%`, opacity: o > 0 ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }} />
                    <motion.span className="absolute top-1/2 h-[26px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[var(--budget)]"
                      initial={false} animate={{ left: `${b}%` }} transition={{ duration: 0.6, ease: EASE }} />
                    <motion.span className="absolute top-1/2 h-6 w-0 -translate-x-1/2 -translate-y-1/2 border-l-2 border-dashed border-ink/70"
                      initial={false} animate={{ left: `${p}%`, opacity: view === "projected" ? 0 : 1 }} transition={{ duration: 0.5, ease: EASE }}>
                      <span className="absolute -left-[6px] -top-[6px] size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink/70" />
                    </motion.span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-2 tabular [grid-area:note]">{note(ch, m)}</div>

                <div className="grid justify-items-end gap-1.5 text-right [grid-area:figs]">{figs(ch, m)}</div>

                <span className="sr-only">
                  {`${ch.label}: ${STATUS_LABEL[m.status]}. Spent ${money(ch.spent)} of ${money(m.budget)} (${pct(m.usedRatio * 100)}). Ideal today ${money(m.budget * cal.frac)}. Projected ${money(m.projected)} (${pct(m.projRatio * 100)}).`}
                </span>
              </motion.li>
            );
          })}
        </ul>

        {/* ---------- legend + source ---------- */}
        <footer className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line px-4 py-3.5 text-[12px] text-ink-3 @lg:px-6 @3xl:px-7">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-ink-2">
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-4 rounded bg-[var(--ok)]" />{view === "projected" ? "Projected spend" : "Spend so far"}</li>
            {view === "spent" && <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3.5 w-0 border-l-2 border-dashed border-ink/70" />Ideal pace today</li>}
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3.5 w-[3px] rounded-sm bg-[var(--budget)]" />Budget</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-4 rounded-r" style={{ background: HATCH }} />Over budget</li>
          </ul>
          {data.source && <span>{data.source}</span>}
        </footer>

        {/* ---------- tooltip ---------- */}
        <AnimatePresence>
          {tip && tipRow && (
            <motion.div ref={tipRef} aria-hidden initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="pointer-events-none absolute z-20 min-w-[180px] rounded-xl bg-ink px-3 py-2.5 text-[12.5px] leading-relaxed text-canvas shadow-xl tabular"
              style={{ left: tip.x, top: tip.y }}>
              <strong className="mb-1 block text-[13px]">{tipRow.ch.label}</strong>
              {([
                ["Spent", `${money(tipRow.ch.spent)} · ${pct(tipRow.m.usedRatio * 100)}`],
                ["Ideal today", money(tipRow.m.budget * cal.frac)],
                ["Budget", money(tipRow.m.budget)],
                ["Projected", `${money(tipRow.m.projected)} · ${pct(tipRow.m.projRatio * 100)}`],
              ] as const).map(([k, v]) => (
                <span key={k} className="flex justify-between gap-4"><em className="not-italic opacity-70">{k}</em>{v}</span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </article>
    </div>
  );
}
