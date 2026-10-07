import { AnimatePresence, motion } from "motion/react";
import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type Ref, type RefObject,
} from "react";
import { Tabs, cx, tabPanelProps } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { NotificationItem, NotificationType, SystemIcon } from "./data";

export type NotificationTab = "all" | NotificationType;

export interface NotificationLabels {
  title: string; bell: string; bellUnread: string; markAll: string; tabs: string;
  all: string; mention: string; system: string; today: string; yesterday: string; earlier: string;
  justNow: string; minAgo: string; hAgo: string; dismiss: string; unread: string; newItem: string;
  readAll: string; dismissed: string; total: string; fresh: string;
  emptyAll: string; emptyAllSub: string; emptyMention: string; emptyMentionSub: string; emptySystem: string; emptySystemSub: string;
}

const LABELS: NotificationLabels = {
  title: "Notifications", bell: "Notifications", bellUnread: "Notifications, {n} unread",
  markAll: "Mark all as read", tabs: "Notification type", all: "All", mention: "Mentions", system: "System",
  today: "Today", yesterday: "Yesterday", earlier: "Earlier",
  justNow: "just now", minAgo: "{n} min ago", hAgo: "{n} h ago",
  dismiss: "Dismiss", unread: "Unread", newItem: "New notification: {text}",
  readAll: "{n} notifications marked as read", dismissed: "Notification dismissed", total: "{n} total", fresh: "{n} new",
  emptyAll: "You're all caught up", emptyAllSub: "New mentions and alerts will show up here.",
  emptyMention: "No mentions", emptyMentionSub: "When a teammate mentions you, you'll see it here.",
  emptySystem: "No system alerts", emptySystemSub: "Payments, reports and sync issues will appear here.",
};

export interface NotificationReadDetail { ids: string[]; source: "click" | "all" | "action" }

/** Imperative handle (pass `ref`): add items from a live source, reset, or open/close from code. */
export interface NotificationCenterHandle {
  add: (item: NotificationItem) => void;
  reset: (items?: NotificationItem[]) => void;
  show: (focus?: boolean) => void;
  hide: (returnFocus?: boolean) => void;
  toggle: () => void;
  readonly unread: number;
}

export interface NotificationCenterProps {
  items: NotificationItem[];
  /** ISO date-time used for "Today", "min ago" etc. (default: the real clock). */
  now?: string;
  title?: string;
  /** Link or button at the bottom of the panel. Without `href` it calls `onFooter`. */
  footer?: { label: string; href?: string };
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: NotificationTab;
  onTabChange?: (tab: NotificationTab) => void;
  onRead?: (detail: NotificationReadDetail) => void;
  onDismiss?: (id: string) => void;
  onAction?: (detail: { id: string; action: string }) => void;
  onFooter?: () => void;
  /** Element the panel must stay inside (default: the viewport). Narrow boundaries turn the panel into a full-width sheet. */
  boundaryRef?: RefObject<HTMLElement | null>;
  /** Panel width on roomy screens (default 400). */
  panelWidth?: number;
  /** Max height of the scrolling list (default 430). */
  maxListHeight?: number;
  labels?: Partial<NotificationLabels>;
  locale?: string;
  className?: string;
  ref?: Ref<NotificationCenterHandle>;
}

interface Item extends NotificationItem { id: string; read: boolean; d: Date; done?: boolean; fresh?: boolean }

/* ---------- helpers ---------- */
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const initials = (s?: string) => (s || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
const HUES = ["#E11D48", "#7C3AED", "#0891B2", "#D97706", "#059669", "#2563EB"];
const hueFor = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const TABS: NotificationTab[] = ["all", "mention", "system"];
const plain = (i: NotificationItem) => (i.type === "system" ? `${i.title ?? ""}. ${i.body ?? ""}` : `${i.actor ?? ""} ${i.text ?? ""} ${i.target ?? ""}. ${i.body ?? ""}`).trim();
let seq = 0;

function normalise(list: NotificationItem[], now: Date): Item[] {
  return list.filter(Boolean).map(i => {
    const d = i.time instanceof Date ? i.time : i.time ? new Date(i.time) : now;
    return { ...i, id: i.id ?? `ntc-auto-${++seq}`, type: i.type === "system" ? "system" : "mention", read: !!i.read, d: isNaN(+d) ? now : d };
  });
}

/* ---------- icons ---------- */
const svg = (d: ReactNode, cls = "size-[18px]", vb = "0 0 18 18", sw = 1.6) => (
  <svg viewBox={vb} className={cls} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const SYS: Record<SystemIcon, { hue: string; icon: ReactNode }> = {
  payment: { hue: "var(--nc-ok)", icon: svg(<><rect x="2" y="4" width="14" height="10" rx="2" /><path d="M2 7.5h14M5 11h3" /></>) },
  warning: { hue: "var(--nc-warn)", icon: svg(<><path d="M9 2.5 16 15H2z" /><path d="M9 7.5v3.2M9 12.9v.1" /></>) },
  report: { hue: "var(--nc-info)", icon: svg(<><path d="M3 15V3M3 15h12" /><path d="M6.5 12V9M10 12V6M13.5 12V8" /></>) },
  automation: { hue: "var(--nc-acc)", icon: svg(<path d="M10 2 4 10h5l-1 6 6-8H9z" />) },
  integration: { hue: "var(--nc-info)", icon: svg(<><path d="M7 4.5V2.5M11 4.5V2.5M5.5 4.5h7v3a3.5 3.5 0 0 1-7 0z" /><path d="M9 11v4.5" /></>) },
};
const BellIcon = () => svg(<><path d="M5 8.2a5 5 0 0 1 10 0c0 3.6 1.4 5.1 2 5.8H3c.6-.7 2-2.2 2-5.8z" /><path d="M8.2 16.6a2 2 0 0 0 3.6 0" /></>, "size-5", "0 0 20 20", 1.7);
const ChecksIcon = () => svg(<><path d="m1.5 8.6 2.8 2.8L10 5.6" /><path d="m7.8 11 .4.4L14 5.6" /></>, "size-3.5", "0 0 16 16");
const XIcon = () => svg(<path d="m3 3 6 6M9 3 3 9" />, "size-3", "0 0 12 12", 1.7);
const AtIcon = () => svg(<><circle cx="6" cy="6" r="2" /><path d="M8 6v.8a1.4 1.4 0 0 0 2.8 0V6A4.8 4.8 0 1 0 8.6 10" /></>, "size-[9px]", "0 0 12 12");
const GearIcon = () => svg(<><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" /></>, "size-[13px]", "0 0 16 16", 1.5);
const EmptyArt = () => (
  <svg viewBox="0 0 80 80" className="mb-1.5 size-[76px]" fill="none" aria-hidden>
    <circle cx="40" cy="40" r="34" fill="var(--nc-tint)" />
    <path d="M27 37a13 13 0 0 1 26 0c0 9 3.4 12.7 5 14.5H22c1.6-1.8 5-5.5 5-14.5z" fill="var(--nc-panel)" stroke="var(--nc-faint)" strokeWidth="2" strokeLinejoin="round" />
    <path d="M35.5 57a5 5 0 0 0 9 0" stroke="var(--nc-faint)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="55" cy="25" r="9" fill="var(--nc-acc)" />
    <path d="m51 25 2.8 2.8L59 22.6" stroke="var(--nc-on-acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- palette ---------- */
export const NC_TOKENS = [
  "[--nc-panel:#FFFFFF] [--nc-raise:#FFFFFF] [--nc-ink:#1C1417] [--nc-muted:#5F5459] [--nc-faint:#75686E] [--nc-line:#F0E6E9] [--nc-line-strong:#E3D9DC]",
  "[--nc-tint:#FBF5F7] [--nc-unread:#FFF6F8] [--nc-acc:#E11D48] [--nc-acc-ink:#BE123C] [--nc-soft:rgba(225,29,72,0.10)] [--nc-on-acc:#FFFFFF]",
  "[--nc-bell:#FFFFFF] [--nc-ok:#15803D] [--nc-warn:#B45309] [--nc-info:#4F46E5] [--nc-shadow:rgba(60,20,34,0.22)]",
  "dark:[--nc-panel:#1C1619] dark:[--nc-raise:#241D20] dark:[--nc-ink:#F5EEF0] dark:[--nc-muted:#BBADB2] dark:[--nc-faint:#9F9196] dark:[--nc-line:#2F2629] dark:[--nc-line-strong:#3A3034]",
  "dark:[--nc-tint:#241D20] dark:[--nc-unread:#251A1E] dark:[--nc-acc:#FB7185] dark:[--nc-acc-ink:#FDA4AF] dark:[--nc-soft:rgba(251,113,133,0.13)] dark:[--nc-on-acc:#2A0710]",
  "dark:[--nc-bell:#1E181B] dark:[--nc-ok:#4ADE80] dark:[--nc-warn:#FBBF24] dark:[--nc-info:#A5B4FC] dark:[--nc-shadow:rgba(0,0,0,0.66)]",
].join(" ");

interface Placement { left: number; width: number; caret: number; sheet: boolean }

export function NotificationCenter({
  items: initialItems, now: nowIso, title, footer, open: openProp, defaultOpen = false, onOpenChange, defaultTab = "all", onTabChange,
  onRead, onDismiss, onAction, onFooter, boundaryRef, panelWidth = 400, maxListHeight = 430, labels, locale = "en-US", className, ref,
}: NotificationCenterProps) {
  const L = useMemo(() => ({ ...LABELS, ...labels }), [labels]);
  const uid = useId().replace(/:/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const now = useMemo(() => { const d = nowIso ? new Date(nowIso) : new Date(); return isNaN(+d) ? new Date() : d; }, [nowIso]);

  const [items, setItems] = useState<Item[]>(() => normalise(initialItems, now));
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = openProp ?? innerOpen;
  const [tab, setTabState] = useState<NotificationTab>(defaultTab);
  const [announce, setAnnounce] = useState("");
  const [ring, setRing] = useState(0);
  const [bump, setBump] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const markAllRef = useRef<HTMLButtonElement>(null);
  const openBtns = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const focusOnOpen = useRef(false);

  const unread = items.filter(i => !i.read).length;
  const visible = useMemo(() => items.filter(i => tab === "all" || i.type === tab).sort((a, b) => +b.d - +a.d), [items, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t, items.filter(i => !i.read && (t === "all" || i.type === t)).length])) as Record<NotificationTab, number>, [items]);

  const say = (t: string) => { setAnnounce(""); requestAnimationFrame(() => setAnnounce(t)); };
  const setOpen = useCallback((v: boolean) => {
    if (openProp === undefined) setInnerOpen(v);
    onOpenChange?.(v);
  }, [openProp, onOpenChange]);
  const show = useCallback((focus = true) => { focusOnOpen.current = focus; setOpen(true); }, [setOpen]);
  const hide = useCallback((returnFocus = true) => {
    const inside = !!rootRef.current?.contains(document.activeElement);
    setOpen(false);
    if (returnFocus || inside) bellRef.current?.focus();
  }, [setOpen]);
  const setTab = (t: NotificationTab) => { if (t !== tab) { setTabState(t); onTabChange?.(t); } };
  const tabEl = () => document.getElementById(`${uid}-tab-${tab}`);

  /* ---- relative times + groups ---- */
  const yesterday = useMemo(() => { const y = new Date(now); y.setDate(y.getDate() - 1); return y; }, [now]);
  const relative = (d: Date) => {
    const mins = Math.round((+now - +d) / 60000);
    if (mins < 1) return L.justNow;
    if (mins < 60) return fill(L.minAgo, { n: mins });
    if (mins < 24 * 60 && dayKey(now) === dayKey(d)) return fill(L.hAgo, { n: Math.floor(mins / 60) });
    if (dayKey(yesterday) === dayKey(d)) return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  };
  const groupOf = (d: Date) => (dayKey(d) === dayKey(now) ? L.today : dayKey(d) === dayKey(yesterday) ? L.yesterday : L.earlier);
  const groups: { label: string; items: Item[] }[] = [];
  for (const i of visible) {
    const g = groupOf(i.d), last = groups[groups.length - 1];
    if (last && last.label === g) last.items.push(i); else groups.push({ label: g, items: [i] });
  }

  /* ---- actions ---- */
  const markRead = (ids: string[], source: NotificationReadDetail["source"]) => {
    const changed = items.filter(i => ids.includes(i.id) && !i.read).map(i => i.id);
    if (!changed.length) return 0;
    setItems(list => list.map(i => (changed.includes(i.id) ? { ...i, read: true } : i)));
    setBump(b => b + 1);
    onRead?.({ ids: changed, source });
    return changed.length;
  };
  const markAll = () => {
    const ids = visible.filter(i => !i.read).map(i => i.id);
    if (!ids.length) return;
    const wasHere = document.activeElement === markAllRef.current;
    markRead(ids, "all");
    say(fill(L.readAll, { n: ids.length }));
    if (wasHere) tabEl()?.focus();
  };
  const dismiss = (id: string) => {
    const idx = visible.findIndex(i => i.id === id);
    const next = visible[idx + 1] ?? visible[idx - 1];
    pendingFocus.current = next ? next.id : "_tabs";
    setItems(list => list.filter(i => i.id !== id));
    say(L.dismissed);
    onDismiss?.(id);
  };
  const act = (i: Item) => {
    if (!i.action) return;
    setItems(list => list.map(x => (x.id === i.id ? { ...x, done: true } : x)));
    onAction?.({ id: i.id, action: i.action.label });
    pendingFocus.current = i.id;
    markRead([i.id], "action");
  };

  useImperativeHandle(ref, () => ({
    add: (item: NotificationItem) => {
      const [it] = normalise([{ time: now, read: false, ...item }], now);
      if (!it) return;
      setItems(list => [{ ...it, fresh: true }, ...list.map(x => (x.fresh ? { ...x, fresh: false } : x))]);
      say(fill(L.newItem, { text: plain(it) }));
      setRing(r => r + 1);
      setBump(b => b + 1);
    },
    reset: (list?: NotificationItem[]) => { setItems(normalise(list ?? initialItems, now)); setTabState(defaultTab); },
    show, hide,
    toggle: () => (open ? hide() : show()),
    get unread() { return unread; },
  }), [now, L, show, hide, open, unread, initialItems, defaultTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // move focus after a dismiss / action re-render
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const target = id === "_tabs" ? null : openBtns.current.get(id);
    (target ?? tabEl())?.focus();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- placement: stay inside the boundary, point the caret at the bell ---- */
  const measure = useCallback(() => {
    const root = rootRef.current, bell = bellRef.current;
    if (!root || !bell) return;
    const r = root.getBoundingClientRect(), b = bell.getBoundingClientRect();
    const bound = boundaryRef?.current?.getBoundingClientRect();
    const bl = bound ? bound.left : 0, br = bound ? bound.right : document.documentElement.clientWidth;
    const margin = bound ? 8 : 12;
    const avail = br - bl - margin * 2;
    const sheet = avail < panelWidth + 40;
    const width = sheet ? avail : Math.min(panelWidth, avail);
    let left = sheet ? bl + margin : b.right + 8 - width;
    left = Math.max(bl + margin, Math.min(left, br - margin - width));
    setPlace({ left: left - r.left, width, caret: Math.max(18, Math.min(width - 18, b.left + b.width / 2 - left)), sheet });
  }, [boundaryRef, panelWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const on = () => measure();
    window.addEventListener("resize", on);
    const ro = "ResizeObserver" in window ? new ResizeObserver(on) : null;
    if (ro && boundaryRef?.current) ro.observe(boundaryRef.current);
    return () => { window.removeEventListener("resize", on); ro?.disconnect(); };
  }, [open, measure, boundaryRef]);

  // focus the selected tab when opened by the user; close on outside pointer
  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) { focusOnOpen.current = false; requestAnimationFrame(() => tabEl()?.focus()); }
    const onDoc = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) hide(false); };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open, hide]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { e.preventDefault(); hide(true); } };

  const panelId = `${uid}-panel`;
  const emptyKey = (tab === "all" ? "All" : tab === "mention" ? "Mention" : "System") as "All" | "Mention" | "System";
  const p = place ?? { left: -(panelWidth - 50), width: panelWidth, caret: panelWidth - 28, sheet: false };

  return (
    <div ref={rootRef} onKeyDown={onKey} className={cx("relative inline-block font-sans leading-[1.4] text-[var(--nc-ink)]", NC_TOKENS, className)}>
      <button ref={bellRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        aria-label={unread ? fill(L.bellUnread, { n: unread }) : L.bell}
        onClick={() => (open ? hide() : show())}
        className={cx("relative grid size-[42px] place-items-center rounded-xl border shadow-[0_1px_2px_-1px_var(--nc-shadow)] transition-[background-color,border-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nc-acc)]",
          open ? "border-[color-mix(in_oklab,var(--nc-acc)_45%,var(--nc-line))] bg-[var(--nc-soft)] text-[var(--nc-acc-ink)]" : "border-[var(--nc-line-strong)] bg-[var(--nc-bell)] hover:border-[color-mix(in_oklab,var(--nc-acc)_40%,var(--nc-line))]")}>
        <motion.span key={ring} className="grid origin-[50%_8%] place-items-center"
          animate={ring && !reduced ? { rotate: [0, 14, -12, 8, -5, 2, 0] } : { rotate: 0 }} transition={{ duration: 0.7, ease: [0.36, 0.07, 0.19, 0.97] }}>
          <BellIcon />
        </motion.span>
        <AnimatePresence initial={false}>
          {unread > 0 && (
            <motion.span key="badge" aria-hidden initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--nc-acc)] px-[5px] text-[11px] font-bold leading-none tabular text-[var(--nc-on-acc)] shadow-[0_0_0_2.5px_var(--nc-bell)]">
              <motion.span key={bump} initial={bump && !reduced ? { scale: 1.3 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14 }}>
                {unread > 9 ? "9+" : unread}
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.section key="panel" id={panelId} role="dialog" aria-modal={false} aria-label={title || L.title}
            initial={preview ? false : { opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ left: p.left, width: p.width, transformOrigin: `${p.caret}px -10px` }}
            className={cx("@container absolute top-[calc(100%+12px)] z-40 border border-[var(--nc-line-strong)] bg-[var(--nc-panel)] text-left shadow-[0_30px_70px_-28px_var(--nc-shadow),0_8px_18px_-12px_var(--nc-shadow)]",
              p.sheet ? "rounded-2xl" : "rounded-[18px]")}>
            <span aria-hidden style={{ left: p.caret }}
              className="absolute -top-[7px] -ml-1.5 size-3 rotate-45 rounded-tl-[3px] border-l border-t border-[var(--nc-line-strong)] bg-[var(--nc-panel)]" />

            <header className="flex items-center justify-between gap-2.5 pb-2.5 pl-[18px] pr-4 pt-4 @max-sm:pl-3.5 @max-sm:pr-3">
              <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold leading-tight tracking-[-0.01em]">
                {title || L.title}
                {unread > 0 && <span aria-hidden className="rounded-full bg-[var(--nc-soft)] px-[7px] py-1 text-[11px] font-semibold leading-none tabular text-[var(--nc-acc-ink)]">{fill(L.fresh, { n: unread })}</span>}
              </h2>
              <button ref={markAllRef} type="button" onClick={markAll} disabled={!visible.some(i => !i.read)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-[7px] text-[12.5px] font-semibold leading-none text-[var(--nc-acc-ink)] transition-colors enabled:hover:bg-[var(--nc-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nc-acc)] disabled:text-[var(--nc-faint)] disabled:opacity-80">
                <ChecksIcon /><span className="@max-xs:sr-only">{L.markAll}</span>
              </button>
            </header>

            <Tabs<NotificationTab> id={uid} ariaLabel={L.tabs} value={tab} onChange={setTab}
              className="gap-0.5 border-[var(--nc-line)]! px-3 @max-sm:px-2"
              tabClassName="px-2! pb-3! pt-2.5! text-[13px]! font-semibold! text-[var(--nc-muted)] hover:text-[var(--nc-ink)] focus-visible:-outline-offset-2 focus-visible:outline-[var(--nc-acc)] rounded-t-md @max-sm:px-1.5! @max-sm:text-[12.5px]!"
              activeClassName="text-[var(--nc-ink)]!"
              indicatorClassName="bg-[var(--nc-acc)]! inset-x-1.5!"
              items={TABS.map(t => ({
                value: t,
                label: (
                  <>
                    {L[t]}
                    {counts[t] > 0 && (
                      <span className={cx("inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-[5px] text-[10.5px] font-semibold leading-none tabular transition-colors @max-xs:hidden",
                        t === tab ? "bg-[var(--nc-acc)] text-[var(--nc-on-acc)]" : "bg-[var(--nc-tint)] text-[var(--nc-muted)]")}>
                        <span className="sr-only">, </span>{counts[t]}<span className="sr-only"> {L.unread.toLowerCase()}</span>
                      </span>
                    )}
                  </>
                ),
              }))} />

            <div {...tabPanelProps(uid, tab)} style={{ maxHeight: maxListHeight }}
              className="overflow-y-auto overscroll-contain pb-2 pt-1 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--nc-acc)]">
              {groups.length === 0 ? (
                <motion.div key={`empty-${tab}`} initial={preview ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                  className="grid justify-items-center gap-1.5 px-6 pb-[30px] pt-[34px] text-center">
                  <EmptyArt />
                  <b className="font-display text-[15px] font-semibold leading-[1.3]">{L[`empty${emptyKey}` as const]}</b>
                  <span className="max-w-[28ch] text-[13px] text-[var(--nc-muted)]">{L[`empty${emptyKey}Sub` as const]}</span>
                </motion.div>
              ) : groups.map((g, gi) => (
                <div key={g.label}>
                  <h3 id={`${uid}-g-${gi}`} className="px-[18px] pb-1.5 pt-3 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--nc-faint)] @max-sm:px-3.5">{g.label}</h3>
                  <ul aria-labelledby={`${uid}-g-${gi}`} className="grid px-2 @max-sm:px-1.5">
                    <AnimatePresence initial={false}>
                      {g.items.map(i => (
                        <motion.li key={i.id} className="overflow-hidden"
                          initial={i.fresh && !preview ? { opacity: 0, height: 0, y: -8 } : false}
                          animate={{ opacity: 1, height: "auto", y: 0, x: 0 }}
                          exit={{ opacity: 0, height: 0, x: 24, transition: { duration: reduced ? 0 : 0.32, ease: [0.2, 0.7, 0.2, 1], opacity: { duration: 0.15 } } }}
                          transition={{ duration: reduced ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}>
                          <Row item={i} L={L} rel={relative(i.d)}
                            setRef={el => { if (el) openBtns.current.set(i.id, el); else openBtns.current.delete(i.id); }}
                            onOpen={() => markRead([i.id], "click")} onDismiss={() => dismiss(i.id)} onAction={() => act(i)} />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>

            <footer className="flex items-center justify-between gap-2.5 border-t border-[var(--nc-line)] pb-3 pl-[18px] pr-4 pt-2.5 text-[12px] text-[var(--nc-faint)] @max-sm:pl-3.5 @max-sm:pr-3">
              {footer?.label ? (
                footer.href
                  ? <a href={footer.href} className="inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-[12.5px] font-semibold leading-none text-[var(--nc-ink)] hover:text-[var(--nc-acc-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nc-acc)]"><GearIcon />{footer.label}</a>
                  : <button type="button" onClick={onFooter} className="inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-[12.5px] font-semibold leading-none text-[var(--nc-ink)] hover:text-[var(--nc-acc-ink)] focus-visible:outline-2 focus-visible:outline-[var(--nc-acc)]"><GearIcon />{footer.label}</button>
              ) : <span />}
              <span className="tabular">{fill(L.total, { n: items.length })}</span>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}

/* ---------- one notification row ---------- */
function Row({ item: i, L, rel, setRef, onOpen, onDismiss, onAction }: {
  item: Item; L: NotificationLabels; rel: string; setRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void; onDismiss: () => void; onAction: () => void;
}) {
  const unread = !i.read;
  const sys = i.type === "system" ? SYS[i.icon ?? "report"] ?? SYS.report : null;
  const hue = sys ? sys.hue : hueFor(i.actor ?? "");
  const fullTime = i.d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className={cx("group/row relative my-px grid grid-cols-[38px_minmax(0,1fr)_26px] items-start gap-3 rounded-xl p-2.5 transition-colors duration-300 @max-sm:grid-cols-[32px_minmax(0,1fr)_24px] @max-sm:gap-2.5 @max-sm:px-2 @max-sm:py-[9px] @max-xs:grid-cols-[minmax(0,1fr)_24px]",
      unread ? "bg-[var(--nc-unread)] hover:bg-[color-mix(in_oklab,var(--nc-unread),var(--nc-acc)_5%)]" : "hover:bg-[var(--nc-tint)]")}>
      <span aria-hidden style={{ ["--hue" as string]: hue }}
        className={cx("relative grid size-[38px] place-items-center text-[12.5px] font-semibold tracking-[0.02em] text-[var(--nc-ink)] @max-sm:size-8 @max-sm:text-[11px] @max-xs:hidden",
          "bg-[color-mix(in_oklab,var(--hue)_16%,var(--nc-panel))] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--hue)_28%,transparent)]",
          sys ? "rounded-[11px] text-[var(--hue)]" : "rounded-full")}>
        {sys ? sys.icon : initials(i.actor)}
        {!sys && (
          <span className="absolute -bottom-1 -right-[5px] grid size-4 place-items-center rounded-full bg-[var(--nc-acc)] text-[var(--nc-on-acc)] shadow-[0_0_0_2px_var(--nc-panel)]"><AtIcon /></span>
        )}
      </span>

      <div className="grid min-w-0 gap-1">
        <button ref={setRef} type="button" onClick={onOpen}
          aria-label={`${unread ? `${L.unread}: ` : ""}${plain(i)} ${rel}`}
          className={cx("p-0 text-left text-[13.5px] leading-[1.42] [overflow-wrap:anywhere] focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[var(--nc-acc)] @max-sm:text-[13px]",
            unread ? "text-[var(--nc-ink)]" : "text-[var(--nc-muted)]")}>
          {i.type === "system"
            ? <b className={cx("text-[var(--nc-ink)]", unread ? "font-semibold" : "font-medium")}>{i.title}</b>
            : <><b className={cx("text-[var(--nc-ink)]", unread ? "font-semibold" : "font-medium")}>{i.actor}</b> {i.text} {i.target && <b className={cx("text-[var(--nc-ink)]", unread ? "font-semibold" : "font-medium")}>{i.target}</b>}</>}
        </button>
        {i.body && <span className="text-[13px] leading-[1.45] text-[var(--nc-muted)] [overflow-wrap:anywhere]">{i.body}</span>}
        <span aria-hidden className="flex flex-wrap items-center gap-1.5 text-[12px] tabular text-[var(--nc-faint)]">
          <time dateTime={i.d.toISOString()} title={fullTime}>{rel}</time>
          <span>·</span>
          <span>{i.type === "system" ? L.system : L.mention}</span>
        </span>
        {i.action?.label && (
          <button type="button" onClick={onAction} disabled={i.done}
            className={cx("relative z-[1] mt-1 justify-self-start rounded-lg border px-[11px] py-1.5 text-[12px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nc-acc)]",
              i.done
                ? "cursor-default border-[color-mix(in_oklab,var(--nc-ok)_40%,var(--nc-line))] bg-transparent text-[var(--nc-ok)]"
                : "border-[color-mix(in_oklab,var(--nc-acc)_40%,var(--nc-line))] bg-[var(--nc-raise)] text-[var(--nc-acc-ink)] hover:border-[var(--nc-acc)] hover:bg-[var(--nc-acc)] hover:text-[var(--nc-on-acc)]")}>
            {i.done ? <span className="inline-flex items-center gap-1"><svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>{i.action.done || i.action.label}</span> : i.action.label}
          </button>
        )}
      </div>

      <div className="relative grid h-full justify-items-center gap-2 pt-0.5">
        <button type="button" onClick={onDismiss}
          aria-label={`${L.dismiss}: ${i.type === "system" ? i.title ?? "" : `${i.actor ?? ""} ${i.text ?? ""} ${i.target ?? ""}`}`.trim()}
          className="relative z-[1] grid size-[26px] place-items-center rounded-lg text-[var(--nc-faint)] opacity-0 transition-[opacity,background-color,color] duration-200 hover:bg-[var(--nc-panel)] hover:text-[var(--nc-ink)] hover:shadow-[0_0_0_1px_var(--nc-line-strong)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--nc-acc)] group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100 @max-sm:size-6 @max-sm:opacity-100">
          <XIcon />
        </button>
        <span aria-hidden className={cx("mt-[5px] size-2 rounded-full bg-[var(--nc-acc)] shadow-[0_0_0_3px_var(--nc-soft)] transition-[scale,opacity] duration-300", unread ? "scale-100 opacity-100" : "scale-0 opacity-0")} />
      </div>
    </div>
  );
}
