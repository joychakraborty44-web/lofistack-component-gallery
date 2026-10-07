import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CountUp, cx } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { BoardColumn, BoardPerson, BoardTask, BoardTone, TaskPriority } from "./data";

/* ------------------------------------------------------------
   Task Progress Board — a kanban board with pointer drag & drop
   (mouse + touch), keyboard moves, a Move menu, an assignee
   filter and a live, segmented progress bar.
   ------------------------------------------------------------ */

export type MoveVia = "drag" | "keyboard" | "menu" | "api";

export interface TaskMoveDetail {
  id: string;
  title: string;
  from: string;
  to: string;
  /** Position among the visible cards of the target column. */
  index: number;
  via: MoveVia;
  /** Percentage of visible tasks that are done after the move. */
  progress: number;
}

export interface TaskBoardLabels {
  filter: string; all: string; progress: string; progressFor: string; progressSub: string; hint: string;
  priority: Record<TaskPriority, string>;
  move: string; moveTo: string; current: string;
  empty: string; emptyFiltered: string;
  today: string; tomorrow: string; overdue: string;
  collapse: string; expand: string; overLimit: string; cardHint: string;
  moved: string; edge: string; picked: string; dropped: string; cancelled: string; showing: string;
}

const LABELS: TaskBoardLabels = {
  filter: "Filter by assignee", all: "Everyone", progress: "Board progress", progressFor: "{name}'s progress",
  progressSub: "{done} of {total} tasks done", hint: "Drag cards, or focus one and press",
  priority: { high: "High", medium: "Medium", low: "Low" },
  move: "Move", moveTo: "Move to", current: "Current",
  empty: "No tasks here yet. Drop a card to move it.", emptyFiltered: "No tasks for this person here.",
  today: "Today", tomorrow: "Tomorrow", overdue: "Overdue",
  collapse: "Collapse {col}", expand: "Expand {col}", overLimit: "over the limit of {n}",
  cardHint: "Press left or right arrow to move to another column, up or down to move between cards, Enter for the move menu.",
  moved: "Moved {title} to {col}. {col} now has {n} tasks.", edge: "{title} is already in {col}.",
  picked: "Picked up {title}.", dropped: "{title} stayed in {col}.", cancelled: "Move cancelled.",
  showing: "Showing {n} tasks for {name}.",
};

export interface TaskBoardHandle {
  /** Move a task to a column. `index` is the position among visible cards; omit to add at the end. */
  moveTask: (id: string, column: string, index?: number) => boolean;
  /** A copy of the current tasks, in board order. */
  getTasks: () => BoardTask[];
}

export interface TaskProgressBoardProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** YYYY-MM-DD used to mark due dates as overdue, today or tomorrow. Defaults to the real date. */
  today?: string;
  locale?: string;
  columns?: BoardColumn[];
  people?: BoardPerson[];
  /** Initial tasks (the board keeps its own state after that; remount with a new `key` to reset). */
  tasks: BoardTask[];
  /** Controlled assignee filter: a person id or "all". */
  assignee?: string;
  defaultAssignee?: string;
  onAssigneeChange?: (assignee: string) => void;
  onTaskMove?: (detail: TaskMoveDetail, tasks: BoardTask[]) => void;
  labels?: Partial<TaskBoardLabels>;
  className?: string;
  ref?: Ref<TaskBoardHandle>;
}

/* ---------------- palette ---------------- */
const PALETTE = [
  "[--tpb-accent:#2F5BD3] dark:[--tpb-accent:#8EAEFF]",
  "[--tpb-accent-soft:rgb(47_91_211/0.14)] dark:[--tpb-accent-soft:rgb(126_162_255/0.18)]",
  "[--tpb-late:#B4232C] dark:[--tpb-late:#FF8A8A]",
  "[--tpb-soon:#8A4B06] dark:[--tpb-soon:#F3C669]",
  "[--tpb-high:#D33F49] dark:[--tpb-high:#FF6B74]",
  "[--tpb-medium:#D88A0B] dark:[--tpb-medium:#F2B23E]",
  "[--tpb-low:#3E8E63] dark:[--tpb-low:#5CC98A]",
  "[--tpb-board:#F6F5F1] dark:[--tpb-board:#111318]",
  "[--tpb-slate:#E6EAF0] [--tpb-slate-ink:#3B4A5E] [--tpb-slate-solid:#8494AA]",
  "dark:[--tpb-slate:#20252F] dark:[--tpb-slate-ink:#B7C2D3] dark:[--tpb-slate-solid:#7D8DA5]",
  "[--tpb-blue:#DFE9FC] [--tpb-blue-ink:#1F4FBF] [--tpb-blue-solid:#3C6FE0]",
  "dark:[--tpb-blue:#18264A] dark:[--tpb-blue-ink:#A3BEFF] dark:[--tpb-blue-solid:#5B8BFF]",
  "[--tpb-amber:#FBEFD3] [--tpb-amber-ink:#84500A] [--tpb-amber-solid:#E0A021]",
  "dark:[--tpb-amber:#30250E] dark:[--tpb-amber-ink:#F3C669] dark:[--tpb-amber-solid:#E3A92C]",
  "[--tpb-green:#DCF1E3] [--tpb-green-ink:#17663A] [--tpb-green-solid:#2E9E5B]",
  "dark:[--tpb-green:#12291C] dark:[--tpb-green-ink:#84DCA4] dark:[--tpb-green-solid:#3DBE73]",
].join(" ");

const TONE: Record<BoardTone, string> = {
  slate: "[--c:var(--tpb-slate)] [--c-ink:var(--tpb-slate-ink)] [--c-solid:var(--tpb-slate-solid)]",
  blue: "[--c:var(--tpb-blue)] [--c-ink:var(--tpb-blue-ink)] [--c-solid:var(--tpb-blue-solid)]",
  amber: "[--c:var(--tpb-amber)] [--c-ink:var(--tpb-amber-ink)] [--c-solid:var(--tpb-amber-solid)]",
  green: "[--c:var(--tpb-green)] [--c-ink:var(--tpb-green-ink)] [--c-solid:var(--tpb-green-solid)]",
};
const PRIO_DOT: Record<TaskPriority, string> = { high: "bg-[var(--tpb-high)]", medium: "bg-[var(--tpb-medium)]", low: "bg-[var(--tpb-low)]" };

const AVATARS = ["#6D4FD1", "#B0482A", "#17705C", "#A3336A", "#2F5BD3", "#7A5B12", "#3F6B8F"];
const TONES: BoardTone[] = ["slate", "blue", "amber", "green"];
const DAY = 864e5;
const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------------- helpers ---------------- */
interface Col { id: string; label: string; tone: BoardTone; limit: number | null; done: boolean }
interface Person { id: string; name: string; first: string; initials: string; color: string }
interface Due { text: string; sr: string; tone: "late" | "soon" | "done" | "" }

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const parseDay = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
const copyTask = (t: BoardTask): BoardTask => ({ ...t, checklist: t.checklist ? { ...t.checklist } : undefined });
const signature = (list: BoardTask[]) => list.map(x => `${x.id}:${x.status}`).join("|");

function normaliseColumns(raw?: BoardColumn[]): Col[] {
  const src = raw && raw.length ? raw : [{ id: "todo", label: "To do" }, { id: "doing", label: "In progress" }, { id: "review", label: "Review" }, { id: "done", label: "Done", done: true }];
  const cols = src.map((c, i) => ({
    id: String(c.id || `col-${i + 1}`), label: c.label || `Column ${i + 1}`,
    tone: c.tone && TONES.includes(c.tone) ? c.tone : TONES[Math.min(i, TONES.length - 1)],
    limit: Number.isFinite(c.limit) && (c.limit ?? 0) > 0 ? (c.limit as number) : null, done: !!c.done,
  }));
  if (!cols.some(c => c.done)) cols[cols.length - 1].done = true;
  return cols;
}

/** Container width (layout size, unaffected by transforms such as the preview scale). */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.offsetWidth);
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => setW(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/* ---------------- icons ---------------- */
const Svg = ({ children, className = "size-3", vb = "0 0 16 16" }: { children: ReactNode; className?: string; vb?: string }) => (
  <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>{children}</svg>
);
const IconCal = () => <Svg><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></Svg>;
const IconLate = () => <Svg><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8.4M8 10.9v.1" /></Svg>;
const IconCheck = () => <Svg><rect x="2" y="2" width="12" height="12" rx="3.5" /><path d="m5.2 8.2 2 2 3.8-4.2" /></Svg>;
const IconMove = () => <Svg className="size-3.5"><path d="M5 4 2 7l3 3M11 6l3 3-3 3M2 7h7M14 9H7" /></Svg>;
const IconChevron = ({ open }: { open: boolean }) => (
  <motion.svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5"
    animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.25, ease: EASE }}><path d="m4 6 4 4 4-4" /></motion.svg>
);
const Grip = () => (
  <svg viewBox="0 0 10 14" fill="currentColor" aria-hidden className="h-3.5 w-2.5"><circle cx="2.5" cy="2.5" r="1.3" /><circle cx="7.5" cy="2.5" r="1.3" /><circle cx="2.5" cy="7" r="1.3" /><circle cx="7.5" cy="7" r="1.3" /><circle cx="2.5" cy="11.5" r="1.3" /><circle cx="7.5" cy="11.5" r="1.3" /></svg>
);

function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" }) {
  return (
    <span aria-hidden title={person.name} style={{ background: person.color }}
      className={cx("grid shrink-0 place-items-center rounded-full font-bold tracking-[0.02em] text-white ring-2 ring-[var(--surface)]",
        size === "sm" ? "size-[22px] text-[9px]" : "size-6 text-[9.5px]")}>
      {person.initials}
    </span>
  );
}

/* ---------------- card body (shared by the card and the drag ghost) ---------------- */
function CardBody({ task, col, person, due, labels, moveSlot }: { task: BoardTask; col: Col; person?: Person; due: Due | null; labels: TaskBoardLabels; moveSlot: ReactNode }) {
  const prio = task.priority && ["high", "medium", "low"].includes(task.priority) ? task.priority : null;
  const ck = task.checklist && task.checklist.total > 0
    ? { done: Math.max(0, Math.min(task.checklist.done || 0, task.checklist.total)), total: task.checklist.total } : null;
  const full = !!ck && ck.done === ck.total;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {prio ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
            <i aria-hidden className={cx("size-2 rounded-full", PRIO_DOT[prio])} />{labels.priority[prio]}
          </span>
        ) : <span />}
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium text-ink-3">
          {task.id}
          <span data-grip className="-my-1 -mr-1.5 grid size-[22px] touch-none place-items-center rounded-md text-ink-3 transition-colors group-hover/card:bg-sunken group-hover/card:text-ink-2 cursor-grab">
            <Grip />
          </span>
        </span>
      </div>
      <h4 className={cx("m-0 text-[13.5px] font-semibold leading-[1.35] [overflow-wrap:anywhere]", col.done ? "text-ink-3" : "text-ink")}>{task.title}</h4>
      {ck && (
        <div aria-hidden className={cx("flex items-center gap-2 font-mono text-[11px] font-medium tabular", full ? "text-[var(--tpb-green-ink)]" : "text-ink-3")}>
          <IconCheck />
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]">
            <motion.span className="block h-full rounded-full bg-[var(--c-solid)]" initial={false}
              animate={{ width: `${(ck.done / ck.total) * 100}%` }} transition={{ duration: 0.45, ease: EASE }} />
          </span>
          <span>{ck.done}/{ck.total}</span>
        </div>
      )}
      <div className="flex min-h-7 items-center gap-2">
        {person && <Avatar person={person} />}
        {due && (
          <span aria-hidden className={cx("inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] tabular",
            due.tone === "late" ? "font-semibold text-[var(--tpb-late)]" : due.tone === "soon" ? "font-semibold text-[var(--tpb-soon)]" : "font-medium text-ink-3")}>
            {due.tone === "late" ? <IconLate /> : <IconCal />}{due.text}
          </span>
        )}
        {moveSlot}
      </div>
    </>
  );
}

/* ---------------- move menu ---------------- */
function MoveMenu({ id, cols, current, labels, onPick, onClose }: {
  id: string; cols: Col[]; current: string; labels: TaskBoardLabels;
  onPick: (col: string) => void; onClose: (refocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const card = el.parentElement?.getBoundingClientRect();
    if (card && r.bottom > window.innerHeight - 8 && card.top > r.height + 16) setUp(true);
    el.querySelector<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      const btn = document.querySelector(`[data-move-btn="${CSS.escape(id)}"]`);
      if (ref.current?.contains(t) || btn?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [id, onClose]);
  const onKey = (e: ReactKeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = items.length;
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault(); items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault(); onClose(true);
    } else if (e.key === "Tab") onClose(false);
    e.stopPropagation();
  };
  return (
    <motion.div ref={ref} role="menu" id={`${id}-menu`} aria-label={`${labels.moveTo}…`} onKeyDown={onKey}
      onPointerDown={e => e.stopPropagation()}
      initial={{ opacity: 0, y: up ? 4 : -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: EASE }}
      className={cx("absolute right-2 z-30 grid min-w-[188px] cursor-default gap-0.5 rounded-xl border border-line-strong bg-surface p-1.5 elev-3",
        up ? "bottom-[calc(100%-6px)] origin-bottom-right" : "top-[calc(100%-6px)] origin-top-right")}>
      <p aria-hidden className="m-0 px-2 pb-1 pt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">{labels.moveTo}</p>
      {cols.map(c => {
        const isCur = c.id === current;
        return (
          <button key={c.id} type="button" role="menuitem" tabIndex={-1} aria-disabled={isCur || undefined}
            onClick={e => { e.stopPropagation(); if (!isCur) onPick(c.id); }}
            className={cx(TONE[c.tone], "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-medium outline-none transition-colors",
              isCur ? "cursor-default text-ink-3" : "text-ink hover:bg-sunken focus-visible:bg-sunken focus-visible:shadow-[inset_0_0_0_2px_var(--tpb-accent)]")}>
            <span aria-hidden className="size-2 rounded-full bg-[var(--c-solid)]" />
            {c.label}
            {isCur && <small className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] text-ink-3">{labels.current}</small>}
          </button>
        );
      })}
    </motion.div>
  );
}

/* ---------------- the board ---------------- */
interface DragView { id: string; col: string; index: number; w: number; h: number }
interface Press { id: string; card: HTMLElement; x: number; y: number; lx: number; ly: number; pid: number; type: string; started: boolean; timer: number }
interface DragData { id: string; dx: number; dy: number; x: number; y: number; col: string; index: number; raf: number }

export function TaskProgressBoard({
  eyebrow, title, subtitle, today, locale = "en-US", columns, people: peopleProp = [], tasks: initialTasks,
  assignee: assigneeProp, defaultAssignee = "all", onAssigneeChange, onTaskMove, labels: labelsProp, className, ref,
}: TaskProgressBoardProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const L = useMemo<TaskBoardLabels>(() => ({ ...LABELS, ...labelsProp, priority: { ...LABELS.priority, ...(labelsProp?.priority ?? {}) } }), [labelsProp]);
  const cols = useMemo(() => normaliseColumns(columns), [columns]);
  const people = useMemo(() => {
    const m = new Map<string, Person>();
    peopleProp.forEach((p, i) => m.set(String(p.id), { id: String(p.id), name: p.name || String(p.id), first: (p.name || String(p.id)).split(/\s+/)[0], initials: initialsOf(p.name || String(p.id)), color: p.color || AVATARS[i % AVATARS.length] }));
    return m;
  }, [peopleProp]);

  const [tasks, setTasks] = useState<BoardTask[]>(() => initialTasks.filter(t => t && t.id != null).map(copyTask));
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const [ownAssignee, setOwnAssignee] = useState(defaultAssignee);
  const rawWho = assigneeProp ?? ownAssignee;
  const who = rawWho !== "all" && people.has(rawWho) ? rawWho : "all";
  const visible = useCallback((t: BoardTask) => who === "all" || String(t.assignee) === who, [who]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [landed, setLanded] = useState<{ id: string; n: number } | null>(null);
  const [epoch, setEpoch] = useState<Record<string, number>>({});
  const [live, setLive] = useState("");
  const [, setFocusTick] = useState(0);

  const outerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const dragData = useRef<DragData | null>(null);
  const focusAfter = useRef<string | null>(null);
  const enterAnim = useRef(!preview);
  const width = useWidth(outerRef);
  const compact = width !== null && width < 512;

  const todayMs = useMemo(() => {
    const t = parseDay(today);
    if (t != null) return t;
    const n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  }, [today]);

  const dueOf = useCallback((t: BoardTask, isDone: boolean): Due | null => {
    const due = parseDay(t.due);
    if (due == null) return null;
    let text: string;
    try { text = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(due); } catch { text = String(t.due); }
    if (isDone) return { text, sr: text, tone: "done" };
    const diff = Math.round((due - todayMs) / DAY);
    if (diff < 0) return { text: `${L.overdue} · ${text}`, sr: `${L.overdue}, due ${text}`, tone: "late" };
    if (diff === 0) return { text: L.today, sr: `Due ${L.today.toLowerCase()}`, tone: "soon" };
    if (diff === 1) return { text: L.tomorrow, sr: `Due ${L.tomorrow.toLowerCase()}`, tone: "soon" };
    return { text, sr: `Due ${text}`, tone: "" };
  }, [locale, todayMs, L]);

  const say = useCallback((text: string) => {
    setLive("");
    window.setTimeout(() => setLive(text), 40);
  }, []);

  /* ---------- moving ---------- */
  const move = useCallback((id: string, toCol: string, index: number, via: MoveVia, focus: boolean): boolean => {
    const list = tasksRef.current;
    const t = list.find(x => String(x.id) === String(id));
    const col = cols.find(c => c.id === String(toCol));
    if (!t || !col) return false;
    const from = String(t.status);
    const rest = list.filter(x => x !== t);
    const moved: BoardTask = { ...t, status: col.id };
    const peers = rest.filter(x => String(x.status) === col.id && visible(x));
    const refTask = peers[Math.max(0, index)];
    let next: BoardTask[];
    if (refTask) { const i = rest.indexOf(refTask); next = [...rest.slice(0, i), moved, ...rest.slice(i)]; }
    else if (peers.length) { const i = rest.indexOf(peers[peers.length - 1]) + 1; next = [...rest.slice(0, i), moved, ...rest.slice(i)]; }
    else next = [...rest, moved];
    setMenuFor(null);
    if (focus) {
      focusAfter.current = t.id;
      setCollapsed(prev => (prev.has(col.id) ? new Set([...prev].filter(x => x !== col.id)) : prev));
    }
    if (signature(list) === signature(next)) { setFocusTick(n => n + 1); return false; }
    tasksRef.current = next;
    setTasks(next);
    setLanded({ id: t.id, n: Date.now() });
    const inCol = next.filter(x => String(x.status) === col.id && visible(x));
    say(fill(L.moved, { title: t.title || t.id, col: col.label, n: inCol.length }));
    const doneCol = cols.find(c => c.done)!;
    const vis = next.filter(visible);
    onTaskMove?.({
      id: t.id, title: t.title || "", from, to: col.id, index: inCol.indexOf(moved), via,
      progress: vis.length ? Math.round((vis.filter(x => String(x.status) === doneCol.id).length / vis.length) * 100) : 0,
    }, next.map(copyTask));
    return true;
  }, [cols, visible, L, say, onTaskMove]);

  useImperativeHandle(ref, () => ({
    moveTask: (id, column, index) => move(id, column, index == null ? Infinity : index, "api", false),
    getTasks: () => tasksRef.current.map(copyTask),
  }), [move]);

  // restore focus to a card after it re-mounts in another column
  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); }
  });
  // entrance animation only for the first paint and after filter changes
  useEffect(() => { enterAnim.current = false; });

  /* ---------- assignee filter ---------- */
  const pickAssignee = (id: string) => {
    if (id === who) return;
    enterAnim.current = !reduced;
    if (assigneeProp === undefined) setOwnAssignee(id);
    onAssigneeChange?.(id);
    setMenuFor(null);
    const n = tasksRef.current.filter(t => id === "all" || String(t.assignee) === id).length;
    say(fill(L.showing, { n, name: id === "all" ? L.all.toLowerCase() : people.get(id)?.name ?? id }));
  };

  /* ---------- pointer drag ---------- */
  const impl = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: () => void }>({ move: () => {}, up: () => {}, cancel: () => {} });
  const listeners = useMemo(() => ({
    move: (e: PointerEvent) => impl.current.move(e),
    up: (e: PointerEvent) => impl.current.up(e),
  }), []);
  const listen = useCallback((on: boolean) => {
    const f = on ? window.addEventListener : window.removeEventListener;
    f("pointermove", listeners.move);
    f("pointerup", listeners.up);
    f("pointercancel", listeners.up);
  }, [listeners]);

  const releasePress = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    if (!dragData.current) listen(false);
  }, [listen]);

  const placeGhost = () => {
    const d = dragData.current, g = ghostRef.current;
    if (d && g) g.style.transform = `translate3d(${d.x - d.dx}px, ${d.y - d.dy}px, 0)`;
  };

  const dragTo = (x: number, y: number) => {
    const d = dragData.current;
    if (!d) return;
    d.x = x; d.y = y;
    placeGhost();
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const colEl = hit?.closest<HTMLElement>("[data-col]");
    if (colEl && rootRef.current?.contains(colEl)) {
      const colId = colEl.dataset.col!;
      let index = 0;
      for (const c of colEl.querySelectorAll<HTMLElement>("[data-card-id]")) {
        if (c.dataset.cardId === d.id) continue;
        const r = c.getBoundingClientRect();
        if (y < r.top + r.height / 2) break;
        index++;
      }
      if (colId !== d.col || index !== d.index) {
        d.col = colId; d.index = index;
        setDrag(prev => (prev ? { ...prev, col: colId, index } : prev));
      }
      setCollapsed(prev => (prev.has(colId) ? new Set([...prev].filter(c => c !== colId)) : prev));
    }
    // auto-scroll near the viewport edges (stacked phone layout)
    const edge = 64, vy = y < edge ? -1 : y > window.innerHeight - edge ? 1 : 0;
    if (vy && !d.raf) {
      const step = () => {
        const dd = dragData.current, p = press.current;
        if (!dd || !p) { if (dd) dd.raf = 0; return; }
        const v = p.ly < edge ? -1 : p.ly > window.innerHeight - edge ? 1 : 0;
        if (!v) { dd.raf = 0; return; }
        window.scrollBy(0, v * 9);
        dragTo(p.lx, p.ly);
        dd.raf = requestAnimationFrame(step);
      };
      d.raf = requestAnimationFrame(step);
    }
  };

  const startDrag = () => {
    const p = press.current;
    if (!p || p.started) return;
    p.started = true;
    window.clearTimeout(p.timer);
    const t = tasksRef.current.find(x => x.id === p.id);
    if (!t) return;
    const r = p.card.getBoundingClientRect();
    const index = tasksRef.current.filter(x => x.status === t.status && visible(x)).indexOf(t);
    dragData.current = { id: p.id, dx: p.x - r.left, dy: p.y - r.top, x: p.lx, y: p.ly, col: String(t.status), index, raf: 0 };
    setMenuFor(null);
    setDrag({ id: p.id, col: String(t.status), index, w: r.width, h: r.height });
    if (p.type === "touch" && "vibrate" in navigator) { try { navigator.vibrate(12); } catch { /* ignore */ } }
    say(fill(L.picked, { title: t.title || t.id }));
  };

  const endDrag = (cancel: boolean) => {
    const d = dragData.current;
    if (!d) { releasePress(); return; }
    dragData.current = null;
    releasePress();
    listen(false);
    cancelAnimationFrame(d.raf);
    setDrag(null);
    if (cancel) { say(L.cancelled); return; }
    setEpoch(prev => ({ ...prev, [d.id]: (prev[d.id] ?? 0) + 1 }));
    const changed = move(d.id, d.col, d.index, "drag", false);
    if (!changed) {
      const t = tasksRef.current.find(x => x.id === d.id);
      const col = cols.find(c => c.id === d.col);
      if (t && col) say(fill(L.dropped, { title: t.title, col: col.label }));
    }
  };

  impl.current.move = (e: PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pid) return;
    p.lx = e.clientX; p.ly = e.clientY;
    if (!p.started) {
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.type === "touch") { if (dist > 10) releasePress(); return; } // the page is scrolling
      if (dist < 6) return;
      startDrag();
    }
    e.preventDefault();
    dragTo(e.clientX, e.clientY);
  };
  impl.current.up = (e: PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pid) return;
    window.clearTimeout(p.timer);
    if (dragData.current) endDrag(e.type === "pointercancel");
    else releasePress();
  };

  const onCardPointerDown = (e: ReactPointerEvent<HTMLElement>, t: BoardTask) => {
    if (preview || dragData.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='menu']")) return;
    releasePress();
    const grip = !!target.closest("[data-grip]");
    press.current = { id: t.id, card: e.currentTarget, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, pid: e.pointerId, type: e.pointerType, started: false, timer: 0 };
    listen(true);
    if (e.pointerType === "touch") {
      if (grip) startDrag();
      else press.current.timer = window.setTimeout(() => { if (press.current && !press.current.started) startDrag(); }, 320);
    }
  };

  // block page scroll while a touch drag is active; no long-press context menu; Esc cancels a drag
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tm = (e: TouchEvent) => { if (dragData.current) e.preventDefault(); };
    const cm = (e: Event) => { if (dragData.current || press.current?.type === "touch") e.preventDefault(); };
    root.addEventListener("touchmove", tm, { passive: false });
    root.addEventListener("contextmenu", cm);
    return () => { root.removeEventListener("touchmove", tm); root.removeEventListener("contextmenu", cm); };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); impl.current.cancel(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [drag]);
  impl.current.cancel = () => endDrag(true);
  useLayoutEffect(placeGhost, [drag?.id]);
  useEffect(() => () => { listen(false); if (press.current) window.clearTimeout(press.current.timer); }, [listen]);

  /* ---------- keyboard ---------- */
  const onCardKey = (e: ReactKeyboardEvent<HTMLElement>, t: BoardTask) => {
    if (e.target !== e.currentTarget || dragData.current) return;
    const ci = cols.findIndex(c => c.id === String(t.status));
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const ni = ci + (e.key === "ArrowRight" ? 1 : -1);
      if (ni < 0 || ni >= cols.length) { say(fill(L.edge, { title: t.title || t.id, col: cols[ci].label })); return; }
      setCollapsed(prev => (prev.has(cols[ni].id) ? new Set([...prev].filter(c => c !== cols[ni].id)) : prev));
      move(t.id, cols[ni].id, Infinity, "keyboard", true);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Home" || e.key === "End") {
      const list = e.currentTarget.parentElement;
      const cards = [...(list?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [])];
      const i = cards.indexOf(e.currentTarget);
      const ni = e.key === "Home" ? 0 : e.key === "End" ? cards.length - 1 : i + (e.key === "ArrowDown" ? 1 : -1);
      if (cards[ni]) { e.preventDefault(); cards[ni].focus(); }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMenuFor(t.id);
    }
  };

  const closeMenu = useCallback((refocus: boolean) => {
    setMenuFor(cur => {
      if (refocus && cur) requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-move-btn="${CSS.escape(cur)}"]`)?.focus());
      return null;
    });
  }, []);

  /* ---------- derived ---------- */
  const shown = tasks.filter(visible);
  const doneCol = cols.find(c => c.done)!;
  const total = shown.filter(t => cols.some(c => c.id === String(t.status))).length;
  const doneN = shown.filter(t => String(t.status) === doneCol.id).length;
  const pct = total ? Math.round((doneN / total) * 100) : 0;
  const progLabel = who === "all" ? L.progress : fill(L.progressFor, { name: people.get(who)!.first });
  const segOrder = [doneCol, ...cols.filter(c => !c.done).reverse()];
  const countIn = (colId: string) => shown.filter(t => String(t.status) === colId).length;
  const hintId = `${uid}-hint`;
  const titleId = `${uid}-title`;
  const draggedTask = drag ? tasks.find(t => t.id === drag.id) : undefined;
  const draggedCol = drag ? cols.find(c => c.id === String(draggedTask?.status)) : undefined;

  const chips: { id: string; name: ReactNode; full: string; count: number; person?: Person }[] = [
    { id: "all", name: L.all, full: L.all, count: tasks.length },
    ...[...people.values()].map(p => ({ id: p.id, name: p.first, full: p.name, count: tasks.filter(t => String(t.assignee) === p.id).length, person: p })),
  ];

  let cardSeq = 0;

  return (
    <div ref={outerRef} className={cx("@container w-full max-w-[1080px]", className)}>
      <section ref={rootRef} aria-labelledby={title ? titleId : undefined}
        className={cx(PALETTE, "relative isolate rounded-[22px] border border-line bg-[var(--tpb-board)] px-3 pb-3.5 pt-5 font-sans text-ink elev-2 @lg:px-5 @lg:pb-5 @lg:pt-6 @3xl:px-6 @3xl:pt-7")}>
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        {/* header: title + progress */}
        <header className="flex flex-col gap-5 px-1 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-8">
          <div className="grid min-w-0 max-w-[52ch] gap-1.5">
            {eyebrow && (
              <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--tpb-accent)]">
                <span aria-hidden className="grid size-4 place-items-center rounded-[5px] bg-[var(--tpb-accent-soft)]">
                  <span className="grid grid-cols-2 gap-[1.5px]">{[0, 1, 2, 3].map(i => <i key={i} className="size-[3px] rounded-[1px] bg-current" />)}</span>
                </span>
                {eyebrow}
              </span>
            )}
            {title && <h2 id={titleId} className="m-0 text-balance font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.018em] @3xl:text-[26px]">{title}</h2>}
            {subtitle && <p className="m-0 text-[13.5px] text-ink-2">{subtitle}</p>}
          </div>

          <div className="grid w-full gap-2.5 rounded-2xl border border-line bg-surface p-3.5 elev-1 @3xl:w-[340px] @3xl:shrink-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-ink-3">{progLabel}</span>
              <CountUp value={pct} format={v => `${Math.round(v)}%`} className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em]" />
            </div>
            <div role="progressbar" aria-label={progLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
              aria-valuetext={`${pct}%, ${fill(L.progressSub, { done: doneN, total })}`}
              className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-sunken p-0 shadow-[inset_0_0_0_1px_var(--line)]">
              {segOrder.map(c => {
                const n = countIn(c.id);
                return (
                  <motion.span key={c.id} className={cx(TONE[c.tone], "h-full shrink-0 bg-[var(--c-solid)] first:rounded-l-full last:rounded-r-full")}
                    initial={preview ? false : { width: "0%" }} animate={{ width: `${total ? (n / total) * 100 : 0}%` }}
                    transition={{ duration: 0.6, ease: EASE }} />
                );
              })}
            </div>
            <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular text-ink-2">
              <span className="font-medium text-ink">{fill(L.progressSub, { done: doneN, total })}</span>
              {cols.filter(c => !c.done).reverse().map(c => (
                <span key={c.id} className={cx(TONE[c.tone], "inline-flex items-center gap-1.5")}>
                  <i aria-hidden className="size-[7px] rounded-[2px] bg-[var(--c-solid)]" />{countIn(c.id)} {c.label.toLowerCase()}
                </span>
              ))}
            </p>
          </div>
        </header>

        {/* toolbar: assignee chips + hint */}
        <div className="mx-1 mb-4 mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <div role="group" aria-label={L.filter} className="flex flex-wrap gap-1.5">
            {chips.map(c => {
              const on = c.id === who;
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => pickAssignee(c.id)}
                  className={cx("relative inline-flex min-h-8 items-center gap-1.5 rounded-full border py-1 pr-2.5 text-[12.5px] font-medium transition-[color,border-color,box-shadow,background-color] duration-200",
                    c.person ? "pl-1" : "pl-3",
                    on ? "border-[var(--tpb-accent)] bg-surface text-ink shadow-[0_0_0_3px_var(--tpb-accent-soft)]"
                      : "border-line bg-surface/80 text-ink-2 hover:border-line-strong hover:text-ink")}>
                  {c.person && <Avatar person={c.person} size="sm" />}
                  <span className="@md:hidden">{c.name}</span>
                  <span className="hidden @md:inline">{c.full}</span>
                  <b className={cx("font-mono text-[11px] font-semibold tabular", on ? "text-[var(--tpb-accent)]" : "text-ink-3")}>{c.count}</b>
                </button>
              );
            })}
          </div>
          <p className="m-0 hidden items-center gap-2 text-[12px] text-ink-3 @lg:inline-flex">
            {L.hint}
            <kbd aria-hidden className="rounded-[5px] border border-b-2 border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-ink-2">←</kbd>
            <kbd aria-hidden className="rounded-[5px] border border-b-2 border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-ink-2">→</kbd>
          </p>
        </div>

        {/* columns */}
        <LayoutGroup id={uid}>
          <div className="grid grid-cols-1 items-start gap-2.5 @lg:grid-cols-2 @lg:gap-3 @3xl:grid-cols-4">
            {cols.map(c => {
              const colTasks = shown.filter(t => String(t.status) === c.id);
              const listTasks = drag ? colTasks.filter(t => t.id !== drag.id) : colTasks;
              const n = colTasks.length;
              const over = c.limit != null && n > c.limit;
              const isOver = drag?.col === c.id;
              const isCollapsed = compact && collapsed.has(c.id);
              const hid = `${uid}-${c.id}`;
              const items: ReactNode[] = listTasks.map(t => {
                const person = people.get(String(t.assignee));
                const due = dueOf(t, c.done);
                const prio = t.priority && L.priority[t.priority] ? t.priority : null;
                const ck = t.checklist && t.checklist.total > 0 ? t.checklist : null;
                const parts = [t.title || t.id];
                if (prio) parts.push(`${L.priority[prio]} priority`);
                if (person) parts.push(`Assigned to ${person.name}`);
                if (due) parts.push(due.sr);
                if (ck) parts.push(`Checklist ${Math.min(ck.done, ck.total)} of ${ck.total}`);
                parts.push(`In ${c.label}`);
                const menuOpen = menuFor === t.id;
                const isLanded = landed?.id === t.id;
                const seq = cardSeq++;
                return (
                  <motion.li key={t.id} layout="position" layoutId={`${uid}-card-${t.id}-${epoch[t.id] ?? 0}`}
                    data-card-id={t.id} tabIndex={0} aria-label={`${parts.join(". ")}.`} aria-describedby={hintId}
                    onKeyDown={e => onCardKey(e, t)} onPointerDown={e => onCardPointerDown(e, t)}
                    initial={enterAnim.current ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }}
                    transition={{ layout: { type: "spring", stiffness: 520, damping: 42 }, opacity: { duration: 0.35, delay: enterAnim.current ? Math.min(seq * 0.025, 0.3) : 0 }, y: { duration: 0.45, ease: EASE, delay: enterAnim.current ? Math.min(seq * 0.025, 0.3) : 0 } }}
                    className={cx("group/card relative grid cursor-grab select-none gap-2.5 rounded-xl border border-line bg-surface px-3 pb-2 pt-3 [-webkit-touch-callout:none]",
                      "shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_8px_16px_-14px_hsl(var(--shadow-color)/0.3)] transition-[border-color,box-shadow,translate] duration-200",
                      "hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--c-solid)_50%,var(--line))] hover:shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_14px_24px_-16px_hsl(var(--shadow-color)/0.4)] motion-reduce:hover:translate-y-0",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tpb-accent)]",
                      menuOpen && "z-20")}>
                    {isLanded && !reduced && (
                      <motion.span key={landed!.n} aria-hidden className="pointer-events-none absolute -inset-px rounded-[inherit]"
                        initial={{ opacity: 1, boxShadow: "0 0 0 3px var(--c-solid)" }} animate={{ opacity: 0, boxShadow: "0 0 0 7px var(--c-solid)" }}
                        transition={{ duration: 0.8, ease: EASE }} />
                    )}
                    <CardBody task={t} col={c} person={person} due={due} labels={L}
                      moveSlot={
                        <button type="button" data-move-btn={t.id} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? `${uid}-${t.id}-menu` : undefined}
                          aria-label={`${L.move} ${t.title || t.id}`}
                          onClick={e => { e.stopPropagation(); setMenuFor(menuOpen ? null : t.id); }}
                          className={cx("ml-auto inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors",
                            menuOpen ? "border-line bg-sunken text-ink" : "border-transparent text-ink-3 hover:border-line hover:bg-sunken hover:text-ink")}>
                          <IconMove />{L.move}
                        </button>
                      } />
                    <AnimatePresence>
                      {menuOpen && (
                        <MoveMenu id={`${uid}-${t.id}`} cols={cols} current={String(t.status)} labels={L}
                          onPick={to => move(t.id, to, Infinity, "menu", true)} onClose={closeMenu} />
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              });
              if (drag && isOver && draggedTask) {
                items.splice(Math.min(drag.index, items.length), 0, (
                  <motion.li key="__placeholder" layout aria-hidden
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
                    style={{ height: drag.h }}
                    className="list-none rounded-xl border-[1.5px] border-dashed border-[var(--c-solid)] bg-[color-mix(in_oklab,var(--c-solid)_10%,transparent)]" />
                ));
              }
              const body = (
                <>
                  <ol id={`${hid}-list`} className={cx("m-0 grid list-none content-start gap-2 p-0", items.length ? "min-h-16" : "min-h-0")}>{items}</ol>
                  {items.length === 0 && (
                    <p className="m-0 rounded-xl border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--c-solid)_45%,transparent)] px-2.5 py-4 text-center text-[12px] text-ink-2">
                      {who === "all" ? L.empty : L.emptyFiltered}
                    </p>
                  )}
                </>
              );
              return (
                <section key={c.id} data-col={c.id} aria-labelledby={`${hid}-h`}
                  className={cx(TONE[c.tone], "grid min-w-0 content-start rounded-2xl border p-1.5 transition-[box-shadow,background-color] duration-200",
                    "border-[color-mix(in_oklab,var(--c-solid)_20%,transparent)] bg-[color-mix(in_oklab,var(--c)_58%,var(--tpb-board))]",
                    isOver && "shadow-[0_0_0_2px_var(--c-solid),0_14px_28px_-20px_var(--c-solid)]")}>
                  <header className={cx("flex items-center gap-2 rounded-[11px] bg-[var(--c)] py-2 pl-2.5 pr-2 text-[var(--c-ink)]", !isCollapsed && "mb-1.5")}>
                    <h3 id={`${hid}-h`} className="m-0 flex min-w-0 flex-1 items-center gap-2 text-[13.5px] font-semibold leading-tight">
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--c-solid)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--c-solid)_25%,transparent)]" />
                      <span className="truncate">{c.label}</span>
                    </h3>
                    <motion.span key={`${n}-${over}`} initial={preview ? false : { scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      aria-label={`${n} tasks${over ? `, ${fill(L.overLimit, { n: c.limit! })}` : ""}`}
                      className={cx("rounded-full px-2 py-1 font-mono text-[11.5px] font-semibold leading-none tabular transition-colors",
                        over ? "bg-[var(--tpb-late)] text-white dark:text-[#1a0b0b]" : "bg-surface text-[var(--c-ink)]")}>
                      {c.limit != null ? `${n}/${c.limit}` : n}
                    </motion.span>
                    {compact && (
                      <button type="button" aria-expanded={!isCollapsed} aria-controls={`${hid}-body`}
                        aria-label={fill(isCollapsed ? L.expand : L.collapse, { col: c.label })}
                        onClick={() => setCollapsed(prev => { const s = new Set(prev); if (s.has(c.id)) s.delete(c.id); else s.add(c.id); return s; })}
                        className="grid size-7 place-items-center rounded-lg text-[var(--c-ink)] transition-colors hover:bg-[color-mix(in_oklab,var(--c-solid)_14%,transparent)]">
                        <IconChevron open={!isCollapsed} />
                      </button>
                    )}
                  </header>
                  {compact ? (
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div key="body" id={`${hid}-body`}
                          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                          animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                          transition={{ duration: 0.3, ease: EASE }}>
                          <div className="grid gap-0">{body}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : <div id={`${hid}-body`}>{body}</div>}
                </section>
              );
            })}
          </div>
        </LayoutGroup>

        <p className="sr-only" aria-live="polite">{live}</p>
        <p id={hintId} hidden>{L.cardHint}</p>
      </section>

      {drag && draggedTask && draggedCol && createPortal(
        <div ref={ghostRef} aria-hidden inert className={cx(PALETTE, TONE[draggedCol.tone], "pointer-events-none fixed left-0 top-0 z-[1000] font-sans text-ink")}
          style={{ width: drag.w, transform: `translate3d(${(dragData.current?.x ?? 0) - (dragData.current?.dx ?? 0)}px, ${(dragData.current?.y ?? 0) - (dragData.current?.dy ?? 0)}px, 0)` }}>
          <motion.div initial={{ scale: 1, rotate: 0 }} animate={reduced ? { scale: 1, rotate: 0 } : { scale: 1.03, rotate: 1.6 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="grid cursor-grabbing gap-2.5 rounded-xl border border-line-strong bg-surface px-3 pb-2 pt-3 opacity-[0.97] shadow-[0_2px_4px_hsl(var(--shadow-color)/0.08),0_28px_48px_-18px_hsl(var(--shadow-color)/0.45)]">
            <CardBody task={draggedTask} col={draggedCol} person={people.get(String(draggedTask.assignee))} due={dueOf(draggedTask, draggedCol.done)} labels={L}
              moveSlot={<span className="ml-auto inline-flex h-7 items-center gap-1 px-2 text-[11px] font-semibold text-ink-3"><IconMove />{L.move}</span>} />
          </motion.div>
        </div>,
        document.body,
      )}
    </div>
  );
}
