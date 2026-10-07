import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, cx } from "../../ui";
import { useCountUp, usePreviewMode } from "../../lib/hooks";
import type { ReportWeek, WeeklyReportData } from "./data";

/* ------------------------------------------------------------
   Weekly Marketing Report — a one-page report set like a
   newspaper: serif type, hairline rules, one red accent.
   ------------------------------------------------------------ */

export const REPORT_LABELS = {
  week: "Week {n}", weeks: "Report week", prev: "Previous week", next: "Next week",
  copy: "Copy summary", copied: "Copied", print: "Print",
  copiedMsg: "Summary copied to the clipboard.", fallbackMsg: "Copy blocked by the browser. The summary is selected below; press Ctrl+C or ⌘C.",
  issue: "Issue {n}", leadStory: "This week",
  leads: "Leads", booked: "Booked calls", cpl: "Cost per lead", cplShort: "Cost/lead", spend: "Ad spend",
  vs: "vs {label}", noCompare: "No earlier week to compare",
  highlights: "Highlights", lowlights: "Lowlights", channels: "By channel", nextWeek: "Next week",
  channel: "Channel", bookRate: "Book rate", total: "Total",
  tableNote: "Cost per lead counts paid channels only in each row; the total is spend over all leads.",
  progress: "{done} of {total} done", example: "Example data",
  summaryNext: "Next week", announce: "Showing week {n}, {range}.",
};
export type ReportLabels = typeof REPORT_LABELS;

export interface ChecklistToggleDetail { week: number; index: number; text: string; done: boolean }
export interface WeeklyMarketingReportHandle {
  resetChecklists: () => void;
  /** Copies the plain-text summary. Resolves false when the browser blocked it (the text is then shown selected). */
  copySummary: () => Promise<boolean>;
  summaryText: () => string;
}

export interface WeeklyMarketingReportProps {
  data: WeeklyReportData;
  /** Controlled week number. Defaults to the last week in the data. */
  week?: number;
  defaultWeek?: number;
  onWeekChange?: (detail: { week: number; range: string; index: number }) => void;
  onChecklistToggle?: (detail: ChecklistToggleDetail) => void;
  onSummaryCopy?: (detail: { week: number; text: string }) => void;
  labels?: Partial<ReportLabels>;
  className?: string;
  ref?: Ref<WeeklyMarketingReportHandle>;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);

interface Totals { rows: { name: string; spend: number; leads: number; booked: number }[]; spend: number; leads: number; booked: number; cpl: number | null }
interface Compare { spend: number; leads: number; booked: number; cpl: number | null; label: string }

function totalsOf(w: ReportWeek | undefined): Totals {
  const rows = (w?.channels ?? []).map((c, i) => ({ name: c?.name || `Channel ${i + 1}`, spend: n0(c?.spend), leads: n0(c?.leads), booked: n0(c?.booked) }));
  const sum = (k: "spend" | "leads" | "booked") => rows.reduce((a, r) => a + r[k], 0);
  const t = { rows, spend: sum("spend"), leads: sum("leads"), booked: sum("booked"), cpl: null as number | null };
  t.cpl = t.leads > 0 ? t.spend / t.leads : null;
  return t;
}

const SERIF_TEXT = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif';

const PALETTE = [
  "[--paper:#FAF8F2] [--paper2:#F3EFE5] [--wink:#141210] [--wmuted:#4F4A43] [--wfaint:#6C665D] [--rule:#1A1714] [--hair:#D9D3C6] [--red:#B91C1C] [--red-soft:rgb(185_28_28/0.08)] [--grain:rgb(60_45_20/0.035)] [--wshadow:rgb(40_30_15/0.22)]",
  "dark:[--paper:#1A1816] dark:[--paper2:#211E1B] dark:[--wink:#EEE8DC] dark:[--wmuted:#BDB4A4] dark:[--wfaint:#958C7E] dark:[--rule:#D9D1C2] dark:[--hair:#36322C] dark:[--red:#F87171] dark:[--red-soft:rgb(248_113_113/0.10)] dark:[--grain:rgb(255_245_225/0.025)] dark:[--wshadow:rgb(0_0_0/0.6)]",
  "[--ring:var(--red)]",
].join(" ");

/* Printing: only the sheet, black on white, controls hidden. Scoped to this component. */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-wmr-sheet], [data-wmr-sheet] * { visibility: visible !important; }
  [data-wmr-sheet] { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: #fff !important;
    --paper: #fff; --paper2: #fff; --wink: #000; --wmuted: #333; --wfaint: #555; --rule: #000; --hair: #bbb; --red: #B91C1C; --red-soft: transparent; --grain: transparent; color: #000 !important; }
  [data-wmr-sheet] section, [data-wmr-sheet] dl, [data-wmr-sheet] tr { break-inside: avoid; }
  [data-wmr-noprint] { display: none !important; }
}`;

/* animated figure that tweens from the previous week's value */
function Fig({ value, from, format, start }: { value: number; from: number; format: (v: number) => string; start: boolean }) {
  const v = useCountUp(value, { from, duration: 700, start });
  return <>{format(v)}</>;
}

export function WeeklyMarketingReport({
  data, week: weekProp, defaultWeek, onWeekChange, onChecklistToggle, onSummaryCopy, labels, className, ref,
}: WeeklyMarketingReportProps) {
  const L = useMemo(() => ({ ...REPORT_LABELS, ...labels }), [labels]);
  const preview = usePreviewMode();
  const uid = useId();
  const locale = data.locale || "en-US";
  const weeks = useMemo(() => (data.weeks ?? []).filter(Boolean), [data.weeks]);
  const findIdx = useCallback((n: number | undefined) => { const i = n == null ? -1 : weeks.findIndex(w => w.week === n); return i > -1 ? i : weeks.length - 1; }, [weeks]);
  const [innerWeek, setInnerWeek] = useState<number | undefined>(defaultWeek);
  const idx = findIdx(weekProp ?? innerWeek);
  const w = weeks[idx];

  /* page-turn direction + previous figures for the count-ups */
  const lastIdx = useRef(idx);
  const dir = idx === lastIdx.current ? 0 : idx > lastIdx.current ? 1 : -1;
  const lastTotals = useRef<Totals | null>(null);
  const t = useMemo(() => totalsOf(w), [w]);
  const fromTotals = lastTotals.current ?? t;
  useEffect(() => { lastIdx.current = idx; lastTotals.current = t; }, [idx, t]);

  const money = useCallback((v: number, d: number) => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: data.currency || "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    catch { return v.toFixed(d); }
  }, [locale, data.currency]);
  const int = useCallback((v: number) => Math.round(v).toLocaleString(locale), [locale]);
  const pct = useCallback((v: number, d = 1) => v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + "%", [locale]);

  const compareFor = useCallback((i: number): Compare | null => {
    if (i > 0) { const p = totalsOf(weeks[i - 1]); return { ...p, label: fill(L.week, { n: weeks[i - 1].week }) }; }
    const p = weeks[i]?.prior;
    if (!p) return null;
    const leads = n0(p.leads), spend = n0(p.spend);
    return { spend, leads, booked: n0(p.booked), cpl: leads > 0 ? spend / leads : null, label: p.label || "" };
  }, [weeks, L.week]);
  const c = compareFor(idx);

  /* ---------- checklists: per-week state, kept while switching weeks ---------- */
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const stateFor = (wk: ReportWeek) => checks[String(wk.week)] ?? (wk.next ?? []).map(n => !!n?.done);
  const toggleCheck = (i: number, done: boolean) => {
    if (!w) return;
    const next = [...stateFor(w)];
    next[i] = done;
    setChecks(cs => ({ ...cs, [String(w.week)]: next }));
    onChecklistToggle?.({ week: w.week, index: i, text: w.next?.[i]?.text ?? "", done });
  };
  const resetChecklists = useCallback(() => setChecks({}), []);
  const [seenData, setSeenData] = useState(data);
  if (seenData !== data) { setSeenData(data); setChecks({}); }

  /* ---------- week switching ---------- */
  const [live, setLive] = useState("");
  const weekBtns = useRef<Record<number, HTMLButtonElement | null>>({});
  const go = (i: number, focus = false) => {
    if (i < 0 || i >= weeks.length || i === idx) return;
    const nw = weeks[i];
    if (weekProp === undefined) setInnerWeek(nw.week);
    onWeekChange?.({ week: nw.week, range: nw.range || "", index: i });
    setLive(fill(L.announce, { n: nw.week, range: nw.range || "" }));
    if (focus) requestAnimationFrame(() => weekBtns.current[nw.week]?.focus({ preventScroll: true }));
  };
  const onWeeksKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    go(idx + (e.key === "ArrowLeft" ? -1 : 1), true);
  };

  /* ---------- summary + copy ---------- */
  const summaryText = useCallback(() => {
    if (!w) return "";
    const tt = totalsOf(w), cc = compareFor(idx);
    const chg = (a: number, b: number | null | undefined) => (cc && b ? ` (${a >= b ? "+" : "−"}${pct(Math.abs(((a - b) / b) * 100))} ${fill(L.vs, { label: cc.label })})` : "");
    const lines: string[] = [];
    lines.push(`${data.publication || "Weekly Report"} — ${fill(L.week, { n: w.week })}${w.range ? ", " + w.range : ""}${data.client ? " · " + data.client : ""}`);
    lines.push("");
    if (w.headline) lines.push(w.headline.toUpperCase());
    if (w.lead) lines.push(w.lead);
    lines.push("");
    lines.push(`${L.leads}: ${int(tt.leads)}${chg(tt.leads, cc?.leads)}`);
    lines.push(`${L.booked}: ${int(tt.booked)}${chg(tt.booked, cc?.booked)}`);
    if (tt.cpl != null) lines.push(`${L.cpl}: ${money(tt.cpl, 2)}${cc?.cpl ? chg(tt.cpl, cc.cpl) : ""}`);
    lines.push(`${L.spend}: ${money(tt.spend, 0)}${chg(tt.spend, cc?.spend)}`);
    const block = (title: string, items?: string[]) => { if (!items?.length) return; lines.push("", title + ":"); items.forEach(s => lines.push(`- ${s}`)); };
    block(L.highlights, w.highlights);
    block(L.lowlights, w.lowlights);
    const st = checks[String(w.week)] ?? (w.next ?? []).map(n => !!n?.done);
    if (w.next?.length) { lines.push("", L.summaryNext + ":"); w.next.forEach((n, i) => lines.push(`[${st[i] ? "x" : " "}] ${n?.text ?? ""}`)); }
    return lines.join("\n");
  }, [w, idx, compareFor, data.publication, data.client, L, int, money, pct, checks]);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const [status, setStatus] = useState("");
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  useEffect(() => { if (fallbackText != null) { fallbackRef.current?.focus(); fallbackRef.current?.select(); } }, [fallbackText]);

  const copySummary = useCallback(async () => {
    const text = summaryText();
    if (!text || !w) return false;
    setFallbackText(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied"); setStatus(L.copiedMsg);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => { setCopyState("idle"); setStatus(""); }, 2200);
      onSummaryCopy?.({ week: w.week, text });
      return true;
    } catch {
      setCopyState("fallback"); setStatus(L.fallbackMsg); setFallbackText(text);
      return false;
    }
  }, [summaryText, w, L.copiedMsg, L.fallbackMsg, onSummaryCopy]);

  useImperativeHandle(ref, () => ({ resetChecklists, copySummary, summaryText }), [resetChecklists, copySummary, summaryText]);

  /* ---------- derived view data ---------- */
  const change = (cur: number, prev: number | null | undefined) => (prev ? ((cur - prev) / prev) * 100 : null);
  const kpis = [
    { k: L.leads, v: t.leads, from: fromTotals.leads, f: int, d: c ? change(t.leads, c.leads) : null, better: "up" as const },
    { k: L.booked, v: t.booked, from: fromTotals.booked, f: int, d: c ? change(t.booked, c.booked) : null, better: "up" as const },
    { k: L.cpl, v: t.cpl ?? 0, from: fromTotals.cpl ?? 0, f: (x: number) => (t.cpl == null ? "—" : money(x, 2)), d: c && c.cpl != null && t.cpl != null ? change(t.cpl, c.cpl) : null, better: "down" as const },
    { k: L.spend, v: t.spend, from: fromTotals.spend, f: (x: number) => money(x, 0), d: c ? change(t.spend, c.spend) : null, better: "none" as const },
  ];
  const rates = t.rows.map(r => (r.leads > 0 ? r.booked / r.leads : 0));
  const bestRate = Math.max(0, ...rates);
  const words = (data.publication || "Weekly Report").split(" ");
  const state = w ? stateFor(w) : [];
  const doneN = state.filter(Boolean).length;

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 28, rotateY: d * -7 }),
    center: { opacity: 1, x: 0, rotateY: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -28, rotateY: d * 7 }),
  };

  const secH = "m-0 flex items-baseline justify-between gap-2.5 border-b border-[var(--rule)] pb-1.5 font-serif text-[19px] leading-[1.15] font-bold tracking-[-0.01em]";
  const secSmall = "font-sans text-[10px] leading-none font-semibold tracking-[0.14em] text-[var(--wfaint)] uppercase";
  const rateBar = (r: number, best: boolean) => (
    <span className="inline-flex items-center gap-2">
      <i aria-hidden className="inline-block h-[5px] w-[30px] bg-[var(--hair)]">
        <motion.i className={cx("block h-full", best ? "bg-[var(--red)]" : "bg-[var(--wink)]")} initial={preview ? false : { width: 0 }} animate={{ width: `${(r * 100).toFixed(1)}%` }} transition={{ duration: 0.6, delay: 0.2 }} />
      </i>
      <b className={cx("font-bold", best && "text-[var(--red)]")}>{pct(r * 100, 0)}</b>
    </span>
  );
  const dash = <span className="text-[var(--wfaint)]">—</span>;
  const td = "py-[9px] pl-2.5 text-right whitespace-nowrap @max-lg:flex @max-lg:justify-between @max-lg:gap-2 @max-lg:py-[3px] @max-lg:pl-0 @max-lg:before:content-[attr(data-label)] @max-lg:before:font-sans @max-lg:before:text-[9.5px] @max-lg:before:font-bold @max-lg:before:leading-[1.6] @max-lg:before:tracking-[0.12em] @max-lg:before:uppercase @max-lg:before:text-[var(--wmuted)]";

  return (
    <div className={cx("@container w-full max-w-[960px] text-[var(--wink)]", PALETTE, className)} style={{ fontFamily: SERIF_TEXT }}>
      <style>{PRINT_CSS}</style>

      {/* ---------- toolbar ---------- */}
      <div data-wmr-noprint className="mb-3.5 flex flex-col items-stretch gap-2.5 @lg:flex-row @lg:flex-wrap @lg:items-center @lg:justify-between">
        <div role="group" aria-label={L.weeks} onKeyDown={onWeeksKey}
          className="inline-flex items-center justify-between gap-0.5 rounded-full border border-[var(--hair)] bg-[var(--paper)] p-[3px] font-sans @lg:justify-start">
          <button type="button" aria-label={L.prev} disabled={idx <= 0} onClick={() => go(idx - 1)}
            className="grid h-[30px] w-8 place-items-center rounded-full text-[var(--wmuted)] transition-colors hover:text-[var(--wink)] disabled:opacity-35 disabled:hover:text-[var(--wmuted)]">
            <Icon name="chevronRight" className="size-3.5 rotate-180" strokeWidth={1.8} />
          </button>
          {weeks.map((x, i) => (
            <span key={x.week} className="contents">
              {i > 0 && <span aria-hidden className="hidden text-[12px] text-[var(--wfaint)] @lg:inline">·</span>}
              <button type="button" ref={el => { weekBtns.current[x.week] = el; }} aria-pressed={i === idx} onClick={() => go(i)}
                className={cx("relative isolate rounded-full px-2.5 py-2 text-[12.5px] leading-none font-semibold whitespace-nowrap transition-colors duration-200 @lg:px-3",
                  i === idx ? "text-[var(--paper)]" : "text-[var(--wmuted)] hover:text-[var(--wink)]")}>
                {i === idx && <motion.span layoutId={`wmr-week-${uid}`} className="absolute inset-0 -z-10 rounded-full bg-[var(--wink)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                {fill(L.week, { n: x.week })}
              </button>
            </span>
          ))}
          <button type="button" aria-label={L.next} disabled={idx >= weeks.length - 1} onClick={() => go(idx + 1)}
            className="grid h-[30px] w-8 place-items-center rounded-full text-[var(--wmuted)] transition-colors hover:text-[var(--wink)] disabled:opacity-35 disabled:hover:text-[var(--wmuted)]">
            <Icon name="chevronRight" className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex gap-1.5 font-sans">
          <button type="button" onClick={() => void copySummary()} disabled={!w}
            className={cx("inline-flex flex-1 items-center justify-center gap-[7px] rounded-full border bg-[var(--paper)] px-[13px] py-[9px] text-[12.5px] leading-none font-semibold transition-colors duration-200 active:scale-[0.98] @lg:flex-none",
              copyState === "copied" ? "border-[var(--red)] text-[var(--red)]" : "border-[var(--hair)] text-[var(--wink)] hover:border-[var(--wink)]")}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={copyState === "copied" ? "y" : "n"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 28 }} className="grid">
                <Icon name={copyState === "copied" ? "check" : "copy"} className="size-3.5" />
              </motion.span>
            </AnimatePresence>
            {copyState === "copied" ? L.copied : L.copy}
          </button>
          <button type="button" onClick={() => window.print()}
            className="inline-flex flex-1 items-center justify-center gap-[7px] rounded-full border border-[var(--hair)] bg-[var(--paper)] px-[13px] py-[9px] text-[12.5px] leading-none font-semibold text-[var(--wink)] transition-colors duration-200 hover:border-[var(--wink)] active:scale-[0.98] @lg:flex-none">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden className="size-3.5"><path d="M4.5 6V2.5h7V6" /><rect x="2" y="6" width="12" height="5.5" rx="1.2" /><path d="M4.5 9.5h7v4h-7z" /></svg>
            {L.print}
          </button>
        </div>
      </div>
      <p data-wmr-noprint aria-live="polite" className={cx("m-0 font-sans text-[12px] leading-snug text-[var(--wfaint)]", status ? "mb-3" : "sr-only")}>{status}</p>
      {fallbackText != null && (
        <textarea data-wmr-noprint ref={fallbackRef} readOnly value={fallbackText} aria-label={L.copy}
          className="mb-3.5 box-border min-h-[140px] w-full resize-y rounded-[10px] border border-[var(--hair)] bg-[var(--paper)] p-3 font-mono text-[12.5px] leading-[1.55] text-[var(--wink)]" />
      )}

      {/* ---------- the sheet ---------- */}
      <div className="relative">
        <span data-wmr-noprint aria-hidden className="absolute inset-0 translate-x-[5px] translate-y-[6px] rounded-[4px] border border-[var(--hair)] bg-[var(--paper2)] @lg:translate-x-2 @lg:translate-y-2" />
        <article data-wmr-sheet
          className="relative rounded-[4px] border border-[var(--hair)] px-4 pt-5 pb-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_26px_50px_-36px_var(--wshadow),0_2px_5px_-3px_var(--wshadow)] @2xl:px-6 @2xl:pt-6 @2xl:pb-[18px] @3xl:px-9 @3xl:pt-[30px] @3xl:pb-[22px] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_26px_50px_-36px_var(--wshadow)]"
          style={{ background: "radial-gradient(var(--grain) 1px, transparent 1.2px) 0 0 / 4px 4px, radial-gradient(120% 80% at 50% 0%, var(--paper), var(--paper2))" }}>
          {/* masthead */}
          <header className="grid gap-2.5 text-center">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 font-sans text-[10.5px] leading-tight font-semibold tracking-[0.14em] text-[var(--wmuted)] uppercase @lg:justify-between">
              <span>{data.client}</span><span>{data.desk}</span>
            </div>
            <h2 className="m-0 font-serif text-[30px] leading-[0.98] font-semibold tracking-[-0.02em] text-balance [font-variant:small-caps] @lg:text-[42px] @3xl:text-[58px]">
              {words.length > 1 ? <>{words.slice(0, -1).join(" ")} <span className="text-[var(--red)]">{words[words.length - 1]}</span></> : words[0]}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t-[3px] border-b border-double border-t-[var(--rule)] border-b-[var(--rule)] py-[7px] text-[12.5px] leading-tight text-[var(--wmuted)] italic @lg:justify-between">
              <AnimatePresence mode="wait" initial={false}>
                <motion.b key={w?.week} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }}
                  className="font-bold tracking-[0.02em] text-[var(--wink)] not-italic">{w ? fill(L.week, { n: w.week }) : ""}</motion.b>
              </AnimatePresence>
              <span>{w?.range}</span>
              <span>{w ? fill(L.issue, { n: w.issue ?? w.week }) : ""}</span>
            </div>
          </header>

          {/* body — page-turn between weeks */}
          <div className="[perspective:1600px]">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              {w && (
                <motion.div key={w.week} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
                  className="mt-[22px] grid gap-6 [transform-origin:50%_0]">
                  {/* lead story */}
                  <section className="grid gap-3">
                    <span className="font-sans text-[10.5px] leading-none font-bold tracking-[0.16em] text-[var(--red)] uppercase">{L.leadStory}</span>
                    <h3 className="m-0 max-w-[26ch] text-[26px] leading-[1.06] font-bold tracking-[-0.02em] text-balance @2xl:text-[33px] @3xl:text-[40px]">{w.headline}</h3>
                    <p className="m-0 text-[15.5px] leading-[1.62] text-pretty hyphens-auto @lg:text-[16px] @3xl:columns-2 @3xl:gap-[34px] @3xl:text-justify @3xl:[column-rule:1px_solid_var(--hair)]
                      first-letter:float-left first-letter:mt-1.5 first-letter:mr-2 first-letter:font-serif first-letter:text-[3.5em] first-letter:leading-[0.8] first-letter:font-bold first-letter:text-[var(--red)]">
                      {w.lead}
                    </p>
                  </section>

                  {/* key figures */}
                  <dl className="m-0 grid grid-cols-2 border-t-2 border-b border-t-[var(--rule)] border-b-[var(--rule)] @2xl:grid-cols-4">
                    {kpis.map((x, i) => {
                      const r = x.d == null ? null : Math.round(x.d * 10) / 10;
                      const good = r == null ? null : x.better === "up" ? r > 0 : x.better === "down" ? r < 0 : null;
                      return (
                        <div key={x.k} className={cx("grid min-w-0 content-start gap-1.5 py-3 @2xl:py-3.5",
                          i % 2 === 0 ? "pr-2.5 @2xl:pr-[18px]" : "border-l border-[var(--hair)] pl-3 @2xl:px-[18px]",
                          i >= 2 && "border-t border-t-[var(--hair)] @2xl:border-t-0", i === 2 && "@2xl:border-l @2xl:border-l-[var(--hair)] @2xl:pl-[18px]", i === 0 && "@2xl:pl-0")}>
                          <dt className="font-sans text-[10px] leading-tight font-bold tracking-[0.14em] text-[var(--wmuted)] uppercase">{x.k}</dt>
                          <dd className="m-0">
                            <span className="block text-[27px] leading-none font-bold tracking-[-0.025em] [font-variant-numeric:lining-nums_tabular-nums] @2xl:text-[32px] @3xl:text-[38px]">
                              <Fig value={x.v} from={x.from} format={x.f} start />
                            </span>
                            <span className="mt-1.5 block text-[12.5px] leading-snug text-[var(--wmuted)] italic tabular">
                              {r == null || !c ? L.noCompare : (
                                <><b className={cx("font-bold not-italic", good === false && r !== 0 ? "text-[var(--red)]" : "text-[var(--wink)]")}>
                                  {r > 0 ? "▲" : r < 0 ? "▼" : "▶"} {pct(Math.abs(r))}</b> {fill(L.vs, { label: c.label })}</>
                              )}
                            </span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>

                  {/* highlights / lowlights */}
                  <div className="grid gap-[22px] @lg:grid-cols-2 @lg:gap-0">
                    {([[L.highlights, w.highlights, "up"], [L.lowlights, w.lowlights, "down"]] as const).map(([title, items, kind], i) => (
                      <section key={title} className={cx("grid min-w-0 content-start gap-2.5", i === 0 ? "@lg:pr-6" : "@lg:border-l @lg:border-[var(--hair)] @lg:pl-6")}>
                        <h3 className={secH}>{title}<small aria-hidden className={secSmall}>{kind === "up" ? "▲" : "▼"}</small></h3>
                        <ul className="m-0 grid list-none gap-[9px] p-0">
                          {(items ?? []).map((s, j) => (
                            <motion.li key={j} initial={preview ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + j * 0.06, duration: 0.35 }}
                              className="relative pl-5 text-[14.5px] leading-normal">
                              <span aria-hidden className={cx("absolute top-[0.6em] left-0.5 size-2", kind === "up" ? "bg-[var(--wink)] [clip-path:polygon(50%_0,100%_100%,0_100%)]" : "bg-[var(--red)] [clip-path:polygon(0_0,100%_0,50%_100%)]")} />
                              {s}
                            </motion.li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>

                  {/* channel table + checklist */}
                  <div className="grid gap-6 @3xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] @3xl:gap-0">
                    <section className="grid min-w-0 content-start gap-2.5 @3xl:pr-6">
                      <h3 className={secH}>{L.channels}<small className={secSmall}>{w.range}</small></h3>
                      <table className="w-full border-collapse text-[14px] leading-[1.3] [font-variant-numeric:lining-nums_tabular-nums] @max-lg:block">
                        <caption className="sr-only">{`${L.channels}, ${fill(L.week, { n: w.week })}`}</caption>
                        <thead className="@max-lg:hidden">
                          <tr>
                            {[L.channel, L.spend, L.leads, L.cplShort, L.booked, L.bookRate].map((h, i) => (
                              <th key={h} scope="col" className={cx("pb-2 font-sans text-[9.5px] leading-tight font-bold tracking-[0.12em] whitespace-nowrap text-[var(--wmuted)] uppercase", i === 0 ? "text-left" : "pl-2.5 text-right")}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="@max-lg:block">
                          {t.rows.map((r, i) => {
                            const best = rates[i] === bestRate && bestRate > 0;
                            return (
                              <tr key={r.name} className="border-t border-[var(--hair)] transition-colors duration-200 hover:bg-[var(--red-soft)] @max-lg:grid @max-lg:grid-cols-2 @max-lg:gap-x-3.5 @max-lg:py-2.5">
                                <th scope="row" className="py-[9px] text-left text-[14px] font-bold @max-lg:col-span-2 @max-lg:py-0 @max-lg:pb-1 @max-lg:text-[15px]">{r.name}</th>
                                <td data-label={L.spend} className={td}>{r.spend > 0 ? money(r.spend, 0) : dash}</td>
                                <td data-label={L.leads} className={td}>{int(r.leads)}</td>
                                <td data-label={L.cplShort} className={td}>{r.spend > 0 && r.leads > 0 ? money(r.spend / r.leads, 2) : dash}</td>
                                <td data-label={L.booked} className={td}>{int(r.booked)}</td>
                                <td data-label={L.bookRate} className={td}>{r.leads > 0 ? rateBar(rates[i], best) : dash}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="@max-lg:block">
                          <tr className="border-t-2 border-[var(--rule)] font-bold @max-lg:grid @max-lg:grid-cols-2 @max-lg:gap-x-3.5 @max-lg:py-2.5">
                            <th scope="row" className="py-[9px] text-left font-bold @max-lg:col-span-2 @max-lg:py-0 @max-lg:pb-1 @max-lg:text-[15px]">{L.total}</th>
                            <td data-label={L.spend} className={td}>{money(t.spend, 0)}</td>
                            <td data-label={L.leads} className={td}>{int(t.leads)}</td>
                            <td data-label={L.cplShort} className={td}>{t.cpl == null ? dash : money(t.cpl, 2)}</td>
                            <td data-label={L.booked} className={td}>{int(t.booked)}</td>
                            <td data-label={L.bookRate} className={td}>{t.leads > 0 ? rateBar(t.booked / t.leads, false) : dash}</td>
                          </tr>
                        </tfoot>
                      </table>
                      <p className="m-0 text-[12px] leading-snug text-[var(--wfaint)] italic">{L.tableNote}</p>
                    </section>

                    <section className="grid min-w-0 content-start gap-2.5 @3xl:border-l @3xl:border-[var(--hair)] @3xl:pl-6">
                      <h3 className={secH}>{L.nextWeek}<small className={secSmall}>{fill(L.progress, { done: doneN, total: state.length })}</small></h3>
                      <span aria-hidden className="block h-[3px] bg-[var(--hair)]">
                        <motion.span className="block h-full bg-[var(--red)]" initial={false} animate={{ width: state.length ? `${(doneN / state.length) * 100}%` : "0%" }} transition={{ duration: 0.4 }} />
                      </span>
                      <ul className="m-0 grid list-none gap-1 p-0">
                        {(w.next ?? []).map((n, i) => {
                          const on = !!state[i];
                          return (
                            <li key={i}>
                              <label className="group grid cursor-pointer grid-cols-[20px_minmax(0,1fr)] items-start gap-2.5 py-1.5 text-[14.5px] leading-[1.45]">
                                <input type="checkbox" checked={on} onChange={e => toggleCheck(i, e.target.checked)} className="peer sr-only" />
                                <span aria-hidden className={cx("mt-px grid size-[18px] place-items-center border-[1.5px] transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--red)]",
                                  on ? "border-[var(--red)] bg-[var(--red)] text-[var(--paper)]" : "border-[var(--wink)] group-hover:border-[var(--red)]")}>
                                  <motion.svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3"
                                    initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }} transition={{ duration: 0.22 }}>
                                    <motion.path d="M2.5 6.3 5 8.6 9.6 3.6" initial={false} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 0.28 }} />
                                  </motion.svg>
                                </span>
                                <span className="min-w-0">
                                  <span className={cx("bg-[linear-gradient(var(--red),var(--red))] bg-[position:0_58%] bg-no-repeat [box-decoration-break:clone] [-webkit-box-decoration-break:clone] transition-[background-size,color] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none",
                                    on ? "bg-[length:100%_1.5px] text-[var(--wfaint)]" : "bg-[length:0_1.5px]")}>{n?.text}</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <footer className="mt-[22px] flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--rule)] pt-2 text-[11.5px] leading-snug text-[var(--wfaint)] italic">
            <span>{data.preparedBy}</span><span>{[data.client, L.example].filter(Boolean).join(" · ")}</span>
          </footer>
        </article>
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  );
}
