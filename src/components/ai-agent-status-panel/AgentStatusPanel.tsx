import { useEffect, useId, useImperativeHandle, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Tooltip, cx } from "../../ui";
import { useInterval, usePreviewMode } from "../../lib/hooks";
import { ASP_LABELS, type AgentAction, type AgentFilter, type AgentFleetData, type AgentState, type AgentStatus, type AspLabels } from "./data";
import { FleetSim, HISTORY, STATUSES, fill, type ActionResult, type SimAgent } from "./sim";

/* ------------------------------------------------------------
   AI Agent Status Panel — ops console for a fleet of AI agents.
   Seeded live simulation (pausable), per-agent Start / Pause /
   Restart, status filters, error rows that open into a log with
   Retry, and a rolling event log. Rows become cards on phones.
   ------------------------------------------------------------ */

export interface AgentSnapshot { id: string; name: string; status: AgentState; queue: number; processed: number; succeeded: number }

/** Imperative API (pass a ref): change an agent from code, read the current agents. */
export interface AgentStatusPanelHandle {
  setStatus: (id: string, status: AgentStatus, message?: string) => boolean;
  getAgents: () => AgentSnapshot[];
}

export interface AgentStatusPanelProps {
  data: AgentFleetData;
  /** Milliseconds between live updates (default 2000, minimum 500). */
  interval?: number;
  /** Start with live updates paused. */
  defaultPaused?: boolean;
  defaultFilter?: AgentFilter;
  labels?: Partial<AspLabels>;
  /** Number and time locale (default en-GB). */
  locale?: string;
  className?: string;
  ref?: Ref<AgentStatusPanelHandle>;
  /** Start, Pause, Restart and Retry — with the status before and after. */
  onAgentAction?: (detail: ActionResult) => void;
  onPausedChange?: (paused: boolean) => void;
  onFilterChange?: (filter: AgentFilter) => void;
}

const ease = [0.16, 1, 0.3, 1] as const;
const FILTERS: AgentFilter[] = ["all", ...STATUSES];
const COLOR: Record<AgentState, string> = {
  running: "var(--asp-run)", idle: "var(--asp-idle)", error: "var(--asp-err)", paused: "var(--asp-pause)", restarting: "var(--asp-restart)",
};
const kLabel = "font-mono text-[10px] font-medium uppercase leading-[1.2] tracking-[0.12em] text-[var(--asp-faint)]";
const ROW_GRID = cx(
  "grid items-center gap-x-4",
  "@3xl:grid-cols-[minmax(150px,1.25fr)_minmax(0,1.8fr)_62px_74px_128px_112px] @3xl:[grid-template-areas:'agent_task_queue_succ_tp_act']",
  "@max-[880px]:@3xl:grid-cols-[minmax(140px,1.2fr)_minmax(0,1.5fr)_56px_68px_104px_112px] @max-[880px]:@3xl:gap-x-3",
);

/* ---------------- icons ---------------- */
const Play = () => <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-3.5"><path d="M5 3.2v9.6c0 .5.5.8.9.5l7.2-4.8a.6.6 0 0 0 0-1L5.9 2.7c-.4-.3-.9 0-.9.5Z" /></svg>;
const Pause = () => <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-3.5"><rect x="3.5" y="3" width="3" height="10" rx="1" /><rect x="9.5" y="3" width="3" height="10" rx="1" /></svg>;
const Restart = ({ spin = false }: { spin?: boolean }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("size-3.5", spin && "animate-spin motion-reduce:animate-none")}>
    <path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v3h-3" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <motion.svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-2.5" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
    <path d="m3 4.5 3 3 3-3" />
  </motion.svg>
);

/* ---------------- pieces ---------------- */

function Led({ status, live }: { status: AgentState; live: boolean }) {
  const pulse = live && status === "running";
  return (
    <span aria-hidden className="relative grid size-2.5 shrink-0 place-items-center">
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--c)] opacity-40 [animation-duration:2.4s] motion-reduce:hidden" />}
      {status === "restarting" && <span className="absolute -inset-[3px] animate-spin rounded-full border-[1.5px] border-[var(--c)] border-t-transparent motion-reduce:animate-none" />}
      <span className="size-2.5 rounded-full bg-[var(--c)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--c)_18%,transparent),0_0_10px_color-mix(in_oklab,var(--c)_calc(var(--asp-glow)*100%),transparent)] transition-colors duration-300" />
    </span>
  );
}

function Bars({ values, top, className, barClass }: { values: number[]; top: number; className?: string; barClass?: string }) {
  return (
    <span aria-hidden className={cx("flex items-end gap-[2px]", className)}>
      {values.map((v, i) => (
        <span key={i} className={cx("min-w-[2px] flex-1 rounded-[1px] transition-[height] duration-[350ms] ease-out motion-reduce:transition-none", barClass)}
          style={{ height: `max(2px, ${((v || 0) / top) * 100}%)` }} />
      ))}
    </span>
  );
}

/** A number that ticks in from above when it changes. */
function Tick({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cx("inline-flex", className)}>
      <motion.span key={value} initial={{ y: -4, opacity: 0.35 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease }}>
        {value}
      </motion.span>
    </span>
  );
}

function IconBtn({ label, tip, disabled, onClick, tone, children }: { label: string; tip: string; disabled: boolean; onClick: (el: HTMLButtonElement) => void; tone: string; children: ReactNode }) {
  return (
    <Tooltip content={tip} className="bg-[var(--asp-ink)] font-mono text-[10.5px] font-semibold text-[var(--asp-bg)]">
      <button type="button" data-act aria-label={label} disabled={disabled} onClick={e => onClick(e.currentTarget)}
        style={{ "--t": tone } as CSSProperties}
        className="grid size-[34px] place-items-center rounded-lg border border-[var(--asp-line)] text-[var(--asp-muted)] transition-[color,border-color,background-color,transform] duration-200 hover:enabled:border-[var(--t)] hover:enabled:bg-[color-mix(in_oklab,var(--t)_8%,transparent)] hover:enabled:text-[var(--t)] active:enabled:translate-y-px disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--asp-accent)] @max-md:h-9 @max-md:w-10">
        {children}
      </button>
    </Tooltip>
  );
}

/* ---------------- main ---------------- */

export function AgentStatusPanel({
  data, interval = 2000, defaultPaused = false, defaultFilter = "all", labels, locale = "en-GB", className, ref,
  onAgentAction, onPausedChange, onFilterChange,
}: AgentStatusPanelProps) {
  const L = useMemo<AspLabels>(() => ({ ...ASP_LABELS, ...labels }), [labels]);
  const preview = usePreviewMode();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ms = Math.max(500, interval || 2000);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [paused, setPausedState] = useState(defaultPaused);
  const [filter, setFilterState] = useState<AgentFilter>(defaultFilter);
  const live = !paused && !preview;

  // simulation (re-created when the data object changes)
  const simRef = useRef<FleetSim | null>(null);
  if (!simRef.current || simRef.current.data !== data) simRef.current = new FleetSim(data, L, locale);
  const sim = simRef.current;
  sim.setLabels(L);

  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((id, agent) => { window.clearTimeout(id); sim.finishRestart(agent, true); }); t.clear(); };
  }, [sim]);

  useInterval(() => { sim.step(); bump(); }, ms, { enabled: live });

  const run = (id: string, action: AgentAction, btn?: HTMLButtonElement) => {
    const res = sim.act(id, action);
    if (!res) return;
    if (res.to === "restarting") {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => { timers.current.delete(id); sim.finishRestart(id); bump(); }, 1400));
    }
    bump();
    onAgentAction?.(res);
    // keep keyboard focus inside the row when the pressed button becomes disabled
    if (btn && document.activeElement === btn) {
      window.setTimeout(() => {
        if (!btn.disabled && btn.isConnected) return;
        const row = document.getElementById(`${uid}-${id}`);
        row?.querySelector<HTMLButtonElement>("[data-act]:not(:disabled)")?.focus({ preventScroll: true });
      }, 0);
    }
  };

  useImperativeHandle(ref, () => ({
    setStatus: (id, status, message) => {
      const t = timers.current.get(id);
      if (t) { window.clearTimeout(t); timers.current.delete(id); }
      const ok = sim.setStatus(id, status, message);
      if (ok) bump();
      return ok;
    },
    getAgents: () => sim.agents.map(a => ({ id: a.id, name: a.name, status: a.status, queue: a.queue, processed: a.processed, succeeded: a.succeeded })),
  }), [sim]);

  const setPaused = (p: boolean) => { setPausedState(p); onPausedChange?.(p); };
  const setFilter = (f: AgentFilter) => { setFilterState(f); onFilterChange?.(f); };
  const toggleError = (a: SimAgent) => {
    a.expanded = !a.expanded;
    bump();
    if (a.expanded) window.setTimeout(() => document.getElementById(`${uid}-${a.id}-retry`)?.focus({ preventScroll: true }), 30);
  };

  const A = sim.agents;
  const matchesF = (a: SimAgent, f: AgentFilter) => f === "all" || a.status === f || (f === "running" && a.status === "restarting");
  const shown = A.filter(a => matchesF(a, filter));
  const runCount = A.filter(a => a.status === "running").length;
  const q = A.reduce((s, a) => s + a.queue, 0);
  const p = A.reduce((s, a) => s + a.processed, 0), ok = A.reduce((s, a) => s + a.succeeded, 0);
  const fleetTop = Math.max(1, ...sim.fleet);
  const tickText = fill(L.tick, { n: String(sim.tick).padStart(4, "0") });

  return (
    <article aria-label={data.title || "AI agent status"}
      className={cx("@container relative isolate grid h-fit w-full max-w-[1040px] content-start gap-[18px] overflow-hidden rounded-[18px] border border-[var(--asp-line)] p-4 font-mono text-[var(--asp-ink)] elev-3 @md:p-5 @3xl:px-6 @3xl:pb-[18px] @3xl:pt-[22px]",
        "[--asp-bg:#F3F7F4] [--asp-row:#FAFCFB] [--asp-row-hover:#FFFFFF] [--asp-ink:#0E2116] [--asp-muted:#48604F] [--asp-faint:#5A7062] [--asp-line:#D5E1D9] [--asp-accent:#166534] [--asp-run:#15803D] [--asp-idle:#5B6878] [--asp-err:#B42318] [--asp-pause:#9A5B05] [--asp-restart:#0E7490] [--asp-glow:0.35] [--asp-scan:rgba(14,33,22,0.025)]",
        "dark:[--asp-bg:#080B09] dark:[--asp-row:#0D1310] dark:[--asp-row-hover:#111914] dark:[--asp-ink:#D5E8DB] dark:[--asp-muted:#8CA394] dark:[--asp-faint:#7A9283] dark:[--asp-line:#1E2C23] dark:[--asp-accent:#4ADE80] dark:[--asp-run:#4ADE80] dark:[--asp-idle:#94A3B8] dark:[--asp-err:#F87171] dark:[--asp-pause:#FBBF24] dark:[--asp-restart:#67E8F9] dark:[--asp-glow:0.75] dark:[--asp-scan:rgba(74,222,128,0.022)]",
        className)}
      style={{ background: "repeating-linear-gradient(to bottom, var(--asp-scan) 0 1px, transparent 1px 3px), radial-gradient(80% 50% at 50% 0%, color-mix(in oklab, var(--asp-accent) 7%, transparent), transparent 70%), var(--asp-bg)" }}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--asp-accent)_30%,var(--asp-accent)_70%,transparent)] opacity-60" />

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3.5">
        <div className="grid min-w-0 gap-1.5">
          {data.path && <span className="text-[11px] font-medium tracking-[0.06em] text-[var(--asp-accent)]"><span className="opacity-70">&gt; </span>{data.path}</span>}
          <h2 className="m-0 text-[clamp(20px,3.1cqi,25px)] font-semibold leading-[1.15] tracking-[-0.03em]">{data.title}</h2>
          {data.subtitle && <p className="m-0 text-[12.5px] text-[var(--asp-muted)]">{data.subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 @max-md:w-full @max-md:justify-between">
          <span className={cx("inline-flex items-center gap-2 rounded-[7px] px-2.5 py-[7px] text-[11px] font-semibold uppercase leading-none tracking-[0.12em] transition-colors duration-300",
            live || preview ? "bg-[color-mix(in_oklab,var(--asp-run)_10%,transparent)] text-[var(--asp-run)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--asp-run)_30%,transparent)]"
              : "bg-[color-mix(in_oklab,var(--asp-pause)_10%,transparent)] text-[var(--asp-pause)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--asp-pause)_30%,transparent)]")}>
            <i className={cx("size-[7px] rounded-full bg-current", live && "animate-pulse shadow-[0_0_8px_currentColor] motion-reduce:animate-none")} />
            {paused ? L.stopped : L.live}
          </span>
          <span className="whitespace-nowrap text-[11.5px] text-[var(--asp-faint)] tabular">{tickText} · {sim.clock}</span>
          <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}
            className={cx("inline-flex min-h-[34px] items-center justify-center gap-2 rounded-lg border px-3 text-[12px] font-semibold transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px focus-visible:outline-2 focus-visible:outline-[var(--asp-accent)] @max-md:flex-[1_1_100%]",
              paused ? "border-[var(--asp-accent)] bg-[var(--asp-accent)] text-[var(--asp-bg)]" : "border-[var(--asp-line)] bg-[var(--asp-row)] hover:border-[var(--asp-accent)] hover:text-[var(--asp-accent)]")}>
            {paused ? <Play /> : <Pause />}{paused ? L.resumeLive : L.pauseLive}
          </button>
        </div>
      </header>

      {/* summary */}
      <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--asp-line)] bg-[var(--asp-row)] @xl:grid-cols-4 @3xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]">
        {[
          { k: L.agentsRunning, v: <><Tick value={sim.int(runCount)} /><small className="text-[11px] font-normal tracking-normal text-[var(--asp-faint)]">/ {sim.int(A.length)}</small></> },
          { k: L.queue, v: <Tick value={sim.int(q)} /> },
          { k: L.processed, v: <CountUp value={p} duration={600} format={v => sim.int(Math.max(0, v))} /> },
          { k: L.success, v: <Tick value={sim.pct(p > 0 ? (ok / p) * 100 : null)} /> },
        ].map((s, i) => (
          <div key={s.k} className={cx("grid min-w-0 content-start gap-[7px] border-dashed border-[var(--asp-line)] px-3 py-[11px] @md:px-4 @md:py-[13px]",
            i % 2 === 1 && "border-l", i >= 2 && "border-t @xl:border-t-0", i >= 1 && "@xl:border-l")}>
            <dt className={kLabel}>{s.k}</dt>
            <dd className="m-0 flex items-baseline gap-1.5 text-[18px] font-semibold leading-none tracking-[-0.03em] tabular @md:text-[20px]">{s.v}</dd>
          </div>
        ))}
        <div className="col-span-full grid min-w-0 content-start gap-[7px] border-t border-dashed border-[var(--asp-line)] px-3 py-[11px] @md:px-4 @md:py-[13px] @3xl:col-span-1 @3xl:border-l @3xl:border-t-0">
          <dt className={kLabel}>{L.throughput}</dt>
          <dd className="m-0 flex items-end justify-between gap-3 text-[18px] font-semibold leading-none tracking-[-0.03em] tabular @md:text-[20px]">
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap"><Tick value={`≈${sim.int(sim.perMin(sim.fleet, ms))}`} /> <small className="text-[11px] font-normal tracking-normal text-[var(--asp-faint)]">{L.perMin}</small></span>
            <Bars values={sim.fleet} top={fleetTop} className="h-6 flex-1 @3xl:max-w-[150px]" barClass="bg-[var(--asp-run)] opacity-80 last:opacity-100 last:shadow-[0_0_6px_var(--asp-run)]" />
          </dd>
        </div>
      </dl>

      {/* filters */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div role="group" aria-label={L.filterLabel} className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => {
            const on = f === filter;
            const count = f === "all" ? A.length : A.filter(a => matchesF(a, f)).length;
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => setFilter(f)}
                className={cx("relative isolate inline-flex items-center gap-2 rounded-[7px] border px-2.5 py-[7px] text-[12px] font-medium leading-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--asp-accent)]",
                  on ? "border-[var(--asp-accent)] text-[var(--asp-ink)]" : "border-[var(--asp-line)] text-[var(--asp-muted)] hover:border-[var(--asp-faint)] hover:text-[var(--asp-ink)]")}>
                {on && <motion.span layoutId={`${uid}-f`} className="absolute inset-0 -z-10 rounded-[6px] bg-[color-mix(in_oklab,var(--asp-accent)_11%,transparent)]" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                {f !== "all" && <i aria-hidden className="size-1.5 rounded-full" style={{ background: COLOR[f] }} />}
                {L[f]}
                <b className="font-semibold text-[var(--asp-ink)] tabular">{count}</b>
              </button>
            );
          })}
        </div>
        <span className="text-[11.5px] text-[var(--asp-faint)] @max-md:hidden">{fill(L.hint, { s: (ms / 1000).toLocaleString(locale) })}</span>
      </div>

      {/* agents */}
      <div className="-mt-1.5 grid gap-1.5">
        <div aria-hidden className={cx(ROW_GRID, kLabel, "hidden px-3.5 @3xl:grid")}>
          <span>{L.agent}</span><span>{L.task}</span><span className="text-right">{L.queue}</span><span className="text-right">{L.success}</span><span className="text-right">{L.throughput}</span><span className="text-right">{L.actions}</span>
        </div>
        <ul className="m-0 grid list-none gap-1.5 p-0">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map(a => <AgentRow key={a.id} a={a} sim={sim} L={L} ms={ms} live={live} uid={uid} run={run} toggleError={toggleError} />)}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {shown.length === 0 && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="m-0 rounded-[10px] border border-dashed border-[var(--asp-line)] p-[22px] text-center text-[12.5px] text-[var(--asp-faint)]">{L.empty}</motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* event log */}
      <section aria-label={L.log} className="grid gap-2 border-t border-dashed border-[var(--asp-line)] pt-3.5">
        <h3 className={cx(kLabel, "m-0 flex justify-between gap-2")}><span>{L.log}</span><span className="tabular">{tickText}</span></h3>
        <ol className="m-0 grid min-h-[95px] list-none content-end gap-[3px] p-0">
          <AnimatePresence initial={false} mode="popLayout">
            {sim.log.map((it, i) => (
              <motion.li key={it.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease }}
                className={cx("grid grid-cols-[66px_minmax(0,1fr)] gap-2.5 text-[11.5px] leading-4 @max-md:grid-cols-[58px_minmax(0,1fr)] @max-md:gap-2 @max-md:text-[11px]",
                  i === sim.log.length - 1 ? "text-[var(--asp-ink)]" : "text-[var(--asp-muted)]")}>
                <span className="text-[var(--asp-faint)] tabular">{it.time}</span>
                <span className={cx("truncate", it.tone === "good" && "text-[var(--asp-run)]", it.tone === "bad" && "text-[var(--asp-err)]", it.tone === "warn" && "text-[var(--asp-pause)]")}>
                  {i === sim.log.length - 1 && <span aria-hidden className="mr-1 text-[var(--asp-accent)]">›</span>}{it.text}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>
      <p className="sr-only" aria-live="polite">{sim.announce}</p>
    </article>
  );
}

/* ---------------- one agent ---------------- */

function AgentRow({ a, sim, L, ms, live, uid, run, toggleError }: {
  a: SimAgent; sim: FleetSim; L: AspLabels; ms: number; live: boolean; uid: string;
  run: (id: string, action: AgentAction, btn?: HTMLButtonElement) => void; toggleError: (a: SimAgent) => void;
}) {
  const s = a.status;
  const isErr = s === "error" && !!a.error;
  const taskText = isErr && a.error ? `${a.error.code ? `ERR ${a.error.code} · ` : ""}${a.error.message}` : s === "restarting" ? L.restartingTask : s === "idle" && a.queue === 0 ? L.waiting : a.task || "—";
  const top = Math.max(1, Math.ceil(a.load * 2), ...a.history);
  const detailId = `${uid}-${a.id}-err`;
  const metric = "grid min-w-0 gap-1 @max-3xl:self-stretch @max-3xl:border-t @max-3xl:border-dashed @max-3xl:border-[var(--asp-line)] @max-3xl:pt-2.5";
  const k = cx(kLabel, "sr-only @max-3xl:not-sr-only");

  return (
    <motion.li id={`${uid}-${a.id}`} layout="position" data-status={s}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ duration: 0.35, ease, layout: { type: "spring", stiffness: 500, damping: 40 } }}
      style={{ "--c": COLOR[s] } as CSSProperties}
      className={cx(ROW_GRID, "relative gap-y-2.5 rounded-[10px] border bg-[var(--asp-row)] px-3.5 py-3 transition-[background-color,border-color] duration-300 hover:bg-[var(--asp-row-hover)]",
        isErr ? "border-[color-mix(in_oklab,var(--asp-err)_40%,var(--asp-line))]" : "border-[var(--asp-line)]",
        "@max-3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] @max-3xl:gap-y-3 @max-3xl:pl-4 @max-3xl:[grid-template-areas:'agent_agent_agent_act''task_task_task_task''queue_succ_tp_tp']",
        "@max-md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] @max-md:px-3 @max-md:pl-3.5 @max-md:[grid-template-areas:'agent_agent_agent''act_act_act''task_task_task''queue_succ_tp']")}>
      <span aria-hidden className="absolute -left-px bottom-2.5 top-2.5 w-[3px] rounded-r-[3px] bg-[var(--c)] opacity-90 transition-colors duration-300" />
      {a.flash > 0 && (
        <motion.span key={a.flash} aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] bg-[color-mix(in_oklab,var(--c)_16%,transparent)]"
          initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} />
      )}

      <div className="flex min-w-0 items-center gap-[11px] [grid-area:agent]">
        <Led status={s} live={live} />
        <div className="grid min-w-0 gap-[5px]">
          <h3 className="m-0 truncate text-[13.5px] font-semibold leading-[1.2] tracking-[-0.02em]">{a.name}</h3>
          <span className="truncate text-[11px] leading-[1.2] text-[var(--asp-faint)]">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--c)] transition-colors duration-300">{L[s]}</span> · {a.id}{a.model ? ` · ${a.model}` : ""}
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-1 [grid-area:task]">
        <span className="sr-only">{L.task}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={taskText} title={taskText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}
            className={cx("truncate font-sans text-[13px] leading-[1.35] @max-3xl:whitespace-normal",
              s === "running" ? "text-[var(--asp-ink)]" : isErr ? "text-[var(--asp-err)]" : "text-[var(--asp-muted)]")}>
            {taskText}
          </motion.span>
        </AnimatePresence>
        {isErr && (
          <button type="button" aria-expanded={a.expanded} aria-controls={detailId} onClick={() => toggleError(a)}
            className="inline-flex items-center gap-[5px] justify-self-start py-[3px] text-[11px] font-semibold tracking-[0.04em] text-[var(--asp-err)] underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-[var(--asp-accent)]">
            {a.expanded ? L.hideError : L.showError}<Chevron open={a.expanded} />
          </button>
        )}
      </div>

      <div className={cx(metric, "text-right [grid-area:queue] @max-3xl:text-left")}>
        <span className={k}>{L.queue}</span>
        <Tick value={sim.int(a.queue)} className="justify-end text-[14px] font-semibold leading-none tracking-[-0.02em] tabular @max-3xl:justify-start" />
      </div>
      <div className={cx(metric, "text-right [grid-area:succ] @max-3xl:text-left")}>
        <span className={k}>{L.success}</span>
        <span className="text-[14px] font-semibold leading-none tracking-[-0.02em] tabular">
          {sim.pct(a.processed > 0 ? (a.succeeded / a.processed) * 100 : null)}
        </span>
      </div>
      <div className={cx(metric, "grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 [grid-area:tp] @max-md:grid-cols-1 @max-md:gap-y-[5px]")}>
        <span className={cx(k, "col-span-full")}>{L.throughput}</span>
        <Bars values={a.history.slice(-HISTORY)} top={top} className="h-[22px] @max-md:h-[18px]"
          barClass={cx("bg-[var(--c)] transition-colors", s === "running" ? "opacity-75" : "opacity-30")} />
        <span className="whitespace-nowrap text-[11.5px] font-medium leading-none text-[var(--asp-muted)] tabular">≈{sim.int(sim.perMin(a.history, ms))}{L.perMin}</span>
      </div>

      <div className="flex justify-end gap-1 [grid-area:act] @max-md:justify-start">
        <IconBtn label={`${L.start} ${a.name}`} tip={L.start} tone="var(--asp-run)" disabled={!(s === "paused" || s === "error")} onClick={el => run(a.id, "start", el)}>
          <Play />
        </IconBtn>
        <IconBtn label={`${L.pause} ${a.name}`} tip={L.pause} tone="var(--asp-pause)" disabled={!(s === "running" || s === "idle")} onClick={el => run(a.id, "pause", el)}>
          <Pause />
        </IconBtn>
        <IconBtn label={`${L.restart} ${a.name}`} tip={L.restart} tone="var(--asp-restart)" disabled={s === "restarting"} onClick={el => run(a.id, "restart", el)}>
          <Restart spin={s === "restarting"} />
        </IconBtn>
      </div>

      <AnimatePresence initial={false}>
        {isErr && a.expanded && a.error && (
          <motion.div key="err" id={detailId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease }, opacity: { duration: 0.2 } }} className="col-span-full overflow-hidden">
            <div className="grid items-start gap-x-4 gap-y-3 rounded-lg border border-dashed border-[color-mix(in_oklab,var(--asp-err)_45%,transparent)] bg-[color-mix(in_oklab,var(--asp-err)_7%,var(--asp-bg))] px-3.5 py-3 @md:grid-cols-[minmax(0,1fr)_auto]">
              <pre className="m-0 whitespace-pre-wrap font-mono text-[12px] leading-[1.6] text-[var(--asp-ink)] [overflow-wrap:anywhere]">
                <b className="font-semibold text-[var(--asp-err)]">[{a.error.at || sim.clock}] {a.error.code ? `ERR ${a.error.code}` : "ERROR"}</b>{`  ${a.id} · ${a.name}\n${a.error.message}`}
              </pre>
              <button id={`${uid}-${a.id}-retry`} type="button" onClick={e => run(a.id, "retry", e.currentTarget)}
                className="inline-flex min-h-[34px] items-center justify-center gap-[7px] rounded-lg border border-[var(--asp-err)] px-3 text-[12px] font-semibold text-[var(--asp-err)] transition-colors duration-200 hover:bg-[var(--asp-err)] hover:text-[var(--asp-bg)] focus-visible:outline-2 focus-visible:outline-[var(--asp-accent)]">
                <Restart />{L.retry}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
