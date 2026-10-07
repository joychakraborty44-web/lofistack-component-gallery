import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, cx } from "../../ui";
import { useInterval, useMediaQuery, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { Integration, IntegrationFilter, IntegrationIcon, IntegrationStatus } from "./data";

/* ------------------------------------------------------------
   Integration Status Grid — every connected tool as a tile with
   a status light, last sync, events today and hourly activity.
   Filter by status, sync one or all (simulated), reconnect, and
   open a details drawer (modal; bottom sheet on phones).
   ------------------------------------------------------------ */

export interface IntegrationGridLabels {
  connected: string; warning: string; disconnected: string; all: string;
  filterGroup: string; healthy: string; needs: string; allGood: string;
  eventsTotal: string; lastSync: string; events: string; never: string;
  syncNow: string; syncing: string; reconnect: string; reconnecting: string; details: string;
  syncAll: string; syncingAll: string; disconnect: string; close: string;
  justNow: string; minAgo: string; hAgo: string; dAgo: string; dAgo1: string;
  connection: string; account: string; since: string; interval: string; scopes: string;
  recent: string; syncOk: string; syncFail: string; reconnected: string; disconnectedNote: string;
  added: string; noEvents: string; empty: string; showAll: string; bars: string; barsCaption: string; barHover: string;
  announceSync: string; announceReconnect: string; announceFilter: string; announceDisconnect: string; detailsOf: string;
}

const LABELS: IntegrationGridLabels = {
  connected: "Connected", warning: "Warning", disconnected: "Disconnected", all: "All",
  filterGroup: "Filter by status", healthy: "{ok} of {n} healthy", needs: "{n} need attention", allGood: "All integrations are working",
  eventsTotal: "{n} events today", lastSync: "Last sync", events: "Events today", never: "Never",
  syncNow: "Sync now", syncing: "Syncing…", reconnect: "Reconnect", reconnecting: "Reconnecting…", details: "Details",
  syncAll: "Sync all", syncingAll: "Syncing…", disconnect: "Disconnect", close: "Close details",
  justNow: "just now", minAgo: "{n} min ago", hAgo: "{n} h ago", dAgo: "{n} days ago", dAgo1: "1 day ago",
  connection: "Connection", account: "Account", since: "Connected since", interval: "Sync schedule", scopes: "Permissions",
  recent: "Recent syncs", syncOk: "Synced", syncFail: "Sync failed", reconnected: "Reconnected", disconnectedNote: "Disconnected",
  added: "{n} new events", noEvents: "No new events",
  empty: "No integrations with this status.", showAll: "Show all", bars: "Events per hour, last 12 hours: {v}",
  barsCaption: "Events / hour · last 12 h", barHover: "{n} events · {h}",
  announceSync: "{name} synced. {n} new events.", announceReconnect: "{name} reconnected.", announceFilter: "{n} integrations shown",
  announceDisconnect: "{name} disconnected.", detailsOf: "Details for {name}",
};

export interface IntegrationSyncDetail {
  id: string; name: string; action: "sync" | "reconnect"; status: IntegrationStatus; eventsAdded: number; eventsToday: number;
}

export interface IntegrationGridHandle {
  sync: (id: string) => void;
  reconnect: (id: string) => void;
  syncAll: () => void;
  setStatus: (id: string, status: IntegrationStatus, issue?: string) => void;
}

export interface IntegrationStatusGridProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footnote?: string;
  integrations: Integration[];
  /** Controlled status filter. */
  filter?: IntegrationFilter;
  defaultFilter?: IntegrationFilter;
  onFilterChange?: (detail: { filter: IntegrationFilter; shown: number }) => void;
  /** A simulated sync or reconnect finished. */
  onSync?: (detail: IntegrationSyncDetail) => void;
  /** The details drawer opened. */
  onOpen?: (detail: { id: string; name: string; status: IntegrationStatus }) => void;
  onDisconnect?: (detail: { id: string; name: string }) => void;
  locale?: string;
  labels?: Partial<IntegrationGridLabels>;
  className?: string;
  ref?: Ref<IntegrationGridHandle>;
}

/* ---------------- palette ---------------- */
const PALETTE = [
  "[--isg-canvas:#ECEEF1] dark:[--isg-canvas:#0F1115]",
  "[--isg-tile:#FFFFFF] dark:[--isg-tile:#181B20]",
  "[--isg-tint:#F4F5F7] dark:[--isg-tint:#20242A]",
  "[--isg-glyph:#2A2F36] dark:[--isg-glyph:#D9DCE1]",
  "[--isg-btn:#1C2026] [--isg-btn-ink:#FFFFFF] dark:[--isg-btn:#E8EAED] dark:[--isg-btn-ink:#121418]",
  "[--isg-ok:#15803D] dark:[--isg-ok:#4ADE80]",
  "[--isg-warn:#B45309] dark:[--isg-warn:#FBBF24]",
  "[--isg-bad:#B91C1C] [--isg-fix-ink:#FFFFFF] dark:[--isg-bad:#F87171] dark:[--isg-fix-ink:#2A0B0B]",
].join(" ");
const C: Record<IntegrationStatus | "all", string> = {
  connected: "[--c:var(--isg-ok)]", warning: "[--c:var(--isg-warn)]", disconnected: "[--c:var(--isg-bad)]", all: "[--c:var(--ink-3)]",
};
const FILTERS: IntegrationFilter[] = ["all", "connected", "warning", "disconnected"];
const STATUSES: IntegrationStatus[] = ["connected", "warning", "disconnected"];
const EASE = [0.16, 1, 0.3, 1] as const;
const MIN = 60000;

/* ---------------- helpers ---------------- */
interface Hist { key: string; at: number; result: "ok" | "fail"; events: number | null; note: string }
interface Item {
  id: string; name: string; icon: IntegrationIcon; description: string; status: IntegrationStatus; issue: string; fix: "sync" | "reconnect";
  lastSync: number | null; events: number; activity: number[]; account: string; since: string; interval: string; scopes: string[]; history: Hist[];
}
type Busy = "sync" | "reconnect";

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
let histSeq = 0;
const hkey = () => `h${++histSeq}`;

function load(list: Integration[], now: number): Item[] {
  return list.map((x, i) => {
    const status: IntegrationStatus = STATUSES.includes(x.status) ? x.status : "connected";
    const lastMin = num(x.lastSyncMinutes);
    const activity = (x.activity ?? []).map(v => Math.max(0, num(v) ?? 0)).slice(-12);
    const id = String(x.id || `integration-${i + 1}`);
    let history: Hist[] | null = x.history ? x.history.map(h => ({
      key: hkey(), at: now - (num(h.minutesAgo) ?? 0) * MIN, result: h.result === "fail" ? "fail" : "ok", events: num(h.events), note: h.note ? String(h.note) : "",
    })) : null;
    if (!history && lastMin != null) {
      const per = Math.max(5, (hash(id) % 15) + 5);
      history = [0, 1, 2].map(k => ({
        key: hkey(), at: now - (lastMin + k * per) * MIN, result: "ok" as const,
        events: activity.length ? Math.max(1, Math.round(activity[activity.length - 1 - k] / 3 || 1)) : null, note: "",
      }));
    }
    return {
      id, name: String(x.name || `Integration ${i + 1}`), icon: x.icon || "plug", description: String(x.description || ""),
      status, issue: status === "connected" ? "" : String(x.issue || ""), fix: x.fix === "reconnect" || status === "disconnected" ? "reconnect" : "sync",
      lastSync: lastMin == null ? null : now - lastMin * MIN, events: Math.max(0, num(x.eventsToday) ?? 0), activity,
      account: x.account ? String(x.account) : "", since: x.connectedSince ? String(x.connectedSince) : "", interval: x.interval ? String(x.interval) : "",
      scopes: (x.scopes ?? []).map(String), history: history ?? [],
    };
  });
}

/* ---------------- glyphs & icons ---------------- */
const GLYPHS: Record<IntegrationIcon, ReactNode> = {
  crm: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2.2" /><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13h2.5" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 9.5h18M6.5 15h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M14.6 13.2a2.9 2.9 0 1 0 .3 2.6M14.9 11.6v1.8h-1.8" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6.2L20.5 7" /></>,
  sms: <><rect x="6" y="2.5" width="12" height="19" rx="2.6" /><path d="M10.5 18.5h3" /><path d="M9 7.5h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3.5L9.5 14v-1.5H9a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" /></>,
  chat: <><path d="M3.5 6.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z" /><path d="M19 9.5a1.6 1.6 0 0 1 1.5 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6H18v2.4l-3-2.4h-3.5" /></>,
  sheet: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M3.5 14h17M9.5 9v11" /></>,
  hub: <><circle cx="12" cy="12" r="3" /><circle cx="5" cy="5.5" r="1.8" /><circle cx="19" cy="5.5" r="1.8" /><circle cx="5" cy="18.5" r="1.8" /><circle cx="19" cy="18.5" r="1.8" /><path d="m6.4 6.8 3.4 3.1M17.6 6.8l-3.4 3.1M6.4 17.2l3.4-3.1M17.6 17.2l-3.4-3.1" /></>,
  plug: <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" />,
};
function Glyph({ icon, status, size = "md", className }: { icon: IntegrationIcon; status: IntegrationStatus; size?: "md" | "lg"; className?: string }) {
  return (
    <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-[11px] bg-[var(--isg-tint)] shadow-[inset_0_0_0_1px_var(--line)] transition-colors duration-300",
      size === "lg" ? "size-11" : "size-10", status === "disconnected" ? "text-ink-3" : "text-[var(--isg-glyph)]", className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={size === "lg" ? "size-[22px]" : "size-[21px]"}>
        {GLYPHS[icon] ?? GLYPHS.plug}
      </svg>
    </span>
  );
}
const Svg = ({ children, className = "size-3.5" }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>{children}</svg>
);
const IconSync = () => <Svg><path d="M13.2 6.2A5.3 5.3 0 0 0 3.4 5M2.8 9.8A5.3 5.3 0 0 0 12.6 11" /><path d="M13.5 2.8v3.5H10M2.5 13.2V9.7H6" /></Svg>;
const IconPlug = () => <Svg><path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3" /></Svg>;
const IconInfo = () => <Svg><circle cx="8" cy="8" r="6" /><path d="M8 7.3v3.7M8 5h.01" /></Svg>;
const IconX = () => <Svg className="size-4"><path d="m4 4 8 8M12 4l-8 8" /></Svg>;
const IconCheck = () => <Svg className="mt-0.5 size-3.5 text-[var(--isg-ok)]"><path d="m3.5 8.4 2.8 2.8 6.2-6.6" /></Svg>;
function Spinner() {
  const reduced = useReducedMotion();
  return (
    <motion.span className="inline-grid" animate={reduced ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
      <Svg><path d="M8 2a6 6 0 1 1-6 6" /></Svg>
    </motion.span>
  );
}

function Light({ status, L, pulse }: { status: IntegrationStatus; L: IntegrationGridLabels; pulse: boolean }) {
  return (
    <span className={cx(C[status], "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--c)_11%,transparent)] py-[5px] pl-[7px] pr-2 text-[11px] font-semibold leading-none text-[var(--c)] transition-colors duration-300")}>
      <span className="relative grid size-[7px] place-items-center">
        {pulse && status === "connected" && <span aria-hidden className="absolute inset-0 rounded-full bg-[var(--c)] opacity-60 motion-safe:animate-ping [animation-duration:2.4s]" />}
        <i className="relative size-[7px] rounded-full bg-[var(--c)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--c)_22%,transparent)]" />
      </span>
      {L[status]}
    </span>
  );
}

const btnBase = "inline-flex min-h-[34px] items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border px-[13px] text-[12.5px] font-semibold leading-none transition-[background-color,border-color,color,opacity,transform] duration-200 enabled:active:scale-[0.98] disabled:cursor-default disabled:opacity-60";
const btnMain = "border-[var(--isg-btn)] bg-[var(--isg-btn)] text-[var(--isg-btn-ink)] enabled:hover:opacity-90";
const btnFix = "border-[var(--isg-bad)] bg-[var(--isg-bad)] text-[var(--isg-fix-ink)] enabled:hover:opacity-90";
const btnGhost = "border-transparent bg-transparent text-ink-2 enabled:hover:bg-[var(--isg-tint)] enabled:hover:text-ink";
const btnPlain = "border-line bg-[var(--isg-tile)] text-ink enabled:hover:border-line-strong";

/* ---------------- component ---------------- */
export function IntegrationStatusGrid({
  eyebrow, title, subtitle, footnote, integrations, filter: filterProp, defaultFilter = "all",
  onFilterChange, onSync, onOpen, onDisconnect, locale = "en-US", labels: labelsProp, className, ref,
}: IntegrationStatusGridProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const sheet = useMediaQuery("(max-width: 639px)");
  const L = useMemo(() => ({ ...LABELS, ...labelsProp }), [labelsProp]);
  const int = useCallback((v: number) => Math.round(v).toLocaleString(locale), [locale]);

  const [items, setItems] = useState<Item[]>(() => load(integrations, Date.now()));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<Record<string, Busy>>({});
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [allIds, setAllIds] = useState<Set<string>>(() => new Set());
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const [newHist, setNewHist] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [ownFilter, setOwnFilter] = useState<IntegrationFilter>(defaultFilter);
  const filter: IntegrationFilter = FILTERS.includes(filterProp ?? ownFilter) ? (filterProp ?? ownFilter) : "all";
  const [enter, setEnter] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const timers = useRef(new Set<number>());
  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }, []);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current.clear(); }, []);

  // relative times stay current (paused in previews / hidden tabs)
  useInterval(() => setNow(Date.now()), 30000);

  const say = useCallback((t: string) => { setLive(""); window.setTimeout(() => setLive(t), 50); }, []);

  const ago = (t: number | null) => {
    if (t == null) return L.never;
    const m = Math.floor((now - t) / MIN);
    if (m < 1) return L.justNow;
    if (m < 60) return fill(L.minAgo, { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return fill(L.hAgo, { n: h });
    const d = Math.floor(h / 24);
    return d === 1 ? L.dAgo1 : fill(L.dAgo, { n: d });
  };

  const patch = (id: string, fn: (it: Item) => Item) => {
    const next = itemsRef.current.map(it => (it.id === id ? fn(it) : it));
    itemsRef.current = next;
    setItems(next);
  };
  const setBusyFor = (id: string, v: Busy | null) => {
    const next = { ...busyRef.current };
    if (v) next[id] = v; else delete next[id];
    busyRef.current = next;
    setBusy(next);
  };

  const act = useCallback((id: string, action: Busy) => {
    const it0 = itemsRef.current.find(x => x.id === id);
    if (!it0 || busyRef.current[id]) return;
    setBusyFor(id, action);
    later(() => {
      if (!busyRef.current[id]) return;
      setBusyFor(id, null);
      setAllIds(prev => { if (!prev.has(id)) return prev; const s = new Set(prev); s.delete(id); return s; });
      const it = itemsRef.current.find(x => x.id === id);
      if (!it) return;
      const t = Date.now();
      let added: number;
      let next: Item;
      if (action === "reconnect") {
        added = 1 + (hash(it.id + t) % 6);
        next = { ...it, status: "connected", issue: "", fix: "sync", history: [{ key: hkey(), at: t, result: "ok" as const, events: added, note: L.reconnected }, ...it.history].slice(0, 6) };
        say(fill(L.announceReconnect, { name: it.name }));
      } else {
        added = 2 + (hash(it.id + it.events + t) % (it.events > 500 ? 40 : 12));
        const clears = it.status === "warning" && it.fix === "sync";
        next = { ...it, status: clears ? "connected" : it.status, issue: clears ? "" : it.issue, history: [{ key: hkey(), at: t, result: "ok" as const, events: added, note: "" }, ...it.history].slice(0, 6) };
        say(fill(L.announceSync, { name: it.name, n: added }));
      }
      next = { ...next, lastSync: t, events: it.events + added, activity: it.activity.length ? [...it.activity.slice(0, -1), it.activity[it.activity.length - 1] + added] : it.activity };
      patch(id, () => next);
      setNow(t);
      setNewHist(next.history[0].key);
      setFresh(prev => ({ ...prev, [id]: t }));
      later(() => setFresh(prev => { if (prev[id] !== t) return prev; const n = { ...prev }; delete n[id]; return n; }), 2400);
      onSync?.({ id: it.id, name: it.name, action, status: next.status, eventsAdded: added, eventsToday: next.events });
    }, action === "reconnect" ? 1700 : 1100 + (hash(id) % 500));
  }, [later, L, say, onSync]);

  const syncAll = useCallback(() => {
    const list = itemsRef.current.filter(it => it.status !== "disconnected" && !busyRef.current[it.id]);
    if (!list.length) return;
    setAllIds(new Set(list.map(it => it.id)));
    list.forEach((it, i) => later(() => act(it.id, "sync"), i * 140));
  }, [act, later]);

  const setStatus = useCallback((id: string, status: IntegrationStatus, issue?: string) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (!it || !STATUSES.includes(status)) return;
    const iss = status === "connected" ? "" : (issue || it.issue || "");
    const h: Hist[] = status !== "connected" ? [{ key: hkey(), at: Date.now(), result: "fail", events: null, note: iss || L.syncFail }, ...it.history] : it.history;
    patch(id, x => ({ ...x, status, issue: iss, fix: status === "disconnected" ? "reconnect" : (x.fix || "sync"), history: h }));
    if (h !== it.history) setNewHist(h[0].key);
    setNow(Date.now());
  }, [L]);

  useImperativeHandle(ref, () => ({
    sync: id => { const it = itemsRef.current.find(x => x.id === id); if (it && it.status !== "disconnected") act(id, "sync"); },
    reconnect: id => act(id, "reconnect"),
    syncAll,
    setStatus,
  }), [act, syncAll, setStatus]);

  const disconnect = (id: string) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (!it) return;
    const h: Hist = { key: hkey(), at: Date.now(), result: "fail", events: null, note: L.disconnectedNote };
    patch(id, x => ({ ...x, status: "disconnected", fix: "reconnect", issue: `${L.disconnectedNote}.`, history: [h, ...x.history] }));
    setNewHist(h.key);
    say(fill(L.announceDisconnect, { name: it.name }));
    onDisconnect?.({ id, name: it.name });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-isg-drawer="${CSS.escape(uid)}"] [data-main-act]`)?.focus());
  };

  /* ---------- filter ---------- */
  const shownFor = (f: IntegrationFilter) => itemsRef.current.filter(it => f === "all" || it.status === f).length;
  const pickFilter = (f: IntegrationFilter) => {
    if (f === filter) return;
    if (filterProp === undefined) setOwnFilter(f);
    setEnter(!reduced);
    const n = shownFor(f);
    say(fill(L.announceFilter, { n }));
    onFilterChange?.({ filter: f, shown: n });
  };

  /* ---------- drawer ---------- */
  const openDrawer = (id: string, el: HTMLElement) => {
    const it = itemsRef.current.find(x => x.id === id);
    if (!it) return;
    opener.current = el;
    setOpenId(id);
    onOpen?.({ id: it.id, name: it.name, status: it.status });
  };
  const closeDrawer = useCallback(() => {
    setOpenId(cur => {
      if (cur) requestAnimationFrame(() => {
        const o = opener.current;
        if (o && o.isConnected) o.focus();
        else mainRef.current?.querySelector<HTMLElement>(`[data-details="${CSS.escape(cur)}"]`)?.focus();
      });
      return null;
    });
  }, []);

  /* ---------- derived ---------- */
  const count = (s: IntegrationStatus) => items.filter(it => it.status === s).length;
  const ok = count("connected"), warn = count("warning"), bad = count("disconnected"), n = items.length;
  const shown = items.filter(it => filter === "all" || it.status === filter);
  const total = items.reduce((a, it) => a + it.events, 0);
  const busyAll = allIds.size > 0;
  const syncable = items.some(it => it.status !== "disconnected");
  const openItem = openId ? items.find(it => it.id === openId) ?? null : null;

  const mainButton = (it: Item, inDrawer = false) => {
    const b = busy[it.id];
    const needsReconnect = it.status === "disconnected" || (it.status === "warning" && it.fix === "reconnect");
    const action: Busy = b || (needsReconnect ? "reconnect" : "sync");
    return (
      <button type="button" data-main-act={inDrawer || undefined} disabled={!!b} aria-busy={!!b} aria-describedby={inDrawer ? undefined : `${uid}-n-${it.id}`}
        onClick={() => act(it.id, action)}
        className={cx(btnBase, "flex-1", action === "reconnect" && it.status === "disconnected" && !b ? btnFix : btnMain)}>
        {b ? <Spinner /> : action === "reconnect" ? <IconPlug /> : <IconSync />}
        {b ? (b === "reconnect" ? L.reconnecting : L.syncing) : action === "reconnect" ? L.reconnect : L.syncNow}
      </button>
    );
  };

  return (
    <div className={cx("@container w-full max-w-[1040px]", className)}>
      <section className={cx(PALETTE, "relative isolate rounded-[22px] border border-line bg-[var(--isg-canvas)] px-3 pb-4 pt-5 font-sans text-ink elev-2 @md:px-5 @md:pt-6 @3xl:px-6 @3xl:pb-5")}>
        <div ref={mainRef} inert={!!openItem || undefined}>
          {/* header */}
          <header className="flex flex-col gap-3.5 px-1 @md:flex-row @md:items-start @md:justify-between @md:gap-5">
            <div className="grid min-w-0 gap-1.5">
              {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{eyebrow}</span>}
              {title && <h2 className="m-0 text-balance font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.02em] @3xl:text-[25px]">{title}</h2>}
              {subtitle && <p className="m-0 text-[13px] text-ink-2">{subtitle}</p>}
            </div>
            <button type="button" onClick={syncAll} disabled={busyAll || !syncable} aria-busy={busyAll}
              className={cx(btnBase, btnPlain, "w-full shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06)] @md:w-auto")}>
              {busyAll ? <Spinner /> : <IconSync />}{busyAll ? L.syncingAll : L.syncAll}
            </button>
          </header>

          {/* summary + filters */}
          <div className="mt-[18px] grid items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-[var(--isg-tile)] p-3 elev-1 @md:px-4 @md:py-3.5 @3xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 gap-2.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular">{fill(L.healthy, { ok, n })}</span>
                <span className={cx("text-[12.5px] tabular", warn + bad ? "text-ink-2" : "text-[var(--isg-ok)]")}>{warn + bad ? fill(L.needs, { n: warn + bad }) : L.allGood}</span>
              </div>
              <div aria-hidden className="flex h-1.5 gap-[3px]">
                {([["connected", ok], ["warning", warn], ["disconnected", bad]] as const).map(([s, v]) => (
                  <motion.span key={s} className={cx(C[s], "min-w-0 rounded-full bg-[var(--c)]")} style={{ flexBasis: 0, flexShrink: 1 }}
                    initial={preview ? false : { flexGrow: 0 }} animate={{ flexGrow: v, opacity: v ? 1 : 0, marginRight: v ? 0 : -3 }} transition={{ duration: 0.5, ease: EASE }} />
                ))}
              </div>
            </div>
            <div ref={filtersRef} role="group" aria-label={L.filterGroup}
              className="grid grid-cols-2 gap-1 rounded-[11px] border border-line bg-[var(--isg-tint)] p-[3px] @lg:flex @lg:flex-wrap">
              {FILTERS.map(f => {
                const on = f === filter;
                const cnt = f === "all" ? n : count(f);
                return (
                  <button key={f} type="button" data-filter={f} aria-pressed={on} onClick={() => pickFilter(f)}
                    className={cx(C[f], "relative isolate inline-flex items-center justify-center gap-[7px] rounded-lg px-2.5 py-2 text-[12.5px] font-semibold leading-none transition-colors duration-200",
                      on ? "text-ink" : "text-ink-2 hover:text-ink")}>
                    {on && <motion.span layoutId={`${uid}-flt`} aria-hidden transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-[var(--isg-tile)] shadow-[0_1px_3px_-1px_hsl(var(--shadow-color)/0.2),0_0_0_1px_var(--line)]" />}
                    {f !== "all" && <span aria-hidden className="size-[7px] rounded-full bg-[var(--c)]" />}
                    {L[f]}
                    <b className={cx("text-[11.5px] font-semibold tabular", on ? "text-ink" : "text-ink-3")}>{cnt}</b>
                  </button>
                );
              })}
            </div>
          </div>

          {/* tiles */}
          {shown.length > 0 ? (
            <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-2.5 p-0 @md:grid-cols-2 @md:gap-3 @3xl:grid-cols-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {shown.map((it, i) => (
                  <Tile key={it.id} it={it} i={i} uid={uid} L={L} enter={enter} preview={preview} reduced={reduced}
                    busy={busy[it.id]} fresh={!!fresh[it.id]} ago={ago(it.lastSync)} int={int} mainButton={mainButton(it)}
                    onDetails={el => openDrawer(it.id, el)} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid justify-items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-9 text-center text-[13.5px] text-ink-2">
              <span>{L.empty}</span>
              <button type="button" className={cx(btnBase, btnPlain)}
                onClick={() => { pickFilter("all"); requestAnimationFrame(() => filtersRef.current?.querySelector<HTMLElement>('[data-filter="all"]')?.focus()); }}>
                {L.showAll}
              </button>
            </motion.div>
          )}

          <footer className="mt-3.5 flex flex-wrap justify-between gap-x-4 gap-y-1.5 px-1 text-[12px] text-ink-3">
            <span className="tabular">{L.eventsTotal.split("{n}")[0]}<CountUp value={total} format={v => int(v)} />{L.eventsTotal.split("{n}")[1] ?? ""}</span>
            {footnote && <span>{footnote}</span>}
          </footer>
        </div>
        <p className="sr-only" aria-live="polite">{live}</p>
      </section>

      {!preview && createPortal(
        <AnimatePresence>
          {openItem && (
            <Drawer key="drawer" it={openItem} uid={uid} L={L} sheet={sheet} reduced={reduced} busy={busy[openItem.id]} newHist={newHist}
              ago={ago} int={int} mainButton={mainButton(openItem, true)} onClose={closeDrawer} onDisconnect={() => disconnect(openItem.id)} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/* ---------------- tile ---------------- */
function Tile({ it, i, uid, L, enter, preview, reduced, busy, fresh, ago, int, mainButton, onDetails, ref }: {
  it: Item; i: number; uid: string; L: IntegrationGridLabels; enter: boolean; preview: boolean; reduced: boolean; busy?: Busy; fresh: boolean;
  ago: string; int: (v: number) => string; mainButton: ReactNode; onDetails: (el: HTMLElement) => void; ref?: Ref<HTMLLIElement>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const prevSync = useRef(it.lastSync);
  useEffect(() => {
    if (prevSync.current !== it.lastSync && it.lastSync != null && prevSync.current != null && it.lastSync > prevSync.current) setFlashKey(k => k + 1);
    prevSync.current = it.lastSync;
  }, [it.lastSync]);
  const max = Math.max(1, ...it.activity);
  const alert = it.status !== "connected";
  return (
    <motion.li ref={ref} layout aria-labelledby={`${uid}-n-${it.id}`}
      initial={enter ? { opacity: 0, y: 8, scale: 0.985 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, default: { duration: 0.35, ease: EASE, delay: enter ? i * 0.03 : 0 } }}
      className={cx(C[it.status], "group/tile relative grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-x-3 rounded-[14px] border bg-[var(--isg-tile)] px-3.5 pb-3 pt-3.5 @md:flex @md:flex-col @md:px-4 @md:pb-3.5 @md:pt-4",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_10px_24px_-22px_hsl(var(--shadow-color)/0.5)] transition-[border-color,box-shadow,translate] duration-300",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-24px_hsl(var(--shadow-color)/0.55)] motion-reduce:hover:translate-y-0 dark:shadow-none",
        it.status === "disconnected" ? "border-dashed border-[color-mix(in_oklab,var(--isg-bad)_45%,var(--line))]" : "border-line")}>
      {/* accent rail for tiles that need attention */}
      <motion.span aria-hidden className="absolute -top-px left-4 right-4 h-0.5 origin-center rounded-b-sm bg-[var(--c)]"
        initial={false} animate={{ scaleX: alert ? 1 : 0, opacity: alert ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
      {/* indeterminate progress while a sync runs */}
      <AnimatePresence>
        {busy && (
          <motion.span key="busy" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-[14px]">
            <motion.span className="absolute inset-y-0 w-1/3 rounded-full bg-[var(--isg-glyph)] opacity-60"
              initial={{ left: "-33%" }} animate={reduced ? { left: "33%" } : { left: ["-33%", "100%"] }}
              transition={reduced ? { duration: 0 } : { repeat: Infinity, duration: 1.1, ease: "easeInOut" }} />
          </motion.span>
        )}
      </AnimatePresence>
      {flashKey > 0 && !reduced && (
        <motion.span key={flashKey} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"
          initial={{ boxShadow: "0 0 0 0 color-mix(in oklab, var(--isg-ok) 50%, transparent)" }} animate={{ boxShadow: "0 0 0 10px color-mix(in oklab, var(--isg-ok) 0%, transparent)" }}
          transition={{ duration: 0.9, ease: "easeOut" }} />
      )}

      <div className="contents @md:flex @md:items-start @md:justify-between @md:gap-2">
        <Glyph icon={it.icon} status={it.status} className="col-start-1 row-span-2 row-start-1" />
        <span className="col-start-2 row-start-1 self-center justify-self-start">
          <Light status={it.status} L={L} pulse={!preview && !reduced} />
        </span>
      </div>
      <h3 id={`${uid}-n-${it.id}`} className="col-start-2 row-start-2 m-0 mt-1.5 font-display text-[15.5px] font-semibold leading-tight tracking-[-0.01em] [overflow-wrap:anywhere] @md:mt-3.5">{it.name}</h3>
      {it.description && <p className="col-span-2 m-0 mt-1 text-[12.5px] leading-snug text-ink-2 [overflow-wrap:anywhere] @md:mt-[3px]">{it.description}</p>}
      <AnimatePresence initial={false}>
        {it.issue && (
          <motion.p key="issue" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}
            className="col-span-2 m-0 overflow-hidden">
            <span className="mt-2.5 block rounded-lg border-l-2 border-[var(--c)] bg-[color-mix(in_oklab,var(--c)_10%,transparent)] px-2.5 py-[7px] text-[12px] leading-snug text-ink">{it.issue}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {it.activity.length > 0 && (
        <div className="col-span-2 mt-auto hidden pt-3.5 @md:block">
          <div role="img" aria-label={fill(L.bars, { v: it.activity.join(", ") })} onMouseLeave={() => setHover(null)} className="flex h-[34px] items-end gap-[2px]">
            {it.activity.map((v, k) => {
              const last = k === it.activity.length - 1;
              return (
                <span key={k} onMouseEnter={() => setHover(k)} className="flex h-full min-w-0 flex-1 items-end">
                  <motion.span className={cx("block w-full rounded-t-[2px] rounded-b-[1px] transition-colors duration-200",
                    hover === k ? "bg-[var(--c)]" : last && it.status !== "disconnected" ? "bg-[var(--isg-glyph)] opacity-75" : "bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]")}
                    initial={preview ? false : { height: "4%" }} animate={{ height: `${Math.max((v / max) * 100, 4)}%` }}
                    transition={{ duration: 0.5, ease: EASE, delay: preview ? 0 : k * 0.015 }} />
                </span>
              );
            })}
          </div>
          <p aria-hidden className="m-0 mt-1.5 h-3.5 font-mono text-[10px] leading-none tabular text-ink-3">
            {hover == null ? L.barsCaption : fill(L.barHover, { n: int(it.activity[hover]), h: hover === it.activity.length - 1 ? "this hour" : `${it.activity.length - 1 - hover} h ago` })}
          </p>
        </div>
      )}

      <dl className={cx("col-span-2 m-0 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 border-t border-line pt-2.5", it.activity.length ? "mt-2.5" : "mt-2.5 @md:mt-auto")}>
        <div className="grid min-w-0 gap-1">
          <dt className="text-[10.5px] font-medium tracking-[0.04em] text-ink-3">{L.lastSync}</dt>
          <dd className={cx("m-0 text-[13px] font-semibold leading-tight tabular transition-colors duration-300", fresh ? "text-[var(--isg-ok)]" : "text-ink")}>{ago}</dd>
        </div>
        <div className="grid min-w-0 gap-1">
          <dt className="text-[10.5px] font-medium tracking-[0.04em] text-ink-3">{L.events}</dt>
          <dd className="m-0 text-[13px] font-semibold leading-tight"><CountUp value={it.events} format={v => int(v)} duration={700} /></dd>
        </div>
      </dl>
      <div className="col-span-2 mt-3 flex gap-1.5">
        {mainButton}
        <button type="button" data-details={it.id} aria-haspopup="dialog" aria-label={fill(L.detailsOf, { name: it.name })}
          onClick={e => onDetails(e.currentTarget)} className={cx(btnBase, btnGhost)}>
          <IconInfo />{L.details}
        </button>
      </div>
    </motion.li>
  );
}

/* ---------------- drawer ---------------- */
function Drawer({ it, uid, L, sheet, reduced, busy, newHist, ago, int, mainButton, onClose, onDisconnect }: {
  it: Item; uid: string; L: IntegrationGridLabels; sheet: boolean; reduced: boolean; busy?: Busy; newHist: string | null;
  ago: (t: number | null) => string; int: (v: number) => string; mainButton: ReactNode; onClose: () => void; onDisconnect: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = `${uid}-drawer-title`;
  useLayoutEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const f = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex='0']") ?? [])].filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const facts: [string, string, boolean][] = [];
  if (it.account) facts.push([L.account, it.account, true]);
  facts.push([L.lastSync, ago(it.lastSync), false], [L.events, int(it.events), false]);
  if (it.interval) facts.push([L.interval, it.interval, false]);
  if (it.since) facts.push([L.since, it.since, false]);
  const sideIn = { x: 0, y: 0, opacity: 1 };
  const sideOut = sheet ? { y: "100%", x: 0, opacity: 1 } : { x: "104%", y: 0, opacity: 1 };

  return (
    <div className={cx(PALETTE, "fixed inset-0 z-[900] font-sans text-ink")} data-isg-drawer={uid}>
      <motion.div aria-hidden onClick={onClose} className="absolute inset-0 bg-[rgb(22_25_29/0.32)] backdrop-blur-[2px] dark:bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.25 }} />
      <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKey}
        initial={reduced ? { opacity: 0 } : sideOut} animate={sideIn} exit={reduced ? { opacity: 0 } : sideOut}
        transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 40 }}
        className={cx("absolute grid grid-rows-[auto_minmax(0,1fr)_auto] border-line bg-[var(--isg-tile)] elev-4",
          sheet ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px] border-t" : "bottom-0 right-0 top-0 w-[min(400px,100%)] border-l")}>
        <div className={cx(C[it.status], "relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 pb-4", sheet ? "pt-5" : "pt-5")}>
          {sheet && <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />}
          <Glyph icon={it.icon} status={it.status} size="lg" />
          <div className="min-w-0">
            <h3 ref={titleRef} id={titleId} tabIndex={-1} className="m-0 font-display text-[17px] font-semibold leading-tight tracking-[-0.01em] outline-none [overflow-wrap:anywhere]">{it.name}</h3>
            <span className="mt-1.5 inline-flex"><Light status={it.status} L={L} pulse={!reduced} /></span>
          </div>
          <button type="button" aria-label={L.close} onClick={onClose} className={cx(btnBase, btnGhost, "w-[34px] self-start px-0")}><IconX /></button>
        </div>

        <div className="grid content-start gap-[18px] overflow-y-auto overscroll-contain px-4 py-4">
          <AnimatePresence initial={false}>
            {it.issue && (
              <motion.p key="issue" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className={cx(C[it.status], "m-0 overflow-hidden")}>
                <span className="block rounded-lg border-l-2 border-[var(--c)] bg-[color-mix(in_oklab,var(--c)_10%,transparent)] px-2.5 py-2 text-[12.5px] leading-snug">{it.issue}</span>
              </motion.p>
            )}
          </AnimatePresence>
          <section className="grid gap-2.5">
            <h4 className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">{L.connection}</h4>
            <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-[var(--line)]">
              {facts.map(([k, v, wide]) => (
                <div key={k} className={cx("grid min-w-0 gap-1 bg-[var(--isg-tile)] px-[11px] py-2.5", wide && "col-span-2")}>
                  <dt className="text-[11px] text-ink-3">{k}</dt>
                  <dd className="m-0 text-[13px] font-semibold leading-snug tabular [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {it.scopes.length > 0 && (
            <section className="grid gap-2.5">
              <h4 className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">{L.scopes}</h4>
              <ul className="m-0 grid list-none gap-[7px] p-0">
                {it.scopes.map(s => <li key={s} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2 text-[13px] leading-snug"><IconCheck /><span>{s}</span></li>)}
              </ul>
            </section>
          )}
          {it.history.length > 0 && (
            <section className="grid gap-2.5">
              <h4 className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">{L.recent}</h4>
              <ol className="m-0 grid list-none p-0">
                <AnimatePresence initial={false}>
                  {it.history.slice(0, 5).map((h, k, arr) => {
                    const sub = h.result === "ok" ? (h.events ? fill(L.added, { n: int(h.events) }) : h.events === 0 ? L.noEvents : "") : h.note;
                    return (
                      <motion.li key={h.key} layout="position"
                        initial={h.key === newHist && !reduced ? { opacity: 0, y: -6 } : false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={cx(h.result === "ok" ? C.connected : C.disconnected, "relative grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-2.5 pb-3 text-[12.5px] leading-snug")}>
                        {k < arr.length - 1 && <span aria-hidden className="absolute bottom-0 left-1.5 top-3.5 w-px bg-line" />}
                        <i aria-hidden className="ml-0.5 mt-[3px] size-[9px] rounded-full bg-[var(--c)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--c)_18%,transparent)]" />
                        <div className="min-w-0">
                          <b className="block font-semibold">{h.note && h.result === "ok" ? h.note : h.result === "ok" ? L.syncOk : L.syncFail}</b>
                          {sub && <small className="block text-[12px] text-ink-2 [overflow-wrap:anywhere]">{sub}</small>}
                        </div>
                        <em className="whitespace-nowrap text-[12px] not-italic tabular text-ink-3">{ago(h.at)}</em>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            </section>
          )}
        </div>

        <div className={cx("flex flex-wrap gap-2 border-t border-line bg-[var(--isg-tint)] px-4 py-3.5", sheet && "pb-[max(14px,env(safe-area-inset-bottom))]")}>
          {mainButton}
          {it.status !== "disconnected" && (
            <button type="button" disabled={!!busy} onClick={onDisconnect} className={cx(btnBase, btnGhost)}>{L.disconnect}</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
