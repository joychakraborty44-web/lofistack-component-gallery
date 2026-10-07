import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useClipboard, useCountUp, useInView, usePreviewMode } from "../../lib/hooks";
import { Tabs, cx, tabPanelProps } from "../../ui";
import { DEFAULT_STAGES, type ClientContact, type ClientData, type ClientNote, type ClientTab, type HealthStatus } from "./data";

/* ------------------------------------------------------------
   Client Overview Card — warm stone, navy and sage CRM profile.
   ------------------------------------------------------------ */

export interface ClientOverviewCardProps {
  data: ClientData;
  /** Controlled tab. Leave out to let the card manage it. */
  tab?: ClientTab;
  defaultTab?: ClientTab;
  onTabChange?: (tab: ClientTab) => void;
  /** Controlled favourite flag. */
  favourite?: boolean;
  defaultFavourite?: boolean;
  onFavouriteChange?: (favourite: boolean, company: string) => void;
  /** Overrides `data.health.status`. */
  health?: HealthStatus;
  /** Fires after a note is added (notes live in memory — persist them from here). */
  onNoteAdd?: (detail: { note: ClientNote; count: number; company: string }) => void;
  /** Fires after an email is copied to the clipboard. */
  onEmailCopy?: (contact: { name: string; email: string }) => void;
  className?: string;
}

/* palette: light + dark values on the root, used through var() */
const PALETTE = cx(
  "[--cov-card:#fffefb] [--cov-band:#f2eee7] [--cov-ink:#18233a] [--cov-muted:#535a68] [--cov-faint:#5f6572]",
  "[--cov-line:#e6e1d8] [--cov-tint:#f6f3ee] [--cov-navy:#1f2d4d] [--cov-navy-2:#33466f] [--cov-navy-ink:#f6f1e7]",
  "[--cov-accent:#4d7c5b] [--cov-accent-strong:#3b6648] [--cov-accent-soft:#e3ece4]",
  "[--cov-warn:#8a5100] [--cov-warn-soft:#f7ebd6] [--cov-bad:#b42318] [--cov-bad-soft:#f9e1de] [--cov-star:#b7791f]",
  "dark:[--cov-card:#17191d] dark:[--cov-band:#1d2025] dark:[--cov-ink:#ece8e1] dark:[--cov-muted:#b0ada5] dark:[--cov-faint:#97948c]",
  "dark:[--cov-line:#2c2f35] dark:[--cov-tint:#1c1f24] dark:[--cov-navy:#2c3d63] dark:[--cov-navy-2:#3e5383] dark:[--cov-navy-ink:#f1ece2]",
  "dark:[--cov-accent:#8fc29e] dark:[--cov-accent-strong:#a6d3b3] dark:[--cov-accent-soft:rgb(143_194_158/0.14)]",
  "dark:[--cov-warn:#e8b65a] dark:[--cov-warn-soft:rgb(232_182_90/0.14)] dark:[--cov-bad:#f59484] dark:[--cov-bad-soft:rgb(245_148_132/0.14)] dark:[--cov-star:#f2c14e]",
);

const TONE: Record<HealthStatus, { label: string; text: string; soft: string; bar: string }> = {
  healthy: { label: "Healthy", text: "text-[var(--cov-accent-strong)]", soft: "bg-[var(--cov-accent-soft)]", bar: "bg-[var(--cov-accent)]" },
  "at-risk": { label: "At risk", text: "text-[var(--cov-warn)]", soft: "bg-[var(--cov-warn-soft)]", bar: "bg-[var(--cov-warn)]" },
  critical: { label: "Critical", text: "text-[var(--cov-bad)]", soft: "bg-[var(--cov-bad-soft)]", bar: "bg-[var(--cov-bad)]" },
};

/* ---------------- helpers ---------------- */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Parts = { y: number; m: number; d: number; hh?: number; mm?: number };
function parse(iso?: string): Parts | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? "");
  if (!r) return null;
  return { y: +r[1], m: +r[2] - 1, d: +r[3], hh: r[4] ? +r[4] : undefined, mm: r[5] ? +r[5] : undefined };
}
const dayNum = (p: Parts) => Date.UTC(p.y, p.m, p.d) / 864e5;
const pad = (n: number) => String(n).padStart(2, "0");
function fmtDay(p: Parts | null, withTime = false) {
  if (!p) return "";
  const base = `${p.d} ${MON[p.m]} ${p.y}`;
  return withTime && p.hh !== undefined ? `${base}, ${pad(p.hh)}:${pad(p.mm ?? 0)}` : base;
}
function todayIso(withTime = false) {
  const n = new Date();
  const d = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  return withTime ? `${d}T${pad(n.getHours())}:${pad(n.getMinutes())}` : d;
}
export function initialsOf(name?: string) {
  return (name ?? "").replace(/&/g, " ").split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
}
function useMoney(currency = "USD", locale = "en-GB") {
  return useMemo(() => {
    let f: Intl.NumberFormat | null = null;
    try { f = new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }); } catch { f = null; }
    return (v: number) => (f ? f.format(v) : `$${Math.round(v).toLocaleString()}`);
  }, [currency, locale]);
}
function relativeDays(days: number, locale: string) {
  let s: string;
  try { s = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day"); } catch { s = `${Math.abs(days)} days ago`; }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(initial);
  const v = value !== undefined ? value : inner;
  const set = useCallback((n: T) => { if (value === undefined) setInner(n); onChange?.(n); }, [value, onChange]);
  return [v, set];
}

/* ---------------- icons ---------------- */
function Glyph({ d, className = "size-3.5", stroke = 1.6 }: { d: ReactNode; className?: string; stroke?: number }) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>{d}</svg>;
}
const G = {
  pin: <><path d="M8 14.5s4.5-4.2 4.5-7.7a4.5 4.5 0 0 0-9 0c0 3.5 4.5 7.7 4.5 7.7z" /><circle cx="8" cy="6.8" r="1.6" /></>,
  tag: <><path d="M2.5 3.5h5l6 6-4 4-6-6z" /><circle cx="5.5" cy="6" r="1" /></>,
  ok: <><circle cx="8" cy="8" r="6.2" /><path d="M5.3 8.2 7.2 10l3.5-3.8" /></>,
  warn: <><path d="M8 2.2 14.3 13H1.7z" /><path d="M8 6.6v2.9M8 11.4v.1" /></>,
  bad: <><circle cx="8" cy="8" r="6.2" /><path d="M8 4.8v3.8M8 11v.1" /></>,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.8" /><path d="M10.5 5.5V3.8a1.3 1.3 0 0 0-1.3-1.3H3.8a1.3 1.3 0 0 0-1.3 1.3v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7" /></>,
  check: <path d="M3.5 8.4 6.6 11.3 12.5 4.9" />,
  plus: <path d="M8 3v10M3 8h10" />,
  up: <path d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7" />,
  down: <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />,
  phone: <path d="M5.2 2.5H3.6a1.1 1.1 0 0 0-1.1 1.2c.5 5.2 4.6 9.3 9.8 9.8a1.1 1.1 0 0 0 1.2-1.1v-1.6l-2.6-1-1.3 1.3a7 7 0 0 1-3.6-3.6l1.3-1.3z" />,
  calendar: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
};
const HEALTH_ICON: Record<HealthStatus, ReactNode> = { healthy: G.ok, "at-risk": G.warn, critical: G.bad };

/* Animates its own height to fit the content (tab panels of different heights). */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || !("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div className="overflow-hidden" initial={false} animate={{ height: h }} transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

const smallCaps = "[font-variant-caps:all-small-caps] tracking-[0.07em] font-semibold";

/* ============================================================ */
export function ClientOverviewCard({
  data, tab: tabProp, defaultTab = "overview", onTabChange, favourite: favProp, defaultFavourite = false, onFavouriteChange,
  health: healthProp, onNoteAdd, onEmailCopy, className,
}: ClientOverviewCardProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const locale = data.locale ?? "en-GB";
  const money = useMoney(data.currency, locale);

  const [tab, setTab] = useControllable<ClientTab>(tabProp, defaultTab, onTabChange);
  const favChange = useCallback((v: boolean) => onFavouriteChange?.(v, data.company), [onFavouriteChange, data.company]);
  const [fav, setFav] = useControllable<boolean>(favProp, defaultFavourite, favChange);

  type Note = ClientNote & { id: string; isNew?: boolean };
  const [notes, setNotes] = useState<Note[]>(() => (data.notes ?? []).filter(n => n?.text).map((n, i) => ({ ...n, id: `n${i}` })));
  const [draft, setDraft] = useState("");
  const [announce, setAnnounce] = useState("");
  const newCount = useRef(0);

  const status: HealthStatus = healthProp ?? data.health?.status ?? "healthy";
  const tone = TONE[status];
  const score = data.health?.score;

  /* ---- derived stats ---- */
  const asOf = parse(data.asOf) ?? parse(todayIso())!;
  const mrr = data.mrr;
  const delta = mrr != null && data.mrrPrevious && data.mrrPrevious > 0 ? Math.round(((mrr - data.mrrPrevious) / data.mrrPrevious) * 1000) / 10 : null;
  const since = parse(data.clientSince);
  let tenure = "";
  if (since) {
    let months = (asOf.y - since.y) * 12 + (asOf.m - since.m);
    if (asOf.d < since.d) months--;
    months = Math.max(0, months);
    const y = Math.floor(months / 12), m = months % 12;
    tenure = [y ? `${y} yr` : "", m || !y ? `${m} mo` : ""].filter(Boolean).join(" ");
  }
  const opps = (data.opportunities ?? []).filter(Boolean);
  const stages = data.stages?.length ? data.stages : DEFAULT_STAGES;
  const pipeline = opps.reduce((a, o) => a + (Number.isFinite(o.value) ? o.value : 0), 0);
  const la = parse(data.lastActivity?.date);
  const lastRel = la ? relativeDays(dayNum(la) - dayNum(asOf), locale) : "—";
  const contacts = (data.contacts ?? []).filter(Boolean);

  const mrrShown = useCountUp(mrr ?? 0, { start: inView, duration: 1000 });

  /* ---- notes ---- */
  const addNote = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const note: Note = { author: data.noteAuthor ?? "You", date: todayIso(true), text: t, id: `new${++newCount.current}`, isNew: true };
    const next = [note, ...notes];
    setNotes(next);
    setAnnounce("Note added");
    onNoteAdd?.({ note: { author: note.author, date: note.date, text: note.text }, count: next.length, company: data.company });
  };
  const textRef = useRef<HTMLTextAreaElement>(null);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    addNote(draft);
    setDraft("");
    textRef.current?.focus();
  };
  const onTextKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
  };

  const tabs = [
    { value: "overview" as const, label: "Overview" },
    { value: "contacts" as const, label: <>Contacts<Count n={contacts.length} /></> },
    { value: "notes" as const, label: <>Notes<Count n={notes.length} /></> },
  ];

  const stagger = (i: number) => (preview ? { initial: false as const } : {
    initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const, delay: 0.04 * i },
  });

  return (
    <article ref={rootRef} aria-label={`Client: ${data.company}`}
      className={cx("@container relative w-full max-w-[960px] font-sans text-[var(--cov-ink)]", PALETTE, className)}>
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--cov-line)] bg-[var(--cov-card)] elev-3 @max-md:rounded-2xl">

        {/* ===== header band ===== */}
        <header className="grain relative grid gap-x-6 gap-y-4 border-b border-[var(--cov-line)] px-4 pt-5 pb-4 @md:px-6 @md:pt-6 @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:px-8 @2xl:pt-7 @2xl:pb-6
          bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_oklab,var(--cov-accent)_12%,transparent),transparent_55%),repeating-linear-gradient(135deg,transparent_0_11px,color-mix(in_oklab,var(--cov-line)_60%,transparent)_11px_12px),linear-gradient(var(--cov-band),var(--cov-band))]">
          <div className="flex min-w-0 items-start gap-3.5 @md:items-center @md:gap-[18px]">
            <span aria-hidden
              className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(150deg,var(--cov-navy-2),var(--cov-navy))] font-display text-[18px] font-semibold tracking-[0.02em] text-[var(--cov-navy-ink)] shadow-[0_0_0_4px_var(--cov-card),0_14px_26px_-14px_rgb(20_28_48/0.55)] @md:size-16 @md:rounded-2xl @md:text-[22px]">
              {data.initials || initialsOf(data.company)}
            </span>
            <div className="grid min-w-0 gap-1.5">
              <p className={cx("m-0 text-[13px] leading-none text-[var(--cov-accent-strong)]", smallCaps)}>{["Client", data.plan].filter(Boolean).join(" · ")}</p>
              <h2 className="m-0 font-display text-[22px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance [overflow-wrap:anywhere] @md:text-[26px] @2xl:text-[30px]">{data.company}</h2>
              {(data.industry || data.location) && (
                <p className="m-0 flex flex-wrap gap-x-3.5 gap-y-1 text-[13.5px] text-[var(--cov-muted)]">
                  {data.industry && <span className="inline-flex items-center gap-1.5"><Glyph d={G.tag} className="size-[13px] text-[var(--cov-faint)]" />{data.industry}</span>}
                  {data.location && <span className="inline-flex items-center gap-1.5"><Glyph d={G.pin} className="size-[13px] text-[var(--cov-faint)]" />{data.location}</span>}
                </p>
              )}
            </div>
          </div>

          {data.owner?.name && (
            <div className="flex items-center gap-2.5 text-[13px] text-[var(--cov-muted)] @2xl:col-start-1 @2xl:pl-[82px]">
              <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--cov-accent-soft)] text-[10.5px] font-bold text-[var(--cov-accent-strong)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cov-accent)_35%,transparent)]">{initialsOf(data.owner.name)}</span>
              <span>{data.owner.role || "Account owner"} · <b className="font-semibold text-[var(--cov-ink)]">{data.owner.name}</b></span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 @2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @2xl:flex-col @2xl:items-end @2xl:justify-between">
            <motion.span layout="position"
              className={cx("inline-flex items-center gap-2 rounded-full py-[7px] pr-3 pl-2.5 text-[12.5px] font-semibold tabular leading-none transition-colors duration-300 shadow-[inset_0_0_0_1px_color-mix(in_oklab,currentColor_28%,transparent)]", tone.text, tone.soft)}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={status} initial={{ scale: 0.5, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 28 }} className="grid">
                  <Glyph d={HEALTH_ICON[status]} className="size-[13px]" stroke={1.8} />
                </motion.span>
              </AnimatePresence>
              <span className="sr-only">Health: </span>{tone.label}
              {score != null && <span className="font-medium opacity-85">· {Math.round(score)}<span className="sr-only"> out of 100</span></span>}
            </motion.span>
            <button type="button" aria-pressed={fav} aria-label={fav ? "Remove favourite" : "Mark as favourite"}
              onClick={() => setFav(!fav)}
              className={cx("inline-flex items-center gap-2 rounded-[10px] border py-2 pr-3 pl-2.5 text-[12.5px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cov-accent)] active:scale-[0.98]",
                fav ? "border-[color-mix(in_oklab,var(--cov-star)_45%,var(--cov-line))] bg-[color-mix(in_oklab,var(--cov-star)_10%,var(--cov-card))] text-[var(--cov-ink)]"
                  : "border-[var(--cov-line)] bg-[var(--cov-card)] text-[var(--cov-muted)] hover:border-[color-mix(in_oklab,var(--cov-faint)_60%,var(--cov-line))] hover:text-[var(--cov-ink)]")}>
              <motion.svg viewBox="0 0 20 20" aria-hidden className={cx("size-4 shrink-0", fav && "text-[var(--cov-star)]")}
                initial={false} animate={fav ? { scale: [1, 1.34, 1], rotate: [0, -12, 0] } : { scale: 1, rotate: 0 }} transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}>
                <path d="M10 2.4l2.35 4.76 5.25.77-3.8 3.7.9 5.23L10 14.4l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"
                  className={cx("transition-[fill] duration-200", fav ? "fill-current" : "fill-transparent")} />
              </motion.svg>
              Favourite
            </button>
          </div>
        </header>

        {/* ===== stats ===== */}
        <dl className="m-0 grid grid-cols-2 border-b border-[var(--cov-line)] @3xl:grid-cols-4">
          <Stat label="Monthly revenue" className="@max-3xl:border-b @3xl:pl-8"
            value={mrr == null ? "—" : money(mrrShown)}
            sub={delta != null && (
              <>
                <span className={cx("inline-flex items-center gap-0.5 font-semibold", delta > 0 ? "text-[var(--cov-accent-strong)]" : delta < 0 ? "text-[var(--cov-bad)]" : "text-[var(--cov-muted)]")}>
                  {delta !== 0 && <Glyph d={delta > 0 ? G.up : G.down} className="size-3" stroke={2} />}
                  <span className="sr-only">{delta > 0 ? "Up" : delta < 0 ? "Down" : "Flat"} </span>{Math.abs(delta).toFixed(1)}%
                </span>
                {data.mrrCompareLabel && <span>vs {data.mrrCompareLabel}</span>}
              </>
            )} />
          <Stat label="Client since" className="border-l @max-3xl:border-b" value={since ? `${MON[since.m]} ${since.y}` : "—"} sub={tenure} />
          <Stat label="Open opportunities" className="@3xl:border-l" value={String(opps.length)} sub={opps.length ? `${money(pipeline)} pipeline` : "None open"} />
          <Stat label="Last activity" className="border-l" value={lastRel} sub={data.lastActivity?.summary} />
        </dl>

        {/* ===== tabs ===== */}
        <div className="relative border-b border-[var(--cov-line)] px-1.5 @md:px-4 @2xl:px-6">
          <Tabs id={uid} value={tab} onChange={setTab} items={tabs} ariaLabel="Client details"
            className="border-b-0! gap-0 overflow-x-auto [scrollbar-width:none] @md:gap-1"
            tabClassName="group flex-1 justify-center rounded-t-lg px-3! pt-[15px]! pb-[14px]! text-[14px]! font-semibold! hover:bg-[color-mix(in_oklab,var(--cov-tint)_80%,transparent)] focus-visible:outline-offset-[-4px]! focus-visible:outline-[var(--cov-accent)]! @md:flex-none"
            activeClassName="text-[var(--cov-ink)]!"
            indicatorClassName="bg-[var(--cov-accent)]! h-[2px]! inset-x-2!" />
        </div>

        {/* ===== panels ===== */}
        <AutoHeight>
          <motion.section key={tab} {...tabPanelProps(uid, tab)}
            initial={preview ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="px-4 pt-[18px] pb-5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--cov-accent)] @md:px-6 @md:pt-6 @md:pb-6 @2xl:px-8 @2xl:pb-7">

            {tab === "overview" && (
              <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @3xl:gap-7">
                <div>
                  <H3 aside={`${opps.length} open`}>Open opportunities</H3>
                  {opps.length === 0 ? <Empty>No open opportunities.</Empty> : (
                    <>
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {opps.map((o, i) => {
                          const si = Math.max(0, stages.findIndex(s => s.toLowerCase() === (o.stage ?? "").toLowerCase()));
                          return (
                            <motion.li key={`${o.name}-${i}`} {...stagger(i)}
                              className="group/opp grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 rounded-xl border border-[var(--cov-line)] bg-[var(--cov-card)] px-3.5 py-[13px] transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--cov-accent)_40%,var(--cov-line))] hover:shadow-[0_12px_22px_-18px_rgb(32_36_48/0.45)] motion-reduce:hover:translate-y-0">
                              <span className="text-[14px] leading-[1.3] font-semibold [overflow-wrap:anywhere]">{o.name || "Untitled"}</span>
                              <span className="text-right font-display text-[15px] leading-none font-semibold tabular">{Number.isFinite(o.value) ? money(o.value) : "—"}</span>
                              <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[12.5px] text-[var(--cov-muted)] tabular">
                                <span className="inline-flex items-center gap-2">
                                  <span aria-hidden className="inline-flex gap-[3px]">
                                    {stages.map((s, k) => (
                                      <motion.i key={s} className={cx("block h-1 w-4 origin-left rounded-[2px]", k <= si ? "bg-[var(--cov-accent)]" : "bg-[var(--cov-line)]")}
                                        initial={preview || k > si ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + 0.04 * i + 0.07 * k, duration: 0.35 }} />
                                    ))}
                                  </span>
                                  <span>{o.stage || stages[si]}</span>
                                  <span className="sr-only">, stage {si + 1} of {stages.length}</span>
                                </span>
                                {parse(o.close) && <span className="inline-flex items-center gap-1.5"><Glyph d={G.calendar} className="size-3 text-[var(--cov-faint)]" />closes {fmtDay(parse(o.close))}</span>}
                              </div>
                            </motion.li>
                          );
                        })}
                      </ul>
                      <div className="mt-3 flex justify-between gap-2.5 border-t border-dashed border-[var(--cov-line)] pt-3 text-[13px] text-[var(--cov-muted)] tabular">
                        <span>{opps.length} open</span>
                        <b className="font-semibold text-[var(--cov-ink)]">{money(pipeline)} pipeline</b>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <H3>Account</H3>
                  <dl className="m-0 grid">
                    {([
                      ["Plan", data.plan],
                      ["Renewal", fmtDay(parse(data.renewal))],
                      ["Billing", data.billing],
                      ["Website", data.website],
                    ] as const).filter(([, v]) => v).map(([k, v], i) => (
                      <Fact key={k} k={k} first={i === 0}>{v}</Fact>
                    ))}
                    {!!data.services?.length && (
                      <Fact k="Services">
                        <span className="flex flex-wrap gap-1.5">
                          {data.services.map(s => <span key={s} className="rounded-[7px] bg-[var(--cov-tint)] px-[9px] py-[5px] text-[12.5px] leading-none text-[var(--cov-ink)] shadow-[inset_0_0_0_1px_var(--cov-line)]">{s}</span>)}
                        </span>
                      </Fact>
                    )}
                  </dl>
                  {(data.health?.note || score != null) && (
                    <motion.div layout="position" className={cx("relative mt-4 overflow-hidden rounded-[10px] py-3 pr-3.5 pl-4 text-[13px] leading-normal transition-colors duration-300", tone.soft)}>
                      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[3px] transition-colors duration-300", tone.bar)} />
                      {score != null && (
                        <div className="mb-2 flex items-center gap-2.5">
                          <span className={cx("text-[12px] leading-none", smallCaps, tone.text)}>Health score</span>
                          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--cov-ink)_8%,transparent)]">
                            <motion.span className={cx("block h-full origin-left rounded-full transition-colors duration-300", tone.bar)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                              initial={preview ? false : { scaleX: 0 }} animate={{ scaleX: inView ? 1 : 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
                          </span>
                          <span className="text-[12.5px] font-semibold tabular leading-none">{Math.round(score)}<span className="font-normal text-[var(--cov-muted)]"> / 100</span></span>
                        </div>
                      )}
                      {data.health?.note && <p className="m-0 text-[var(--cov-ink)]">{data.health.note}</p>}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {tab === "contacts" && (contacts.length === 0 ? <Empty>No contacts yet.</Empty> : (
              <ul className="m-0 grid list-none gap-2.5 p-0 @2xl:grid-cols-2">
                {contacts.map((c, i) => (
                  <motion.li key={`${c.email ?? c.name}-${i}`} {...stagger(i)}>
                    <ContactRow c={c} onCopied={(ok) => {
                      setAnnounce(ok ? `Email for ${c.name || c.email} copied` : "Press Ctrl+C to copy");
                      if (ok && c.email) onEmailCopy?.({ name: c.name, email: c.email });
                    }} />
                  </motion.li>
                ))}
              </ul>
            ))}

            {tab === "notes" && (
              <>
                <form onSubmit={submit} className="grid gap-2.5 rounded-[14px] border border-[var(--cov-line)] bg-[var(--cov-tint)] p-3.5">
                  <label htmlFor={`${uid}-note`} className={cx("text-[13.5px] leading-none text-[var(--cov-faint)]", smallCaps)}>Add a note</label>
                  <textarea ref={textRef} id={`${uid}-note`} rows={3} maxLength={1000} value={draft} placeholder="What happened, what's next…"
                    onChange={e => setDraft(e.target.value)} onKeyDown={onTextKey}
                    className="box-border max-h-60 min-h-[76px] w-full resize-none rounded-[10px] border border-[var(--cov-line)] bg-[var(--cov-card)] px-[13px] py-[11px] text-[14px] leading-normal text-[var(--cov-ink)] transition-[border-color,box-shadow] duration-200 [field-sizing:content] placeholder:text-[var(--cov-faint)] focus:border-[var(--cov-accent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--cov-accent)_22%,transparent)] focus:outline-none" />
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-[12.5px] text-[var(--cov-muted)]">
                      <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to add
                      {draft.length > 800 && <span className="ml-2 tabular">· {draft.length} / 1000</span>}
                    </span>
                    <button type="submit" disabled={!draft.trim()}
                      className="inline-flex items-center gap-[7px] rounded-[10px] bg-[var(--cov-navy)] px-[15px] py-2.5 text-[13px] leading-none font-semibold text-[var(--cov-navy-ink)] transition-[background-color,opacity,scale] duration-200 hover:enabled:bg-[color-mix(in_oklab,var(--cov-navy),#000_18%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cov-accent)] active:enabled:scale-[0.98] disabled:opacity-45 dark:hover:enabled:bg-[color-mix(in_oklab,var(--cov-navy),#fff_10%)]">
                      <Glyph d={G.plus} className="size-[13px]" stroke={2} />Add note
                    </button>
                  </div>
                </form>
                <ol aria-label="Notes" className="m-0 mt-[18px] grid list-none p-0">
                  {notes.length === 0 && <li><Empty>No notes yet. Add the first one above.</Empty></li>}
                  <AnimatePresence initial={false}>
                    {notes.map((n, i) => {
                      const p = parse(n.date);
                      const time = p ? (n.isNew ? `Just now · ${fmtDay(p, true)}` : fmtDay(p, p.hh !== undefined)) : "";
                      return (
                        <motion.li key={n.id} layout="position"
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className={cx("overflow-hidden", i > 0 && "border-t border-[var(--cov-line)]")}>
                          <div className="relative isolate grid grid-cols-[30px_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-2 py-3.5">
                            {n.isNew && !preview && (
                              <motion.span aria-hidden className="absolute inset-x-0 inset-y-1 -z-10 rounded-lg bg-[var(--cov-accent-soft)]"
                                initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6, ease: "easeOut", delay: 0.35 }} />
                            )}
                            <span aria-hidden className={cx("row-span-2 grid size-[30px] place-items-center rounded-full text-[10.5px] font-bold",
                              n.isNew ? "bg-[var(--cov-navy)] text-[var(--cov-navy-ink)]" : "bg-[var(--cov-accent-soft)] text-[var(--cov-accent-strong)]")}>{initialsOf(n.author)}</span>
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[13px]">
                              <b className="font-semibold">{n.author || "You"}</b>
                              {p && <time dateTime={n.date} className="text-[12.5px] text-[var(--cov-muted)] tabular">{time}</time>}
                            </div>
                            <p className="m-0 mt-1 text-[14px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]">{n.text}</p>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
              </>
            )}
          </motion.section>
        </AutoHeight>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </article>
  );
}

/* ---------------- pieces ---------------- */
function Count({ n }: { n: number }) {
  return (
    <span className="min-w-5 rounded-full bg-[var(--cov-tint)] px-1.5 py-[3px] text-center text-[11px] leading-none font-semibold tabular text-[var(--cov-muted)] shadow-[inset_0_0_0_1px_var(--cov-line)] transition-colors duration-200 group-aria-selected:bg-[var(--cov-accent-soft)] group-aria-selected:text-[var(--cov-accent-strong)] group-aria-selected:shadow-none">
      {n}
    </span>
  );
}

function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("grid min-w-0 content-start gap-1.5 border-[var(--cov-line)] px-4 py-3.5 @md:px-[22px] @md:py-4 @3xl:py-[18px]", className)}>
      <dt className={cx("text-[13px] leading-none text-[var(--cov-faint)]", smallCaps)}>{label}</dt>
      <dd className="m-0 min-w-0 font-display text-[19px] leading-[1.1] font-semibold tracking-[-0.015em] tabular [overflow-wrap:anywhere] @md:text-[22px] @3xl:text-[25px]">{value}</dd>
      {sub ? <dd className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-[1.35] text-[var(--cov-muted)] tabular">{sub}</dd> : null}
    </div>
  );
}

function H3({ children, aside }: { children: ReactNode; aside?: string }) {
  return (
    <h3 className="m-0 mb-3 flex items-baseline justify-between gap-2.5 text-[13.5px] leading-none text-[var(--cov-faint)]">
      <span className={smallCaps}>{children}</span>
      {aside && <small className="text-[12.5px] font-medium text-[var(--cov-muted)] tabular">{aside}</small>}
    </h3>
  );
}

function Fact({ k, children, first }: { k: string; children: ReactNode; first?: boolean }) {
  return (
    <div className={cx("grid gap-1 py-2.5 text-[13.5px] @md:grid-cols-[110px_minmax(0,1fr)] @md:gap-3", first ? "pt-0.5" : "border-t border-[var(--cov-line)]")}>
      <dt className={cx("text-[13px] text-[var(--cov-faint)]", smallCaps)}>{k}</dt>
      <dd className="m-0 min-w-0 tabular [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-xl border border-dashed border-[var(--cov-line)] p-[22px] text-center text-[13.5px] text-[var(--cov-muted)]">{children}</p>;
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded bg-[var(--cov-card)] px-[5px] py-[3px] font-mono text-[11px] leading-none font-medium shadow-[inset_0_0_0_1px_var(--cov-line)]">{children}</kbd>;
}

function ContactRow({ c, onCopied }: { c: ClientContact; onCopied: (ok: boolean) => void }) {
  const { copy, copied } = useClipboard(1800);
  const emailRef = useRef<HTMLSpanElement>(null);
  const done = copied === "copied";
  return (
    <div className="group/c grid h-full grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-xl border border-[var(--cov-line)] bg-[var(--cov-card)] p-3.5 transition-[border-color,box-shadow] duration-200 hover:border-[color-mix(in_oklab,var(--cov-accent)_35%,var(--cov-line))] hover:shadow-[0_12px_22px_-20px_rgb(32_36_48/0.5)]">
      <span aria-hidden className={cx("row-span-3 grid size-10 place-items-center rounded-xl font-display text-[13px] font-semibold",
        c.primary ? "bg-[var(--cov-navy)] text-[var(--cov-navy-ink)]" : "bg-[var(--cov-tint)] text-[var(--cov-ink)] shadow-[inset_0_0_0_1px_var(--cov-line)]")}>{initialsOf(c.name)}</span>
      <div className="flex flex-wrap items-center gap-2 text-[14.5px] leading-[1.25] font-semibold">
        {c.name || "Unnamed"}
        {c.primary && <span className={cx("rounded-full bg-[var(--cov-accent-soft)] px-[7px] py-[3px] text-[12px] leading-none text-[var(--cov-accent-strong)]", smallCaps)}>Primary</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--cov-muted)] tabular">
        {c.role && <span>{c.role}</span>}
        {c.role && c.phone && <span aria-hidden>·</span>}
        {c.phone && <span className="inline-flex items-center gap-1"><Glyph d={G.phone} className="size-3 text-[var(--cov-faint)]" />{c.phone}</span>}
      </div>
      {c.email && (
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span ref={emailRef} className="min-w-0 font-mono text-[12.5px] leading-[1.4] text-[var(--cov-ink)] [overflow-wrap:anywhere]">{c.email}</span>
          <button type="button" aria-label={`Copy email for ${c.name || c.email}`}
            onClick={async () => { const ok = await copy(c.email!, emailRef.current); onCopied(ok); }}
            className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-[9px] py-1.5 text-[12px] leading-none font-semibold transition-[color,border-color,background-color,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cov-accent)] active:scale-[0.97]",
              done ? "border-[color-mix(in_oklab,var(--cov-accent)_50%,var(--cov-line))] bg-[var(--cov-accent-soft)] text-[var(--cov-accent-strong)]"
                : "border-[var(--cov-line)] bg-[var(--cov-card)] text-[var(--cov-muted)] hover:border-[var(--cov-faint)] hover:text-[var(--cov-ink)] [@media(hover:hover)]:border-transparent [@media(hover:hover)]:group-hover/c:border-[var(--cov-line)] [@media(hover:hover)]:group-focus-within/c:border-[var(--cov-line)]")}>
            <span className="relative grid size-[13px] place-items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={done ? "y" : "n"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 28 }} className="grid">
                  <Glyph d={done ? G.check : G.copy} className="size-[13px]" stroke={done ? 2 : 1.5} />
                </motion.span>
              </AnimatePresence>
            </span>
            {done ? "Copied" : copied === "selected" ? "Press Ctrl+C" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
