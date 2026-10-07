import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCountUp, useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { Segmented, cx } from "../../ui";
import type { AuditData, AuditIssue, Severity, SeverityFilter } from "./data";

/* ------------------------------------------------------------
   SEO Audit Scorecard — violet report card: letter grade, four
   category rings and issues grouped by severity.
   ------------------------------------------------------------ */

export interface AuditScores {
  cats: { id: string; label: string; score: number; gained: number; max: number; open: number }[];
  overall: number; potential: number; grade: string; potentialGrade: string;
}
export interface IssueFixDetail {
  id: string; fixed: boolean; issue: AuditIssue; category: string; categoryScore: number; overall: number; grade: string;
}
export interface AuditRunDetail {
  overall: number; grade: string; verified: string[]; categories: { id: string; score: number }[];
}
export interface SeoAuditScorecardHandle {
  setFixed: (id: string, fixed: boolean) => void;
  rerun: () => void;
  scores: () => AuditScores;
}
export interface SeoAuditScorecardProps {
  data: AuditData;
  /** Controlled severity filter; leave out to let the card manage it. */
  severity?: SeverityFilter;
  defaultSeverity?: SeverityFilter;
  onSeverityChange?: (severity: SeverityFilter) => void;
  /** Controlled category scope (category id or null). */
  category?: string | null;
  defaultCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onIssueFix?: (detail: IssueFixDetail) => void;
  onAuditRun?: (detail: AuditRunDetail) => void;
  ref?: Ref<SeoAuditScorecardHandle>;
  className?: string;
}

const PALETTE = cx(
  "[--sa-card:#ffffff] [--sa-ink:#1a1530] [--sa-muted:#57506e] [--sa-faint:#625c7b] [--sa-line:#e6e3ef] [--sa-tint:#f6f5fa] [--sa-track:#ece9f4]",
  "[--sa-violet:#6d28d9] [--sa-violet-soft:#f1ecfe] [--sa-head:#2e1065] [--sa-head-2:#4c1d95] [--sa-head-muted:#d8ccff]",
  "[--sa-good:#15803d] [--sa-good-soft:#e9f6ee] [--sa-warn:#b45309] [--sa-warn-soft:#fef3e2] [--sa-bad:#b91c1c] [--sa-bad-soft:#fdecec]",
  "[--sa-good-hi:#4ade80] [--sa-warn-hi:#fbbf24] [--sa-bad-hi:#f87171]",
  "dark:[--sa-card:#15121f] dark:[--sa-ink:#ece9f5] dark:[--sa-muted:#aba4c2] dark:[--sa-faint:#938cab] dark:[--sa-line:#2a2540] dark:[--sa-tint:#1c1829] dark:[--sa-track:#2a2540]",
  "dark:[--sa-violet:#a78bfa] dark:[--sa-violet-soft:rgb(167_139_250/0.14)] dark:[--sa-head:#1f0f45] dark:[--sa-head-2:#3b1d7a] dark:[--sa-head-muted:#c4b5fd]",
  "dark:[--sa-good:#4ade80] dark:[--sa-good-soft:rgb(74_222_128/0.12)] dark:[--sa-warn:#fbbf24] dark:[--sa-warn-soft:rgb(251_191_36/0.12)] dark:[--sa-bad:#f87171] dark:[--sa-bad-soft:rgb(248_113_113/0.13)]",
);

const SEVS: Severity[] = ["critical", "warning", "notice"];
const FILTERS: SeverityFilter[] = ["all", "critical", "warning", "notice", "fixed"];
const LABEL: Record<SeverityFilter, string> = { all: "All", critical: "Critical", warning: "Warning", notice: "Notice", fixed: "Fixed" };
const GRADES: [number, string][] = [[90, "A"], [80, "B"], [70, "C"], [60, "D"], [0, "F"]];
const gradeOf = (s: number) => GRADES.find(g => s >= g[0])![1];
type Tone = "good" | "warn" | "bad";
const toneOf = (s: number): Tone => (s >= 90 ? "good" : s >= 50 ? "warn" : "bad");
const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const SEV_VAR: Record<SeverityFilter, string> = { all: "violet", critical: "bad", warning: "warn", notice: "violet", fixed: "good" };
const toneStyle = (k: string) => ({ "--c": `var(--sa-${k})`, "--c-soft": `var(--sa-${k === "violet" ? "violet-soft" : `${k}-soft`})`, "--c-hi": `var(--sa-${k === "violet" ? "violet" : `${k}-hi`})` }) as CSSProperties;
const STEPS = (pages?: number) => [`Fetching ${pages ?? ""} pages`.replace(/\s+/g, " "), "Checking performance", "Checking accessibility", "Checking best practices", "Checking on-page SEO", "Working out scores"];

type Issue = AuditIssue & { fixed: boolean; verified: boolean };

/* ---------------- icons ---------------- */
function Glyph({ d, className = "size-3.5", stroke = 1.7 }: { d: ReactNode; className?: string; stroke?: number }) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>{d}</svg>;
}
const G: Record<string, ReactNode> = {
  critical: <><path d="M8 1.8 15 14H1z" /><path d="M8 6.4v3.4M8 11.9v.1" /></>,
  warning: <><circle cx="8" cy="8" r="6.2" /><path d="M8 4.8v3.7M8 10.9v.1" /></>,
  notice: <><circle cx="8" cy="8" r="6.2" /><path d="M8 7.4v3.8M8 4.9v.1" /></>,
  fixed: <path d="m3.2 8.4 3 3 6.6-6.8" />,
  chev: <path d="m4 6 4 4 4-4" />,
  globe: <><circle cx="8" cy="8" r="6.3" /><path d="M1.8 8h12.4M8 1.7c2 2 2 10.6 0 12.6M8 1.7c-2 2-2 10.6 0 12.6" /></>,
  rerun: <><path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" /><path d="M13.6 2.2v3.4h-3.4" /></>,
  x: <path d="m5 5 6 6M11 5l-6 6" />,
  ok: <><circle cx="8" cy="8" r="6.3" /><path d="m5.2 8.2 2 2 3.8-4" /></>,
  shield: <><path d="M8 1.8 13 3.8v4c0 3-2.2 5.3-5 6.4-2.8-1.1-5-3.4-5-6.4v-4z" /><path d="m5.8 8 1.6 1.6 3-3.2" /></>,
};

/* ---------------- ring ---------------- */
function Ring({ value, size, stroke, track, color, start, className }: { value: number; size: number; stroke: number; track: string; color: string; start: boolean; className?: string }) {
  const preview = usePreviewMode();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false" className={cx("-rotate-90", className)}>
      <circle cx="50" cy="50" r="42" fill="none" stroke={track} strokeWidth={stroke} />
      <motion.circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray="100 100"
        initial={preview ? false : { strokeDashoffset: 100 }} animate={{ strokeDashoffset: start ? 100 - value : 100 }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} style={{ transition: "stroke 0.4s ease" }} />
    </svg>
  );
}
function Num({ value, start }: { value: number; start: boolean }) {
  return <>{Math.round(useCountUp(value, { start, duration: 700 }))}</>;
}

/* ============================================================ */
export function SeoAuditScorecard({
  data, severity: sevProp, defaultSeverity = "all", onSeverityChange, category: catProp, defaultCategory = null, onCategoryChange,
  onIssueFix, onAuditRun, ref, className,
}: SeoAuditScorecardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const started = inView || preview;

  /* ---- normalised data ---- */
  const cats = useMemo(() => (data.categories ?? []).filter(Boolean).map(c => ({ id: c.id, label: c.label || c.id, base: clamp100(c.score ?? 0), weight: Math.max(0, c.weight ?? 1) })), [data.categories]);
  const initialIssues = useCallback((): Issue[] => (data.issues ?? []).filter(Boolean).map(x => ({
    ...x, severity: SEVS.includes(x.severity) ? x.severity : "notice", category: cats.some(c => c.id === x.category) ? x.category : cats[0]?.id ?? "",
    impact: Math.max(0, x.impact ?? 0), urls: x.urls ?? [], fixed: !!x.fixed, verified: !!x.fixed,
  })), [data.issues, cats]);
  const [issues, setIssuesState] = useState<Issue[]>(initialIssues);
  const issuesRef = useRef(issues);
  const setIssues = (next: Issue[]) => { issuesRef.current = next; setIssuesState(next); };

  const [sevInner, setSevInner] = useState<SeverityFilter>(defaultSeverity);
  const severity = sevProp ?? sevInner;
  const setSeverity = (s: SeverityFilter) => { if (sevProp === undefined) setSevInner(s); onSeverityChange?.(s); };
  const [catInner, setCatInner] = useState<string | null>(defaultCategory);
  const rawCat = catProp !== undefined ? catProp : catInner;
  const category = rawCat && cats.some(c => c.id === rawCat) ? rawCat : null;
  const setCategory = (c: string | null) => { if (catProp === undefined) setCatInner(c); onCategoryChange?.(c); };

  const [openId, setOpenId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState(data.lastRun ?? "");
  const [scan, setScan] = useState<{ on: boolean; step: number }>({ on: false, step: 0 });
  const [done, setDone] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const timers = useRef<number[]>([]);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const focusAfter = useRef<{ kind: "checkbox"; id: string } | { kind: "filter"; f: SeverityFilter } | { kind: "rerun" } | null>(null);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const say = (t: string) => { setAnnounce(""); later(() => setAnnounce(t), 60); };

  /* ---- scoring ---- */
  const scoreOf = useCallback((list: Issue[]): AuditScores => {
    const out = cats.map(c => {
      const mine = list.filter(i => i.category === c.id);
      const gained = mine.filter(i => i.fixed).reduce((s, i) => s + i.impact, 0);
      const left = mine.filter(i => !i.fixed).reduce((s, i) => s + i.impact, 0);
      return { id: c.id, label: c.label, weight: c.weight, score: Math.round(clamp100(c.base + gained)), gained: Math.round(Math.min(gained, 100 - c.base)), max: Math.round(clamp100(c.base + gained + left)), open: mine.filter(i => !i.fixed).length };
    });
    const w = out.reduce((s, c) => s + c.weight, 0) || 1;
    const overall = Math.round(out.reduce((s, c) => s + c.score * c.weight, 0) / w);
    const potential = Math.round(out.reduce((s, c) => s + c.max * c.weight, 0) / w);
    return { cats: out.map(({ weight: _w, ...rest }) => rest), overall, potential, grade: gradeOf(overall), potentialGrade: gradeOf(potential) };
  }, [cats]);
  const S = useMemo(() => scoreOf(issues), [issues, scoreOf]);

  /* ---- actions ---- */
  const setFixed = (id: string, fixed: boolean, fromUi = false) => {
    const cur = issuesRef.current, it = cur.find(i => i.id === id);
    if (!it || it.fixed === fixed) return;
    const next = cur.map(i => (i.id === id ? { ...i, fixed, verified: fixed ? i.verified : false } : i));
    setIssues(next);
    const sc = scoreOf(next), c = sc.cats.find(x => x.id === it.category);
    if (fromUi) {
      const stillVisible = severity === "all" || (fixed ? severity === "fixed" : severity === it.severity);
      focusAfter.current = stillVisible ? { kind: "checkbox", id } : { kind: "filter", f: fixed ? "fixed" : it.severity };
    }
    say(`${it.title} ${fixed ? "marked as fixed" : "reopened"}. ${c?.label} is now ${c?.score}. Overall ${sc.overall}, grade ${sc.grade}.`);
    const { fixed: _f, verified: _v, ...raw } = it;
    onIssueFix?.({ id, fixed, issue: { ...raw, fixed }, category: it.category, categoryScore: c?.score ?? 0, overall: sc.overall, grade: sc.grade });
  };

  const rerun = () => {
    if (scan.on || preview) return;
    timers.current.forEach(t => window.clearTimeout(t)); timers.current = [];
    const steps = STEPS(data.pages);
    const stepMs = reduced ? 160 : 340;
    setDone(null);
    setScan({ on: true, step: 0 });
    say("Re-running audit");
    steps.forEach((_, i) => later(() => setScan({ on: true, step: i + 1 }), stepMs * (i + 1)));
    later(() => {
      const cur = issuesRef.current;
      const verified = cur.filter(i => i.fixed && !i.verified).map(i => i.id);
      const next = cur.map(i => (i.fixed ? { ...i, verified: true } : i));
      setIssues(next);
      setLastRun("just now");
      setScan({ on: false, step: 0 });
      const sc = scoreOf(next);
      const msg = verified.length
        ? `Audit complete. ${verified.length} fixes verified · overall ${sc.overall} · grade ${sc.grade}.`
        : `Audit complete. No changes since the last run · overall ${sc.overall} · grade ${sc.grade}.`;
      setDone(msg);
      say(msg);
      focusAfter.current = { kind: "rerun" };
      onAuditRun?.({ overall: sc.overall, grade: sc.grade, verified, categories: sc.cats.map(c => ({ id: c.id, score: c.score })) });
    }, stepMs * (steps.length + 1) + (reduced ? 0 : 200));
  };

  useImperativeHandle(ref, () => ({ setFixed: (id, f) => setFixed(id, f), rerun, scores: () => scoreOf(issuesRef.current) }));

  /* focus management after re-render */
  const rerunRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const root = rootRef.current;
    if (f.kind === "rerun") rerunRef.current?.focus({ preventScroll: true });
    else if (f.kind === "checkbox") (root?.querySelector(`#${uid}-cb-${CSS.escape(f.id)}`) as HTMLElement | null)?.focus({ preventScroll: true });
    else (root?.querySelectorAll<HTMLElement>(`[data-sev-filter] [role=radio]`)[FILTERS.indexOf(f.f)])?.focus();
  });

  /* ---- view model ---- */
  const inCat = issues.filter(i => !category || i.category === category);
  const count = (f: SeverityFilter) => f === "all" ? inCat.length : f === "fixed" ? inCat.filter(i => i.fixed).length : inCat.filter(i => !i.fixed && i.severity === f).length;
  const groupKeys: SeverityFilter[] = severity === "all" ? [...SEVS, "fixed"] : [severity];
  const groups = groupKeys.map(k => ({
    k, items: inCat.filter(i => (k === "fixed" ? i.fixed : !i.fixed && i.severity === k)).sort((a, b) => b.impact - a.impact || a.title.localeCompare(b.title)),
  })).filter(g => g.items.length);
  const catLabel = (id: string) => cats.find(c => c.id === id)?.label ?? "";
  const overallShown = useCountUp(S.overall, { start: started, duration: 800 });
  const sealTone = toneOf(S.overall);

  const onGroupsKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !openId) return;
    const id = openId;
    setOpenId(null);
    (rootRef.current?.querySelector(`#${uid}-btn-${CSS.escape(id)}`) as HTMLElement | null)?.focus();
  };

  const sevOptions = FILTERS.map(f => ({
    value: f,
    label: (
      <span className="inline-flex items-center gap-1.5 @max-md:flex-col @max-md:gap-0.5" style={toneStyle(SEV_VAR[f])}>
        <span className="inline-flex items-center gap-1.5">{f !== "all" && <i aria-hidden className="block size-[7px] rounded-full bg-[var(--c)] @max-md:hidden" />}{LABEL[f]}</span>
        <span className="inline-flex items-center gap-1">{f !== "all" && <i aria-hidden className="block size-1.5 rounded-full bg-[var(--c)] @md:hidden" />}<b className="font-semibold tabular text-[var(--sa-faint)] group-aria-checked:text-[var(--sa-ink)]">{count(f)}</b></span>
      </span>
    ),
  }));

  return (
    <article ref={rootRef} aria-label={`SEO audit: ${data.title ?? data.site ?? ""}`} aria-busy={scan.on || undefined}
      className={cx("@container relative w-full max-w-[980px] font-sans text-[var(--sa-ink)]", PALETTE, className)}>
      <div className="relative overflow-hidden rounded-[22px] border border-[var(--sa-line)] bg-[var(--sa-card)] elev-3 @max-md:rounded-2xl">

        {/* ===== header band (dark in both themes) ===== */}
        <header className="grain relative grid items-center gap-x-7 gap-y-5 px-4 py-5 text-white @md:px-6 @md:py-6 @2xl:grid-cols-[minmax(0,1fr)_auto] @3xl:px-8 @3xl:py-7
          bg-[radial-gradient(70%_120%_at_100%_0%,color-mix(in_oklab,var(--sa-head-2)_95%,transparent),transparent_62%),repeating-linear-gradient(0deg,rgb(255_255_255/0.07)_0_1px,transparent_1px_24px),linear-gradient(var(--sa-head),var(--sa-head))]">
          <div className="grid min-w-0 gap-2 @max-2xl:order-2">
            {data.eyebrow && <span className="font-mono text-[11px] leading-none font-semibold tracking-[0.12em] text-[var(--sa-head-muted)] uppercase">{data.eyebrow}</span>}
            {data.title && <h2 className="m-0 font-display text-[22px] leading-[1.1] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] @md:text-[26px] @3xl:text-[30px]">{data.title}</h2>}
            {data.site && <span className="inline-flex items-center gap-[7px] font-mono text-[13px] leading-[1.2] font-medium text-[var(--sa-head-muted)] [overflow-wrap:anywhere]"><Glyph d={G.globe} className="size-[13px]" stroke={1.4} />{data.site}</span>}
            <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[12.5px] text-[var(--sa-head-muted)] tabular">
              {data.pages != null && <li><b className="font-semibold text-white">{data.pages.toLocaleString("en-US")}</b> pages crawled</li>}
              {lastRun && <li>Last run <motion.b key={lastRun} initial={preview ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-block font-semibold text-white">{lastRun}</motion.b></li>}
            </ul>
            <button ref={rerunRef} type="button" onClick={rerun} disabled={scan.on}
              className="group/rr mt-2 inline-flex items-center gap-2 justify-self-start rounded-[10px] border border-white/30 bg-white/10 py-[9px] pr-3.5 pl-3 text-[13px] leading-none font-semibold text-white transition-colors duration-200 hover:enabled:border-white/50 hover:enabled:bg-white/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-progress disabled:opacity-75">
              <motion.span className="grid" animate={scan.on && !reduced ? { rotate: -360 } : { rotate: 0 }} transition={scan.on ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0.3 }}>
                <Glyph d={G.rerun} className="size-3.5 transition-transform duration-500 group-hover/rr:group-enabled/rr:-rotate-[120deg] motion-reduce:transition-none" />
              </motion.span>
              {scan.on ? "Re-running…" : "Re-run audit"}
            </button>
          </div>

          <div className="flex items-center gap-x-[18px] gap-y-1.5 @max-2xl:order-1">
            <div role="img" aria-label={`Grade ${S.grade}, overall score ${S.overall} / 100`} className="relative size-[96px] shrink-0 @md:size-[112px] @3xl:size-32" style={toneStyle(sealTone)}>
              <Ring value={S.overall} size={128} stroke={7} track="rgb(255 255 255 / 0.14)" color="var(--c-hi)" start={started} className="size-full drop-shadow-[0_0_14px_color-mix(in_oklab,var(--c-hi)_35%,transparent)]" />
              <div className="absolute inset-0 grid place-content-center justify-items-center gap-0.5">
                <span className="relative grid h-[40px] place-items-center overflow-hidden @md:h-[46px] @3xl:h-[52px]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.b key={S.grade} initial={{ scale: 0.6, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 1.2, opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}
                      className="font-display text-[40px] leading-[0.9] font-bold tracking-[-0.04em] text-white @md:text-[46px] @3xl:text-[52px]">{S.grade}</motion.b>
                  </AnimatePresence>
                </span>
                <small className="font-mono text-[10px] leading-none font-semibold tracking-[0.1em] text-[var(--sa-head-muted)] uppercase">Grade</small>
              </div>
            </div>
            <div className="grid gap-1">
              <span className="font-mono text-[10.5px] leading-none font-semibold tracking-[0.1em] text-[var(--sa-head-muted)] uppercase">Overall score</span>
              <span className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em] tabular @md:text-[40px]">{Math.round(overallShown)}<small className="ml-[3px] text-[0.42em] tracking-normal text-[var(--sa-head-muted)]">/ 100</small></span>
              <span className="max-w-[20ch] text-[12.5px] leading-[1.35] text-[var(--sa-head-muted)]">
                {S.potential > S.overall ? <>Fix everything to reach <b className="font-semibold text-[var(--sa-good-hi)]">{S.potential} · {S.potentialGrade}</b></> : "Every issue is fixed"}
              </span>
            </div>
          </div>
        </header>

        {/* ===== body ===== */}
        <div className="relative px-3 pt-4 pb-3.5 @md:px-5 @md:pt-5 @3xl:px-7 @3xl:pt-[22px] @3xl:pb-5">
          <div inert={scan.on} className={cx("transition-[filter,opacity] duration-300", scan.on && "opacity-60 blur-[2px] motion-reduce:blur-none")}>
            <AnimatePresence initial={false}>
              {done && (
                <motion.div key="done" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
                  <p className="m-0 mb-3.5 flex items-center gap-2 rounded-[10px] bg-[var(--sa-good-soft)] px-3 py-2.5 text-[13px] text-[var(--sa-ink)]">
                    <Glyph d={G.ok} className="size-[15px] text-[var(--sa-good)]" stroke={1.8} />{done}
                    <button type="button" aria-label="Dismiss" onClick={() => setDone(null)} className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-[var(--sa-muted)] hover:bg-[color-mix(in_oklab,var(--sa-good)_14%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--sa-violet)]"><Glyph d={G.x} className="size-3" /></button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* category rings */}
            <div role="group" aria-label="Category scores" className="grid grid-cols-2 gap-2 @md:gap-2.5 @3xl:grid-cols-4">
              {S.cats.map((c, i) => {
                const on = category === c.id, t = toneOf(c.score);
                return (
                  <motion.button key={c.id} type="button" aria-pressed={on} onClick={() => setCategory(on ? null : c.id)} style={toneStyle(t)}
                    initial={preview ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    className={cx("grid min-w-0 items-center gap-x-3 gap-y-1 rounded-[14px] border p-3 text-left transition-[border-color,background-color,box-shadow,translate] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sa-violet)] @max-md:justify-items-center @max-md:px-2 @max-md:py-2.5 @max-md:text-center @md:grid-cols-[62px_minmax(0,1fr)]",
                      on ? "border-[var(--sa-violet)] bg-[var(--sa-violet-soft)] shadow-[0_0_0_1px_var(--sa-violet)]" : "border-[var(--sa-line)] bg-[var(--sa-card)] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--sa-violet)_40%,var(--sa-line))] hover:shadow-[0_14px_24px_-20px_rgb(30_16_64/0.45)] motion-reduce:hover:translate-y-0")}>
                    <span aria-hidden className="relative size-14 @md:row-span-2 @md:size-[62px]">
                      <Ring value={c.score} size={62} stroke={9} track="var(--sa-track)" color="var(--c)" start={started} className="size-full" />
                      <span className="absolute inset-0 grid place-items-center font-display text-[18px] leading-none font-semibold tracking-[-0.02em] text-[var(--c)] tabular @md:text-[19px]"><Num value={c.score} start={started} /></span>
                    </span>
                    <span className="self-end text-[13.5px] leading-[1.2] font-semibold [overflow-wrap:anywhere]">{c.label}<span className="sr-only">, score {c.score} out of 100</span></span>
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5 self-start text-[12px] text-[var(--sa-muted)] tabular @max-md:justify-center">
                      <span>{c.open === 0 ? "No open issues" : c.open === 1 ? "1 open" : `${c.open} open`}</span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {c.gained > 0 && (
                          <motion.span key={c.gained} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.35 }}
                            className="font-semibold text-[var(--sa-good)]">+{c.gained} from fixes</motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* toolbar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 @3xl:mt-[22px]">
              <h3 className="m-0 flex flex-wrap items-center gap-2.5 font-display text-[17px] leading-[1.2] font-semibold tracking-[-0.01em]">
                Issues
                <AnimatePresence initial={false}>
                  {category && (
                    <motion.span key={category} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sa-violet-soft)] py-1 pr-1.5 pl-2.5 font-sans text-[12px] leading-none font-semibold text-[var(--sa-violet)]">
                      {catLabel(category)}
                      <button type="button" aria-label="Show all categories" onClick={() => { setCategory(null); (rootRef.current?.querySelector("[aria-label='Category scores'] button") as HTMLElement | null)?.focus(); }}
                        className="grid size-[18px] place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--sa-violet)_18%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--sa-violet)]"><Glyph d={G.x} className="size-2.5" stroke={2} /></button>
                    </motion.span>
                  )}
                </AnimatePresence>
              </h3>
              <div data-sev-filter className="@max-md:w-full">
                <Segmented<SeverityFilter> ariaLabel="Filter issues by severity" value={severity} onChange={setSeverity} options={sevOptions} size="sm"
                  className="flex-wrap border-[var(--sa-line)]! bg-[var(--sa-tint)]! @max-md:grid! @max-md:w-full @max-md:grid-cols-5"
                  buttonClassName="group text-[12.5px]! font-semibold! py-[7px]! @max-md:px-0.5! @max-md:text-[11.5px]! focus-visible:outline-[var(--sa-violet)]!"
                  activeClassName="text-[var(--sa-ink)]!"
                  indicatorClassName="bg-[var(--sa-card)]! shadow-[0_1px_3px_-1px_rgb(30_16_64/0.25),0_0_0_1px_var(--sa-line)]!" />
              </div>
            </div>

            {/* groups */}
            <div className="mt-3.5 grid gap-[18px]" onKeyDown={onGroupsKey}>
              <LayoutGroup id={uid}>
                {groups.map(gr => (
                  <motion.section key={gr.k} layout="position" aria-labelledby={`${uid}-g-${gr.k}`} className="grid gap-2" style={toneStyle(SEV_VAR[gr.k])}
                    transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}>
                    <h4 id={`${uid}-g-${gr.k}`} className="m-0 flex items-center gap-2 font-mono text-[11px] leading-none font-semibold tracking-[0.1em] text-[var(--c)] uppercase">
                      {LABEL[gr.k]}<span aria-hidden className="h-px flex-1 bg-[var(--sa-line)]" /><span className="tracking-[0.04em] text-[var(--sa-faint)]">{gr.items.length}</span>
                    </h4>
                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      {gr.items.map((it, i) => (
                        <IssueRow key={it.id} it={it} uid={uid} open={openId === it.id} catLabel={catLabel(it.category)} index={i} appear={!mounted.current}
                          onToggle={() => setOpenId(o => (o === it.id ? null : it.id))} onFixed={f => setFixed(it.id, f, true)} />
                      ))}
                    </ul>
                  </motion.section>
                ))}
              </LayoutGroup>
              {groups.length === 0 && <p className="m-0 rounded-xl border border-dashed border-[var(--sa-line)] p-[22px] text-center text-[13.5px] text-[var(--sa-muted)]">Nothing in this view. Nice work.</p>}
            </div>

            {data.source && <p className="m-0 mt-[18px] border-t border-[var(--sa-line)] pt-3 text-[12px] text-[var(--sa-faint)]">{data.source}</p>}
          </div>

          {/* scanning overlay */}
          <AnimatePresence>
            {scan.on && <ScanOverlay key="scan" site={data.site} steps={STEPS(data.pages)} step={scan.step} />}
          </AnimatePresence>
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </article>
  );
}

/* ---------------- issue row ---------------- */
function IssueRow({ it, uid, open, catLabel, index, appear, onToggle, onFixed }: {
  it: Issue; appear: boolean; uid: string; open: boolean; catLabel: string; index: number; onToggle: () => void; onFixed: (fixed: boolean) => void;
}) {
  const preview = usePreviewMode();
  const sev: SeverityFilter = it.fixed ? "fixed" : it.severity;
  const detId = `${uid}-d-${it.id}`;
  const urls = it.urls ?? [];
  const shown = urls.slice(0, 4);
  const rest = (it.pages ?? urls.length) - shown.length;
  return (
    <motion.li layoutId={`${uid}-${it.id}`} layout="position" style={toneStyle(SEV_VAR[sev])}
      initial={preview || !appear ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1], delay: Math.min(index, 6) * 0.03 }}
      className={cx("rounded-xl border bg-[var(--sa-card)] transition-[border-color,box-shadow] duration-200",
        open ? "border-[color-mix(in_oklab,var(--c)_55%,var(--sa-line))] shadow-[0_14px_26px_-22px_rgb(30_16_64/0.5)]" : "border-[var(--sa-line)] hover:border-[color-mix(in_oklab,var(--c)_35%,var(--sa-line))]")}>
      <button type="button" id={`${uid}-btn-${it.id}`} aria-expanded={open} aria-controls={detId} onClick={onToggle}
        className="grid w-full grid-cols-[28px_minmax(0,1fr)_18px] items-center gap-x-2.5 gap-y-1 rounded-xl p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sa-violet)] @md:grid-cols-[28px_minmax(0,1fr)_auto_18px] @md:gap-x-3 @md:py-[11px] @md:pr-3.5 @md:pl-3">
        <span className="grid size-7 place-items-center rounded-lg bg-[var(--c-soft)] text-[var(--c)] transition-colors duration-300">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={sev} className="grid" initial={{ scale: 0.4, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
              <Glyph d={G[sev]} className="size-3.5" stroke={sev === "fixed" ? 1.9 : 1.7} />
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="grid min-w-0 gap-1">
          <span className="sr-only">{LABEL[sev]}: </span>
          <span className={cx("text-[14px] leading-[1.3] font-semibold [overflow-wrap:anywhere]", it.fixed && "text-[var(--sa-muted)] line-through decoration-[color-mix(in_oklab,var(--sa-good)_60%,transparent)] decoration-[1.5px]")}>{it.title}</span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--sa-muted)]">
            <span className="rounded-[5px] bg-[var(--sa-tint)] px-[7px] py-0.5 font-medium shadow-[inset_0_0_0_1px_var(--sa-line)]">{catLabel}</span>
            {it.pages != null && <span className="tabular">{it.pages === 1 ? "1 page" : `${it.pages} pages`}</span>}
            {it.fixed && it.verified && (
              <motion.span initial={preview ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1 font-semibold text-[var(--sa-good)]">
                <Glyph d={G.shield} className="size-3" stroke={1.6} />Verified on re-run
              </motion.span>
            )}
          </span>
        </span>
        <span className="col-start-2 row-start-2 justify-self-start rounded-[7px] bg-[var(--c-soft)] px-1.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap text-[var(--c)] tabular @md:col-start-3 @md:row-start-1 @md:px-2 @md:py-1.5 @md:text-[13px]">+{it.impact} pts</span>
        <motion.span aria-hidden className="col-start-3 row-start-1 grid text-[var(--sa-faint)] @md:col-start-4" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
          <Glyph d={G.chev} className="size-[18px]" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={detId} key="det" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
            <div className="mx-2.5 mb-2.5 grid gap-x-[22px] gap-y-3.5 border-t border-dashed border-[var(--sa-line)] pt-3 @md:mx-3.5 @md:mb-3.5 @2xl:ml-[52px] @2xl:grid-cols-2">
              {it.why && <DSec h="Why it matters">{it.why}</DSec>}
              {it.fix && <DSec h="How to fix">{it.fix}</DSec>}
              {shown.length > 0 && (
                <ul aria-label="Example pages" className="m-0 flex list-none flex-wrap gap-1.5 p-0 @2xl:col-span-2">
                  {shown.map(u => <li key={u} className="rounded-md bg-[var(--sa-tint)] px-[7px] py-[5px] font-mono text-[11.5px] leading-none font-medium text-[var(--sa-muted)] [overflow-wrap:anywhere]">{u}</li>)}
                  {rest > 0 && <li className="rounded-md px-[7px] py-[5px] font-mono text-[11.5px] leading-none font-medium text-[var(--sa-muted)] shadow-[inset_0_0_0_1px_var(--sa-line)]">+{rest} more</li>}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-[10px] bg-[var(--sa-tint)] px-3 py-2.5 @2xl:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] leading-[1.2] font-semibold">
                  <span className="relative grid size-5 shrink-0 place-items-center">
                    <input id={`${uid}-cb-${it.id}`} type="checkbox" checked={it.fixed} onChange={e => onFixed(e.target.checked)}
                      className="peer size-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-[var(--sa-faint)] bg-[var(--sa-card)] transition-colors duration-200 checked:border-[var(--sa-good)] checked:bg-[var(--sa-good)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sa-violet)]" />
                    <svg viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute size-3.5 scale-0 text-[var(--sa-card)] transition-transform duration-200 ease-[cubic-bezier(.2,.7,.2,1)] peer-checked:scale-100">
                      <path d="m3.2 8.4 3 3 6.6-6.8" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  Mark as fixed
                </label>
                <span className="text-[12px] text-[var(--sa-muted)] tabular">{it.fixed ? "Added" : "Adds"} <b className="font-semibold text-[var(--sa-good)]">+{it.impact}</b> to {catLabel}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function DSec({ h, children }: { h: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-[5px]">
      <h5 className="m-0 font-mono text-[10.5px] leading-none font-semibold tracking-[0.1em] text-[var(--sa-faint)] uppercase">{h}</h5>
      <p className="m-0 text-[13.5px] leading-normal text-[var(--sa-ink)]">{children}</p>
    </div>
  );
}

/* ---------------- scanning overlay ---------------- */
function ScanOverlay({ site, steps, step }: { site?: string; steps: string[]; step: number }) {
  const reduced = useReducedMotion();
  const pct = Math.round((step / steps.length) * 100);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="absolute inset-0 z-10 grid place-items-start justify-center bg-[color-mix(in_oklab,var(--sa-card)_55%,transparent)] px-4 pt-10 @md:pt-14">
      <motion.div initial={{ y: 12, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, scale: 0.98 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
        role="status" aria-label="Re-running audit"
        className="grid w-[min(380px,100%)] gap-3 rounded-2xl border border-[var(--sa-line)] bg-[var(--sa-card)] p-5 shadow-[0_24px_48px_-28px_rgb(30_16_64/0.55)]">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="font-display text-[15px] leading-[1.25] font-semibold">Scanning {site}</span>
          <span className="font-mono text-[13px] leading-none font-semibold text-[var(--sa-violet)] tabular">{pct}%</span>
        </div>
        <div className="relative h-[30px] overflow-hidden rounded-lg bg-[repeating-linear-gradient(90deg,var(--sa-tint)_0_10px,transparent_10px_14px)]" aria-hidden>
          {!reduced && (
            <motion.span className="absolute inset-y-0 w-2/5 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--sa-violet)_30%,transparent),transparent)]"
              initial={{ left: "-40%" }} animate={{ left: "100%" }} transition={{ duration: 1.1, ease: "linear", repeat: Infinity }} />
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sa-track)]" aria-hidden>
          <motion.i className="block h-full rounded-full bg-[linear-gradient(90deg,var(--sa-head-2),var(--sa-violet))]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
        <ol className="m-0 grid list-none gap-1.5 p-0 text-[12.5px]">
          {steps.map((s, i) => {
            const state = i < step ? "done" : i === step ? "now" : "todo";
            return (
              <li key={s} className={cx("flex items-center gap-2 transition-colors duration-200", state === "todo" ? "text-[var(--sa-faint)]" : state === "now" ? "font-semibold text-[var(--sa-ink)]" : "text-[var(--sa-muted)]")}>
                <span className="grid size-4 place-items-center">
                  {state === "done" ? <Glyph d={G.fixed} className="size-3.5 text-[var(--sa-good)]" stroke={2} />
                    : state === "now" ? <motion.span className="block size-3 rounded-full border-2 border-[var(--sa-violet)] border-t-transparent" animate={reduced ? undefined : { rotate: 360 }} transition={{ duration: 0.8, ease: "linear", repeat: Infinity }} />
                      : <span className="block size-1.5 rounded-full bg-[var(--sa-line)]" />}
                </span>
                {s}{state === "now" ? "…" : ""}
              </li>
            );
          })}
        </ol>
      </motion.div>
    </motion.div>
  );
}
