import { AnimatePresence, motion } from "motion/react";
import {
  useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type Ref,
} from "react";
import { CountUp, Tabs, cx, tabPanelProps } from "../../ui";
import { useClipboard, useInterval, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { useElementWidth } from "./useElementWidth";
import {
  STATUS_TEXT, clsOf, generate, headersFor, mulberry, normalise, seedEvents,
  type JsonValue, type Rng, type StatusClass, type WebhookEvent, type WebhookEventInput,
} from "./data";

export interface ReplayDetail { name: string; original: { id: string; status: number }; replay: { id: string; status: number; latency: number } }

/** Imperative handle (pass `ref`): feed real deliveries, drive the demo, or pause from code. */
export interface WebhookMonitorHandle {
  addEvent: (e: WebhookEventInput) => WebhookEvent;
  /** Add one simulated failing (5xx) delivery right away. */
  simulateFailure: () => WebhookEvent;
  select: (id: string) => void;
  replay: (id: string) => WebhookEvent | null;
  pause: () => void;
  resume: () => void;
  readonly events: WebhookEvent[];
}

export interface WebhookMonitorProps {
  title?: string;
  /** Environment badge, e.g. "Production". */
  environment?: string;
  /** Base path shown in the header. */
  endpoint?: string;
  /** Seed for the repeatable simulation (default 2041). */
  seed?: number;
  /** Simulated deliveries to start with (default 18). */
  initial?: number;
  /** Rows to keep (default 60). */
  max?: number;
  /** Account names used in simulated payloads. */
  accounts?: string[];
  /** Set false to show only events you pass in or add. */
  simulate?: boolean;
  /** Optional starting events (replaces the simulated backlog). */
  events?: WebhookEventInput[];
  /** Average milliseconds between simulated deliveries (default 2400). */
  interval?: number;
  defaultPaused?: boolean;
  onSelect?: (detail: { id: string; name: string; status: number }) => void;
  onReplay?: (detail: ReplayDetail) => void;
  onStreamChange?: (detail: { paused: boolean }) => void;
  className?: string;
  ref?: Ref<WebhookMonitorHandle>;
}

type Filter = "all" | StatusClass;
type InsTab = "payload" | "headers" | "response";

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtLat = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s` : `${ms} ms`);
const latTone = (ms: number) => (ms >= 10000 ? "text-[var(--wh-err)]" : ms >= 1000 ? "text-[var(--wh-warn)]" : "");
const matches = (e: WebhookEvent, q: string) => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);

/* ---------- JSON pretty-printer → highlighted nodes ---------- */
function jsonNodes(v: JsonValue | undefined, depth: number, out: ReactNode[], k: { n: number }) {
  const ind = (n: number) => "  ".repeat(n);
  const P = (t: string) => out.push(<span key={k.n++} className="text-[var(--wh-j-p)]">{t}</span>);
  if (v === null || v === undefined) { out.push(<span key={k.n++} className="text-[var(--wh-j-lit)]">null</span>); return; }
  if (typeof v === "boolean") { out.push(<span key={k.n++} className="text-[var(--wh-j-lit)]">{String(v)}</span>); return; }
  if (typeof v === "number") { out.push(<span key={k.n++} className="text-[var(--wh-j-num)]">{String(v)}</span>); return; }
  if (typeof v === "string") { out.push(<span key={k.n++} className="text-[var(--wh-j-str)]">{JSON.stringify(v)}</span>); return; }
  if (Array.isArray(v)) {
    if (!v.length) { P("[]"); return; }
    P("["); out.push("\n");
    v.forEach((x, i) => { out.push(ind(depth + 1)); jsonNodes(x, depth + 1, out, k); P(i < v.length - 1 ? "," : ""); out.push("\n"); });
    out.push(ind(depth)); P("]"); return;
  }
  const keys = Object.keys(v).filter(key => v[key] !== undefined);
  if (!keys.length) { P("{}"); return; }
  P("{"); out.push("\n");
  keys.forEach((key, i) => {
    out.push(ind(depth + 1));
    out.push(<span key={k.n++} className="text-[var(--wh-j-key)]">{JSON.stringify(key)}</span>);
    P(": ");
    jsonNodes(v[key], depth + 1, out, k);
    P(i < keys.length - 1 ? "," : "");
    out.push("\n");
  });
  out.push(ind(depth)); P("}");
}
const renderJson = (v: JsonValue) => { const out: ReactNode[] = []; jsonNodes(v, 0, out, { n: 0 }); return out; };

/* ---------- icons ---------- */
const I = (d: ReactNode, cls = "size-3.5") => <svg viewBox="0 0 16 16" className={cx("shrink-0", cls)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const Ico = {
  hook: I(<><path d="M6 3.5a2.5 2.5 0 1 1 3.5 2.3L8 9.5" /><path d="M4.4 9.2A2.5 2.5 0 1 0 6.5 13h4" /><path d="M10.5 13a2.5 2.5 0 1 0-1-4.8" /></>, "size-[18px]"),
  pause: I(<path d="M5.5 3.5v9M10.5 3.5v9" />),
  play: I(<path d="M5 3.2v9.6L12.5 8z" />),
  search: I(<><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 3.3 3.3" /></>),
  replay: I(<><path d="M2.8 7.5A5.2 5.2 0 1 1 4.3 11.6" /><path d="M2.5 3.5v4h4" /></>),
  copy: I(<><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" /></>),
  check: I(<path d="M3.5 8.5 6.5 11.5 12.5 4.5" />),
  x: I(<path d="M4 4l8 8M12 4l-8 8" />),
};

/* ---------- palette ---------- */
const TOKENS = [
  "[--wh-canvas:#F6F8FA] [--wh-card:#FFFFFF] [--wh-ink:#1F2328] [--wh-muted:#555F6A] [--wh-faint:#5F6973] [--wh-line:#D1D9E0] [--wh-line-soft:#E7EBEF]",
  "[--wh-hover:#F3F6F9] [--wh-sel:#EAF1F8] [--wh-acc:#34536F] [--wh-acc-soft:#E3EBF3] [--wh-on-acc:#FFFFFF]",
  "[--wh-ok:#1A7F37] [--wh-ok-bg:#DDF4E4] [--wh-warn:#8A5300] [--wh-warn-bg:#FFF1C9] [--wh-err:#C21F2B] [--wh-err-bg:#FFE6E6]",
  "[--wh-j-key:#23527C] [--wh-j-str:#0E6B37] [--wh-j-num:#7A3BC2] [--wh-j-lit:#9A4700] [--wh-j-p:#5F6973] [--wh-shadow:rgba(25,35,50,0.16)]",
  "dark:[--wh-canvas:#0F1318] dark:[--wh-card:#151B22] dark:[--wh-ink:#E6EDF3] dark:[--wh-muted:#A4AEB9] dark:[--wh-faint:#8F99A4] dark:[--wh-line:#2A333D] dark:[--wh-line-soft:#212932]",
  "dark:[--wh-hover:#1A222B] dark:[--wh-sel:#1C2A39] dark:[--wh-acc:#9DBEDD] dark:[--wh-acc-soft:rgba(157,190,221,0.14)] dark:[--wh-on-acc:#0F1318]",
  "dark:[--wh-ok:#56D27F] dark:[--wh-ok-bg:rgba(86,210,127,0.14)] dark:[--wh-warn:#E8B647] dark:[--wh-warn-bg:rgba(232,182,71,0.15)] dark:[--wh-err:#FF8079] dark:[--wh-err-bg:rgba(255,128,121,0.15)]",
  "dark:[--wh-j-key:#8EC3FF] dark:[--wh-j-str:#7EE2A8] dark:[--wh-j-num:#D3AEFF] dark:[--wh-j-lit:#FFAE66] dark:[--wh-j-p:#8F99A4] dark:[--wh-shadow:rgba(0,0,0,0.6)]",
].join(" ");

const CODE_TONE: Record<StatusClass, string> = {
  "2xx": "text-[var(--wh-ok)] bg-[var(--wh-ok-bg)]",
  "4xx": "text-[var(--wh-warn)] bg-[var(--wh-warn-bg)]",
  "5xx": "text-[var(--wh-err)] bg-[var(--wh-err-bg)]",
};
const Code = ({ status, className }: { status: number; className?: string }) => (
  <span title={STATUS_TEXT[status] ?? ""} className={cx("inline-flex min-w-[38px] items-center justify-center rounded-full px-1.5 py-[3px] font-mono text-[11.5px] font-semibold leading-none tabular", CODE_TONE[clsOf(status)], className)}>{status}</span>
);
const btn = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[12.5px] font-semibold leading-none transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wh-acc)]";
const btnGhost = cx(btn, "border-[var(--wh-line)] bg-[var(--wh-card)] text-[var(--wh-ink)] shadow-[0_1px_0_rgba(31,35,40,0.04)] enabled:hover:border-[var(--wh-faint)] enabled:hover:bg-[var(--wh-hover)]");
const btnPrimary = cx(btn, "border-[var(--wh-acc)] bg-[var(--wh-acc)] text-[var(--wh-on-acc)] enabled:hover:bg-[color-mix(in_oklab,var(--wh-acc),#000_14%)] dark:enabled:hover:bg-[color-mix(in_oklab,var(--wh-acc),#fff_14%)]");

/* ---------- inspector ---------- */
function Inspector({ ev, uid, tab, setTab, hasEvent, onSelectId, onReplay, compact, closeButton }: {
  ev: WebhookEvent | null; uid: string; tab: InsTab; setTab: (t: InsTab) => void; hasEvent: (id: string) => boolean;
  onSelectId: (id: string) => void; onReplay: () => void; compact: boolean; closeButton?: ReactNode;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const { copy, copied } = useClipboard();
  const headers = ev ? headersFor(ev) : {};
  const doCopy = () => {
    if (!ev) return;
    const text = JSON.stringify(ev.payload, null, 2);
    const run = () => void copy(text, preRef.current);
    if (tab !== "payload") { setTab("payload"); requestAnimationFrame(() => requestAnimationFrame(run)); } else run();
  };

  let body: ReactNode;
  if (!ev) body = <span className="text-[var(--wh-j-p)]">Select a delivery to inspect it.</span>;
  else if (tab === "headers") body = Object.keys(headers).map((key, i) => (
    <span key={key}>{i > 0 && "\n"}<span className="text-[var(--wh-j-key)]">{key}</span><span className="text-[var(--wh-j-p)]">: </span>{headers[key]}</span>
  ));
  else if (tab === "response") body = (
    <>
      <span className="text-[var(--wh-j-lit)]">HTTP/1.1 {ev.status} {STATUS_TEXT[ev.status] ?? ""}</span>{"\n"}
      {ev.response === null
        ? <span className="text-[var(--wh-j-p)]">(empty body)</span>
        : <><span className="text-[var(--wh-j-key)]">Content-Type</span><span className="text-[var(--wh-j-p)]">: </span>application/json{"\n\n"}{renderJson(ev.response)}</>}
    </>
  );
  else body = renderJson(ev.payload);

  const meta: [string, ReactNode][] = ev ? [
    ["Delivered", `${ev.at.getFullYear()}-${pad(ev.at.getMonth() + 1)}-${pad(ev.at.getDate())} ${hms(ev.at)}`],
    ["Request", `${ev.method} ${ev.path}`],
    ["Response", `${ev.status} ${STATUS_TEXT[ev.status] ?? ""} · ${fmtLat(ev.latency)}`],
    ["Attempt", String(ev.attempt)],
  ] : [];
  if (ev?.replayOf) {
    const id = ev.replayOf, live = hasEvent(id);
    meta.push(["Replay of", <button key="r" type="button" disabled={!live} onClick={() => onSelectId(id)}
      className="rounded-sm text-[var(--wh-acc)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wh-acc)] disabled:text-[var(--wh-faint)] disabled:no-underline">{id}</button>]);
  }

  return (
    <div className="grid min-w-0 grid-rows-[auto_auto_auto_1fr_auto] bg-[var(--wh-card)]">
      <div className="grid gap-1.5 border-b border-[var(--wh-line-soft)] px-3 pb-3 pt-3.5 @lg:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {ev && <Code status={ev.status} />}
          <h3 className="min-w-0 flex-1 font-mono text-[14px] font-semibold leading-[1.3] [overflow-wrap:anywhere]">{ev ? ev.name : "No delivery selected"}</h3>
          {closeButton}
        </div>
        {ev && <span className="font-mono text-[11.5px] leading-[1.3] text-[var(--wh-faint)] [overflow-wrap:anywhere]">{ev.id}</span>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 border-b border-[var(--wh-line-soft)] px-3 py-2.5 text-[12px] @lg:px-4">
        {meta.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--wh-faint)]">{k}</dt>
            <dd className="font-mono leading-[1.35] tabular [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      <Tabs<InsTab> id={`${uid}-ins`} ariaLabel="Delivery details" value={tab} onChange={setTab}
        className="gap-0.5 border-[var(--wh-line)]! px-3"
        tabClassName="px-2! py-2.5! text-[12px]! font-semibold! text-[var(--wh-muted)] hover:text-[var(--wh-ink)] focus-visible:-outline-offset-2 focus-visible:outline-[var(--wh-acc)]"
        activeClassName="text-[var(--wh-ink)]!"
        indicatorClassName="bg-[var(--wh-acc)]! inset-x-1.5!"
        items={[
          { value: "payload", label: "Payload" },
          { value: "headers", label: <>Headers <span className="font-mono text-[10.5px] text-[var(--wh-faint)]">{ev ? Object.keys(headers).length : ""}</span></> },
          { value: "response", label: "Response" },
        ]} />
      <div {...tabPanelProps(`${uid}-ins`, tab)}
        className={cx("min-h-0 overflow-auto bg-[var(--wh-canvas)] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--wh-acc)]", compact ? "max-h-[46vh]" : "h-[214px] @max-3xl:h-auto @max-3xl:max-h-[300px]")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.pre key={`${ev?.id}:${tab}`} ref={preRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="m-0 whitespace-pre-wrap px-3 pb-3.5 pt-3 font-mono text-[12px] leading-[1.65] text-[var(--wh-ink)] [overflow-wrap:anywhere] [tab-size:2] @lg:px-4">
            {body}
          </motion.pre>
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--wh-line)] px-3 py-3 @lg:px-4">
        <button type="button" disabled={!ev} onClick={onReplay} className={cx(btnPrimary, "flex-1")}>{Ico.replay}<span>Replay</span></button>
        <button type="button" disabled={!ev} onClick={doCopy}
          className={cx(btnGhost, "flex-1", copied && "border-[var(--wh-ok)]! text-[var(--wh-ok)]!")}>
          {copied ? Ico.check : Ico.copy}<span aria-live="polite">{copied === "copied" ? "Copied" : copied === "selected" ? "Selected — press Ctrl+C" : "Copy payload"}</span>
        </button>
      </div>
    </div>
  );
}

/* ---------- the monitor ---------- */
export function WebhookMonitor({
  title = "Webhook events", environment, endpoint, seed = 2041, initial = 18, max = 60, accounts = ["Brightside Dental"],
  simulate = true, events: startEvents, interval = 2400, defaultPaused = false, onSelect, onReplay, onStreamChange, className, ref,
}: WebhookMonitorProps) {
  const uid = useId().replace(/:/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const width = useElementWidth(rootRef);
  const compact = width < 512, stacked = width < 768;
  const keep = Math.max(10, max);

  // boot once: the RNG and the backlog come from the same seed (pure, so StrictMode's double call is harmless)
  const [boot] = useState(() => {
    const rnd = mulberry(seed);
    const list = startEvents?.length ? startEvents.map(e => normalise(e, rnd))
      : simulate ? seedEvents(rnd, Math.max(0, Math.min(initial, 60)), accounts) : [];
    return { rnd, list, sel: list.find(e => e.status >= 500) ?? list[0] ?? null };
  });
  const rng = useRef<Rng>(boot.rnd);
  const [events, setEvents] = useState<WebhookEvent[]>(boot.list);
  const [sel, setSel] = useState<WebhookEvent | null>(boot.sel);
  const [paused, setPaused] = useState(defaultPaused);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<InsTab>("payload");
  const [sheet, setSheet] = useState(false);
  const [announce, setAnnounce] = useState("");
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastRowBtn = useRef<HTMLElement | null>(null);

  const say = (t: string) => { setAnnounce(""); requestAnimationFrame(() => setAnnounce(t)); };

  const add = useCallback((e: WebhookEvent) => {
    eventsRef.current = [e, ...eventsRef.current].slice(0, keep);
    setEvents(list => [e, ...list].slice(0, keep));
    setSel(s => s ?? e);
    return e;
  }, [keep]);

  const select = useCallback((id: string) => {
    const ev = eventsRef.current.find(x => x.id === id);
    if (!ev) return;
    setSel(ev);
    onSelect?.({ id: ev.id, name: ev.name, status: ev.status });
  }, [onSelect]);

  const replay = useCallback((id: string) => {
    const orig = eventsRef.current.find(x => x.id === id) ?? (sel?.id === id ? sel : null);
    if (!orig) return null;
    const r = rng.current;
    const status = orig.status >= 500 || orig.status === 429 ? 200 : orig.status;
    const ev = normalise({
      name: orig.name, method: orig.method, path: orig.path, payload: orig.payload, account: orig.account, status,
      latency: Math.round(status < 300 ? 40 + r() * r() * 380 : 20 + r() * 160), replayOf: orig.id, attempt: orig.attempt + 1,
    }, r);
    eventsRef.current = [ev, ...eventsRef.current].slice(0, keep);
    setEvents(list => [ev, ...list].slice(0, keep));
    setSel(ev);
    say(`Replayed ${orig.name}. New delivery returned ${status} ${STATUS_TEXT[status] ?? ""}.`);
    onReplay?.({ name: orig.name, original: { id: orig.id, status: orig.status }, replay: { id: ev.id, status: ev.status, latency: ev.latency } });
    return ev;
  }, [sel, keep, onReplay]);

  const setStream = useCallback((p: boolean) => {
    if (p === paused) return;
    setPaused(p);
    say(p ? "Live updates paused." : "Live updates resumed.");
    onStreamChange?.({ paused: p });
  }, [paused, onStreamChange]);

  useImperativeHandle(ref, () => ({
    addEvent: e => add(normalise(e, rng.current)),
    simulateFailure: () => add(generate(rng.current, new Date(), accounts, "fail")),
    select, replay,
    pause: () => setStream(true),
    resume: () => setStream(false),
    get events() { return eventsRef.current.slice(); },
  }), [add, accounts, select, replay, setStream]);

  /* ---- live stream: jittered arrivals, paused in previews / hidden tabs (useInterval) ---- */
  const nextAt = useRef(0);
  useEffect(() => { nextAt.current = 0; }, [paused]);
  useInterval(() => {
    const now = Date.now(), wait = () => Math.round(Math.max(600, interval) * (0.6 + rng.current() * 0.8));
    if (!nextAt.current) { nextAt.current = now + wait(); return; }
    if (now < nextAt.current) return;
    add(generate(rng.current, new Date(now), accounts));
    nextAt.current = now + wait();
  }, 250, { enabled: simulate && !paused });

  /* ---- derived ---- */
  const q = query.trim().toLowerCase();
  const visible = events.filter(e => (filter === "all" || clsOf(e.status) === filter) && matches(e, q));
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, "2xx": 0, "4xx": 0, "5xx": 0 };
    for (const e of events) if (matches(e, q)) { c.all++; c[clsOf(e.status)]++; }
    return c;
  }, [events, q]);
  const stats = useMemo(() => {
    const n = events.length, ok = events.filter(e => e.status < 400).length, fail = n - ok;
    const rate = n ? (ok / n) * 100 : 0;
    const lats = events.map(e => e.latency).sort((a, b) => a - b);
    const p95 = lats.length ? lats[Math.min(lats.length - 1, Math.ceil(lats.length * 0.95) - 1)] : 0;
    return { n, fail, rate, p95, hasLat: lats.length > 0 };
  }, [events]);

  /* ---- keyboard: arrows move between rows and select ---- */
  const onRowsKey = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const btns = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : Math.max(0, Math.min(btns.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
    btns[n].focus();
    btns[n].scrollIntoView({ block: "nearest" });
    select(btns[n].dataset.row ?? "");
  };

  /* ---- phone sheet ---- */
  const openSheet = (id: string, el: HTMLElement) => { select(id); lastRowBtn.current = el; setSheet(true); };
  const closeSheet = () => { setSheet(false); requestAnimationFrame(() => lastRowBtn.current?.focus()); };
  useEffect(() => { if (!compact && sheet) setSheet(false); }, [compact, sheet]);
  useEffect(() => { if (sheet) requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>("button")?.focus()); }, [sheet]);
  const onSheetKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const f = [...sheetRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const hasEvent = (id: string) => events.some(x => x.id === id);
  const inspector = (closeButton?: ReactNode) => (
    <Inspector ev={sel} uid={uid} tab={tab} setTab={setTab} hasEvent={hasEvent} onSelectId={select}
      onReplay={() => sel && replay(sel.id)} compact={compact} closeButton={closeButton} />
  );
  const rowAnim = {
    initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 },
    transition: { duration: reduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] as const },
  };
  const emptyText = events.length ? "No deliveries match these filters." : "Waiting for the first delivery…";
  const rateTone = !stats.n ? "" : stats.rate >= 95 ? "text-[var(--wh-ok)]" : stats.rate >= 85 ? "text-[var(--wh-warn)]" : "text-[var(--wh-err)]";
  const p95Tone = stats.p95 >= 3000 ? "text-[var(--wh-err)]" : stats.p95 >= 1000 ? "text-[var(--wh-warn)]" : "";

  return (
    <section ref={rootRef} aria-label={title} className={cx("@container w-full max-w-[980px] font-sans text-[var(--wh-ink)]", TOKENS, className)}>
      <div className="relative overflow-hidden rounded-[10px] border border-[var(--wh-line)] bg-[var(--wh-card)] shadow-[0_24px_50px_-40px_var(--wh-shadow),0_1px_3px_-1px_var(--wh-shadow)] @lg:rounded-xl">
        {/* top bar */}
        <header className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-3 border-b border-[var(--wh-line)] bg-[var(--wh-canvas)] px-3 py-3.5 @lg:px-[18px]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-[var(--wh-card)] text-[var(--wh-acc)] shadow-[inset_0_0_0_1px_var(--wh-line)]">{Ico.hook}</span>
            <div className="grid min-w-0 gap-1">
              <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
              <p className="flex flex-wrap items-center gap-2 font-mono text-[12px] leading-tight text-[var(--wh-muted)]">
                {environment && <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase leading-[1.3] tracking-[0.04em] text-[var(--wh-acc)] [background:var(--wh-acc-soft)]">{environment}</span>}
                {endpoint && <span>{endpoint}</span>}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2.5 @lg:w-auto @lg:justify-start">
            <span className={cx("inline-flex items-center gap-[7px] text-[12px] font-semibold leading-none", paused ? "text-[var(--wh-muted)]" : "text-[var(--wh-ok)]")}>
              <span aria-hidden className="relative size-2">
                {!paused && !preview && <span className="absolute -inset-1 animate-ping rounded-full border-2 border-[var(--wh-ok)] opacity-60 motion-reduce:hidden" />}
                <span className={cx("absolute inset-0 rounded-full", paused ? "bg-[var(--wh-faint)]" : "bg-[var(--wh-ok)]")} />
              </span>
              {paused ? "Paused" : "Live"}
            </span>
            <button type="button" onClick={() => setStream(!paused)} aria-label={paused ? "Resume live updates" : "Pause live updates"} className={btnGhost}>
              {paused ? Ico.play : Ico.pause}<span>{paused ? "Resume" : "Pause"}</span>
            </button>
          </div>
        </header>

        {/* stats */}
        <dl className="grid grid-cols-2 border-b border-[var(--wh-line)] @3xl:grid-cols-4">
          {[
            ["Deliveries", <CountUp key="n" value={stats.n} duration={400} />, ""],
            ["Success rate", stats.n ? <>{stats.rate === 100 ? "100" : stats.rate.toFixed(1)}<small className="ml-[3px] font-mono text-[11.5px] font-medium text-[var(--wh-faint)]">%</small></> : "—", rateTone],
            ["p95 latency", stats.hasLat ? <>{stats.p95 >= 1000 ? (stats.p95 / 1000).toFixed(1) : stats.p95}<small className="ml-[3px] font-mono text-[11.5px] font-medium text-[var(--wh-faint)]">{stats.p95 >= 1000 ? "s" : "ms"}</small></> : "—", p95Tone],
            ["Failed", <>{stats.fail}<small className="ml-[3px] font-mono text-[11.5px] font-medium text-[var(--wh-faint)]">of {stats.n}</small></>, stats.fail ? "text-[var(--wh-err)]" : "text-[var(--wh-ok)]"],
          ].map(([k, v, tone], i) => (
            <div key={k as string} className={cx("grid min-w-0 gap-[5px] px-3 py-2.5 @lg:px-[18px] @lg:py-3",
              i % 2 === 1 && "border-l border-[var(--wh-line-soft)]", i >= 2 && "border-t border-[var(--wh-line-soft)] @3xl:border-t-0", i === 2 && "@3xl:border-l")}>
              <dt className="text-[11px] font-medium leading-tight text-[var(--wh-faint)]">{k}</dt>
              <dd className={cx("font-mono text-[16px] font-semibold leading-[1.1] tracking-[-0.01em] tabular @lg:text-[18px]", tone as string)}>{v}</dd>
            </div>
          ))}
        </dl>

        {/* filters */}
        <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 border-b border-[var(--wh-line)] px-3 py-2.5 @lg:px-[18px]">
          <div role="group" aria-label="Filter by status" className="relative flex w-full overflow-hidden rounded-md border border-[var(--wh-line)] @lg:inline-flex @lg:w-auto">
            {(["all", "2xx", "4xx", "5xx"] as Filter[]).map((f, i) => {
              const on = filter === f;
              return (
                <button key={f} type="button" aria-pressed={on} onClick={() => setFilter(f)}
                  className={cx("relative inline-flex flex-1 items-center justify-center gap-[5px] px-1.5 py-[7px] text-[12px] font-semibold leading-none transition-colors duration-150 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--wh-acc)] @lg:flex-none @lg:gap-[7px] @lg:px-[11px]",
                    i > 0 && "border-l border-[var(--wh-line)]", on ? "bg-[var(--wh-sel)] text-[var(--wh-ink)]" : "bg-[var(--wh-card)] text-[var(--wh-muted)] hover:bg-[var(--wh-hover)] hover:text-[var(--wh-ink)]")}>
                  {on && <motion.span layoutId={`${uid}-chip`} aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--wh-acc)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  {f === "all" ? "All" : f}
                  <b className={cx("rounded-full px-[5px] py-0.5 font-mono text-[11px] font-semibold leading-none tabular", f === "all" ? "bg-[var(--wh-line-soft)] text-[var(--wh-muted)]" : CODE_TONE[f])}>{counts[f]}</b>
                </button>
              );
            })}
          </div>
          <label className="relative flex min-w-0 flex-[1_1_100%] items-center @lg:flex-[0_1_260px]">
            <span className="pointer-events-none absolute left-[9px] text-[var(--wh-faint)]">{Ico.search}</span>
            <input type="search" value={query} placeholder="Filter by event name" aria-label="Filter by event name" autoComplete="off" spellCheck={false}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape" && query) { e.preventDefault(); e.stopPropagation(); setQuery(""); } }}
              className="min-h-8 w-full rounded-md border border-[var(--wh-line)] bg-[var(--wh-canvas)] py-1.5 pl-[30px] pr-2.5 font-mono text-[12.5px] leading-tight text-[var(--wh-ink)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--wh-faint)] focus:border-[var(--wh-acc)] focus:bg-[var(--wh-card)] focus:shadow-[0_0_0_3px_var(--wh-acc-soft)] focus:outline-none" />
          </label>
        </div>

        {/* stream + inspector */}
        <div className="grid @3xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className={cx("relative min-w-0", stacked ? "border-b border-[var(--wh-line)]" : "min-h-[300px] border-r border-[var(--wh-line)]", compact && "border-b-0")}>
            <div ref={listRef} onKeyDown={onRowsKey} className={cx("overflow-auto [scrollbar-width:thin]", stacked ? (compact ? "max-h-[420px]" : "max-h-[340px]") : "absolute inset-0")}>
              {compact ? (
                <ul aria-label="Webhook deliveries, newest first" className="grid">
                  <AnimatePresence initial={false}>
                    {visible.map(ev => {
                      const on = ev.id === sel?.id;
                      return (
                        <motion.li key={ev.id} layout="position" {...rowAnim} className="border-b border-[var(--wh-line-soft)]">
                          <button type="button" data-row={ev.id} aria-current={on || undefined} onClick={e => openSheet(ev.id, e.currentTarget)}
                            aria-label={`${ev.name}${ev.replayOf ? " (replay)" : ""}, ${ev.status} ${STATUS_TEXT[ev.status] ?? ""}, ${fmtLat(ev.latency)}, at ${hms(ev.at)}`}
                            className={cx("grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 px-3 py-2.5 text-left font-mono text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--wh-acc)]",
                              on ? "bg-[var(--wh-sel)] shadow-[inset_3px_0_0_var(--wh-acc)]" : "hover:bg-[var(--wh-hover)]")}>
                            <span className="flex min-w-0 items-center gap-[7px] font-medium">
                              <span className="truncate">{ev.name}</span>
                              {ev.replayOf && <span className="shrink-0 rounded px-[5px] py-px font-sans text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.03em] text-[var(--wh-acc)] [background:var(--wh-acc-soft)]">replay</span>}
                            </span>
                            <Code status={ev.status} className="justify-self-end" />
                            <span className="col-span-2 truncate text-[11.5px] text-[var(--wh-muted)]"><span className="mr-1.5 font-semibold text-[var(--wh-acc)]">{ev.method}</span>{ev.path}</span>
                            <span className="text-[11.5px] tabular text-[var(--wh-faint)]">{hms(ev.at)}</span>
                            <span className={cx("text-right text-[11.5px] tabular", latTone(ev.latency))}>{fmtLat(ev.latency)}</span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              ) : (
                <table className="w-full table-fixed border-separate border-spacing-0 font-mono text-[12.5px] leading-[1.3]">
                  <caption className="sr-only">Webhook deliveries, newest first</caption>
                  <thead>
                    <tr className="text-left font-sans text-[11px] font-semibold text-[var(--wh-faint)]">
                      {[["Time", "w-[94px] pl-4"], ["Event", ""], ["Method · endpoint", stacked ? "w-[40%]" : "w-[31%]"], ["Status", "w-[60px]"], ["Latency", "w-[72px] pr-4 text-right"]].map(([h, c]) => (
                        <th key={h} scope="col" className={cx("sticky top-0 z-[1] whitespace-nowrap border-b border-[var(--wh-line)] bg-[var(--wh-canvas)] px-2.5 py-2", c)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {visible.map(ev => {
                        const on = ev.id === sel?.id;
                        return (
                          <motion.tr key={ev.id} layout="position" {...rowAnim} onClick={e => { select(ev.id); if (!(e.target as HTMLElement).closest("button")) (e.currentTarget.querySelector("[data-row]") as HTMLElement | null)?.focus({ preventScroll: true }); }}
                            className={cx("cursor-pointer transition-colors duration-200 [&>td]:h-[38px] [&>td]:overflow-hidden [&>td]:text-ellipsis [&>td]:whitespace-nowrap [&>td]:border-b [&>td]:border-[var(--wh-line-soft)] [&>td]:px-2.5 [&>td]:align-middle",
                              on ? "bg-[var(--wh-sel)] [&>td:first-child]:shadow-[inset_3px_0_0_var(--wh-acc)]" : "hover:bg-[var(--wh-hover)]")}>
                            <td className="pl-4! tabular text-[var(--wh-faint)]" title={ev.at.toISOString()}>{hms(ev.at)}</td>
                            <td>
                              <button type="button" data-row={ev.id} aria-current={on || undefined}
                                aria-label={`${ev.name}${ev.replayOf ? " (replay)" : ""}, ${ev.status} ${STATUS_TEXT[ev.status] ?? ""}, ${fmtLat(ev.latency)}, at ${hms(ev.at)}`}
                                className="inline-flex max-w-full items-center gap-[7px] overflow-hidden rounded-sm text-left font-medium text-[var(--wh-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wh-acc)]">
                                <span className="truncate">{ev.name}</span>
                                {ev.replayOf && <span className="shrink-0 rounded px-[5px] py-px font-sans text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.03em] text-[var(--wh-acc)] [background:var(--wh-acc-soft)]">replay</span>}
                              </button>
                            </td>
                            <td className="text-[var(--wh-muted)]" title={`${ev.method} ${ev.path}`}><span className="mr-1.5 inline-block min-w-[3.4em] text-[11px] font-semibold text-[var(--wh-acc)]">{ev.method}</span>{ev.path}</td>
                            <td><Code status={ev.status} /></td>
                            <td className={cx("pr-4! text-right tabular", latTone(ev.latency))}>{fmtLat(ev.latency)}</td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
              {visible.length === 0 && <p className="px-[18px] py-9 text-center text-[13px] text-[var(--wh-muted)]">{emptyText}</p>}
            </div>
          </div>
          {!compact && <aside aria-label="Delivery details" className="min-w-0">{inspector()}</aside>}
        </div>

        {/* phone: inspector as a bottom sheet inside the card */}
        <AnimatePresence>
          {compact && sheet && (
            <motion.div key="sheet" className="absolute inset-0 z-20 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <button type="button" aria-label="Close details" tabIndex={-1} onClick={closeSheet} className="absolute inset-0 cursor-default bg-[rgba(15,19,24,0.36)] backdrop-blur-[1px]" />
              <motion.div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Delivery details" onKeyDown={onSheetKey}
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="relative max-h-[88%] overflow-auto rounded-t-2xl border-t border-[var(--wh-line)] bg-[var(--wh-card)] shadow-[0_-20px_40px_-20px_var(--wh-shadow)]">
                <span aria-hidden className="mx-auto mt-2 block h-1 w-9 rounded-full bg-[var(--wh-line)]" />
                {inspector(
                  <button type="button" onClick={closeSheet} aria-label="Close delivery details"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--wh-muted)] hover:bg-[var(--wh-hover)] hover:text-[var(--wh-ink)] focus-visible:outline-2 focus-visible:outline-[var(--wh-acc)]">{Ico.x}</button>,
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </section>
  );
}
