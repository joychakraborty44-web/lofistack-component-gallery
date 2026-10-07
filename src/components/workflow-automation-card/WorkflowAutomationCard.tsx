import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Tabs, cx, tabPanelProps } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { FlowIcon, FlowNode, FlowNodeType, Workflow } from "./data";

/* ------------------------------------------------------------
   Workflow Automation Card — a blueprint-navy flow builder
   (dark in both themes): trigger → if / else → actions → wait.
   Connectors are measured from the laid-out nodes; a test run
   walks a contact through the flow step by step.
   ------------------------------------------------------------ */

export type RunStatus = "started" | "paused" | "resumed" | "stopped" | "completed";
export interface WorkflowRunDetail {
  status: RunStatus;
  workflow: string;
  /** Steps finished so far. */
  step: number;
  steps: number;
  totalMs: number;
  /** Test-switch value per condition id. */
  branches: Record<string, boolean>;
  /** Ids of the finished steps, in order. */
  path: string[];
}

export interface WorkflowAutomationCardProps {
  workflow: Workflow;
  /** Controlled on/off state. Omit to start from `defaultEnabled` (or `workflow.enabled`). */
  enabled?: boolean;
  defaultEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Fired when a test run starts, pauses, resumes, stops or completes. */
  onRun?: (detail: WorkflowRunDetail) => void;
  /** Fired when a step is opened. */
  onNodeSelect?: (detail: { id: string; type: FlowNodeType; title: string; config: Record<string, string> }) => void;
  className?: string;
}

/* ---------------- constants ---------------- */
const TYPE_LABEL: Record<FlowNodeType, string> = { trigger: "Trigger", condition: "If / else", action: "Action", wait: "Wait" };
const TYPE_ICON: Record<FlowNodeType, FlowIcon> = { trigger: "bolt", condition: "branch", action: "task", wait: "clock" };
const TYPE_COLOR: Record<FlowNodeType, string> = { trigger: "#FBBF24", condition: "#2DD4BF", action: "#22D3EE", wait: "#A5B4FC" };
const ICONS: Record<FlowIcon, ReactNode> = {
  form: <><path d="M6 3.5h8l3 3V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 20z" /><path d="M9 10h6M9 13.5h6M9 17h3.5" /></>,
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" />,
  branch: <><circle cx="7" cy="5.5" r="2" /><circle cx="7" cy="18.5" r="2" /><circle cx="17" cy="9" r="2" /><path d="M7 7.5v9M17 11c0 3-4 3.5-8.5 6" /></>,
  chat: <><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11l-4 3.5V15.5H6.5a2 2 0 0 1-2-2z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="5" cy="6.5" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="17.5" r="1" /></>,
  sms: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3M9.5 8.5h5M9.5 11.5h3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  task: <><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  bell: <><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  flow: <><rect x="3.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="15.5" width="7" height="5" rx="1.5" /><path d="M7 8.5v4.5a2 2 0 0 0 2 2h4.5" /></>,
};
const Glyph = ({ name, className = "size-[18px]" }: { name: FlowIcon; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{ICONS[name] ?? ICONS.task}</svg>
);
const Small = {
  check: <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[11px]"><path d="M2.5 6.3 5 8.6 9.6 3.6" /></svg>,
  skip: <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-2.5"><path d="m3 3 3 3-3 3M7 3l3 3-3 3" /></svg>,
  stop: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden className="size-[11px]"><rect x="3" y="3" width="6" height="6" rx="1" /></svg>,
  play: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden className="size-[13px]"><path d="M3 1.8v8.4L10 6z" /></svg>,
  pause: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden className="size-[13px]"><rect x="2.5" y="2" width="2.6" height="8" rx=".6" /><rect x="6.9" y="2" width="2.6" height="8" rx=".6" /></svg>,
};

/* ---------------- graph + run planning (pure) ---------------- */
type Branch = "yes" | "no";
interface Edge { from: string; to: string; kind: "line" | "split" | "merge"; branch?: Branch }
interface Step { node: FlowNode; edge: string | null; ms: number; branch?: Branch; skip?: string[] }
interface LogItem { key: string; kind: "ok" | "skip" | "stop"; title: string; sub: string; ms: number | null }
interface Run { steps: Step[]; end: string | null; i: number; phase: "wire" | "node" | "gap"; state: "running" | "paused" | "done" | "stopped"; total: number; log: LogItem[]; seq: number }

const typeOf = (n: FlowNode): FlowNodeType => (n.type === "trigger" || n.type === "condition" || n.type === "wait" ? n.type : "action");
const hash = (s: string) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
const testMs = (n: FlowNode) => {
  if (typeof n.testMs === "number" && Number.isFinite(n.testMs)) return Math.max(0, Math.round(n.testMs));
  const h = hash(n.id || n.title), t = typeOf(n);
  return t === "trigger" ? 40 + (h % 70) : t === "condition" ? 4 + (h % 14) : t === "wait" ? 0 : 120 + (h % 340);
};
const eKey = (from: string, to: string) => `${from}>${to}`;

function flatten(flow: FlowNode[]): FlowNode[] {
  const out: FlowNode[] = [];
  const walk = (seq?: FlowNode[]) => (seq ?? []).forEach(n => { if (!n) return; out.push(n); if (typeOf(n) === "condition") { walk(n.yes); walk(n.no); } });
  walk(flow);
  return out;
}

function buildEdges(flow: FlowNode[]): Edge[] {
  const edges: Edge[] = [];
  type P = { id: string; kind: Edge["kind"]; branch?: Branch };
  const seq = (list: FlowNode[] | undefined, prev: P[]): P[] => {
    (list ?? []).forEach(n => {
      if (!n) return;
      prev.forEach(p => edges.push({ from: p.id, to: n.id, kind: p.kind, branch: p.branch }));
      if (typeOf(n) === "condition") {
        const ends: P[] = [];
        (["yes", "no"] as Branch[]).forEach(b => {
          const lane = n[b] ?? [];
          const last = seq(lane, [{ id: n.id, kind: "split", branch: b }]);
          if (lane.length) ends.push(...last.map(x => ({ id: x.id, kind: "merge" as const })));
          else ends.push({ id: n.id, kind: "line" });
        });
        prev = ends.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
      } else prev = [{ id: n.id, kind: "line" }];
    });
    return prev;
  };
  const last = seq(flow, []);
  last.forEach(p => edges.push({ from: p.id, to: "__end", kind: p.kind === "merge" ? "merge" : "line" }));
  return edges;
}

function plan(flow: FlowNode[], tests: Record<string, boolean>): { steps: Step[]; end: string | null } {
  const steps: Step[] = [];
  const skip = new Set<string>();
  const collect = (list?: FlowNode[]) => (list ?? []).forEach(n => { if (!n) return; skip.add(n.id); if (typeOf(n) === "condition") { collect(n.yes); collect(n.no); } });
  const walk = (list: FlowNode[] | undefined, from: string | null): string | null => {
    (list ?? []).forEach(n => {
      if (!n) return;
      const step: Step = { node: n, edge: from ? eKey(from, n.id) : null, ms: testMs(n) };
      steps.push(step);
      if (typeOf(n) === "condition") {
        const branch: Branch = tests[n.id] ? "yes" : "no";
        step.branch = branch;
        const before = new Set(skip);
        collect(n[branch === "yes" ? "no" : "yes"]);
        step.skip = [...skip].filter(id => !before.has(id));
        const taken = n[branch] ?? [];
        from = taken.length ? walk(taken, n.id) : n.id;
      } else from = n.id;
    });
    return from;
  };
  const last = walk(flow, null);
  return { steps, end: last ? eKey(last, "__end") : null };
}

const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
const int = (v: number) => Math.round(v).toLocaleString("en-US");

/* ---------------- component ---------------- */
export function WorkflowAutomationCard({ workflow, enabled: enabledProp, defaultEnabled, onEnabledChange, onRun, onNodeSelect, className }: WorkflowAutomationCardProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const flow = workflow.flow ?? [];
  const nodes = useMemo(() => flatten(flow), [flow]);
  const edges = useMemo(() => buildEdges(flow), [flow]);
  const conditions = nodes.filter(n => typeOf(n) === "condition");
  const initTests = () => Object.fromEntries(conditions.map(n => [n.id, n.testDefault !== false]));

  const [innerOn, setInnerOn] = useState(defaultEnabled ?? workflow.enabled !== false);
  const on = enabledProp ?? innerOn;
  const [wfId, setWfId] = useState(workflow.id);
  const [sel, setSel] = useState<string | null>(nodes[0]?.id ?? null);
  const [tab, setTab] = useState<"node" | "log">("node");
  const [tests, setTests] = useState<Record<string, boolean>>(initTests);
  const [run, setRun] = useState<Run | null>(null);
  const [live, setLive] = useState("");
  /* a new workflow resets the card (derived state, no effect flash) */
  if (wfId !== workflow.id) {
    setWfId(workflow.id); setSel(nodes[0]?.id ?? null); setTab("node"); setTests(initTests()); setRun(null);
  }

  const contactName = workflow.testContact?.name || "Test contact";
  const planned = useMemo(() => plan(flow, tests), [flow, tests]);
  const n = run ? run.steps.length : planned.steps.length;

  const detail = (status: RunStatus, r: Run | null): WorkflowRunDetail => ({
    status, workflow: workflow.name || "", step: r ? r.i : 0, steps: r ? r.steps.length : 0, totalMs: r ? r.total : 0,
    branches: { ...tests }, path: r ? r.steps.slice(0, r.i).map(s => s.node.id) : [],
  });

  /* ----- run engine: one timer per phase ----- */
  useEffect(() => {
    if (!run || run.state !== "running") return;
    const step = run.steps[run.i];
    const t = step ? typeOf(step.node) : "action";
    const base = run.phase === "wire" ? (step?.edge ? 380 : 0) : run.phase === "node" ? (t === "wait" ? 700 : Math.max(420, Math.min(900, (step?.ms ?? 0) * 2))) : 160;
    const id = window.setTimeout(() => {
      let next: Run;
      if (run.phase === "wire") next = { ...run, phase: "node" };
      else if (run.phase === "node") {
        const nd = step.node, ty = typeOf(nd);
        let sub = nd.detail || "";
        if (ty === "condition") sub = `→ ${step.branch === "yes" ? "Yes" : "No"} branch`;
        if (ty === "wait") sub = `Skipped in test, live contacts wait ${nd.config?.Duration || (nd.title || "").replace(/^wait\s*/i, "")}`;
        next = { ...run, phase: "gap", i: run.i + 1, total: run.total + step.ms,
          log: [...run.log, { key: `${run.seq}-${nd.id}`, kind: ty === "wait" ? "skip" : "ok", title: nd.title || TYPE_LABEL[ty], sub, ms: step.ms }] };
      } else if (run.i >= run.steps.length) next = { ...run, state: "done" };
      else next = { ...run, phase: "wire" };
      setRun(next);
      if (next.state === "done") {
        setLive(`Completed. ${next.steps.length} steps in ${int(next.total)} ms`);
        onRun?.(detail("completed", next));
      }
    }, reduced ? Math.min(160, base) : base);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, reduced]);

  const start = () => {
    if (!planned.steps.length) return;
    const r: Run = { ...planned, i: 0, phase: "wire", state: "running", total: 0, log: [], seq: (run?.seq ?? 0) + 1 };
    setRun(r); setTab("log");
    setLive(`Running: ${contactName}${on ? "" : ". The workflow is off, but test runs still work."}`);
    onRun?.(detail("started", r));
  };
  const pause = () => { if (!run) return; const r = { ...run, state: "paused" as const }; setRun(r); setLive("Paused"); onRun?.(detail("paused", r)); };
  const resume = () => { if (!run) return; const r = { ...run, state: "running" as const }; setRun(r); onRun?.(detail("resumed", r)); };
  const stop = () => {
    if (!run || (run.state !== "running" && run.state !== "paused")) return;
    const r: Run = { ...run, state: "stopped", log: [...run.log, { key: `${run.seq}-stop`, kind: "stop", title: "Stopped", sub: `after ${run.i} of ${run.steps.length} steps`, ms: null }] };
    setRun(r); setLive("Stopped"); onRun?.(detail("stopped", r));
  };
  const busy = !!run && (run.state === "running" || run.state === "paused");

  const toggleOn = () => {
    const v = !on;
    setInnerOn(v); onEnabledChange?.(v);
    setLive(v ? "Active. New contacts enter" : "Off. No new contacts enter");
  };
  const flipTest = (id: string) => {
    if (busy) return;
    setTests(t => ({ ...t, [id]: !t[id] }));
    if (run && (run.state === "done" || run.state === "stopped")) setRun(null);
  };
  const select = (nd: FlowNode) => {
    setSel(nd.id); setTab("node");
    onNodeSelect?.({ id: nd.id, type: typeOf(nd), title: nd.title || "", config: nd.config ?? {} });
  };

  /* ----- visual run state ----- */
  const active = !!run && (run.state === "running" || run.state === "paused");
  const doneNodes = new Set(run ? run.steps.slice(0, run.i).map(s => s.node.id) : []);
  const runningNode = active && run!.phase === "node" ? run!.steps[run!.i]?.node.id ?? null : null;
  const doneEdges = new Set<string>(run ? run.steps.slice(0, run.i).map(s => s.edge).filter((e): e is string => !!e) : []);
  if (run && run.phase === "node" && run.steps[run.i]?.edge) doneEdges.add(run.steps[run.i].edge!);
  if (run?.state === "done" && run.end) doneEdges.add(run.end);
  const liveEdge = active && run!.phase === "wire" ? run!.steps[run!.i]?.edge ?? null : null;
  const skipNodes = new Set(run ? run.steps.slice(0, run.i).flatMap(s => s.skip ?? []) : []);
  const taken = new Map<string, Branch>(run ? run.steps.slice(0, run.i).filter(s => s.branch).map(s => [s.node.id, s.branch!]) : []);
  const endDone = run?.state === "done";

  /* ----- measured connectors ----- */
  const flowRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement | null>());
  const [geo, setGeo] = useState<{ w: number; h: number; d: Record<string, string> }>({ w: 0, h: 0, d: {} });
  const layoutWires = useCallback(() => {
    const flowEl = flowRef.current;
    if (!flowEl) return;
    const box = flowEl.getBoundingClientRect();
    if (!box.width) return;
    // undo any CSS scale (preview thumbnails are scaled down)
    const k = flowEl.offsetWidth ? box.width / flowEl.offsetWidth : 1;
    const pt = (el: HTMLElement, top: boolean) => { const r = el.getBoundingClientRect(); return { x: (r.left - box.left + r.width / 2) / k, y: ((top ? r.top : r.bottom) - box.top) / k }; };
    const d: Record<string, string> = {};
    edges.forEach(e => {
      const a = els.current.get(e.from), b = els.current.get(e.to);
      if (!a || !b) return;
      const A = pt(a, false), B = pt(b, true);
      if (Math.abs(A.x - B.x) < 1.5) { d[eKey(e.from, e.to)] = `M${A.x.toFixed(1)} ${A.y.toFixed(1)} V${B.y.toFixed(1)}`; return; }
      const mid = e.kind === "split" ? A.y + 20 : e.kind === "merge" ? B.y - 20 : (A.y + B.y) / 2;
      const dir = B.x > A.x ? 1 : -1;
      const r = Math.max(0, Math.min(10, Math.abs(B.x - A.x) / 2, mid - A.y, B.y - mid));
      d[eKey(e.from, e.to)] = `M${A.x.toFixed(1)} ${A.y.toFixed(1)} V${(mid - r).toFixed(1)} Q${A.x.toFixed(1)} ${mid.toFixed(1)} ${(A.x + dir * r).toFixed(1)} ${mid.toFixed(1)} H${(B.x - dir * r).toFixed(1)} Q${B.x.toFixed(1)} ${mid.toFixed(1)} ${B.x.toFixed(1)} ${(mid + r).toFixed(1)} V${B.y.toFixed(1)}`;
    });
    const w = flowEl.offsetWidth, h = flowEl.offsetHeight;
    setGeo(g => (g.w === w && g.h === h && JSON.stringify(g.d) === JSON.stringify(d) ? g : { w, h, d }));
  }, [edges]);
  useLayoutEffect(() => {
    layoutWires();
    const el = flowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => layoutWires());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layoutWires, workflow.id]);

  const onFlowKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const list = [...(flowRef.current?.querySelectorAll<HTMLButtonElement>("[data-node]") ?? [])];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  /* ----- pieces ----- */
  const renderNode = (nd: FlowNode, inBranch: boolean) => {
    const t = typeOf(nd);
    const isDone = doneNodes.has(nd.id), isRun = runningNode === nd.id, isSkip = skipNodes.has(nd.id), isSel = sel === nd.id;
    return (
      <button key={nd.id} type="button" data-node ref={el => { els.current.set(nd.id, el); }}
        aria-pressed={isSel} aria-controls={`${uid}-panel`} onClick={() => select(nd)}
        style={{ "--t": TYPE_COLOR[t] } as CSSProperties}
        className={cx("group/node relative z-[1] box-border grid w-full max-w-[268px] items-center rounded-xl border text-left transition-[border-color,background-color,box-shadow,opacity] duration-300 focus-visible:outline-offset-4",
          "bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent),#10284A] hover:bg-[linear-gradient(180deg,rgb(255_255_255/0.05),transparent),#143159]",
          inBranch ? "grid-cols-1 justify-items-start gap-1.5 p-[9px] @md:grid-cols-[36px_minmax(0,1fr)] @md:justify-items-stretch @md:gap-[11px] @md:py-2.5 @md:pl-2.5 @md:pr-3"
            : "grid-cols-[30px_minmax(0,1fr)] gap-2.5 p-[9px] @md:grid-cols-[36px_minmax(0,1fr)] @md:gap-[11px] @md:py-2.5 @md:pl-2.5 @md:pr-3",
          isRun ? "border-[var(--t)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--t)_22%,transparent),0_0_28px_-4px_color-mix(in_oklab,var(--t)_60%,transparent)]"
            : isSel ? "border-[var(--t)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--t)_24%,transparent),0_14px_30px_-18px_#000]"
            : isDone ? "border-[color-mix(in_oklab,#4ADE80_70%,transparent)] shadow-[0_12px_26px_-18px_#000]"
            : "border-[color-mix(in_oklab,var(--t)_45%,transparent)] shadow-[0_12px_26px_-18px_#000] hover:border-[var(--t)]",
          isSkip && "opacity-[0.32]")}>
        {t !== "trigger" && <span aria-hidden className="absolute -top-[5px] left-1/2 size-[7px] -translate-x-1/2 rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--t)_70%,transparent)] bg-[#0B1B33]" />}
        <span aria-hidden className="absolute -bottom-[5px] left-1/2 size-[7px] -translate-x-1/2 rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--t)_70%,transparent)] bg-[#0B1B33]" />
        <motion.span aria-hidden
          animate={isRun && !reduced ? { scale: [1, 1.08, 1], boxShadow: ["inset 0 0 0 1px color-mix(in oklab, var(--t) 28%, transparent)", "inset 0 0 0 1px var(--t), 0 0 0 5px color-mix(in oklab, var(--t) 18%, transparent)", "inset 0 0 0 1px color-mix(in oklab, var(--t) 28%, transparent)"] } : { scale: 1 }}
          transition={isRun ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          className={cx("grid place-items-center rounded-lg bg-[color-mix(in_oklab,var(--t)_15%,transparent)] text-[var(--t)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t)_28%,transparent)] @md:size-9 @md:rounded-[9px]", inBranch ? "size-7" : "size-[30px]")}>
          <Glyph name={nd.icon || TYPE_ICON[t]} className="size-[15px] @md:size-[18px]" />
        </motion.span>
        <span className="grid min-w-0 gap-[3px]">
          <span className="font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--t)]">{TYPE_LABEL[t]}</span>
          <span className="text-[12.5px] font-semibold leading-[1.25] text-[#F1F6FD] [overflow-wrap:anywhere] @md:text-[13.5px]">{nd.title || TYPE_LABEL[t]}</span>
          {nd.detail && <span className={cx("text-[11.5px] leading-[1.3] text-[#AFC1DA] [overflow-wrap:anywhere]", inBranch && "hidden @md:block")}>{nd.detail}</span>}
        </span>
        <AnimatePresence>
          {isDone && (
            <motion.span key="ok" aria-hidden initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="absolute -right-[9px] -top-[9px] grid size-5 place-items-center rounded-full bg-[#4ADE80] text-[#052E16] shadow-[0_0_0_3px_#0B1B33]">{Small.check}</motion.span>
          )}
        </AnimatePresence>
        <span className="sr-only">{isDone ? ", completed" : isRun ? ", running" : isSkip ? ", skipped" : ""}</span>
      </button>
    );
  };

  const renderSeq = (list: FlowNode[] | undefined, inBranch: boolean): ReactNode =>
    (list ?? []).map(nd => {
      if (typeOf(nd) !== "condition") return renderNode(nd, inBranch);
      const tk = taken.get(nd.id);
      return (
        <Fragment key={nd.id}>
          {renderNode(nd, inBranch)}
          <div className="relative z-[1] grid w-full max-w-[580px] grid-cols-2 gap-x-2.5 @md:gap-x-7">
            {(["yes", "no"] as Branch[]).map(b => (
              <div key={b} className="grid min-w-0 content-start justify-items-center gap-[34px] @md:gap-10">
                <span className={cx("relative z-[1] -mb-4 rounded-full border bg-[#0B1B33] px-[9px] py-[5px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] transition-[color,border-color,opacity,background-color] duration-300",
                  tk === b ? "border-[#2DD4BF] bg-[#0F3240] text-[#F1F6FD]" : "border-[rgb(148_186_232/0.32)]", tk && tk !== b && "opacity-40",
                  tk !== b && (b === "yes" ? "text-[#2DD4BF]" : "text-[#AFC1DA]"))}>
                  {b === "yes" ? "If yes" : "If no"}
                </span>
                {renderSeq(nd[b], true)}
              </div>
            ))}
          </div>
        </Fragment>
      );
    });

  const selNode = nodes.find(x => x.id === sel) ?? null;
  const totalRuns = workflow.stats?.runs ?? nodes[0]?.runs;
  const s = workflow.stats ?? {};
  const k = run ? run.i : 0;
  const stateName = run ? run.state : "idle";
  const offNote = stateName !== "idle" && !on ? " The workflow is off, but test runs still work." : "";
  const stateText = {
    idle: ["Ready to test", "Pick the test switches, then press Test run."],
    running: ["Running", `step ${Math.min(k + 1, n)} of ${n}`],
    paused: ["Paused", `at step ${Math.min(k + 1, n)} of ${n}`],
    done: ["Completed", `${n} steps in ${int(run?.total ?? 0)} ms`],
    stopped: ["Stopped", `after ${k} of ${n} steps`],
  }[stateName];
  const dotTone = { idle: "bg-[#8399B8]", running: "bg-[#22D3EE]", paused: "bg-[#FBBF24]", done: "bg-[#4ADE80]", stopped: "bg-[#FB7185]" }[stateName];
  const logCount = run ? run.log.filter(x => x.kind !== "stop").length : 0;
  const grid: CSSProperties = {
    backgroundImage: "linear-gradient(rgb(56 189 248/0.12) 1px, transparent 1px), linear-gradient(90deg, rgb(56 189 248/0.12) 1px, transparent 1px), linear-gradient(rgb(56 189 248/0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(56 189 248/0.06) 1px, transparent 1px)",
    backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px", backgroundPosition: "-1px -1px",
  };

  return (
    <article aria-labelledby={`${uid}-name`} data-on={on}
      className={cx("@container relative w-full max-w-[1040px] overflow-hidden rounded-2xl border border-[rgb(34_211_238/0.28)] bg-[#0B1B33] text-[#F1F6FD] [color-scheme:dark]",
        "shadow-[0_0_0_1px_rgb(2_8_20/0.4),0_36px_64px_-42px_rgb(2_8_20/0.6),inset_0_1px_0_rgb(255_255_255/0.05)]",
        /* re-theme the shared primitives for the blueprint surface */
        "[--ink:#F1F6FD] [--ink-2:#AFC1DA] [--ink-3:#8399B8] [--line:rgb(148_186_232/0.18)] [--line-strong:rgb(148_186_232/0.32)] [--sunken:rgb(255_255_255/0.07)] [--surface:#10284A] [--ring:#22D3EE]",
        "[&_:focus-visible]:outline-[#22D3EE]", className)}>

      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3.5 px-3.5 pb-3 pt-[18px] @lg:px-[18px] @lg:pb-3.5 @lg:pt-5 @3xl:px-6 @3xl:pb-4 @3xl:pt-[22px]">
        <div className="grid min-w-0 gap-1.5">
          {workflow.eyebrow && <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[#22D3EE]"><Glyph name="flow" className="size-[13px]" />{workflow.eyebrow}</span>}
          <h2 id={`${uid}-name`} className="m-0 font-display text-[clamp(19px,3cqi,23px)] font-semibold leading-[1.2] tracking-[-0.01em] text-balance">{workflow.name}</h2>
          {workflow.subtitle && <p className="m-0 text-[12.5px] text-[#AFC1DA]">{workflow.subtitle}</p>}
        </div>
        <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgb(148_186_232/0.18)] bg-white/[0.02] py-1.5 pl-3 pr-1.5 @lg:w-auto @lg:justify-start">
          <span className="grid gap-1 @lg:text-right">
            <b className="inline-flex items-center gap-[7px] text-[13px] font-semibold leading-none @lg:justify-end">
              <span aria-hidden className={cx("size-[7px] rounded-full transition-[background-color,box-shadow] duration-300", on ? "bg-[#4ADE80] shadow-[0_0_0_3px_rgb(74_222_128/0.18)]" : "bg-[#8399B8]")} />
              {on ? "Active" : "Off"}
            </b>
            <small className="text-[11px] leading-[1.2] text-[#8399B8]">{on ? "New contacts enter" : "No new contacts enter"}</small>
          </span>
          <button type="button" role="switch" aria-checked={on} aria-label="Workflow on" onClick={toggleOn}
            className={cx("relative h-[30px] w-[52px] shrink-0 rounded-full border p-0 transition-[background-color,border-color] duration-300",
              on ? "border-[#22D3EE] bg-[#22D3EE]" : "border-[rgb(148_186_232/0.32)] bg-[#0A1830]")}>
            <motion.span aria-hidden className={cx("absolute left-[3px] top-[3px] size-[22px] rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.4)]", on ? "bg-white" : "bg-[#AFC1DA]")}
              initial={false} animate={{ x: on ? 22 : 0 }} transition={{ type: "spring", stiffness: 520, damping: 34 }} />
          </button>
        </div>
      </header>

      {/* stats */}
      <dl className="m-0 grid grid-cols-2 gap-y-3.5 px-3.5 pb-3.5 @lg:px-[18px] @lg:pb-4 @3xl:grid-cols-4 @3xl:px-6 @3xl:pb-[18px]">
        {([
          s.runs != null ? ["Runs", <><CountUp value={s.runs} />{s.period && <small className="ml-1.5 font-sans text-[11px] font-medium tracking-normal text-[#8399B8]">{s.period}</small>}</>] : null,
          s.runs && s.succeeded != null ? ["Success rate", <><CountUp value={(s.succeeded / s.runs) * 100} format={v => `${v.toFixed(1)}%`} /><small className="ml-1.5 font-sans text-[11px] font-medium tracking-normal text-[#8399B8]">{int(s.succeeded)}/{int(s.runs)}</small></>] : null,
          s.avgSeconds != null ? ["Avg. run time", `${s.avgSeconds.toFixed(1)} s`] : null,
          s.lastRun ? ["Last run", s.lastRun] : null,
        ].filter(Boolean) as [string, ReactNode][]).map(([kk, v], i) => (
          <div key={kk} className={cx("grid min-w-0 gap-1.5 pr-2.5 @lg:pr-4", i % 2 === 1 ? "border-l border-[rgb(148_186_232/0.18)] pl-2.5 @lg:pl-4" : "pl-0", i === 2 && "border-[rgb(148_186_232/0.18)] @3xl:border-l @3xl:pl-4")}>
            <dt className="font-mono text-[10px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-[#8399B8]">{kk}</dt>
            <dd className="m-0 font-mono text-[16px] font-semibold leading-[1.1] tracking-[-0.02em] tabular [overflow-wrap:anywhere] @lg:text-[18px]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid border-t border-[rgb(148_186_232/0.18)] @3xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* canvas */}
        <div className={cx("relative min-w-0 bg-[#0B1B33] transition-[filter] duration-500", !on && "saturate-[.45] brightness-[.92]")} style={grid}>
          <span aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 border-l border-t border-[rgb(103_232_249/0.5)]" />
          <span aria-hidden className="pointer-events-none absolute bottom-2.5 right-2.5 size-3.5 border-b border-r border-[rgb(103_232_249/0.5)]" />
          <span aria-hidden className="absolute right-3.5 top-3 z-[2] hidden font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-[#8399B8] @md:block">{nodes.length} nodes</span>

          <div ref={flowRef} onKeyDown={onFlowKey} className="relative grid justify-items-center gap-[34px] px-2.5 pb-[46px] pt-[34px] @md:gap-10 @md:px-6 @md:pb-12 @md:pt-[38px]">
            {/* connectors */}
            <motion.svg aria-hidden width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w || 1} ${geo.h || 1}`} className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
              initial={preview ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
              {edges.map(e => {
                const key = eKey(e.from, e.to), d = geo.d[key];
                if (!d) return null;
                const done = doneEdges.has(key), isLive = liveEdge === key;
                const skip = !done && (skipNodes.has(e.from) || skipNodes.has(e.to));
                return (
                  <path key={key} d={d} fill="none" strokeLinecap="round"
                    className={cx("transition-[stroke,opacity] duration-300",
                      done ? "stroke-[#22D3EE] [stroke-width:2] [filter:drop-shadow(0_0_4px_rgb(34_211_238/0.55))]"
                      : isLive ? "stroke-[rgb(34_211_238/0.55)] [stroke-width:2]"
                      : skip ? "stroke-[rgb(103_232_249/0.42)] opacity-[0.22] [stroke-dasharray:3_5] [stroke-width:1.6]"
                      : "stroke-[rgb(103_232_249/0.42)] [stroke-width:1.6]")} />
                );
              })}
              {liveEdge && geo.d[liveEdge] && !reduced && (
                <motion.path key={`live-${liveEdge}-${run?.seq}`} d={geo.d[liveEdge]} fill="none" stroke="#22D3EE" strokeWidth={2} strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.38, ease: "easeInOut" }} />
              )}
            </motion.svg>
            {/* travelling pulse */}
            {liveEdge && geo.d[liveEdge] && !reduced && (
              <motion.span key={`pulse-${liveEdge}-${run?.seq}`} aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-[2] size-2.5 rounded-full bg-[#CFFAFE] shadow-[0_0_0_3px_rgb(34_211_238/0.35),0_0_14px_3px_rgb(34_211_238/0.8)]"
                style={{ offsetPath: `path("${geo.d[liveEdge]}")`, offsetRotate: "0deg", offsetAnchor: "50% 50%" } as CSSProperties}
                initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 0.38, ease: "easeInOut" }} />
            )}

            {renderSeq(flow, false)}
            {flow.length > 0 && (
              <span ref={el => { els.current.set("__end", el); }}
                className={cx("relative z-[1] inline-flex items-center gap-[7px] rounded-full border bg-[#0B1B33] px-[11px] py-1.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] transition-[color,border-color] duration-300",
                  endDone ? "border-solid border-[#4ADE80] text-[#4ADE80]" : "border-dashed border-[rgb(148_186_232/0.32)] text-[#8399B8]")}>
                <span aria-hidden className="size-[7px] rounded-[2px] bg-current" />End
              </span>
            )}
          </div>

          {(workflow.ref || workflow.revision || nodes.length > 0) && (
            <div aria-hidden className="absolute bottom-3 left-3.5 z-[2] flex border border-[rgb(148_186_232/0.32)] font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.08em] text-[#8399B8]">
              {[workflow.ref, workflow.revision, nodes.length ? `${nodes.length} nodes` : null].filter(Boolean).map((t, i) => (
                <span key={i} className={cx("px-[7px] py-[5px]", i > 0 && "border-l border-[rgb(148_186_232/0.32)]")}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* side panel */}
        <aside className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] border-t border-[rgb(148_186_232/0.18)] bg-[#0D2140] @3xl:border-l @3xl:border-t-0">
          <Tabs id={uid} value={tab} onChange={setTab} ariaLabel="Workflow details"
            className="px-3.5" tabClassName="py-3.5 text-[12.5px]" indicatorClassName="bg-[#22D3EE]!"
            items={[{ value: "node", label: "Step" }, { value: "log", label: "Test log", count: logCount || undefined }]} />
          <div {...tabPanelProps(uid, tab)} className="grid min-w-0 content-start gap-4 px-3.5 pb-[18px] pt-4 outline-none @lg:px-[18px] @lg:pb-5 @lg:pt-[18px]">
            {tab === "node" ? (
                <motion.div key={`node-${selNode?.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="grid gap-4">
                  {selNode && <StepPane node={selNode} totalRuns={totalRuns} period={workflow.stats?.period} />}
                </motion.div>
              ) : (
                <motion.div key="log" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="grid gap-4">
                  <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgb(148_186_232/0.18)] bg-[rgb(2_10_24/0.35)] px-3 py-2.5 text-[12.5px] text-[#AFC1DA]">
                    <motion.span aria-hidden className={cx("size-2 shrink-0 rounded-full", dotTone)}
                      animate={stateName === "running" && !reduced ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                      transition={stateName === "running" ? { duration: 1, repeat: Infinity } : { duration: 0.2 }} />
                    <span><b className="font-semibold text-[#F1F6FD]">{stateText[0]}</b> · {stateText[1]}{offNote}</span>
                  </div>
                  {!run?.log.length && <p className="m-0 text-[13px] leading-[1.55] text-[#AFC1DA]">No test run yet. The run follows the branch set by the test switches and skips any waits.</p>}
                  {!!run?.log.length && (
                    <ol className="m-0 grid list-none p-0">
                      <AnimatePresence initial={false}>
                        {run.log.map(item => (
                          <motion.li key={item.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                            className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-[rgb(148_186_232/0.18)] py-[9px] text-[12.5px] leading-[1.4]">
                            <span aria-hidden className={cx("mt-px grid size-[18px] place-items-center rounded-full",
                              item.kind === "stop" ? "bg-[rgb(251_113_133/0.16)] text-[#FB7185]" : item.kind === "skip" ? "bg-[rgb(165_180_252/0.16)] text-[#A5B4FC]" : "bg-[rgb(74_222_128/0.16)] text-[#4ADE80]")}>
                              {item.kind === "stop" ? Small.stop : item.kind === "skip" ? Small.skip : Small.check}
                            </span>
                            <span className="grid min-w-0 gap-0.5">
                              <b className="font-semibold text-[#F1F6FD] [overflow-wrap:anywhere]">{item.title}</b>
                              {item.sub && <small className="text-[11.5px] text-[#AFC1DA] [overflow-wrap:anywhere]">{item.sub}</small>}
                            </span>
                            <span className="whitespace-nowrap font-mono text-[11.5px] font-semibold leading-[1.4] text-[#22D3EE] tabular">{item.ms == null ? "" : `${int(item.ms)} ms`}</span>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  )}
                  {run && (run.state === "done" || run.state === "stopped") && (
                    <p className="m-0 flex justify-between gap-2.5 font-mono text-[12px] font-semibold leading-none"><span>Total</span><span>{int(run.total)} ms</span></p>
                  )}
                </motion.div>
              )}
          </div>
        </aside>
      </div>

      {/* run bar */}
      <footer className="relative flex flex-wrap items-center justify-between gap-x-[18px] gap-y-3 border-t border-[rgb(148_186_232/0.18)] bg-[rgb(3_12_28/0.35)] p-3.5 @lg:px-[18px] @3xl:px-6">
        <div aria-hidden className="absolute inset-x-0 -top-px h-0.5">
          <motion.span className="block h-full bg-[#22D3EE] shadow-[0_0_10px_#22D3EE]" initial={false} animate={{ width: `${n ? (k / n) * 100 : 0}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[#173A63] font-mono text-[11.5px] font-semibold shadow-[inset_0_0_0_1px_rgb(148_186_232/0.32)]">{initials(contactName)}</span>
            <span className="grid min-w-0 gap-[3px]">
              <small className="font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.1em] text-[#8399B8]">{workflow.testContact?.note || "Test contact"}</small>
              <b className="text-[13px] font-semibold leading-[1.2] [overflow-wrap:anywhere]">{contactName}</b>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {conditions.map(c => {
              const v = !!tests[c.id];
              return (
                <button key={c.id} type="button" role="switch" aria-checked={v} disabled={busy} onClick={() => flipTest(c.id)}
                  className="inline-flex items-center gap-[9px] rounded-full border border-[rgb(148_186_232/0.32)] py-1.5 pl-[7px] pr-[11px] text-left text-[12.5px] font-medium leading-[1.2] transition-[border-color,opacity] duration-200 enabled:hover:border-[#2DD4BF] disabled:cursor-not-allowed disabled:opacity-55">
                  <span aria-hidden className={cx("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200", v ? "bg-[#2DD4BF]" : "bg-white/[0.12]")}>
                    <motion.span className={cx("absolute left-0.5 top-0.5 size-3.5 rounded-full", v ? "bg-white" : "bg-[#AFC1DA]")} initial={false} animate={{ x: v ? 12 : 0 }} transition={{ type: "spring", stiffness: 520, damping: 32 }} />
                  </span>
                  <span>{c.test || c.title || "Condition"}</span>
                  <span className={cx("font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]", v ? "text-[#2DD4BF]" : "text-[#8399B8]")}>{v ? "Yes" : "No"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex w-full gap-2 @lg:w-auto">
          <button type="button" disabled={!n} onClick={() => (run?.state === "running" ? pause() : run?.state === "paused" ? resume() : start())}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#22D3EE] bg-[#22D3EE] px-[15px] text-[13px] font-semibold leading-none text-[#04202A] shadow-[0_10px_22px_-12px_#22D3EE] transition-[background-color,border-color,transform] duration-200 enabled:hover:border-[#67E8F9] enabled:hover:bg-[#67E8F9] enabled:active:scale-[0.98] disabled:opacity-40 @lg:flex-none">
            {run?.state === "running" ? <>{Small.pause}Pause</> : run?.state === "paused" ? <>{Small.play}Resume</> : <>{Small.play}{run ? "Run again" : "Test run"}</>}
          </button>
          <button type="button" disabled={!busy} onClick={stop}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[rgb(148_186_232/0.32)] px-[15px] text-[13px] font-semibold leading-none transition-[border-color,transform,opacity] duration-200 enabled:hover:border-[#22D3EE] enabled:active:scale-[0.98] disabled:opacity-40 @lg:flex-none">
            {Small.stop}Stop
          </button>
        </div>
      </footer>
      <p className="sr-only" aria-live="polite">{live}</p>
    </article>
  );
}

function StepPane({ node, totalRuns, period }: { node: FlowNode; totalRuns?: number; period?: string }) {
  const preview = usePreviewMode();
  const t = typeOf(node);
  const cfg = node.config ? Object.entries(node.config) : [];
  const reach = node.runs != null && totalRuns ? Math.min(100, (node.runs / totalRuns) * 100) : null;
  return (
    <>
      <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3" style={{ "--t": TYPE_COLOR[t] } as CSSProperties}>
        <span aria-hidden className="grid size-10 place-items-center rounded-[10px] bg-[color-mix(in_oklab,var(--t)_15%,transparent)] text-[var(--t)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--t)_28%,transparent)]"><Glyph name={node.icon || TYPE_ICON[t]} /></span>
        <div className="grid min-w-0 gap-[3px]">
          <span className="font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--t)]">{TYPE_LABEL[t]}</span>
          <h3 className="m-0 font-display text-[16px] font-semibold leading-[1.25] [overflow-wrap:anywhere]">{node.title || TYPE_LABEL[t]}</h3>
        </div>
      </div>
      {node.description && <p className="m-0 text-[13px] leading-[1.55] text-[#AFC1DA]">{node.description}</p>}
      {cfg.length > 0 && (
        <dl className="m-0 grid gap-2">
          {cfg.map(([kk, v]) => (
            <div key={kk} className="grid gap-[5px]">
              <dt className="font-mono text-[10px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-[#8399B8]">{kk}</dt>
              <dd className="m-0 rounded-lg border border-[rgb(148_186_232/0.18)] bg-[rgb(2_10_24/0.45)] px-2.5 py-2 font-mono text-[12.5px] font-medium leading-[1.45] [overflow-wrap:anywhere]">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {reach != null && (
        <div className="grid gap-2 border-t border-dashed border-[rgb(148_186_232/0.32)] pt-3.5">
          <div className="flex items-baseline justify-between gap-2.5 font-mono text-[10px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-[#8399B8]">
            <span>Reached this step{period ? ` · ${period}` : ""}</span>
            <b className="font-mono text-[13px] font-semibold normal-case leading-none tracking-normal text-[#F1F6FD] tabular">{int(node.runs!)}</b>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="presentation">
            <motion.span className="block h-full rounded-full bg-[linear-gradient(90deg,#2DD4BF,#22D3EE)]" initial={preview ? false : { width: 0 }} animate={{ width: `${reach}%` }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }} />
          </div>
          <p className="m-0 text-[12px] text-[#AFC1DA] tabular">{int(node.runs!)} of {int(totalRuns!)} contacts · {reach.toFixed(1)}%</p>
        </div>
      )}
    </>
  );
}
