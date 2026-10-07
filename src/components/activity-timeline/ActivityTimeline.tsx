import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { CountUp, Icon, Segmented, cx } from "../../ui";
import {
  ACTIVITY_LABELS, ACTIVITY_TYPES, TYPE_LABELS,
  type ActivityEvent, type ActivityLabels, type ActivitySort, type ActivityType,
} from "./data";

/* ------------------------------------------------------------
   Activity Timeline — lavender rail, day groups, typed nodes,
   multi-select type filter, expandable events and paging.
   ------------------------------------------------------------ */

export interface ActivityTimelineHandle {
  /** Open an event (clears a filter that hides it and pages forward if needed). */
  expand: (id: string) => void;
  /** Close every open event. */
  collapseAll: () => void;
}

export interface ActivityOpenDetail { id: string; type: ActivityType; title: string; time: string; actor: string }

export interface ActivityTimelineProps {
  events: ActivityEvent[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** ISO date-time used for "Today", "Yesterday" and "min ago". Defaults to the current time. */
  now?: string;
  /** Controlled sort order. */
  sort?: ActivitySort;
  defaultSort?: ActivitySort;
  onSortChange?: (sort: ActivitySort) => void;
  /** Controlled type filter; empty = all. */
  filter?: ActivityType[];
  defaultFilter?: ActivityType[];
  onFilterChange?: (types: ActivityType[]) => void;
  /** Events shown before "Show more" (default 8). */
  pageSize?: number;
  /** Rename a type, e.g. { form: "Form fill" }. */
  typeLabels?: Partial<Record<ActivityType, string>>;
  labels?: Partial<ActivityLabels>;
  /** Date and time formatting locale (default en-US). */
  locale?: string;
  /** Fires when an event is opened. */
  onActivityOpen?: (detail: ActivityOpenDetail) => void;
  className?: string;
  ref?: Ref<ActivityTimelineHandle>;
}

type Ev = ActivityEvent & { d: Date };

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const initials = (s?: string) => String(s || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
const EASE = [0.2, 0.7, 0.2, 1] as const;

const PALETTE = cx(
  "[--at-card:#FCFBFF] [--at-raise:#FFFFFF] [--at-tint:#F2F0F9] [--at-rail:#DAD6EA] [--at-acc:#5B4BC4] [--at-node-ink:#FFFFFF]",
  "[--at-call:#0E8A7D] [--at-email:#3A66D6] [--at-form:#C2650A] [--at-deal:#2E8F52] [--at-note:#BE3F78]",
  "dark:[--at-card:#17161F] dark:[--at-raise:#201F2B] dark:[--at-tint:#22202E] dark:[--at-rail:#343146] dark:[--at-acc:#B1A6FA] dark:[--at-node-ink:#15141C]",
  "dark:[--at-call:#3DD6C3] dark:[--at-email:#86A9FF] dark:[--at-form:#F5AA55] dark:[--at-deal:#5EDB8E] dark:[--at-note:#F584BE]",
);

const TYPE_ICON: Record<ActivityType | "all", ReactNode> = {
  call: <path d="M3.2 2.5h2.3l1.1 3-1.5 1a7.4 7.4 0 0 0 3.4 3.4l1-1.5 3 1.1v2.3a1.4 1.4 0 0 1-1.5 1.4A10.6 10.6 0 0 1 1.8 4a1.4 1.4 0 0 1 1.4-1.5z" />,
  email: <><rect x="2" y="3.5" width="12" height="9" rx="2" /><path d="m2.6 4.6 5.4 4.1 5.4-4.1" /></>,
  form: <><rect x="3" y="2" width="10" height="12" rx="2" /><path d="M5.6 5.5h4.8M5.6 8h4.8M5.6 10.5h2.6" /></>,
  deal: <><path d="M2 9.2 5 6.4l2.4 2.2L12 4" /><path d="M9.2 4H12v2.8" /><path d="M2.5 13h11" /></>,
  note: <><path d="M3 13.2V2.8h7.2L13 5.6v7.6z" /><path d="M10 2.8v3h3M5.4 8.4h5.2M5.4 10.8h3.4" /></>,
  all: <path d="M3 4h10M3 8h10M3 12h10" />,
};
function TypeIcon({ type, className }: { type: ActivityType | "all"; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden>
      {TYPE_ICON[type]}
    </svg>
  );
}

function useControllable<T>(value: T | undefined, def: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState(def);
  const v = value !== undefined ? value : inner;
  return [v, (n: T) => { if (value === undefined) setInner(n); onChange?.(n); }];
}

export function ActivityTimeline({
  events, eyebrow, title, subtitle, now: nowIso, sort: sortProp, defaultSort = "newest", onSortChange,
  filter: filterProp, defaultFilter = [], onFilterChange, pageSize: pageSizeProp = 8, typeLabels, labels, locale = "en-US",
  onActivityOpen, className, ref,
}: ActivityTimelineProps) {
  const L = useMemo(() => ({ ...ACTIVITY_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const instant = reduced || preview;
  const page = Math.max(1, Math.round(pageSizeProp) || 8);
  const typeLabel = (t: ActivityType) => typeLabels?.[t] || TYPE_LABELS[t] || t;

  const [sort, setSort] = useControllable<ActivitySort>(sortProp, defaultSort, onSortChange);
  const [typesArr, setTypesArr] = useControllable<ActivityType[]>(filterProp, defaultFilter, onFilterChange);
  const types = useMemo(() => new Set(typesArr.filter(t => ACTIVITY_TYPES.includes(t))), [typesArr]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [paging, setPaging] = useState<{ key: string; shown: number; base: number }>({ key: "", shown: page, base: 0 });
  const [announce, setAnnounce] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const allChip = useRef<HTMLButtonElement>(null);

  const now = useMemo(() => {
    const d = nowIso ? new Date(nowIso) : new Date();
    return isNaN(+d) ? new Date() : d;
  }, [nowIso]);

  const evs: Ev[] = useMemo(() => events
    .filter(e => e && e.time && !isNaN(+new Date(e.time)))
    .map((e, i) => ({ ...e, id: e.id != null ? String(e.id) : `ev-${i}`, type: ACTIVITY_TYPES.includes(e.type) ? e.type : "note", d: new Date(e.time) })),
  [events]);

  const counts = useMemo(() => Object.fromEntries(ACTIVITY_TYPES.map(t => [t, evs.filter(e => e.type === t).length])) as Record<ActivityType, number>, [evs]);
  const presentTypes = ACTIVITY_TYPES.filter(t => counts[t] > 0);
  const days = useMemo(() => new Set(evs.map(e => dayKey(e.d))).size, [evs]);
  const latest = evs.reduce<Ev | null>((a, e) => (!a || e.d > a.d ? e : a), null);

  const listFor = (ts: Set<ActivityType>, s: ActivitySort) => evs
    .filter(e => !ts.size || ts.has(e.type))
    .sort((a, b) => (s === "oldest" ? +a.d - +b.d : +b.d - +a.d));
  const filtered = listFor(types, sort);
  const viewKey = `${[...types].sort().join(",")}|${sort}|${page}`;
  const shown = paging.key === viewKey ? paging.shown : page;
  const base = paging.key === viewKey ? paging.base : 0;
  const visible = filtered.slice(0, shown);
  const left = filtered.length - visible.length;

  /* ---------- relative times ---------- */
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const relative = (d: Date, long: boolean) => {
    const mins = Math.round((+now - +d) / 60000);
    if (mins >= 0 && mins < 1) return L.justNow;
    if (mins >= 0 && mins < 60) return fill(L.minAgo, { n: mins });
    if (mins >= 0 && mins < 12 * 60 && dayKey(now) === dayKey(d)) return fill(L.hAgo, { n: Math.floor(mins / 60) });
    if (!long) return time(d);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (dayKey(y) === dayKey(d)) return `${L.yesterday.toLowerCase()}, ${time(d)}`;
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" }) + ", " + time(d);
  };
  const dayLabel = (d: Date): [string, string] => {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const date = d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
    if (dayKey(d) === dayKey(now)) return [L.today, date];
    if (dayKey(d) === dayKey(y)) return [L.yesterday, date];
    return [d.toLocaleDateString(locale, { weekday: "long" }), d.toLocaleDateString(locale, { month: "short", day: "numeric" })];
  };
  const fullStamp = (d: Date) => d.toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  /* ---------- actions ---------- */
  const applyTypes = (list: ActivityType[]) => {
    const next = list.filter(t => ACTIVITY_TYPES.includes(t));
    setTypesArr(next);
    const names = next.length ? next.map(typeLabel).join(", ") : L.all.toLowerCase();
    const n = listFor(new Set(next), sort).length;
    setAnnounce(`${fill(L.filterAnnounce, { list: names })}. ${n ? fill(L.showing, { shown: Math.min(page, n), total: n }) : L.none}`);
  };
  const toggleType = (t: ActivityType | "all") => {
    if (t === "all") return applyTypes([]);
    const next = new Set(types);
    if (next.has(t)) next.delete(t); else next.add(t);
    applyTypes([...next]);
  };
  const showMore = () => {
    const nextShown = shown + page;
    setPaging({ key: viewKey, shown: nextShown, base: shown });
    const first = filtered[shown];
    if (first) setFocusId(first.id);
    setAnnounce(fill(L.announce, { n: Math.min(nextShown, filtered.length) }));
  };
  const setOpenState = (id: string, on: boolean) => {
    setOpen(prev => {
      if (prev.has(id) === on) return prev;
      const n = new Set(prev);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
    if (on) {
      const e = evs.find(x => x.id === id);
      if (e) onActivityOpen?.({ id: e.id, type: e.type, title: e.title || "", time: e.time, actor: e.actor || "" });
    }
  };
  const expand = (id: string) => {
    const ev = evs.find(e => e.id === String(id));
    if (!ev) return;
    let ts = types;
    if (ts.size && !ts.has(ev.type)) { ts = new Set([...ts, ev.type]); setTypesArr([...ts]); }
    const list = listFor(ts, sort);
    const idx = list.findIndex(e => e.id === ev.id);
    const key = `${[...ts].sort().join(",")}|${sort}|${page}`;
    const cur = paging.key === key ? paging.shown : page;
    const need = Math.max(cur, Math.ceil((idx + 1) / page) * page);
    if (need !== cur || paging.key !== key) setPaging({ key, shown: need, base: cur });
    setOpenState(ev.id, true);
  };
  useImperativeHandle(ref, () => ({ expand, collapseAll: () => setOpen(new Set()) }));

  useEffect(() => {
    if (!focusId) return;
    toggles.current.get(focusId)?.focus({ preventScroll: false });
    setFocusId(null);
  }, [focusId, visible.length]);

  /* ---------- groups ---------- */
  const groups: { key: string; d: Date; items: Ev[] }[] = [];
  visible.forEach(e => {
    const k = dayKey(e.d), g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(e); else groups.push({ key: k, d: e.d, items: [e] });
  });
  const perDay = filtered.reduce<Record<string, number>>((m, e) => { const k = dayKey(e.d); m[k] = (m[k] || 0) + 1; return m; }, {});

  return (
    <article
      className={cx(
        PALETTE,
        "@container relative w-full max-w-[980px] rounded-[22px] border border-line bg-[var(--at-card)] text-ink elev-3",
        className,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <span className="absolute -top-32 -left-24 h-72 w-96 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--at-acc)_10%,transparent),transparent)]" />
      </span>

      <div className="relative px-4 pt-5 pb-4 @md:px-6 @md:pt-6 @3xl:px-7">
        {/* header */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
          <div className="grid min-w-0 gap-1.5">
            {eyebrow && <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--at-acc)]">{eyebrow}</span>}
            {title && <h2 className="m-0 font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.02em] @2xl:text-[26px]">{title}</h2>}
            {subtitle && <p className="m-0 text-[13.5px] text-ink-3">{subtitle}</p>}
          </div>
          <Segmented<ActivitySort>
            ariaLabel={L.sort} value={sort} onChange={v => setSort(v)} size="sm"
            className="w-full rounded-full border-line bg-[var(--at-tint)] @md:w-auto"
            buttonClassName="flex-1 rounded-full px-3 py-1.5 @md:flex-none"
            indicatorClassName="rounded-full bg-[var(--at-raise)] shadow-[0_1px_3px_-1px_rgb(36_28_74/0.25),0_0_0_1px_var(--line)]"
            options={[
              { value: "newest", label: <><Icon name="arrowDown" className="size-3" />{L.newest}</> },
              { value: "oldest", label: <><Icon name="arrowUp" className="size-3" />{L.oldest}</> },
            ]}
          />
        </header>

        <div className="grid grid-cols-1 gap-5 pt-5 @2xl:grid-cols-[214px_minmax(0,1fr)] @2xl:gap-7 @2xl:pt-6">
          {/* side: summary, mix, filters */}
          <aside className="grid min-w-0 content-start gap-4 @2xl:sticky @2xl:top-20 @2xl:gap-5 @2xl:self-start">
            <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 @2xl:block">
              <div className="grid gap-1">
                <span className="flex items-baseline gap-2 @2xl:block">
                  <CountUp value={evs.length} className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] @2xl:text-[40px]" />
                  <span className="text-[13px] text-ink-2 @2xl:mt-1.5 @2xl:block">
                    {evs.length === 1 ? L.activity : L.activities} {days === 1 ? L.acrossDay : fill(L.acrossDays, { n: days })}
                  </span>
                </span>
                {latest && <span className="text-[12px] text-ink-3">{fill(L.last, { when: relative(latest.d, true) })}</span>}
              </div>
            </div>

            <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--at-tint)]">
              {presentTypes.map(t => (
                <motion.span
                  key={t}
                  initial={instant ? false : { flexGrow: 0 }}
                  animate={{ flexGrow: counts[t], opacity: types.size && !types.has(t) ? 0.22 : 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="min-w-1 basis-0"
                  style={{ background: `var(--at-${t})` }}
                />
              ))}
            </div>

            <div role="group" aria-label={L.filterBy} className="min-w-0">
              <p className="m-0 mb-2 hidden font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-3 @2xl:block">{L.filterBy}</p>
              <ul className="-mx-4 m-0 flex list-none gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @md:-mx-6 @md:px-6 @2xl:mx-0 @2xl:grid @2xl:gap-1 @2xl:overflow-visible @2xl:px-0 @2xl:pb-0 [&::-webkit-scrollbar]:hidden">
                {(["all", ...presentTypes] as const).map(t => {
                  const on = t === "all" ? types.size === 0 : types.has(t);
                  const n = t === "all" ? evs.length : counts[t];
                  const label = t === "all" ? L.all : typeLabel(t);
                  return (
                    <li key={t} className="flex-none">
                      <button
                        ref={t === "all" ? allChip : undefined}
                        type="button" aria-pressed={on}
                        aria-label={`${label}, ${n === 1 ? L.event : fill(L.events, { n })}`}
                        onClick={() => toggleType(t)}
                        style={{ "--tc": t === "all" ? "var(--at-acc)" : `var(--at-${t})` } as CSSProperties}
                        className={cx(
                          "group/chip grid w-auto grid-cols-[22px_auto_auto] items-center gap-2 rounded-full border py-1 pr-2 pl-1 text-left text-[13px] font-medium whitespace-nowrap transition-[background,border-color,box-shadow,color] duration-200",
                          "@2xl:w-full @2xl:grid-cols-[26px_minmax(0,1fr)_auto] @2xl:gap-2.5 @2xl:rounded-[11px] @2xl:py-1.5 @2xl:pr-2.5 @2xl:pl-1.5 @2xl:text-[13.5px]",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--at-acc)]",
                          on
                            ? "border-[color-mix(in_oklab,var(--tc)_45%,var(--line))] bg-[var(--at-raise)] shadow-[0_6px_16px_-12px_rgb(36_28_74/0.45)]"
                            : "border-line bg-transparent hover:bg-[var(--at-tint)] @2xl:border-transparent",
                        )}
                      >
                        <span className={cx(
                          "grid size-[22px] place-items-center rounded-full transition-colors duration-200 @2xl:size-[26px] @2xl:rounded-lg",
                          on ? "bg-[var(--tc)] text-[var(--at-node-ink)]" : "bg-[color-mix(in_oklab,var(--tc)_14%,transparent)] text-[color-mix(in_oklab,var(--tc)_82%,var(--ink))]",
                        )}>
                          <TypeIcon type={t} className="size-3 @2xl:size-3.5" />
                        </span>
                        <span className="min-w-0 truncate">{label}</span>
                        <span className={cx(
                          "rounded-full px-1.5 py-[3px] font-mono text-[11px] font-semibold leading-none tabular transition-colors duration-200",
                          on ? "bg-[color-mix(in_oklab,var(--tc)_16%,transparent)] text-[color-mix(in_oklab,var(--tc)_78%,var(--ink))]" : "bg-[var(--at-tint)] text-ink-3",
                        )}>{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <AnimatePresence initial={false}>
                {types.size > 0 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => { applyTypes([]); allChip.current?.focus(); }}
                    className="mt-1.5 block overflow-hidden py-1 text-[12px] font-semibold text-[var(--at-acc)] underline decoration-[color-mix(in_oklab,var(--at-acc)_40%,transparent)] underline-offset-[3px] hover:decoration-current"
                  >
                    {L.clear}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </aside>

          {/* feed */}
          <div className="min-w-0">
            {!filtered.length ? (
              <motion.div initial={instant ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-12 text-center text-[13.5px] text-ink-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--at-tint)] text-[var(--at-acc)]"><TypeIcon type="all" className="size-4" /></span>
                <b className="text-[15px] text-ink">{L.noneTitle}</b>
                <span>{L.none}</span>
                {types.size > 0 && (
                  <button type="button" onClick={() => applyTypes([])} className="mt-1 rounded-full border border-line bg-[var(--at-raise)] px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-[var(--at-acc)]">{L.clear}</button>
                )}
              </motion.div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {groups.map(g => {
                  const [main, sub] = dayLabel(g.d);
                  const hid = `${uid}-d-${g.key}`;
                  return (
                    <motion.section
                      key={g.key} layout={instant ? false : "position"} aria-labelledby={hid}
                      initial={instant ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      className="relative [&+&]:mt-3"
                    >
                      <h3 id={hid} className="m-0 mb-1.5 flex items-baseline justify-between gap-2.5 py-1.5 pl-9 font-mono text-[12px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink-2 @md:pl-[50px]">
                        <span>{main} <small className="text-[11px] font-medium tracking-[0.04em] normal-case text-ink-3">· {sub}</small></span>
                        <small className="text-[11px] font-medium tracking-[0.04em] normal-case text-ink-3 tabular">{perDay[g.key] === 1 ? L.event : fill(L.events, { n: perDay[g.key] })}</small>
                      </h3>
                      <ol className="relative m-0 list-none p-0 before:absolute before:top-1.5 before:bottom-1.5 before:left-[13px] before:w-0.5 before:rounded-full before:bg-[linear-gradient(to_bottom,var(--at-rail),color-mix(in_oklab,var(--at-rail)_35%,transparent))] @md:before:left-[17px]">
                        <AnimatePresence initial={!instant} mode="popLayout">
                          {g.items.map(e => {
                            const idx = visible.indexOf(e);
                            return (
                              <Item
                                key={e.id} e={e} uid={uid} L={L} instant={instant}
                                delay={Math.min(10, Math.max(0, idx - base)) * 0.045}
                                isOpen={open.has(e.id)}
                                onToggle={() => setOpenState(e.id, !open.has(e.id))}
                                typeName={typeLabel(e.type)}
                                timeText={relative(e.d, false)}
                                stamp={fullStamp(e.d)}
                                btnRef={el => { if (el) toggles.current.set(e.id, el); else toggles.current.delete(e.id); }}
                              />
                            );
                          })}
                        </AnimatePresence>
                      </ol>
                    </motion.section>
                  );
                })}
              </AnimatePresence>
            )}

            {filtered.length > 0 && (
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-line pt-3.5 @md:pl-[50px]">
                <span className="text-[12.5px] text-ink-3 tabular">{fill(L.showing, { shown: visible.length, total: filtered.length })}</span>
                {left > 0 && (
                  <button
                    type="button" onClick={showMore}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-[var(--at-raise)] px-3.5 py-2 text-[13px] font-semibold text-ink transition-[border-color,transform] duration-200 hover:border-[var(--at-acc)] active:scale-[0.98] @md:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--at-acc)]"
                  >
                    <Icon name="plus" className="size-3.5 text-[var(--at-acc)]" strokeWidth={1.8} />
                    {fill(L.showMore, { n: Math.min(page, left) })}
                  </button>
                )}
              </footer>
            )}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </article>
  );
}

function Item({ e, uid, L, instant, delay, isOpen, onToggle, typeName, timeText, stamp, btnRef, ref }: {
  ref?: Ref<HTMLLIElement>; e: Ev; uid: string; L: ActivityLabels; instant: boolean; delay: number; isOpen: boolean; onToggle: () => void;
  typeName: string; timeText: string; stamp: string; btnRef: (el: HTMLButtonElement | null) => void;
}) {
  const did = `${uid}-x-${e.id}`;
  const pairs = Array.isArray(e.details) ? e.details.filter(p => Array.isArray(p) && p.length >= 2) : [];
  return (
    <motion.li
      ref={ref}
      layout={instant ? false : "position"}
      initial={instant ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE, delay } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      style={{ "--tc": `var(--at-${e.type})` } as CSSProperties}
      className="group/item relative grid grid-cols-[28px_minmax(0,1fr)] gap-2 py-1.5 @md:grid-cols-[36px_minmax(0,1fr)] @md:gap-3.5"
    >
      <span
        aria-hidden
        className={cx(
          "relative z-[1] grid size-7 place-items-center rounded-[9px] bg-[var(--tc)] text-[var(--at-node-ink)] shadow-[0_0_0_3px_var(--at-card),0_8px_16px_-10px_var(--tc)] transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none",
          "@md:size-9 @md:rounded-xl @md:shadow-[0_0_0_4px_var(--at-card),0_8px_16px_-10px_var(--tc)]",
          "group-hover/item:scale-[1.06] group-hover/item:-rotate-4 motion-reduce:group-hover/item:transform-none",
          isOpen && "scale-[1.06] -rotate-4",
        )}
      >
        <TypeIcon type={e.type} className="size-3.5 @md:size-[17px]" />
      </span>
      <div className={cx(
        "min-w-0 rounded-[14px] border transition-[background,border-color,box-shadow] duration-300",
        isOpen ? "border-line bg-[var(--at-raise)] shadow-[0_16px_34px_-26px_rgb(36_28_74/0.5)] dark:shadow-[0_16px_34px_-20px_rgb(0_0_0/0.8)]" : "border-transparent group-hover/item:bg-[var(--at-tint)]",
      )}>
        <button
          ref={btnRef} type="button" aria-expanded={isOpen} aria-controls={did} onClick={onToggle}
          aria-label={`${e.title || typeName}. ${e.summary || ""} ${stamp}. ${isOpen ? L.close : L.open}`}
          className="group/btn grid w-full grid-cols-[minmax(0,1fr)] gap-0.5 rounded-[14px] px-2 pt-1 pb-2 text-left focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[color:var(--at-acc)] @md:grid-cols-[minmax(0,1fr)_auto] @md:gap-x-3.5 @md:px-3 @md:pt-2 @md:pb-2.5"
        >
          <span className="row-start-1 flex items-center justify-between gap-1.5 @md:col-start-2 @md:grid @md:content-start @md:justify-items-end @md:gap-1.5 @md:self-start @md:pt-px">
            <time dateTime={e.time} title={stamp} className="text-[12px] whitespace-nowrap text-ink-3 tabular">{timeText}</time>
            <span className={cx(
              "grid size-[22px] place-items-center rounded-lg text-ink-3 transition-[transform,background,color] duration-300 group-hover/btn:bg-[var(--at-card)] group-hover/btn:text-ink @md:size-6",
              isOpen && "rotate-180 text-[var(--at-acc)]",
            )}>
              <Icon name="chevronDown" className="size-3.5" strokeWidth={1.8} />
            </span>
          </span>
          <span className="grid min-w-0 gap-1 @md:col-start-1 @md:row-start-1">
            <span className="text-[14px] font-semibold leading-snug [overflow-wrap:anywhere] @md:text-[14.5px]">{e.title || typeName}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-2">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[color-mix(in_oklab,var(--tc)_78%,var(--ink))]">{typeName}</span>
              <span aria-hidden className="size-[3px] rounded-full bg-ink-3 opacity-60" />
              <span aria-hidden className="inline-grid size-5 flex-none place-items-center rounded-full bg-[color-mix(in_oklab,var(--at-acc)_10%,transparent)] text-[9px] font-bold tracking-[0.02em] text-[var(--at-acc)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--at-acc)_25%,transparent)]">{initials(e.actor)}</span>
              <span>{e.actor || ""}</span>
            </span>
            {e.summary && <span className="mt-0.5 text-[13.5px] leading-normal text-ink-2 [overflow-wrap:anywhere]">{e.summary}</span>}
          </span>
        </button>
        <motion.div
          id={did} role="region" aria-label={e.title || typeName} aria-hidden={!isOpen} inert={!isOpen}
          initial={false}
          animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
          transition={{ height: { duration: 0.32, ease: EASE }, opacity: { duration: 0.22 } }}
          className="overflow-hidden"
        >
          <div className="mx-2 mb-2.5 grid gap-3 border-t border-dashed border-line pt-3 @md:mx-3 @md:mb-3">
            {pairs.length > 0 && (
              <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2.5 @md:grid-cols-2 @3xl:grid-cols-3">
                {pairs.map(([k, v]) => (
                  <div key={k} className="grid min-w-0 gap-1">
                    <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">{k}</dt>
                    <dd className="m-0 text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {e.note && <p className="m-0 rounded-[10px] border-l-[3px] border-[var(--tc)] bg-[var(--at-tint)] px-3 py-2.5 text-[13px] leading-normal text-ink">{e.note}</p>}
            <span className="font-mono text-[11px] text-ink-3">{stamp}{e.actor ? ` · ${e.actor}` : ""}</span>
          </div>
        </motion.div>
      </div>
    </motion.li>
  );
}
