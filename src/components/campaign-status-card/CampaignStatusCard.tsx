import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../ui";
import { useInterval, usePreviewMode } from "../../lib/hooks";
import { fmtMoney } from "../../lib/format";
import {
  ACTIONS, ACTION_ORDER, CH_STATE, HINTS, PRIMARY, STATE_LABEL, STEPS, VERB_LABEL, VERB_STATE,
  type CampaignAction, type CampaignData, type CampaignStatus, type ChannelType, type LogVerb, type StatusChangeDetail,
} from "./data";

/* ------------------------------------------------------------
   Campaign Status Card — lifecycle stepper + state machine.
   Only valid moves are enabled, ending asks to confirm in a
   modal dialog, and every change lands in the activity log.
   ------------------------------------------------------------ */

export interface CampaignStatusCardProps {
  data: CampaignData;
  /** Fires after every lifecycle move: { from, to, action, by, at }. */
  onStatusChange?: (detail: StatusChangeDetail) => void;
  className?: string;
}

const THEME = [
  "[--acc:#0284c7] [--acc-ink:#0369a1] [--band:#eef6fc] [--danger:#b91c1c] [--danger-ink:#ffffff]",
  "[--st-draft:#52606f] [--st-scheduled:#0369a1] [--st-live:#15803d] [--st-paused:#b45309] [--st-completed:#334155]",
  "dark:[--acc:#38bdf8] dark:[--acc-ink:#7dd3fc] dark:[--band:#0f1d2b] dark:[--danger:#f87171] dark:[--danger-ink:#2a0a0a]",
  "dark:[--st-draft:#b4c1cf] dark:[--st-scheduled:#7dd3fc] dark:[--st-live:#4ade80] dark:[--st-paused:#fbbf24] dark:[--st-completed:#cbd5e1]",
].join(" ");

const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/* ---------- dates ---------- */
const parseDate = (s?: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s ?? "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) : null;
};
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((dayOnly(b).getTime() - dayOnly(a).getTime()) / 864e5);
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const clock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
function when(at: Date | null, now: number) {
  if (!at) return "";
  const diff = (now - at.getTime()) / 6e4;
  if (diff >= -1 && diff < 1) return "just now";
  if (diff >= 1 && diff < 60) return `${Math.floor(diff)} min ago`;
  return `${shortDate(at)}, ${clock(at)}`;
}

/* ---------- icons ---------- */
const P: Record<string, ReactNode> = {
  schedule: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
  launch: <path d="M5 3.2v9.6L12.5 8z" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  resume: <path d="M5 3.2v9.6L12.5 8z" />,
  end: <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />,
  check: <path d="m3.5 8.4 3 3 6-6.4" />,
  draft: <path d="M3 13h3l7-7-3-3-7 7z" />,
  user: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c.7-2.3 2.6-3.5 5-3.5s4.3 1.2 5 3.5" /></>,
  target: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></>,
  flag: <path d="M3.5 14V2.5M3.5 3h8l-1.6 2.7L11.5 8.5h-8" />,
  search: <><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 3.3 3.3" /></>,
  social: <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H7l-3 2.5v-2.5a1.5 1.5 0 0 1-1.5-1.5z" />,
  video: <><rect x="2" y="3.5" width="12" height="9" rx="2" /><path d="M6.8 6v4l3.2-2z" /></>,
  display: <><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M2 6h12M5 9h3" /></>,
  email: <><rect x="2" y="3.5" width="12" height="9" rx="2" /><path d="m2.5 4.5 5.5 4 5.5-4" /></>,
};
function Glyph({ name, className = "size-3.5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden>
      {P[name] ?? P.display}
    </svg>
  );
}
const STEP_ICON: Record<CampaignStatus, string> = { draft: "draft", scheduled: "schedule", live: "launch", paused: "pause", completed: "check" };

/* ---------- small pieces ---------- */
type Tone = "good" | "warn" | "info" | null;
const TONE_VAR: Record<Exclude<Tone, null>, string> = { good: "var(--st-live)", warn: "var(--st-paused)", info: "var(--st-scheduled)" };
function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  if (!children) return null;
  return (
    <motion.span layout="position" key={String(children)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold leading-none",
        tone ? "text-[var(--t)] bg-[color-mix(in_oklab,var(--t)_13%,transparent)]" : "bg-sunken text-ink-2 ring-1 ring-inset ring-line")}
      style={tone ? ({ "--t": TONE_VAR[tone] } as CSSProperties) : undefined}>
      {tone && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </motion.span>
  );
}

function Meter({ value, mark, color, label, entrance }: { value: number; mark?: number | null; color?: string; label: string; entrance: boolean }) {
  return (
    <div role="img" aria-label={label} className="relative h-2.5 rounded-full bg-sunken ring-1 ring-inset ring-line">
      <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: color ?? "var(--acc)" }}
        initial={entrance ? { width: 0 } : false} animate={{ width: `${value}%` }} transition={{ duration: 0.7, ease: EASE }} />
      {mark !== null && mark !== undefined && (
        <motion.span aria-hidden className="absolute -inset-y-1 -ml-px w-0.5 rounded-full bg-ink"
          initial={entrance ? { left: 0, opacity: 0 } : false} animate={{ left: `${mark}%`, opacity: 1 }} transition={{ duration: 0.7, ease: EASE }} />
      )}
    </div>
  );
}

const Label = ({ children, as: Tag = "h3" }: { children: ReactNode; as?: "h3" | "span" }) => (
  <Tag className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-3">{children}</Tag>
);

/* ---------- model ---------- */
interface Entry { id: number; action: LogVerb; by: string; at: Date | null; isNew?: boolean }
interface CardState { status: CampaignStatus; log: Entry[]; flightStart: Date | null; endedDay: number | null }

function initState(d: CampaignData): CardState {
  const log: Entry[] = (d.log ?? [])
    .filter(e => e && VERB_STATE[e.action])
    .map((e, i) => ({ id: i + 1, action: e.action, by: e.by ?? "", at: parseDate(e.at) }));
  const last = log.length ? VERB_STATE[log[log.length - 1].action] : "draft";
  return { status: d.status && STEPS.includes(d.status) ? d.status : last, log, flightStart: null, endedDay: null };
}

/* ---------- component ---------- */
export function CampaignStatusCard({ data, onStatusChange, className }: CampaignStatusCardProps) {
  const preview = usePreviewMode();
  const uid = useId();
  const [st, setSt] = useState<CardState>(() => initState(data));
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState("");
  const [dlgKey, setDlgKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const nowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef(false);
  const nextId = useRef(1000);
  useEffect(() => { setMounted(true); }, []);
  useInterval(() => setNow(Date.now()), 30000);
  const entrance = !preview && !mounted;

  const s = st.status;
  const user = data.user || "you";
  const cur = data.currency ?? "USD", loc = data.locale ?? "en-US";
  const money = (v: number) => fmtMoney(v, cur, 0, loc);
  const int = (v: number) => Math.round(v).toLocaleString(loc);
  const today = useMemo(() => parseDate(data.today) ?? dayOnly(new Date()), [data.today]);

  const flight = useMemo(() => {
    const start = st.flightStart ?? parseDate(data.flight?.start), end = parseDate(data.flight?.end);
    if (!start || !end || end.getTime() < start.getTime()) return null;
    return { start, end, total: daysBetween(start, end) + 1 };
  }, [st.flightStart, data.flight]);
  const dayOf = () => (flight ? Math.max(0, Math.min(flight.total, daysBetween(flight.start, today) + 1)) : 0);
  const can = (a: CampaignAction) => ACTIONS[a].from.includes(s);

  /* ---- transitions ---- */
  const transition = (action: CampaignAction) => {
    if (!can(action)) return false;
    const a = ACTIONS[action], from = s, at = new Date();
    setSt(prev => ({
      status: a.to,
      flightStart: action === "launch" && flight && today.getTime() < flight.start.getTime() ? dayOnly(today) : prev.flightStart,
      endedDay: action === "end" ? dayOf() : prev.endedDay,
      log: [...prev.log, { id: nextId.current++, action: a.verb, by: user, at, isNew: true }],
    }));
    setAnnounce(`${VERB_LABEL[a.verb]}. Campaign is now ${STATE_LABEL[a.to].toLowerCase()}.`);
    onStatusChange?.({ from, to: a.to, action, by: user, at: at.toISOString() });
    return true;
  };

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const active = document.activeElement as HTMLButtonElement | null;
    if (active && actionsRef.current?.contains(active) && !active.disabled) return;
    const box = actionsRef.current;
    const next = box?.querySelector<HTMLButtonElement>("button[data-primary='true']:not(:disabled)") ?? box?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    (next ?? nowRef.current)?.focus();
  }, [s]);

  const onAction = (action: CampaignAction, btn: HTMLButtonElement) => {
    if (ACTIONS[action].confirm) {
      returnFocus.current = btn;
      const dlg = dlgRef.current;
      if (dlg && typeof dlg.showModal === "function") {
        dlg.returnValue = "";
        setDlgKey(k => k + 1);
        dlg.showModal();
      } else if (window.confirm(dialogText)) transition("end");
      return;
    }
    pendingFocus.current = true;
    transition(action);
  };

  // the dialog body re-mounts (for its entrance animation) on every open: focus "Keep running" after that
  useEffect(() => {
    if (dlgKey > 0 && dlgRef.current?.open) dlgRef.current.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
  }, [dlgKey]);

  const onDialogClose = () => {
    const ok = dlgRef.current?.returnValue === "confirm";
    if (ok) { transition("end"); requestAnimationFrame(() => nowRef.current?.focus()); }
    else returnFocus.current?.focus();
    returnFocus.current = null;
  };
  const trapTab = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const f = [...(dlgRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = f.indexOf(document.activeElement as HTMLButtonElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1]?.focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0]?.focus(); }
  };

  /* ---- derived: header ---- */
  const sinceEntry = [...st.log].reverse().find(e => VERB_STATE[e.action] === s) ?? null;
  const sinceText = sinceEntry?.at ? `Since ${when(sinceEntry.at, now)}` : "";

  /* ---- derived: steps ---- */
  const curIdx = STEPS.indexOf(s);
  const visited = new Set<CampaignStatus>(st.log.map(e => VERB_STATE[e.action]));
  visited.add(s);
  const counts: Partial<Record<LogVerb, number>> = {};
  st.log.forEach(e => { counts[e.action] = (counts[e.action] ?? 0) + 1; });
  const lastAt = (x: CampaignStatus) => { for (let i = st.log.length - 1; i >= 0; i--) if (VERB_STATE[st.log[i].action] === x && st.log[i].at) return st.log[i].at; return null; };
  type StepState = "current" | "done" | "skipped" | "upcoming";
  const stepStates: StepState[] = STEPS.map((x, i) => {
    if (x === s) return "current";
    if (visited.has(x)) return "done";
    if (i < curIdx && x !== "paused") return "skipped";
    if (x === "paused" && s === "completed") return "skipped";
    return "upcoming";
  });
  const reached = (k: StepState) => k === "current" || k === "done";
  const stepMeta = (x: CampaignStatus, k: StepState) => {
    const at = lastAt(x);
    if (x === "paused" && counts.paused && at) return counts.paused > 1 ? `${counts.paused}×, last ${shortDate(at)}` : shortDate(at);
    if (k === "skipped") return "Skipped";
    if (at && (k === "done" || k === "current")) return shortDate(at);
    if (x === "scheduled" && flight) return `For ${shortDate(flight.start)}`;
    if (x === "live" && flight) return `From ${shortDate(flight.start)}`;
    if (x === "paused") return "If needed";
    if (x === "completed" && flight) return `Ends ${shortDate(flight.end)}`;
    return "";
  };

  /* ---- derived: flight ---- */
  const fl = (() => {
    if (!flight) return { big: <>No dates</>, sub: "", badge: "", tone: null as Tone, v: 0, label: "No flight dates" };
    const day = dayOf();
    const started = s === "live" || s === "paused" || (s === "completed" && st.log.some(e => e.action === "launched"));
    let shown = started ? (s === "completed" && st.endedDay !== null ? st.endedDay : day) : 0;
    if (s === "completed" && st.endedDay === null && started) shown = daysBetween(flight.start, today) + 1 >= flight.total ? flight.total : day;
    const v = (shown / flight.total) * 100;
    const label = `${shown} of ${flight.total} flight days elapsed`;
    if (!started) {
      const until = daysBetween(today, flight.start);
      return {
        big: <>{until > 0 ? `In ${until} day${until === 1 ? "" : "s"}` : "Today"}</>,
        sub: s === "completed" ? "Cancelled before it started." : `${flight.total}-day flight, ${shortDate(flight.start)} to ${shortDate(flight.end)}.`,
        badge: s === "completed" ? "Cancelled" : s === "scheduled" ? "Scheduled" : "Not started",
        tone: (s === "scheduled" ? "info" : null) as Tone, v, label,
      };
    }
    const left = Math.max(0, flight.total - shown);
    const big = <>Day {shown} <small className="text-[13px] font-medium tracking-normal text-ink-2">of {flight.total}</small></>;
    if (s === "completed") return { big, v, label, sub: shown >= flight.total ? `Ran all ${flight.total} days.` : `Ended early, ${left} day${left === 1 ? "" : "s"} before the planned end.`, badge: "Ended", tone: null as Tone };
    if (s === "paused") return { big, v, label, sub: `${left} day${left === 1 ? "" : "s"} left. The end date doesn't move while paused.`, badge: "On hold", tone: "warn" as Tone };
    return { big, v, label, sub: `${left} day${left === 1 ? "" : "s"} left, ends ${shortDate(flight.end)}.`, badge: `${Math.round(v)}% through`, tone: "good" as Tone };
  })();

  /* ---- derived: budget ---- */
  const budget = data.budget > 0 ? data.budget : 0, spent = Math.max(0, data.spent || 0);
  const bd = (() => {
    const v = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
    const left = `${budget > 0 ? Math.round((spent / budget) * 100) : 0}% spent`;
    const day = dayOf();
    const running = (s === "live" || s === "paused") && flight && day > 0 && budget > 0;
    if (running && flight) {
      const expected = (budget * day) / flight.total, pace = expected > 0 ? spent / expected : 0;
      const perDay = spent / day, projected = perDay * flight.total, diff = ((projected - budget) / budget) * 100;
      let badge = "On pace", tone: Tone = "good", color: string | undefined;
      if (spent === 0 && s === "live") { badge = "Just started"; tone = "info"; }
      else if (s === "paused") { badge = "On hold"; tone = "warn"; color = "var(--st-paused)"; }
      else if (pace > 1.1) { badge = "Overspending"; tone = "warn"; color = "var(--st-paused)"; }
      else if (pace < 0.9) { badge = "Underspending"; tone = "info"; }
      const sub: ReactNode = spent === 0
        ? `No spend recorded yet. About ${money(budget / flight.total)} a day keeps it on pace.`
        : <><b className="font-semibold text-ink">{Math.round(pace * 100)}%</b> of expected spend. ≈ {money(perDay)}/day, projected {money(projected)} ({diff >= 0 ? "+" : "−"}{Math.abs(diff).toFixed(1)}%).</>;
      return { v, mark: Math.min(100, (expected / budget) * 100), left, right: `Expected ${money(expected)}`, badge, tone, color, sub, label: `${money(spent)} spent of ${money(budget)}. Expected by today: ${money(expected)}.` };
    }
    const rest = money(Math.max(0, budget - spent));
    return s === "completed"
      ? { v, mark: null, left, right: `${rest} left`, badge: "Closed", tone: null as Tone, color: undefined, sub: `${rest} unspent and released.` as ReactNode, label: `${money(spent)} spent of ${money(budget)}.` }
      : { v, mark: null, left, right: `${rest} left`, badge: "Not spending", tone: null as Tone, color: undefined, sub: "Spend starts when the campaign goes live." as ReactNode, label: `${money(spent)} spent of ${money(budget)}.` };
  })();

  /* ---- derived: channels ---- */
  const chs = data.channels ?? [];
  const chTotal = chs.reduce((a, c) => a + (c.spent || 0), 0);
  const chLeads = chs.reduce((a, c) => a + (c.leads || 0), 0);

  const dialogText = s === "scheduled"
    ? `“${data.name || "This campaign"}” will be cancelled before it starts. The full ${money(Math.max(0, budget - spent))} budget is released. This can't be undone.`
    : `All ${chs.length} channel${chs.length === 1 ? "" : "s"} stop delivering right away and ${money(Math.max(0, budget - spent))} of unspent budget is released. This can't be undone.`;

  const statusVar = { "--c": `var(--st-${s})` } as CSSProperties;
  const logItems = [...st.log].reverse();

  return (
    <div className={cx("@container w-full max-w-[1000px]", className)}>
      <article data-status={s} style={statusVar}
        className={cx(THEME, "relative w-full overflow-hidden rounded-[20px] border border-line bg-surface text-ink elev-3")}>
        {/* ---------- header band ---------- */}
        <div className="relative grid gap-6 border-b border-line bg-[linear-gradient(180deg,var(--band),var(--surface))] px-4 pb-5 pt-5 @lg:px-6 @lg:pt-6 @3xl:px-7">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[var(--c)] opacity-80 transition-colors duration-500" />
          <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
            <div className="grid min-w-0 flex-[1_1_320px] gap-1.5">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--acc-ink)]">
                <span>Campaign</span>
                {data.id && <><span aria-hidden className="text-ink-3">·</span><span>{data.id}</span></>}
              </div>
              <h2 className="font-display text-[21px] font-semibold leading-tight tracking-[-0.018em] text-balance [overflow-wrap:anywhere] @lg:text-[26px]">{data.name || "Untitled campaign"}</h2>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
                {([["target", data.client], ["flag", data.objective], ["user", data.owner]] as const).map(([ico, t]) => t && (
                  <span key={ico} className="inline-flex items-center gap-1.5"><Glyph name={ico} className="size-3.5 text-ink-3" />{t}</span>
                ))}
              </p>
            </div>
            <div ref={nowRef} tabIndex={-1} aria-label={`Status: ${STATE_LABEL[s]}. ${sinceText}`}
              className="grid w-full justify-items-start gap-2 rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--acc)] @lg:w-auto @lg:justify-items-end">
              <motion.span layout style={{ borderRadius: 999 }} transition={{ layout: { duration: 0.35, ease: EASE } }}
                className="inline-flex items-center gap-2.5 bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] py-2.5 pl-3.5 pr-4.5 text-[var(--c)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--c)_30%,transparent)] transition-colors duration-500">
                <span aria-hidden className="relative grid size-2.5 place-items-center">
                  {s === "paused" ? (
                    <span className="flex h-2.5 gap-[3px]"><i className="w-[3px] rounded-[1px] bg-current" /><i className="w-[3px] rounded-[1px] bg-current" /></span>
                  ) : (
                    <>
                      {s === "live" && <span className="absolute -inset-1 animate-ping rounded-full border-2 border-current opacity-60 motion-reduce:hidden" />}
                      <span className="size-2.5 rounded-full bg-current" />
                    </>
                  )}
                </span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={s} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
                    className="font-display text-[17px] font-semibold leading-none">
                    {STATE_LABEL[s]}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              <span className="text-[12.5px] text-ink-2 tabular">{sinceText}</span>
            </div>
          </header>

          {/* ---------- lifecycle stepper ---------- */}
          <ol aria-label="Campaign lifecycle" className="grid grid-cols-1 @lg:grid-cols-5">
            {STEPS.map((x, i) => {
              const k = stepStates[i];
              const linked = i < STEPS.length - 1 && reached(k) && reached(stepStates[i + 1]);
              const meta = stepMeta(x, k);
              return (
                <li key={x} aria-current={k === "current" ? "step" : undefined}
                  className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-0.5 pb-3.5 last:pb-0 @lg:grid-cols-1 @lg:justify-items-center @lg:gap-y-1.5 @lg:px-1 @lg:pb-0 @lg:text-center">
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-0.5 overflow-hidden rounded-full bg-line-strong @lg:bottom-auto @lg:left-[calc(50%+22px)] @lg:right-[calc(-50%+22px)] @lg:top-[15px] @lg:h-0.5 @lg:w-auto">
                      <span data-on={linked}
                        className="absolute inset-0 origin-top scale-y-0 bg-[var(--acc)] transition-transform duration-500 ease-out data-[on=true]:scale-y-100 motion-reduce:transition-none @lg:origin-left @lg:scale-x-0 @lg:scale-y-100 @lg:data-[on=true]:scale-x-100" />
                    </span>
                  )}
                  <motion.span aria-hidden animate={{ scale: k === "current" ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className={cx("row-span-2 grid size-8 place-items-center rounded-full transition-[background-color,color,box-shadow] duration-300 @lg:row-span-1",
                      k === "done" && "bg-[var(--acc)] text-surface",
                      k === "current" && "bg-[var(--c)] text-surface shadow-[0_0_0_5px_color-mix(in_oklab,var(--c)_18%,transparent)]",
                      k === "skipped" && "bg-sunken text-ink-3 shadow-[inset_0_0_0_2px_var(--line)]",
                      k === "upcoming" && "bg-surface text-ink-3 shadow-[inset_0_0_0_2px_var(--line-strong)]")}>
                    <Glyph name={k === "done" ? "check" : STEP_ICON[x]} className="size-3.5" />
                  </motion.span>
                  <span className={cx("self-end pt-0.5 text-[13px] font-semibold leading-tight @lg:self-auto @lg:pt-0",
                    k === "current" || k === "done" ? "text-ink" : "text-ink-2", k === "skipped" && "text-ink-3 line-through decoration-line-strong")}>
                    {STATE_LABEL[x]}
                    <span className="sr-only">, {{ current: "current step", done: "done", skipped: "skipped", upcoming: "not yet" }[k]}</span>
                  </span>
                  <span className={cx("min-h-[1.3em] text-[11.5px] leading-snug text-ink-3 tabular", k === "skipped" && "line-through decoration-line-strong")}>{meta}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* ---------- body ---------- */}
        <div className="grid @3xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid min-w-0 content-start gap-6 p-4 @lg:p-6 @3xl:px-7">
            <div className="grid gap-3.5 @lg:grid-cols-2">
              {/* flight */}
              <section aria-label="Flight dates" className="grid min-w-0 content-start gap-2.5 rounded-2xl border border-line bg-surface-2 p-4 elev-1">
                <div className="flex items-center justify-between gap-2"><Label>Flight</Label><Badge tone={fl.tone}>{fl.badge}</Badge></div>
                <div className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.02em] tabular">{fl.big}</div>
                <Meter value={fl.v} label={fl.label} entrance={entrance} />
                {flight && <div className="flex justify-between gap-2 text-[11.5px] text-ink-3 tabular"><span>{shortDate(flight.start)}</span><span>{shortDate(flight.end)}</span></div>}
                <p className="text-[12.5px] leading-relaxed text-ink-2 tabular">{fl.sub}</p>
              </section>
              {/* budget */}
              <section aria-label="Budget pacing" className="grid min-w-0 content-start gap-2.5 rounded-2xl border border-line bg-surface-2 p-4 elev-1">
                <div className="flex items-center justify-between gap-2"><Label>Budget pacing</Label><Badge tone={bd.tone}>{bd.badge}</Badge></div>
                <div className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.02em] tabular">
                  {money(spent)} <small className="text-[13px] font-medium tracking-normal text-ink-2">of {money(budget)}</small>
                </div>
                <Meter value={bd.v} mark={bd.mark} color={bd.color} label={bd.label} entrance={entrance} />
                <div className="flex justify-between gap-2 text-[11.5px] text-ink-3 tabular"><span>{bd.left}</span><span>{bd.right}</span></div>
                <p className="text-[12.5px] leading-relaxed text-ink-2 tabular">{bd.sub}</p>
              </section>
            </div>

            {/* channels */}
            <section aria-labelledby={`${uid}-ch`}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span id={`${uid}-ch`}><Label as="span">Channels</Label></span>
                {chs.length > 0 && <span className="text-[12px] text-ink-3 tabular">{int(chLeads)} leads · {chLeads > 0 ? money(chTotal / chLeads) : "—"} per lead</span>}
              </div>
              <ul className="grid">
                {chs.map((c, i) => {
                  const share = chTotal > 0 ? (c.spent / chTotal) * 100 : 0;
                  return (
                    <li key={c.name + i} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 border-t border-line py-3 first:border-t-0 @lg:grid-cols-[36px_minmax(0,1.2fr)_minmax(0,1.4fr)_88px]">
                      <span aria-hidden className="grid size-9 place-items-center rounded-[10px] bg-[color-mix(in_oklab,var(--acc)_12%,transparent)] text-[var(--acc-ink)]">
                        <Glyph name={c.type as ChannelType} className="size-[17px]" />
                      </span>
                      <div className="grid min-w-0 gap-1">
                        <b className="text-[14px] font-semibold leading-tight [overflow-wrap:anywhere]">{c.name}</b>
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                          <span aria-hidden className="size-1.5 rounded-full bg-[var(--c)] transition-colors duration-500" />{CH_STATE[s]}
                        </span>
                      </div>
                      <div className="col-span-3 grid min-w-0 gap-1.5 @lg:col-span-1 @lg:row-start-1 @lg:col-start-3">
                        <div className="flex justify-between gap-2 text-[12.5px] text-ink-2 tabular"><b className="font-semibold text-ink">{money(c.spent)}</b><span>{Math.round(share)}% of spend</span></div>
                        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-sunken">
                          <motion.span className="block h-full rounded-full bg-[var(--acc)]" initial={entrance ? { width: 0 } : false} animate={{ width: `${share}%` }}
                            transition={{ duration: 0.7, ease: EASE, delay: entrance ? 0.15 + i * 0.07 : 0 }} />
                        </div>
                      </div>
                      <div className="col-start-3 row-start-1 grid justify-items-end gap-0.5 text-right tabular @lg:col-start-4">
                        <b className="font-display text-[17px] font-semibold leading-none">{int(c.leads)}</b>
                        <span className="text-[11.5px] text-ink-3">{c.leads > 0 ? `leads · ${money(c.spent / c.leads)}` : "leads"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* ---------- side: controls + activity ---------- */}
          <aside className="grid min-w-0 content-start gap-6 border-t border-line bg-[color-mix(in_oklab,var(--sunken)_55%,var(--surface))] p-4 @lg:grid-cols-2 @lg:p-6 @3xl:grid-cols-1 @3xl:border-l @3xl:border-t-0 @3xl:px-5">
            <section aria-labelledby={`${uid}-ctl`} className="grid content-start gap-3">
              <span id={`${uid}-ctl`}><Label as="span">Controls</Label></span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                  className="min-h-[3.6em] text-[12.5px] leading-relaxed text-ink-2">{HINTS[s]}</motion.p>
              </AnimatePresence>
              <div ref={actionsRef} className="grid grid-cols-2 gap-2">
                {ACTION_ORDER.map(k => {
                  const ok = can(k);
                  const primary = ok && PRIMARY[s] === k;
                  const end = k === "end";
                  return (
                    <button key={k} type="button" disabled={!ok} data-primary={primary}
                      title={ok ? undefined : `Not available while ${STATE_LABEL[s].toLowerCase()}`}
                      onClick={e => onAction(k, e.currentTarget)}
                      className={cx("inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)] enabled:active:scale-[0.98] disabled:opacity-40",
                        end && "col-span-2",
                        primary
                          ? "border-[var(--acc-ink)] bg-[var(--acc-ink)] text-white shadow-[0_10px_20px_-12px_var(--acc)] enabled:hover:brightness-110 dark:border-[var(--acc)] dark:bg-[var(--acc)] dark:text-[#04202f]"
                          : end
                            ? "border-line-strong bg-surface text-[var(--danger)] enabled:hover:border-[var(--danger)] enabled:hover:bg-[color-mix(in_oklab,var(--danger)_7%,var(--surface))]"
                            : "border-line-strong bg-surface text-ink enabled:hover:border-[var(--acc)] enabled:hover:text-[var(--acc-ink)]")}>
                      <Glyph name={k} className="size-3.5" />{ACTIONS[k].label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby={`${uid}-log`} className="min-w-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span id={`${uid}-log`}><Label as="span">Activity</Label></span>
                <span className="text-[12px] text-ink-3 tabular">{logItems.length} change{logItems.length === 1 ? "" : "s"}</span>
              </div>
              <ol className="grid max-h-[260px] overflow-y-auto [scrollbar-width:thin]">
                <AnimatePresence initial={false}>
                  {logItems.map((e, i) => {
                    const stv = VERB_STATE[e.action];
                    return (
                      <motion.li key={e.id} layout="position"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.32, ease: EASE }}
                        className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 overflow-hidden">
                        {i < logItems.length - 1 && <span aria-hidden className="absolute bottom-0 left-2 top-4 w-0.5 bg-line" />}
                        <span aria-hidden className="ml-1 mt-1 size-2.5 rounded-full"
                          style={{ boxShadow: `inset 0 0 0 2px var(--st-${stv})`, background: e.isNew ? `var(--st-${stv})` : "var(--surface)" }} />
                        <div className="grid min-w-0 gap-0.5 pb-3.5">
                          <b className="text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]">{e.by ? `${VERB_LABEL[e.action]} by ${e.by}` : VERB_LABEL[e.action]}</b>
                          <span className="text-[12px] text-ink-3 tabular">{when(e.at, now)}</span>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            </section>
          </aside>
        </div>

        {/* ---------- end confirm dialog (native modal: top layer, inert page, Esc) ---------- */}
        <dialog ref={dlgRef} aria-labelledby={`${uid}-dt`} aria-describedby={`${uid}-dd`} onClose={onDialogClose} onKeyDown={trapTab}
          className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[18px] bg-surface p-0 text-ink shadow-[0_0_0_1px_var(--line),0_40px_80px_-30px_rgb(0_0_0/0.45)] backdrop:bg-[rgb(8_20_34/0.45)] backdrop:backdrop-blur-[3px]">
          <motion.form key={dlgKey} method="dialog" initial={preview ? false : { opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.26, ease: EASE }}
            className="grid gap-3 p-5 @lg:p-6">
            <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] text-[var(--danger)]">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M10 3 2.5 16.5h15z" /><path d="M10 8.5v3.5M10 14.5v.01" /></svg>
            </span>
            <h3 id={`${uid}-dt`} className="mt-1 font-display text-[19px] font-semibold leading-snug tracking-[-0.01em]">End this campaign?</h3>
            <p id={`${uid}-dd`} className="text-[14px] leading-relaxed text-ink-2">{dialogText}</p>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button type="submit" value="cancel" data-cancel
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-4 text-[13px] font-semibold transition-colors hover:border-[var(--acc)] hover:text-[var(--acc-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)] @md:min-w-32 @md:flex-none">
                Keep running
              </button>
              <button type="submit" value="confirm"
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--danger)] bg-[var(--danger)] px-4 text-[13px] font-semibold text-[var(--danger-ink)] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] @md:min-w-32 @md:flex-none">
                End campaign
              </button>
            </div>
          </motion.form>
        </dialog>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </article>
    </div>
  );
}
