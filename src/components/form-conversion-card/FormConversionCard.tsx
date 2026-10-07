import { useId, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Icon, Segmented, cx } from "../../ui";
import { useCountUp, usePreviewMode } from "../../lib/hooks";
import type { FormConversionData, FormStepType } from "./data";

/* ------------------------------------------------------------
   Form Conversion Card — a mini form mirrored by field-by-field
   completion bars. The field that loses the most people is
   highlighted in both.
   ------------------------------------------------------------ */

export const FORM_CONVERSION_LABELS = {
  device: "Device", conversion: "Form conversion", conversionSub: "{n} of {views} views submitted",
  completion: "Start to submit", completionSub: "of people who start, finish",
  time: "Avg. time to submit", timeSub: "for people who finished",
  ofViews: "{pct} of views", didntStart: "{pct} didn't start", leftHere: "−{pct} left here", leftSubmit: "−{pct} left at submit",
  worst: "Biggest drop-off", reached: "reached", completed: "completed", left: "left",
  retained: "Completed", lost: "Left at this step",
  show: "Show suggestions", hide: "Hide suggestions",
  tipTitle: "Start with the {field} field",
  gain: "If {field} kept pace with your other fields ({rate}), you could get about {extra} more submissions: {from} → {to} conversion.",
  estimate: "Estimate",
  tipFallback: "{rate} of people who reach {field} leave there. Try making it optional, shorter, or easier to fill in.",
  noTip: "No field drop-off to fix.",
  selectHint: "Select a bar or a field to see its numbers.",
  mobileNote: "Showing the mobile layout", desktopNote: "Showing the desktop layout", allNote: "All devices combined",
  steps: "Completion by step",
};
export type FormConversionLabels = typeof FORM_CONVERSION_LABELS;

export interface FieldSelectDetail {
  id: string; label: string; type: FormStepType; device: string;
  count: number; reached: number | null; lost: number; dropRate: number | null; worst: boolean;
}

export interface FormConversionCardProps {
  data: FormConversionData;
  /** Controlled segment key (e.g. "all" | "desktop" | "mobile"). */
  device?: string;
  defaultDevice?: string;
  onDeviceChange?: (device: string) => void;
  /** Clicking a bar or a field in the mini form selects it (click again to clear). */
  onFieldSelect?: (detail: FieldSelectDetail | null) => void;
  /** Start with the suggestions panel open. */
  defaultSuggestionsOpen?: boolean;
  locale?: string;
  labels?: Partial<FormConversionLabels>;
  className?: string;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const SKEL = [58, 66, 44, 52, 61];
const TYPES: FormStepType[] = ["view", "start", "field", "submit"];

const PALETTE = [
  "[--card:#FFFFFF] [--fink:#0B2730] [--muted:#44606A] [--faint:#5B747D] [--fline:#DCEBEE] [--tint:#EEF9FB] [--tint2:#D6F1F6] [--skel:#E1EEF1]",
  "[--acc:#155E75] [--acc2:#1C88A8] [--acc-ink:#FFFFFF] [--acc-soft:rgb(21_94_117/0.12)] [--worst:#AE3A0B] [--worst-soft:rgb(174_58_11/0.09)] [--good:#0F7A5A] [--glow:rgb(11_39_48/0.22)]",
  "dark:[--card:#0D1F25] dark:[--fink:#E2F5F8] dark:[--muted:#9DBCC4] dark:[--faint:#85A5AE] dark:[--fline:#1D363E] dark:[--tint:#10272E] dark:[--tint2:#133943] dark:[--skel:#1A3540]",
  "dark:[--acc:#67E8F9] dark:[--acc2:#2BB9D3] dark:[--acc-ink:#062027] dark:[--acc-soft:rgb(103_232_249/0.13)] dark:[--worst:#FF9466] dark:[--worst-soft:rgb(255_148_102/0.13)] dark:[--good:#5EDBB0] dark:[--glow:rgb(0_0_0/0.65)]",
  /* gallery tokens re-pointed so the shared primitives pick up the petrol palette */
  "[--ink:var(--fink)] [--ink-2:var(--muted)] [--ink-3:var(--muted)] [--line:var(--fline)] [--surface:var(--card)] [--sunken:var(--tint)] [--ring:var(--acc)]",
].join(" ");

const DEVICE_ICON: Record<string, ReactNode> = {
  all: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5"><rect x="1.5" y="3" width="9" height="7" rx="1.5" /><rect x="11" y="5.5" width="3.5" height="7.5" rx="1" /><path d="M4 13h4" /></svg>,
  desktop: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5"><rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5" /><path d="M5.5 14h5M8 11v3" /></svg>,
  mobile: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5"><rect x="4.5" y="1.5" width="7" height="13" rx="1.8" /><path d="M7 12.2h2" /></svg>,
};
const BulbIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[18px]">
    <path d="M7.5 15.5h5M8.3 18h3.4M10 2.2a5.6 5.6 0 0 0-3.4 10c.6.5.9 1.1.9 1.8v.2h5v-.2c0-.7.3-1.3.9-1.8A5.6 5.6 0 0 0 10 2.2Z" />
  </svg>
);

interface Row { id: string; label: string; type: FormStepType; i: number; count: number; prev: number | null; lost: number; dropRate: number | null; share: number | null }

function RowCount({ value, locale }: { value: number; locale: string }) {
  const v = useCountUp(value, { duration: 600 });
  return <>{Math.round(v).toLocaleString(locale)}</>;
}

export function FormConversionCard({
  data, device: deviceProp, defaultDevice, onDeviceChange, onFieldSelect, defaultSuggestionsOpen = false,
  locale = "en-US", labels, className,
}: FormConversionCardProps) {
  const L = useMemo(() => ({ ...FORM_CONVERSION_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const preview = usePreviewMode();
  const keys = Object.keys(data.segments ?? {});
  const [innerDevice, setInnerDevice] = useState(defaultDevice ?? keys[0] ?? "all");
  const want = deviceProp ?? innerDevice;
  const device = keys.includes(want) ? want : keys[0] ?? "all";
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(defaultSuggestionsOpen);
  const hl = hover ?? focusId;

  const int = (v: number) => Math.round(v).toLocaleString(locale);
  const pct = (r: number | null) => (r == null || !Number.isFinite(r) ? "—" : (r * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%");
  const time = (s: number | null | undefined) => {
    if (s == null || !Number.isFinite(s)) return "—";
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
  };

  /* ---------- model: counts → rates ---------- */
  const m = useMemo(() => {
    const seg = data.segments?.[device];
    const counts = seg?.counts ?? [];
    const rows: Row[] = (data.steps ?? []).map((s, i) => ({
      id: String(s?.id || `step-${i + 1}`), label: s?.label || `Step ${i + 1}`, type: TYPES.includes(s?.type) ? s.type : "field",
      i, count: Math.max(0, Number.isFinite(counts[i]) ? counts[i] : 0), prev: null, lost: 0, dropRate: null, share: null,
    }));
    const views = rows.length ? rows[0].count : 0;
    rows.forEach((r, i) => {
      const prev = i > 0 ? rows[i - 1].count : null;
      r.prev = prev;
      r.lost = prev != null ? Math.max(0, prev - r.count) : 0;
      r.dropRate = prev != null && prev > 0 ? r.lost / prev : null;
      r.share = views > 0 ? r.count / views : null;
    });
    const fields = rows.filter(r => r.type === "field" && r.dropRate != null);
    const worstRow = fields.reduce<Row | null>((a, r) => (!a || r.dropRate! > a.dropRate! ? r : a), null);
    const sub = rows.find(r => r.type === "submit") ?? rows[rows.length - 1];
    const start = rows.find(r => r.type === "start");
    return {
      rows, views, fields, seg, worst: worstRow && worstRow.lost > 0 ? worstRow : null,
      submitted: sub ? sub.count : 0, started: start ? start.count : null,
    };
  }, [data, device]);

  const conv = m.views > 0 ? m.submitted / m.views : null;
  const comp = m.started ? m.submitted / m.started : null;
  const selRow = selected ? m.rows.find(r => r.id === selected) ?? null : null;
  const isWorst = (id: string) => m.worst?.id === id;

  /* ---------- actions ---------- */
  const changeDevice = (k: string) => {
    if (k === device) return;
    if (deviceProp === undefined) setInnerDevice(k);
    onDeviceChange?.(k);
  };
  const select = (id: string | null) => {
    const next = id && id !== selected ? m.rows.find(r => r.id === id) ?? null : null;
    setSelected(next ? next.id : null);
    onFieldSelect?.(next ? { id: next.id, label: next.label, type: next.type, device, count: next.count, reached: next.prev, lost: next.lost, dropRate: next.dropRate, worst: isWorst(next.id) } : null);
  };
  const linkProps = (id: string) => ({
    onPointerEnter: () => setHover(id), onPointerLeave: () => setHover(null),
    onFocus: () => setFocusId(id), onBlur: () => setFocusId(null),
    onClick: () => select(id),
    "aria-pressed": selected === id,
  });

  /* ---------- suggestion + estimate ---------- */
  const tip = useMemo(() => {
    const w = m.worst;
    if (!w) return null;
    const vars = { rate: pct(w.dropRate), lost: int(w.lost), field: w.label };
    const body = fill(data.tips?.[w.id] ?? L.tipFallback, vars);
    let gain: { before: string; extra: string; after: string } | null = null;
    const others = m.fields.filter(r => r !== w && (r.prev ?? 0) > 0);
    if (others.length && w.count > 0 && m.views > 0 && w.prev) {
      const rate = others.reduce((a, r) => a + r.count / r.prev!, 0) / others.length;
      const extra = Math.max(0, (w.prev * rate - w.count) * (m.submitted / w.count));
      const rounded = extra >= 100 ? Math.round(extra / 10) * 10 : Math.round(extra);
      if (rounded > 0) {
        const text = fill(L.gain, { field: w.label, rate: pct(rate), extra: "\u0000", from: pct(m.submitted / m.views), to: pct((m.submitted + rounded) / m.views) });
        const [before, after = ""] = text.split("\u0000");
        gain = { before, extra: int(rounded), after };
      }
    }
    return { title: fill(L.tipTitle, vars), body, gain };
  }, [m, data.tips, L, locale]); // pct/int depend only on locale

  const viewRow = m.rows.find(r => r.type === "view");
  const startRow = m.rows.find(r => r.type === "start");
  const subRow = m.rows.find(r => r.type === "submit");
  const fieldRows = m.rows.filter(r => r.type === "field");
  const isMobile = device === "mobile";
  const tipId = `${uid}-tip`;

  const kpiVal = "font-display text-[26px] leading-none font-bold tracking-[-0.02em] tabular @2xl:text-[31px]";

  return (
    <div className={cx("@container w-full max-w-[980px] text-[var(--fink)]", PALETTE, className)}>
      <article className="relative rounded-[22px] border border-[var(--fline)] bg-[var(--card)] p-3.5 shadow-[0_30px_60px_-46px_var(--glow),0_2px_6px_-4px_var(--glow)] @md:p-5 @2xl:px-[26px] @2xl:pt-[26px] @2xl:pb-[22px]">
        {/* ---------- header ---------- */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3.5">
          <div className="grid max-w-[48ch] min-w-0 gap-1.5">
            {data.eyebrow && <span className="font-mono text-[10.5px] leading-none font-semibold tracking-[0.1em] text-[var(--acc)] uppercase">{data.eyebrow}</span>}
            {data.title && <h2 className="m-0 font-display text-[19px] leading-[1.18] font-bold tracking-[-0.015em] text-balance @2xl:text-[23px]">{data.title}</h2>}
            {data.subtitle && <p className="m-0 text-[13.5px] text-[var(--muted)]">{data.subtitle}</p>}
          </div>
          {keys.length > 1 && (
            <Segmented ariaLabel={L.device} value={device} onChange={changeDevice}
              className="w-full rounded-xl bg-[var(--tint)]! p-1 @md:w-auto" buttonClassName="flex-1 @md:flex-none px-2 @md:px-3"
              activeClassName="text-[var(--acc)]!" indicatorClassName="shadow-[0_1px_3px_-1px_var(--glow),0_0_0_1px_var(--fline)]"
              options={keys.map(k => ({ value: k, label: <><span className="hidden @sm:inline-flex">{DEVICE_ICON[k]}</span>{data.segments[k]?.label || k}</> }))} />
          )}
        </header>

        {/* ---------- KPIs ---------- */}
        <dl className="m-0 mt-5 grid grid-cols-2 gap-2.5 @xl:grid-cols-3">
          <div className="relative col-span-2 grid content-start gap-1.5 overflow-hidden rounded-[14px] bg-[var(--acc)] px-4 py-3.5 text-[var(--acc-ink)] @xl:col-span-1">
            <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.22),transparent)]" />
            <dt className="font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] uppercase opacity-85">{L.conversion}</dt>
            <dd className="m-0"><CountUp value={(conv ?? 0) * 100} duration={600} format={v => (conv == null ? "—" : pct(v / 100))} className={kpiVal} /></dd>
            <dd className="m-0 text-[12.5px] leading-snug tabular opacity-90">{fill(L.conversionSub, { n: int(m.submitted), views: int(m.views) })}</dd>
          </div>
          <div className="grid min-w-0 content-start gap-1.5 rounded-[14px] bg-[var(--tint)] px-3.5 py-3.5 @md:px-4">
            <dt className="font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] text-[var(--faint)] uppercase">{L.completion}</dt>
            <dd className="m-0"><CountUp value={(comp ?? 0) * 100} duration={600} format={v => (comp == null ? "—" : pct(v / 100))} className={kpiVal} /></dd>
            <dd className="m-0 text-[12px] leading-snug text-[var(--muted)] @md:text-[12.5px]">{L.completionSub}</dd>
          </div>
          <div className="grid min-w-0 content-start gap-1.5 rounded-[14px] bg-[var(--tint)] px-3.5 py-3.5 @md:px-4">
            <dt className="font-mono text-[10.5px] leading-tight font-semibold tracking-[0.08em] text-[var(--faint)] uppercase">{L.time}</dt>
            <dd className={cx("m-0", kpiVal)}>{time(m.seg?.avgSeconds)}</dd>
            <dd className="m-0 text-[12px] leading-snug text-[var(--muted)] @md:text-[12.5px]">{L.timeSub}</dd>
          </div>
        </dl>

        {/* ---------- body ---------- */}
        <div className="mt-[18px] grid items-start gap-4 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] @3xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @3xl:gap-[22px]">
          {/* mock form */}
          <div className="grid content-start justify-items-center rounded-2xl bg-[var(--tint)] bg-[radial-gradient(circle_at_1px_1px,var(--tint2)_1px,transparent_1.4px)] bg-[length:14px_14px] px-3 py-4 @2xl:px-[18px] @2xl:py-5">
            <motion.div
              initial={false}
              animate={{ maxWidth: isMobile ? 228 : 320, borderRadius: isMobile ? 26 : 14 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="w-full overflow-hidden border border-[var(--fline)] bg-[var(--card)] shadow-[0_22px_40px_-30px_var(--glow)]">
              <div aria-hidden className={cx("relative flex h-[26px] items-center gap-[5px] px-3 transition-colors duration-300", isMobile ? "justify-center" : "border-b border-[var(--fline)] bg-[var(--tint)]")}>
                <AnimatePresence mode="wait" initial={false}>
                  {isMobile ? (
                    <motion.b key="notch" initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 0.85, scaleX: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      className="h-2.5 w-[54px] rounded-full bg-[var(--fink)]" />
                  ) : (
                    <motion.span key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex w-full items-center gap-[5px]">
                      <i className="size-[7px] rounded-full bg-[#FF6B5E]/70" /><i className="size-[7px] rounded-full bg-[#F5BF4F]/70" /><i className="size-[7px] rounded-full bg-[#5DC466]/70" />
                      <b className="ml-2.5 h-2 max-w-[60%] flex-1 rounded-full bg-[var(--skel)]" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className={cx("grid gap-1 rounded-[10px] p-2.5 pb-3 transition-shadow duration-200", startRow && hl === startRow.id && "shadow-[inset_0_0_0_2px_var(--acc-soft)]")}>
                <button type="button" disabled={!viewRow} {...(viewRow ? linkProps(viewRow.id) : {})}
                  aria-label={viewRow ? `${viewRow.label}: ${int(viewRow.count)}` : undefined}
                  className={cx("mb-1 grid w-full gap-1.5 rounded-[10px] p-1.5 text-left transition-[background-color,box-shadow] duration-200 focus-visible:outline-offset-1",
                    viewRow && (selected === viewRow.id ? "bg-[var(--acc-soft)] shadow-[inset_0_0_0_1.5px_var(--acc)]" : hl === viewRow.id && "bg-[var(--acc-soft)]"))}>
                  <span className="font-display text-[14px] leading-tight font-bold">{data.form?.title || data.title || "Form"}</span>
                  <span aria-hidden className="grid gap-[5px]"><span className="h-1.5 rounded-full bg-[var(--skel)]" /><span className="h-1.5 w-[62%] rounded-full bg-[var(--skel)]" /></span>
                </button>
                {fieldRows.map((r, k) => {
                  const worst = isWorst(r.id);
                  const on = selected === r.id, lit = hl === r.id;
                  return (
                    <button key={r.id} type="button" {...linkProps(r.id)}
                      aria-label={`${r.label} field: ${int(r.prev ?? 0)} ${L.reached}, ${int(r.count)} ${L.completed}, ${pct(r.dropRate)} ${L.left}${worst ? ". " + L.worst : ""}`}
                      className={cx("grid w-full gap-1.5 rounded-[10px] p-1.5 text-left transition-[background-color,box-shadow] duration-200 focus-visible:outline-offset-1",
                        on ? (worst ? "bg-[var(--worst-soft)] shadow-[inset_0_0_0_1.5px_var(--worst)]" : "bg-[var(--acc-soft)] shadow-[inset_0_0_0_1.5px_var(--acc)]")
                          : lit && (worst ? "bg-[var(--worst-soft)]" : "bg-[var(--acc-soft)]"))}>
                      <span className={cx("flex items-center justify-between gap-2 text-[11.5px] leading-tight font-semibold", worst ? "text-[var(--worst)]" : "text-[var(--muted)]")}>
                        <span>{r.label}</span>
                        <motion.span layout="position" className={cx("rounded-full px-1.5 py-[3px] font-mono text-[10.5px] leading-none font-bold tabular transition-colors duration-300",
                          worst ? "bg-[var(--worst)] text-[var(--card)]" : "bg-[var(--tint)] text-[var(--acc)]")}>
                          {worst ? `−${Math.round((r.dropRate ?? 0) * 100)}%` : r.prev ? `${Math.round((r.count / r.prev) * 100)}%` : "—"}
                        </motion.span>
                      </span>
                      <span className={cx("relative flex h-8 items-center rounded-lg border bg-[var(--card)] px-2.5 transition-[border-color,box-shadow] duration-300",
                        worst ? "border-[var(--worst)] shadow-[0_0_0_3px_var(--worst-soft)]" : "border-[var(--fline)]")}>
                        <span aria-hidden className="h-[7px] rounded-full bg-[var(--skel)]" style={{ width: `${SKEL[k % SKEL.length]}%` }} />
                        {worst && <motion.span aria-hidden initial={preview ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="absolute right-2 grid size-4 place-items-center rounded-full bg-[var(--worst)] text-[10px] font-bold text-[var(--card)]">!</motion.span>}
                      </span>
                    </button>
                  );
                })}
                <button type="button" disabled={!subRow} {...(subRow ? linkProps(subRow.id) : {})}
                  aria-label={subRow ? `${subRow.label}: ${int(subRow.count)}, ${fill(L.ofViews, { pct: pct(subRow.share) })}` : undefined}
                  className={cx("w-full rounded-[10px] p-1.5 text-left transition-[background-color,box-shadow] duration-200 focus-visible:outline-offset-1",
                    subRow && (selected === subRow.id ? "bg-[var(--acc-soft)] shadow-[inset_0_0_0_1.5px_var(--acc)]" : hl === subRow.id && "bg-[var(--acc-soft)]"))}>
                  <span className="mt-1 flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[var(--acc)] px-3 font-display text-[12.5px] font-bold text-[var(--acc-ink)]">
                    <span className="text-center leading-tight">{data.form?.button || "Submit"}</span>
                    {subRow && <span className="rounded-full bg-[color-mix(in_oklab,var(--acc-ink)_14%,transparent)] px-1.5 py-[3px] font-mono text-[10.5px] leading-none tabular">{pct(m.views > 0 ? subRow.count / m.views : null)}</span>}
                  </span>
                </button>
              </div>
            </motion.div>
            <p className="mt-3 mb-0 text-center text-[11.5px] text-[var(--faint)]">{isMobile ? L.mobileNote : device === "desktop" ? L.desktopNote : L.allNote}</p>
          </div>

          {/* step bars */}
          <div className="min-w-0">
            <ol aria-label={L.steps} className="m-0 grid list-none gap-1 p-0">
              {m.rows.map((r, i) => {
                const worst = isWorst(r.id);
                const on = selected === r.id, lit = hl === r.id;
                const w = m.views > 0 ? (r.count / m.views) * 100 : 0;
                const l = m.views > 0 ? (r.lost / m.views) * 100 : 0;
                const dropText = r.prev == null ? "" : r.type === "start" ? fill(L.didntStart, { pct: pct(r.dropRate) })
                  : r.type === "submit" ? fill(L.leftSubmit, { pct: pct(r.dropRate) }) : fill(L.leftHere, { pct: pct(r.dropRate) });
                const sr = [`${r.label}: ${int(r.count)}`];
                if (i > 0) sr.push(fill(L.ofViews, { pct: pct(r.share) }));
                if (dropText) sr.push(`${int(r.lost)} ${L.left} (${pct(r.dropRate)})`);
                if (worst) sr.push(L.worst);
                return (
                  <li key={r.id}>
                    <button type="button" {...linkProps(r.id)}
                      className={cx("grid w-full gap-[7px] rounded-xl px-2.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200 focus-visible:outline-offset-1 @2xl:px-3",
                        worst && "bg-[var(--worst-soft)]",
                        on ? (worst ? "shadow-[inset_0_0_0_1.5px_var(--worst)]" : "bg-[var(--tint)] shadow-[inset_0_0_0_1.5px_var(--acc)]") : lit && !worst && "bg-[var(--tint)]")}>
                      <span aria-hidden className="flex items-baseline justify-between gap-2.5">
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] leading-tight font-semibold">
                          <span className={cx("flex-none rounded-[5px] px-[5px] py-1 font-mono text-[10.5px] leading-none text-[var(--faint)]", on || lit ? "bg-[var(--card)]" : "bg-[var(--tint)]")}>{String(i + 1).padStart(2, "0")}</span>
                          <span>{r.label}</span>
                          {worst && (
                            <motion.span initial={preview ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                              className="rounded-full bg-[var(--worst)] px-1.5 py-1 font-mono text-[9.5px] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-[var(--card)] uppercase">{L.worst}</motion.span>
                          )}
                        </span>
                        <span className="font-display text-[16px] leading-none font-bold tracking-[-0.01em] tabular @2xl:text-[18px]"><RowCount value={r.count} locale={locale} /></span>
                      </span>
                      <span aria-hidden className="relative flex h-3 overflow-hidden rounded-full bg-[var(--skel)]">
                        <motion.span className="h-full rounded-l-full bg-gradient-to-r from-[var(--acc)] to-[var(--acc2)]"
                          initial={preview ? false : { width: "0%" }} animate={{ width: `${w.toFixed(2)}%` }}
                          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: preview ? 0 : i * 0.04 }} />
                        <motion.span className="h-full"
                          style={{ backgroundImage: `repeating-linear-gradient(-45deg, ${worst ? "var(--worst)" : "color-mix(in oklab, var(--muted) 45%, transparent)"} 0 3px, transparent 3px 6px)` }}
                          initial={preview ? false : { width: "0%" }} animate={{ width: `${l.toFixed(2)}%` }}
                          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: preview ? 0 : 0.15 + i * 0.04 }} />
                      </span>
                      <span aria-hidden className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted)] tabular @md:text-[12px]">
                        <span>{i === 0 ? "100%" : fill(L.ofViews, { pct: pct(r.share) })}</span>
                        <span className={cx("font-semibold", worst && "text-[var(--worst)]")}>{dropText}</span>
                      </span>
                      <span className="sr-only">{sr.join(", ") + "."}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div aria-hidden className="mx-3 mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--faint)]">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3.5 rounded-[3px] bg-gradient-to-r from-[var(--acc)] to-[var(--acc2)]" />{L.retained}</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3.5 rounded-[3px] shadow-[inset_0_0_0_1px_var(--fline)]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--muted) 55%, transparent) 0 2px, transparent 2px 4px)" }} />{L.lost}</span>
            </div>
            <p aria-live="polite" className="mx-3 mt-2.5 mb-0 min-h-[1.4em] text-[12.5px] text-[var(--muted)] tabular">
              {selRow ? (
                <><b className="font-semibold text-[var(--fink)]">{selRow.label}</b> · {selRow.prev != null
                  ? `${int(selRow.prev)} ${L.reached} · ${int(selRow.count)} ${L.completed} · ${int(selRow.lost)} ${L.left} (${pct(selRow.dropRate)})`
                  : int(selRow.count)}</>
              ) : L.selectHint}
            </p>
          </div>
        </div>

        {/* ---------- suggestions ---------- */}
        <footer className="mt-[18px] grid gap-3 border-t border-dashed border-[var(--fline)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <button type="button" aria-expanded={tipOpen} aria-controls={tipId} onClick={() => setTipOpen(o => !o)}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--acc)] bg-[var(--card)] px-3.5 text-[13px] font-semibold text-[var(--acc)] transition-colors duration-200 hover:bg-[var(--acc)] hover:text-[var(--acc-ink)] active:scale-[0.98] @md:w-auto">
              <BulbIcon />
              {tipOpen ? L.hide : L.show}
              <motion.span animate={{ rotate: tipOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }} className="grid"><Icon name="chevronDown" className="size-[15px]" strokeWidth={1.8} /></motion.span>
            </button>
            {data.period && <span className="text-[12px] text-[var(--faint)]">{data.period}</span>}
          </div>
          <AnimatePresence initial={false}>
            {tipOpen && (
              <motion.div id={tipId} key="tip" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
                <div className="grid items-start gap-3.5 rounded-[14px] border border-[color-mix(in_oklab,var(--worst)_30%,transparent)] bg-[var(--worst-soft)] p-3.5 @md:grid-cols-[36px_minmax(0,1fr)] @md:px-[18px] @md:py-4">
                  <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--worst)] text-[var(--card)]"><BulbIcon /></span>
                  <div>
                    {tip ? (
                      <>
                        <p className="m-0 mb-1 font-display text-[14.5px] leading-snug font-bold">{tip.title}</p>
                        <p className="m-0 text-[13.5px] leading-[1.55] text-[var(--muted)]">{tip.body}</p>
                        {tip.gain && (
                          <p className="m-0 mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px] text-[var(--fink)] tabular">
                            <span className="rounded-full border border-[var(--fline)] bg-[var(--card)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">{L.estimate}</span>
                            <span>{tip.gain.before}<b className="text-[var(--good)]">{tip.gain.extra}</b>{tip.gain.after}</span>
                          </p>
                        )}
                      </>
                    ) : <p className="m-0 text-[13.5px] text-[var(--muted)]">{L.noTip}</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </article>
    </div>
  );
}
