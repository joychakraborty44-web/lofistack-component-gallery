import { useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCountUp, useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { Icon, cx } from "../../ui";
import { LEAD_FUNNEL_LABELS, type FunnelCompare, type FunnelScale, type FunnelStage, type LeadFunnelLabels } from "./data";

/* ------------------------------------------------------------
   Lead Funnel Analytics — magenta funnel with centred bars,
   trapezoid flows between stages and step-rate chips.
   ------------------------------------------------------------ */

export interface LeadFunnelHandle {
  /** Re-run the entrance animation (bars grow, numbers count up). */
  replay: () => void;
}

export interface LeadFunnelProps {
  /** Stages in funnel order. Two or more; four is typical. */
  stages: FunnelStage[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Date-range text shown top right. */
  period?: string;
  /** Earlier period, adds a change in points to the overall rate. */
  compare?: FunnelCompare;
  /** Footer note, e.g. where the data comes from. */
  source?: string;
  /** `sqrt` (default) keeps small stages readable; `linear` draws bars exactly to scale. */
  scale?: FunnelScale;
  /** Override any built-in text. */
  labels?: Partial<LeadFunnelLabels>;
  /** Number formatting locale (default en-US). */
  locale?: string;
  /** Fires when a stage is hovered or focused (null when none). */
  onActiveStageChange?: (index: number | null, stage: FunnelStage | null) => void;
  className?: string;
  ref?: Ref<LeadFunnelHandle>;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const EASE = [0.2, 0.8, 0.2, 1] as const;

const PALETTE = cx(
  "[--lf-from:#E58DBE] [--lf-to:#8A0F52] [--lf-acc:#A3165F] [--lf-good:#1B7F4B] [--lf-bad:#B4372A] [--lf-tint:#F8F4F7]",
  "dark:[--lf-from:#6E2C57] dark:[--lf-to:#FF7BC2] dark:[--lf-acc:#FF8CCB] dark:[--lf-good:#5FD394] dark:[--lf-bad:#FF8A7A] dark:[--lf-tint:#1D1922]",
);

interface Step { from: string; to: string; rate: number | null; lost: number }

function useFunnelModel(stagesIn: FunnelStage[], compare: FunnelCompare | undefined, scale: FunnelScale, locale: string) {
  return useMemo(() => {
    const int = (v: number) => Math.round(v).toLocaleString(locale);
    const pct = (r: number | null | undefined) => {
      if (r == null || !Number.isFinite(r)) return "—";
      const p = r * 100;
      return (p === 100 || p === 0 ? String(p) : p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + "%";
    };
    const stages = stagesIn.map((s, i) => ({
      label: s?.label || `Stage ${i + 1}`,
      count: Math.max(0, Number.isFinite(+s?.count) ? +s.count : 0),
    }));
    const n = stages.length;
    const first = n ? stages[0].count : 0;
    const last = n ? stages[n - 1].count : 0;
    const firstLabel = n ? stages[0].label.toLowerCase() : "";
    const steps: Step[] = stages.slice(1).map((s, i) => {
      const prev = stages[i].count;
      return { from: stages[i].label, to: s.label, rate: prev > 0 ? s.count / prev : null, lost: Math.max(0, prev - s.count) };
    });
    const overall = first > 0 && n > 1 ? last / first : null;
    let delta: number | null = null;
    const prev = compare && Array.isArray(compare.stages) ? compare.stages.map(v => (Number.isFinite(+v) ? +v : null)) : null;
    if (overall != null && prev && prev.length === n && (prev[0] ?? 0) > 0 && prev[n - 1] != null) {
      delta = Math.round((overall - (prev[n - 1] as number) / (prev[0] as number)) * 1000) / 10;
    }
    const rated = steps.filter(s => s.rate != null);
    const worst = rated.reduce<Step | null>((a, s) => (!a || (s.rate as number) < (a.rate as number) ? s : a), null);
    const best = rated.reduce<Step | null>((a, s) => (!a || (s.rate as number) > (a.rate as number) ? s : a), null);
    const width = (c: number) => {
      if (!(first > 0) || !(c > 0)) return 2;
      const r = c / first;
      // linear keeps a 1% sliver so tiny stages stay visible; sqrt floors at 4%
      return scale === "linear" ? Math.max(1, r * 100) : Math.max(4, Math.sqrt(r) * 100);
    };
    const widths = stages.map(s => width(s.count));
    return { int, pct, stages, n, first, last, firstLabel, steps, overall, delta, worst, best, widths };
  }, [stagesIn, compare, scale, locale]);
}

type Model = ReturnType<typeof useFunnelModel>;

export function LeadFunnel({
  stages, eyebrow, title, subtitle, period, compare, source, scale = "sqrt", labels, locale = "en-US",
  onActiveStageChange, className, ref,
}: LeadFunnelProps) {
  const L = useMemo(() => ({ ...LEAD_FUNNEL_LABELS, ...labels }), [labels]);
  const model = useFunnelModel(stages, compare, scale, locale);
  const [run, setRun] = useState(0);
  useImperativeHandle(ref, () => ({ replay: () => setRun(r => r + 1) }), []);

  return (
    <article
      className={cx(
        PALETTE,
        "@container relative w-full max-w-[960px] overflow-hidden rounded-[20px] border border-line bg-surface text-ink elev-3",
        className,
      )}
    >
      {/* gradient hairline + soft magenta wash */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--lf-from),var(--lf-to))]" />
      <span aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-72 w-[60%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--lf-acc)_10%,transparent),transparent)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--lf-acc)_8%,transparent),transparent)]" />

      <div className="relative px-4 pt-6 pb-4 @lg:px-6 @2xl:px-8 @2xl:pt-7">
        <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <div className="grid min-w-0 gap-1.5">
            {eyebrow && <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--lf-acc)]">{eyebrow}</span>}
            {title && <h2 className="m-0 text-balance font-display text-[19px] font-semibold leading-tight tracking-[-0.012em] @2xl:text-[23px]">{title}</h2>}
            {subtitle && <p className="m-0 text-[13.5px] text-ink-3">{subtitle}</p>}
          </div>
          {period && (
            <span className="inline-flex flex-none items-center gap-2 rounded-lg border border-line bg-[var(--lf-tint)] px-3 py-1.5 text-[12.5px] font-medium text-ink-2 tabular">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-3.5 text-ink-3" aria-hidden>
                <rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
              </svg>
              {period}
            </span>
          )}
        </header>

        <FunnelBody key={run} model={model} L={L} compareLabel={compare?.label ?? ""} onActiveStageChange={onActiveStageChange} />

        <footer className="mt-5 flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-dashed border-line pt-3 text-[12px] text-ink-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={scale} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}>
              {scale === "linear" ? L.scaleLinear : L.scaleSqrt}
            </motion.span>
          </AnimatePresence>
          {source && <span>{source}</span>}
        </footer>
      </div>
    </article>
  );
}

/* Summary + funnel. Keyed by the replay counter so a replay re-runs every entrance. */
function FunnelBody({ model, L, compareLabel, onActiveStageChange }: {
  model: Model; L: LeadFunnelLabels; compareLabel: string;
  onActiveStageChange?: (index: number | null, stage: FunnelStage | null) => void;
}) {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const instant = reduced || preview;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const go = instant || inView;
  const [active, setActiveState] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const focused = useRef<number | null>(null);
  const setActive = (i: number | null) => {
    if (activeRef.current === i) return;
    activeRef.current = i;
    setActiveState(i);
    onActiveStageChange?.(i, i == null ? null : model.stages[i]);
  };

  const { int, pct, stages, n, first, last, firstLabel, steps, overall, delta, worst, best, widths } = model;
  const big = useCountUp(overall ?? 0, { start: go, duration: 900 });
  const tone = delta == null ? null : delta > 0 ? "good" : delta < 0 ? "bad" : "flat";

  return (
    <div ref={ref}>
      {/* summary */}
      <dl className="mt-6 mb-2 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line @lg:grid-cols-2 @3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative grid content-start gap-2 bg-surface p-4 @lg:col-span-2 @2xl:p-5 @3xl:col-span-1">
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--lf-acc)_7%,transparent),transparent_65%)]" />
          <dt className="relative font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-3">{L.overall}</dt>
          <dd className="relative m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="font-condensed text-[40px] font-semibold leading-none tracking-[-0.02em] text-[var(--lf-acc)] tabular @2xl:text-[46px]">
              {overall == null ? "—" : pct(big)}
            </span>
            {tone && delta != null && (
              <motion.span
                initial={instant ? false : { opacity: 0, x: -6 }} animate={go ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.4, delay: 0.5 }}
                className={cx(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold tabular",
                  tone === "good" && "bg-[color-mix(in_oklab,var(--lf-good)_12%,transparent)] text-[var(--lf-good)]",
                  tone === "bad" && "bg-[color-mix(in_oklab,var(--lf-bad)_12%,transparent)] text-[var(--lf-bad)]",
                  tone === "flat" && "bg-[var(--lf-tint)] text-ink-2",
                )}
              >
                {tone !== "flat" && <Icon name={tone === "good" ? "arrowUp" : "arrowDown"} className="size-3" strokeWidth={2} />}
                {Math.abs(delta).toFixed(1)} {L.pts} {fill(L.vs, { label: compareLabel })}
              </motion.span>
            )}
          </dd>
          {n > 1 && <dd className="relative m-0 text-[12.5px] text-ink-3 tabular">{fill(L.overallSub, { last: int(last), first: int(first), firstLabel })}</dd>}
        </div>
        <Kpi label={L.drop} value={worst ? `${worst.from} → ${worst.to}` : "—"} sub={worst ? fill(L.dropSub, { pct: pct(1 - (worst.rate as number)) }) : ""} tone="bad" />
        <Kpi label={L.best} value={best ? `${best.from} → ${best.to}` : "—"} sub={best ? fill(L.bestSub, { pct: pct(best.rate) }) : ""} tone="good" />
      </dl>

      {/* funnel */}
      {n < 1 ? (
        <p className="py-10 text-center text-[13.5px] text-ink-3">{L.empty}</p>
      ) : (
        <ol
          aria-label={stages.map(s => s.label).join(", ")}
          className="m-0 grid list-none p-0"
          onMouseLeave={() => setActive(focused.current)}
        >
          {stages.map((s, i) => (
            <StageRow
              key={s.label + i}
              i={i} n={n} label={s.label} count={s.count}
              width={widths[i]} prevWidth={i > 0 ? widths[i - 1] : 0}
              step={i > 0 ? steps[i - 1] : null}
              shareText={i === 0 ? "100%" : fill(L.share, { pct: pct(first > 0 ? s.count / first : null), firstLabel })}
              active={active === i} dim={active != null && active !== i}
              go={go} instant={instant} int={int} pct={pct} L={L}
              onEnter={() => setActive(i)}
              onFocus={() => { focused.current = i; setActive(i); }}
              onBlur={(next) => { focused.current = null; if (!next) setActive(null); }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "good" | "bad" }) {
  return (
    <div className="grid content-start gap-1.5 bg-surface p-4 @2xl:p-5">
      <dt className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <span aria-hidden className={cx("size-1.5 rounded-full", tone === "bad" ? "bg-[var(--lf-bad)]" : "bg-[var(--lf-good)]")} />
        {label}
      </dt>
      <dd className="m-0 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{value}</dd>
      {sub && <dd className="m-0 text-[12.5px] leading-snug text-ink-3 tabular">{sub}</dd>}
    </div>
  );
}

interface RowProps {
  i: number; n: number; label: string; count: number; width: number; prevWidth: number; step: Step | null;
  shareText: string; active: boolean; dim: boolean; go: boolean; instant: boolean;
  int: (v: number) => string; pct: (r: number | null) => string; L: LeadFunnelLabels;
  onEnter: () => void; onFocus: () => void; onBlur: (stillInside: boolean) => void;
}

function StageRow({ i, n, label, count, width, prevWidth, step, shareText, active, dim, go, instant, int, pct, L, onEnter, onFocus, onBlur }: RowProps) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shown = useCountUp(count, { start: go, duration: 900 });
  const t = n > 1 ? (i / (n - 1)) * 100 : 100;
  const tp = n > 1 ? (Math.max(0, i - 1) / (n - 1)) * 100 : 100;
  const style = {
    "--c": `color-mix(in oklab, var(--lf-from), var(--lf-to) ${t.toFixed(1)}%)`,
    "--cp": `color-mix(in oklab, var(--lf-from), var(--lf-to) ${tp.toFixed(1)}%)`,
  } as CSSProperties;
  const a = (100 - prevWidth) / 2, c = (100 - width) / 2;
  const d = `M${a} 0 L${100 - a} 0 L${100 - c} 40 L${c} 40 Z`;
  const delay = i * 0.09;
  const sr = [`${label}: ${int(count)}`];
  if (i > 0) sr.push(shareText);
  if (step) sr.push(`${pct(step.rate)} of ${step.from.toLowerCase()} ${L.moved}, ${fill(L.dropped, { n: int(step.lost) })}`);

  return (
    <li
      tabIndex={0}
      style={style}
      onMouseEnter={onEnter}
      onFocus={onFocus}
      onBlur={e => onBlur(!!e.relatedTarget && e.currentTarget.parentElement?.contains(e.relatedTarget as Node) === true)}
      className={cx(
        "group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 rounded-xl outline-none transition-opacity duration-300 motion-reduce:transition-none",
        "@lg:grid-cols-[124px_minmax(0,1fr)_104px] @lg:gap-x-4 @2xl:grid-cols-[150px_minmax(0,1fr)_132px] @2xl:gap-x-5",
        i === 0 && "pt-3",
        dim && "opacity-45",
      )}
    >
      {/* flow from the previous stage + step-rate chip */}
      {step && (
        <div aria-hidden className="relative col-span-2 row-start-1 grid h-[34px] place-items-center @lg:col-span-1 @lg:col-start-2 @lg:h-10">
          <motion.svg
            viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 hidden size-full overflow-visible @lg:block"
            initial={instant ? false : { opacity: 0 }} animate={go ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: delay + 0.25 }}
          >
            <defs>
              <linearGradient id={`lf-g-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--cp)", stopOpacity: active ? 0.34 : 0.16 }} />
                <stop offset="1" style={{ stopColor: "var(--c)", stopOpacity: active ? 0.42 : 0.22 }} />
              </linearGradient>
            </defs>
            <motion.path
              initial={false} animate={{ d }} transition={{ duration: 0.7, ease: EASE }}
              fill={`url(#lf-g-${gid})`}
            />
          </motion.svg>
          {/* phone: a slim gradient stem instead of the trapezoid */}
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-[linear-gradient(var(--cp),var(--c))] opacity-50 @lg:hidden" />
          <motion.span
            initial={instant ? false : { opacity: 0, y: 4 }} animate={go ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.4, delay: delay + 0.35 }}
            className={cx(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface py-1 pr-2.5 pl-2 text-[12px] font-semibold leading-none text-ink tabular",
              "shadow-[0_0_0_1px_var(--line),0_6px_14px_-10px_rgb(30_16_40/0.35)] transition-shadow duration-300",
              active && "shadow-[0_0_0_1px_color-mix(in_oklab,var(--c)_55%,transparent),0_8px_18px_-10px_var(--c)]",
            )}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[11px] text-[color-mix(in_oklab,var(--c)_85%,var(--ink))]">
              <path d="M6 2v8M2.8 6.8 6 10l3.2-3.2" />
            </svg>
            <b className="font-semibold">{pct(step.rate)}</b>
            <span
              className={cx(
                "inline-block overflow-hidden font-medium text-ink-3 transition-[max-width,opacity] duration-[450ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none",
                active ? "max-w-[18em] opacity-100" : "max-w-0 opacity-0",
              )}
            >
              &nbsp;{L.moved} · {fill(L.dropped, { n: int(step.lost) })}
            </span>
          </motion.span>
        </div>
      )}

      {/* label */}
      <div aria-hidden className="col-start-1 row-start-2 flex min-w-0 items-center gap-2.5">
        <span
          className={cx(
            "flex-none rounded-md px-1.5 py-1 font-mono text-[10.5px] leading-none transition-[background,color,box-shadow] duration-300",
            active ? "bg-[color-mix(in_oklab,var(--c)_22%,transparent)] text-ink shadow-[inset_0_0_0_1px_var(--c)]" : "bg-[var(--lf-tint)] text-ink-3",
          )}
        >
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">{label}</span>
      </div>

      {/* bar */}
      <div aria-hidden className="relative col-span-2 row-start-3 mt-2 flex h-10 items-center justify-center @lg:col-span-1 @lg:col-start-2 @lg:row-start-2 @lg:mt-0 @lg:h-12">
        <span className="absolute inset-x-0 top-1/2 h-px bg-[linear-gradient(to_right,var(--line-strong)_50%,transparent_0)] bg-[length:6px_1px]" />
        <motion.span
          initial={instant ? false : { scaleX: 0, opacity: 0 }}
          animate={go ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
          transition={{ scaleX: { duration: 0.9, ease: EASE, delay }, opacity: { duration: 0.4, delay } }}
          style={{ width: `${width}%` }}
          className={cx(
            "relative block h-full rounded-[10px] transition-[width,box-shadow,filter] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none",
            "bg-[linear-gradient(180deg,color-mix(in_oklab,var(--c),white_18%),var(--c))] shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
            "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[color:var(--lf-acc)]",
            active && "shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_12px_24px_-12px_var(--c)] brightness-[1.04] saturate-[1.12]",
          )}
        />
      </div>

      {/* figures */}
      <div aria-hidden className="col-start-2 row-start-2 flex items-baseline justify-end gap-2 text-right @lg:col-start-3 @lg:flex-col @lg:items-end @lg:gap-1">
        <span className="font-condensed text-[20px] font-semibold leading-none tracking-[-0.01em] tabular @lg:text-[23px] @2xl:text-[26px]">{int(shown)}</span>
        <span className="text-[12px] leading-tight text-ink-3 tabular">{shareText}</span>
      </div>

      <span className="sr-only">{sr.join(". ") + "."}</span>
    </li>
  );
}
