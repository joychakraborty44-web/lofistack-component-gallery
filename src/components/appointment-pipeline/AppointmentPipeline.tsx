import {
  useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CountUp, cx } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { STATUSES, type Appointment, type AppointmentDay, type AppointmentStatus } from "./data";

/* ------------------------------------------------------------
   Appointment Pipeline — one day of a booking week at a time,
   in Booked / Confirmed / Showed / No-show lanes, with an inline
   detail that moves appointments between lanes and sends
   reminders, and a weekly show-rate summary.
   ------------------------------------------------------------ */

export interface AppointmentPipelineLabels {
  booked: string; confirmed: string; showed: string; noshow: string;
  bookedDesc: string; confirmedDesc: string; showedDesc: string; noshowDesc: string;
  weekRate: string; rateSub: string; noRate: string;
  appts: string; appt: string; dayRate: string; dayConfirmed: string; dayAppts: string;
  today: string; empty: string;
  time: string; staff: string; phone: string; via: string;
  moveTo: string; remind: string; reminded: string; remindedNow: string; remindNa: string;
  bulk: string; bulkOne: string; bulkNone: string; bulkDone: string;
  min: string; days: string; moved: string; remindedSr: string;
  legendShowed: string; legendNoshow: string;
}

const LABELS: AppointmentPipelineLabels = {
  booked: "Booked", confirmed: "Confirmed", showed: "Showed", noshow: "No-show",
  bookedDesc: "Waiting to confirm", confirmedDesc: "Said they're coming", showedDesc: "Came in", noshowDesc: "Missed it",
  weekRate: "Show rate · this week", rateSub: "{showed} showed · {noshow} no-shows · {upcoming} still to come",
  noRate: "No finished visits yet",
  appts: "{n} appointments", appt: "1 appointment",
  dayRate: "show rate", dayConfirmed: "of upcoming confirmed", dayAppts: "appointments",
  today: "Today", empty: "Nothing here",
  time: "Time", staff: "Coach", phone: "Phone", via: "Booked via",
  moveTo: "Move to", remind: "Send reminder", reminded: "Reminder sent", remindedNow: "Reminder sent · just now",
  remindNa: "Visit finished", bulk: "Send {n} reminders", bulkOne: "Send 1 reminder", bulkNone: "All reminded", bulkDone: "Sent {n} reminders.",
  min: "{n} min", days: "Choose a day",
  moved: "{name} moved to {lane}.", remindedSr: "Reminder sent to {name}.",
  legendShowed: "Showed", legendNoshow: "No-show",
};

export interface AppointmentUpdateDetail {
  action: "status" | "reminder";
  id: string;
  /** YYYY-MM-DD of the appointment's day. */
  day: string;
  appointment: Appointment;
  from?: AppointmentStatus;
  to?: AppointmentStatus;
  reminded?: boolean;
}

export interface AppointmentPipelineHandle {
  setStatus: (id: string, status: AppointmentStatus) => void;
  remind: (id: string) => void;
}

export interface AppointmentPipelineProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** YYYY-MM-DD. Marks that day with a "Today" tag. */
  today?: string;
  days: AppointmentDay[];
  /** Controlled day (YYYY-MM-DD). */
  day?: string;
  /** Day to open first. Defaults to `today`, then the first day. */
  defaultDay?: string;
  onDayChange?: (day: string) => void;
  onAppointmentUpdate?: (detail: AppointmentUpdateDetail) => void;
  /** Footer note. */
  source?: string;
  locale?: string;
  labels?: Partial<AppointmentPipelineLabels>;
  className?: string;
  ref?: Ref<AppointmentPipelineHandle>;
}

/* ---------------- palette ---------------- */
const PALETTE = [
  "[--apl-coral:#E2553F] [--apl-coral-ink:#B83A27] [--apl-coral-soft:#FDE8E3] [--apl-on-coral:#FFFFFF]",
  "dark:[--apl-coral:#FF8A73] dark:[--apl-coral-ink:#FF9A86] dark:[--apl-coral-soft:rgb(255_138_115/0.13)] dark:[--apl-on-coral:#1B0F08]",
  "[--apl-well:#F1F4F8] dark:[--apl-well:#0E131B]",
  "[--apl-card:#FFFFFF] dark:[--apl-card:#161C27]",
  "[--apl-booked:#64748B] [--apl-booked-ink:#475569] dark:[--apl-booked:#94A3B8] dark:[--apl-booked-ink:#B6C2D2]",
  "[--apl-confirmed:#2563EB] [--apl-confirmed-ink:#1D4ED8] dark:[--apl-confirmed:#7AA2FF] dark:[--apl-confirmed-ink:#9DBBFF]",
  "[--apl-showed:#16A34A] [--apl-showed-ink:#166534] dark:[--apl-showed:#4ADE80] dark:[--apl-showed-ink:#6EE7A0]",
  "[--apl-noshow:#D97706] [--apl-noshow-ink:#92400E] dark:[--apl-noshow:#FBBF24] dark:[--apl-noshow-ink:#FCD34D]",
].join(" ");
const S: Record<AppointmentStatus, string> = {
  booked: "[--s:var(--apl-booked)] [--s-ink:var(--apl-booked-ink)]",
  confirmed: "[--s:var(--apl-confirmed)] [--s-ink:var(--apl-confirmed-ink)]",
  showed: "[--s:var(--apl-showed)] [--s-ink:var(--apl-showed-ink)]",
  noshow: "[--s:var(--apl-noshow)] [--s-ink:var(--apl-noshow-ink)]",
};
const HATCH = "bg-[linear-gradient(135deg,transparent_44%,var(--apl-noshow)_44%_56%,transparent_56%)] shadow-[inset_0_0_0_1.5px_var(--apl-noshow)]";
const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------------- helpers ---------------- */
interface Appt extends Appointment { start: number; reminded: boolean; remindedNow: boolean }
interface Day { date: string; appts: Appt[] }

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const minutesOf = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const clock = (mins: number) => { const v = ((mins % 1440) + 1440) % 1440; const h = Math.floor(v / 60), m = v % 60; return { hm: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, ap: h < 12 ? "AM" : "PM" }; };
const initialsOf = (s?: string) => (s || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
const parseDate = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; };
const counts = (appts: Appt[]) => { const c: Record<AppointmentStatus, number> = { booked: 0, confirmed: 0, showed: 0, noshow: 0 }; appts.forEach(a => c[a.status]++); return c; };
const isUpcoming = (s: AppointmentStatus) => s === "booked" || s === "confirmed";

function normalise(days: AppointmentDay[]): Day[] {
  const seen = new Set<string>();
  return days.filter(d => d && parseDate(d.date)).map(d => ({
    date: d.date,
    appts: (d.appointments || []).filter(Boolean).map((a, i) => {
      let id = String(a.id || `${d.date}-${i + 1}`);
      while (seen.has(id)) id += `-${i}`;
      seen.add(id);
      return {
        ...a, id, name: a.name || "Client", start: minutesOf(a.time), duration: Math.max(0, a.duration || 0),
        status: STATUSES.includes(a.status) ? a.status : "booked", reminded: !!a.reminded, remindedNow: false,
      };
    }).sort((x, y) => x.start - y.start),
  }));
}
const strip = (a: Appt): Appointment => {
  const { start: _s, remindedNow: _r, ...rest } = a;
  return rest;
};

/* ---------------- icons ---------------- */
const Bell = ({ className = "size-[11px]" }: { className?: string }) => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>
    <path d="M3.5 9.5V6.2a3.5 3.5 0 0 1 7 0v3.3l1 1.3h-9z" /><path d="M5.8 12.3a1.3 1.3 0 0 0 2.4 0" />
  </svg>
);
const Send = ({ className = "size-[13px]" }: { className?: string }) => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>
    <path d="M12.5 1.5 6 8M12.5 1.5l-4 11-2.5-4.5L1.5 5.5z" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <motion.svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden
    className="size-3.5 shrink-0 text-ink-3" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: EASE }}><path d="m4 6 4 4 4-4" /></motion.svg>
);

/* ---------------- component ---------------- */
export function AppointmentPipeline({
  eyebrow, title, subtitle, today, days: daysProp, day: dayProp, defaultDay, onDayChange, onAppointmentUpdate,
  source, locale = "en-US", labels: labelsProp, className, ref,
}: AppointmentPipelineProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const L = useMemo(() => ({ ...LABELS, ...labelsProp }), [labelsProp]);
  const [days, setDays] = useState<Day[]>(() => normalise(daysProp));
  const daysRef = useRef(days);
  daysRef.current = days;

  const [ownDay, setOwnDay] = useState(() => defaultDay ?? today ?? "");
  const wanted = dayProp ?? ownDay;
  const current = days.find(d => d.date === wanted) ?? days[0] ?? null;

  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const [live, setLive] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAfter = useRef<{ id: string; sel: string } | null>(null);
  const enterAnim = useRef(!preview);

  const fmtDow = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }), [locale]);

  const say = useCallback((t: string) => { setLive(""); window.setTimeout(() => setLive(t), 60); }, []);

  const find = useCallback((id: string) => {
    for (const d of daysRef.current) { const a = d.appts.find(x => x.id === id); if (a) return { a, d }; }
    return null;
  }, []);

  const update = (id: string, patch: (a: Appt) => Appt) => {
    const next = daysRef.current.map(d => ({ ...d, appts: d.appts.map(a => (a.id === id ? patch(a) : a)) }));
    daysRef.current = next;
    setDays(next);
  };

  const setStatus = useCallback((id: string, status: AppointmentStatus, fromUi: boolean) => {
    const hit = find(id);
    if (!hit || hit.a.status === status || !STATUSES.includes(status)) return;
    const from = hit.a.status;
    update(id, a => ({ ...a, status }));
    if (fromUi) focusAfter.current = { id, sel: `[data-mv="${status}"]` };
    setFlash({ id, n: Date.now() });
    say(fill(L.moved, { name: hit.a.name, lane: L[status] }));
    onAppointmentUpdate?.({ action: "status", id, day: hit.d.date, appointment: { ...strip(hit.a), status }, from, to: status });
  }, [find, L, say, onAppointmentUpdate]);

  const remind = useCallback((ids: string[], fromBtn?: string) => {
    const todo = ids.map(find).filter((h): h is { a: Appt; d: Day } => !!h && !h.a.reminded && isUpcoming(h.a.status));
    if (!todo.length) return;
    const set = new Set(todo.map(h => h.a.id));
    const next = daysRef.current.map(d => ({ ...d, appts: d.appts.map(a => (set.has(a.id) ? { ...a, reminded: true, remindedNow: true } : a)) }));
    daysRef.current = next;
    setDays(next);
    if (fromBtn) focusAfter.current = { id: fromBtn, sel: '[aria-pressed="true"]' };
    say(todo.length === 1 ? fill(L.remindedSr, { name: todo[0].a.name }) : fill(L.bulkDone, { n: todo.length }));
    todo.forEach(h => onAppointmentUpdate?.({ action: "reminder", id: h.a.id, day: h.d.date, appointment: { ...strip(h.a), reminded: true }, reminded: true }));
  }, [find, L, say, onAppointmentUpdate]);

  useImperativeHandle(ref, () => ({
    setStatus: (id, status) => setStatus(id, status, false),
    remind: id => remind([id]),
  }), [setStatus, remind]);

  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const card = rootRef.current?.querySelector<HTMLElement>(`[data-appt="${CSS.escape(f.id)}"]`);
    const el = card?.querySelector<HTMLElement>(f.sel);
    if (el) {
      el.focus({ preventScroll: true });
      const r = card!.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) card!.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  });
  useEffect(() => { enterAnim.current = false; });

  const pickDay = (date: string, focusIndex?: number) => {
    if (focusIndex != null) tabRefs.current[focusIndex]?.focus();
    if (!current || date === current.date) return;
    enterAnim.current = !reduced;
    setOpen(null);
    if (dayProp === undefined) setOwnDay(date);
    onDayChange?.(date);
  };
  const onTabsKey = (e: ReactKeyboardEvent) => {
    const i = days.findIndex(d => d.date === current?.date);
    const n = days.length;
    let j: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j == null) return;
    e.preventDefault();
    pickDay(days[j].date, j);
  };
  const onLanesKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    const id = open;
    setOpen(null);
    rootRef.current?.querySelector<HTMLElement>(`[data-appt="${CSS.escape(id)}"] [data-appt-btn]`)?.focus();
  };

  /* ---------- derived ---------- */
  const all = days.flatMap(d => d.appts);
  const wk = counts(all);
  const fin = wk.showed + wk.noshow;
  const weekRate = fin ? Math.round((wk.showed / fin) * 100) : null;
  const finished = all.filter(a => a.status === "showed" || a.status === "noshow");
  const appts = current?.appts ?? [];
  const c = counts(appts);
  const dFin = c.showed + c.noshow, dUp = c.booked + c.confirmed;
  const pending = appts.filter(a => isUpcoming(a.status) && !a.reminded);
  const panelId = `${uid}-panel`;

  let seq = 0;

  return (
    <div className={cx("@container w-full max-w-[1040px]", className)}>
      <article ref={rootRef} className={cx(PALETTE, "relative isolate overflow-hidden rounded-[22px] border border-line bg-[var(--apl-card)] px-3 pb-4 pt-5 font-sans text-ink elev-2 @md:px-5 @md:pt-6 @3xl:px-6 @3xl:pb-5")}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 -z-10 h-72 w-[28rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--apl-coral)_14%,transparent),transparent)]" />

        {/* header */}
        <header className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start @3xl:justify-between @3xl:gap-8">
          <div className="grid min-w-0 flex-1 gap-1.5 px-1">
            {eyebrow && (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--apl-coral-ink)]">
                <span aria-hidden className="size-2 rounded-full bg-[var(--apl-coral)] shadow-[0_0_0_3px_var(--apl-coral-soft)]" />{eyebrow}
              </span>
            )}
            {title && <h2 className="m-0 text-balance font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.018em] @3xl:text-[27px]">{title}</h2>}
            {subtitle && <p className="m-0 text-[13.5px] leading-snug text-ink-2">{subtitle}</p>}
          </div>

          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 rounded-2xl border border-line bg-[var(--apl-well)] px-4 py-3.5 @3xl:w-[372px] @3xl:shrink-0">
            <span className="row-span-2 font-display text-[38px] font-semibold leading-none tracking-[-0.03em] text-[var(--apl-coral-ink)] tabular @md:text-[44px]"
              aria-label={weekRate != null ? `${weekRate}%` : L.noRate}>
              {weekRate != null ? <><CountUp value={weekRate} duration={600} /><small className="ml-px text-[0.5em] tracking-normal">%</small></> : "—"}
            </span>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">{L.weekRate}</span>
            <span aria-hidden className="flex flex-wrap gap-[3px]">
              <AnimatePresence initial={false}>
                {finished.map(a => (
                  <motion.i key={a.id} layout initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.25 }}
                    className={cx("h-3.5 w-[9px] rounded-[3px] transition-colors duration-300", a.status === "showed" ? "bg-[var(--apl-showed)]" : HATCH)} />
                ))}
              </AnimatePresence>
            </span>
            <p className="col-span-2 m-0 mt-1 text-[12.5px] tabular text-ink-2">
              {fin ? fill(L.rateSub, { showed: wk.showed, noshow: wk.noshow, upcoming: wk.booked + wk.confirmed }) : L.noRate}
            </p>
          </div>
        </header>

        {/* day picker */}
        <div role="tablist" aria-label={L.days} onKeyDown={onTabsKey}
          className="mt-5 grid gap-1 @md:gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(7, days.length))}, minmax(0, 1fr))` }}>
          {days.map((d, i) => {
            const dt = parseDate(d.date)!;
            const dc = counts(d.appts), n = d.appts.length;
            const on = d.date === current?.date;
            const isToday = today === d.date;
            const countText = n === 1 ? L.appt : fill(L.appts, { n });
            const parts = STATUSES.filter(s => dc[s]).map(s => `${dc[s]} ${L[s].toLowerCase()}`).join(", ");
            return (
              <button key={d.date} ref={el => { tabRefs.current[i] = el; }} type="button" role="tab" id={`${uid}-tab-${d.date}`}
                aria-selected={on} aria-controls={panelId} tabIndex={on ? 0 : -1}
                aria-label={`${fmtDow.format(dt)} ${dt.getUTCDate()}${isToday ? `, ${L.today}` : ""}: ${countText}${parts ? ` (${parts})` : ""}`}
                onClick={() => pickDay(d.date)}
                className={cx("group relative isolate grid min-w-0 justify-items-center gap-1 rounded-xl border px-1 pb-2 pt-2 text-center transition-[border-color,transform] duration-200 @md:justify-items-stretch @md:px-3 @md:pb-2.5 @md:pt-2.5 @md:text-left",
                  "hover:-translate-y-px motion-reduce:hover:translate-y-0",
                  on ? "border-transparent" : "border-line bg-[var(--apl-card)] hover:border-line-strong")}>
                {on && (
                  <motion.span layoutId={`${uid}-day`} aria-hidden transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 -z-10 rounded-[inherit] bg-[var(--apl-coral-soft)] shadow-[0_0_0_1.5px_var(--apl-coral),0_12px_22px_-16px_var(--apl-coral)]" />
                )}
                <span className="flex w-full items-center justify-center gap-1.5 @md:justify-between">
                  <span className={cx("font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] @md:text-[11px]", on ? "text-[var(--apl-coral-ink)]" : "text-ink-2")}>{fmtDow.format(dt)}</span>
                  {isToday && (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--apl-coral-ink)] @md:static @md:size-auto @md:rounded @md:px-[5px] @md:py-[3px] @md:font-mono @md:text-[9.5px] @md:font-bold @md:uppercase @md:leading-none @md:tracking-[0.06em] @md:text-[var(--apl-on-coral)]">
                      <span className="sr-only @md:not-sr-only">{L.today}</span>
                    </span>
                  )}
                </span>
                <span className="font-display text-[19px] font-semibold leading-none tracking-[-0.02em] tabular @md:text-[24px]">{dt.getUTCDate()}</span>
                <span className="text-[11px] tabular text-ink-2 @md:text-[12px]">
                  <span className="@2xl:hidden">{n}</span><span className="hidden @2xl:inline">{countText}</span>
                </span>
                <span aria-hidden className="mt-1 flex h-[5px] w-full gap-[2px] overflow-hidden rounded-[3px] bg-line">
                  {STATUSES.map(s => (
                    <motion.i key={s} className={cx(S[s], "min-w-0 bg-[var(--s)]")} initial={false}
                      animate={{ flexGrow: dc[s], opacity: dc[s] ? 1 : 0 }} style={{ flexShrink: 1, flexBasis: 0 }}
                      transition={{ duration: 0.4, ease: EASE }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* selected day */}
        <div role="tabpanel" id={panelId} aria-labelledby={current ? `${uid}-tab-${current.date}` : undefined}>
          <div className="mt-5 flex flex-col gap-3 px-0.5 @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:justify-between">
            <h3 className="m-0 font-display text-[16px] font-semibold tracking-[-0.01em]">
              {current ? fmtLong.format(parseDate(current.date)!) : ""}
              {current && today === current.date && <span className="text-[var(--apl-coral-ink)]"> · {L.today}</span>}
            </h3>
            <div className="flex flex-wrap items-center gap-2 @2xl:ml-auto">
              <dl className="m-0 flex flex-wrap gap-1.5">
                {[[String(appts.length), L.dayAppts], [dFin ? `${Math.round((c.showed / dFin) * 100)}%` : "—", L.dayRate], [dUp ? `${Math.round((c.confirmed / dUp) * 100)}%` : "—", L.dayConfirmed]].map(([v, k]) => (
                  <div key={k} className="inline-flex items-baseline gap-1.5 rounded-full bg-[var(--apl-well)] px-2.5 py-1.5 text-[12.5px] text-ink-2">
                    <dd className="m-0 font-semibold text-ink tabular">{v}</dd><dt className="order-2">{k}</dt>
                  </div>
                ))}
              </dl>
              <button type="button" disabled={!pending.length} onClick={() => current && remind(current.appts.map(a => a.id))}
                className={cx("inline-flex w-full items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors @md:w-auto",
                  pending.length ? "border-[var(--apl-coral-ink)] text-[var(--apl-coral-ink)] hover:bg-[var(--apl-coral-ink)] hover:text-[var(--apl-on-coral)] active:scale-[0.98]"
                    : "border-line-strong text-ink-3")}>
                {pending.length ? <Send /> : <Bell className="size-[13px]" />}
                {pending.length === 0 ? L.bulkNone : pending.length === 1 ? L.bulkOne : fill(L.bulk, { n: pending.length })}
              </button>
            </div>
          </div>

          {/* lanes */}
          <LayoutGroup id={uid}>
            <div onKeyDown={onLanesKey} className="mt-3.5 grid grid-cols-1 items-start gap-2 @md:grid-cols-2 @md:gap-2.5 @3xl:grid-cols-4">
              {STATUSES.map(s => {
                const items = appts.filter(a => a.status === s);
                const laneId = `${uid}-lane-${s}`;
                return (
                  <section key={s} aria-labelledby={laneId}
                    className={cx(S[s], "grid min-w-0 content-start gap-2 rounded-2xl bg-[var(--apl-well)] p-2 @md:p-2.5", !items.length && "@max-md:py-1.5")}>
                    <div className="flex items-center gap-2 px-1 pt-0.5">
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--s)]" />
                      <h4 id={laneId} className="m-0 text-[13px] font-semibold">{L[s]}</h4>
                      {!items.length && <span className="text-[12px] text-ink-3 @md:hidden">· {L.empty}</span>}
                      <motion.span key={items.length} initial={preview ? false : { scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="ml-auto min-w-[24px] rounded-full bg-[var(--apl-card)] px-[7px] py-[3px] text-center text-[11.5px] font-semibold tabular text-[var(--s-ink)] shadow-[inset_0_0_0_1px_var(--line)]">
                        {items.length}
                      </motion.span>
                    </div>
                    <p className={cx("-mt-1.5 mx-1 mb-0.5 text-[11.5px] text-ink-3", !items.length && "@max-md:hidden")}>{L[`${s}Desc` as const]}</p>
                    {items.length > 0 && (
                      <ol className="m-0 grid list-none gap-2 p-0">
                        {items.map(a => {
                          const i = seq++;
                          return (
                            <ApptCard key={a.id} a={a} uid={uid} L={L} isOpen={open === a.id} preview={preview} reduced={reduced}
                              enter={enterAnim.current} delay={Math.min(i * 0.03, 0.3)} flash={flash?.id === a.id ? flash.n : null}
                              onToggle={() => setOpen(o => (o === a.id ? null : a.id))}
                              onMove={st => setStatus(a.id, st, true)} onRemind={() => remind([a.id], a.id)} />
                          );
                        })}
                      </ol>
                    )}
                    {!items.length && (
                      <p className="m-0 hidden rounded-[10px] border border-dashed border-line-strong px-2 py-3.5 text-center text-[12.5px] text-ink-3 @md:block">{L.empty}</p>
                    )}
                  </section>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        {/* footer */}
        <footer className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-line px-1 pt-3 text-[12px] text-ink-3">
          <span aria-hidden className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><i className="h-3 w-[9px] rounded-[2px] bg-[var(--apl-showed)]" />{L.legendShowed}</span>
            <span className="inline-flex items-center gap-1.5"><i className={cx("h-3 w-[9px] rounded-[2px]", HATCH)} />{L.legendNoshow}</span>
          </span>
          {source && <span>{source}</span>}
        </footer>
        <p className="sr-only" aria-live="polite">{live}</p>
      </article>
    </div>
  );
}

/* ---------------- appointment card ---------------- */
function ApptCard({ a, uid, L, isOpen, preview, reduced, enter, delay, flash, onToggle, onMove, onRemind }: {
  a: Appt; uid: string; L: AppointmentPipelineLabels; isOpen: boolean; preview: boolean; reduced: boolean; enter: boolean; delay: number;
  flash: number | null; onToggle: () => void; onMove: (s: AppointmentStatus) => void; onRemind: () => void;
}) {
  const t = clock(a.start), end = clock(a.start + (a.duration || 0));
  const detId = `${uid}-det-${a.id.replace(/[^\w-]/g, "")}`;
  const finished = a.status === "showed" || a.status === "noshow";
  const off = a.reminded || finished;
  const facts: [string, ReactNode][] = ([
    [L.time, a.duration ? `${t.hm}${t.ap !== end.ap ? ` ${t.ap}` : ""} – ${end.hm} ${end.ap}` : `${t.hm} ${t.ap}`],
    [L.staff, a.staff], [L.phone, a.phone], [L.via, a.source],
  ] as [string, ReactNode][]).filter(r => r[1]);
  return (
    <motion.li data-appt={a.id} layout="position" layoutId={`${uid}-appt-${a.id}`}
      initial={enter && !preview ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }}
      transition={{ layout: { type: "spring", stiffness: 380, damping: 34 }, opacity: { duration: 0.3, delay: enter ? delay : 0 }, y: { duration: 0.4, ease: EASE, delay: enter ? delay : 0 } }}
      className={cx(S[a.status], "relative rounded-[11px] bg-[var(--apl-card)] transition-shadow duration-200",
        isOpen ? "z-10 shadow-[0_0_0_1.5px_var(--apl-coral),0_16px_28px_-18px_hsl(var(--shadow-color)/0.45)]"
          : "shadow-[0_0_0_1px_var(--line),0_6px_14px_-12px_hsl(var(--shadow-color)/0.35)] hover:shadow-[0_0_0_1px_var(--line-strong),0_10px_20px_-14px_hsl(var(--shadow-color)/0.4)]")}>
      <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-[3px] bg-[var(--s)] transition-colors duration-300" />
      {flash != null && !reduced && (
        <motion.span key={flash} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"
          initial={{ opacity: 1, boxShadow: "0 0 0 3px var(--s), 0 0 0 9px var(--apl-coral-soft)" }} animate={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} />
      )}
      <button type="button" data-appt-btn aria-expanded={isOpen} aria-controls={detId} onClick={onToggle}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 rounded-[11px] py-2.5 pl-[13px] pr-2.5 text-left">
        <span className="grid min-w-[44px] content-start gap-0.5">
          <b className="text-[14px] font-semibold leading-none tabular">{t.hm}</b>
          <small className="font-mono text-[9.5px] font-semibold leading-none tracking-[0.06em] text-ink-3">{t.ap}</small>
        </span>
        <span className="grid min-w-0 gap-[3px]">
          <span className="text-[13.5px] font-semibold leading-tight [overflow-wrap:anywhere]">{a.name}</span>
          {a.service && <span className="text-[12px] leading-snug text-ink-2 [overflow-wrap:anywhere]">{a.service}</span>}
        </span>
        <Chevron open={isOpen} />
        <span className="col-start-2 col-end-4 mt-0.5 flex flex-wrap items-center gap-1.5">
          {a.staff && (
            <span title={a.staff} className="inline-grid size-[22px] place-items-center rounded-full bg-[var(--apl-well)] text-[9.5px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
              <span aria-hidden>{initialsOf(a.staff)}</span><span className="sr-only">{a.staff}</span>
            </span>
          )}
          {!!a.duration && <span className="text-[11px] tabular text-ink-3">{fill(L.min, { n: a.duration })}</span>}
          {a.reminded && (
            <motion.span initial={a.remindedNow && !preview ? { opacity: 0, scale: 0.7 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 460, damping: 24 }}
              className="inline-flex items-center gap-[3px] rounded-full bg-[var(--apl-coral-soft)] py-[3px] pl-1 pr-1.5 text-[10.5px] font-semibold text-[var(--apl-coral-ink)]">
              <Bell /><span className="sr-only">{L.reminded}</span>
            </motion.span>
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div id={detId} key="det" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="mx-2.5 mb-2.5 ml-[13px] grid gap-2.5 border-t border-dashed border-line-strong pt-2.5">
              <dl className="m-0 grid gap-1.5 text-[12px]">
                {facts.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="text-ink-3">{k}</dt><dd className="m-0 tabular text-ink [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
              </dl>
              {a.note && <p className="m-0 rounded-lg bg-[var(--apl-well)] px-2.5 py-2 text-[12px] leading-snug text-ink-2">{a.note}</p>}
              <p className="m-0 -mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-3">{L.moveTo}</p>
              <div role="group" aria-label={L.moveTo} className="grid grid-cols-2 gap-1">
                {STATUSES.map(s => {
                  const on = a.status === s;
                  return (
                    <button key={s} type="button" data-mv={s} aria-pressed={on} onClick={() => !on && onMove(s)}
                      className={cx(S[s], "inline-flex min-w-0 items-center gap-1.5 rounded-[7px] border px-2 py-[7px] text-[11.5px] font-semibold leading-tight transition-colors",
                        on ? "cursor-default border-[var(--s)] bg-[color-mix(in_oklab,var(--s)_12%,var(--apl-card))] text-[var(--s-ink)]"
                          : "border-line bg-[var(--apl-card)] text-ink-2 hover:border-[var(--s)] hover:text-ink")}>
                      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-[var(--s)]" />{L[s]}
                    </button>
                  );
                })}
              </div>
              <button type="button" disabled={off} onClick={onRemind}
                className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-[9px] text-[12.5px] font-semibold transition-[filter,background-color,color] duration-200",
                  off ? "bg-[var(--apl-well)] text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]" : "bg-[var(--apl-coral-ink)] text-[var(--apl-on-coral)] hover:brightness-110 active:scale-[0.98]")}>
                {a.reminded ? <Bell className="size-[13px]" /> : <Send />}
                {a.reminded ? (a.remindedNow ? L.remindedNow : L.reminded) : finished ? L.remindNa : L.remind}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
