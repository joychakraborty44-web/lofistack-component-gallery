import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useInView, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { Icon, Segmented, cx } from "../../ui";
import {
  HEALTH_LABELS,
  type ClientHealthData, type HealthBand, type HealthBands, type HealthFactor, type HealthLabels, type HealthPeriod,
} from "./data";

/* ------------------------------------------------------------
   Client Health Score — ivory card, 270° dial with risk zones,
   five weighted factors with live weight sliders.
   ------------------------------------------------------------ */

export interface HealthScoreDetail {
  /** Rounded score for the shown period. */
  score: number;
  band: HealthBand;
  period: HealthPeriod;
  current: number;
  previous: number;
  /** Whole-number share of the score per factor key (sums to 100). */
  weights: Record<string, number>;
  reason: "weight" | "reset" | "period";
}

export interface ClientHealthScoreHandle {
  /** Set a factor's weight (0–10). */
  setWeight: (key: string, value: number) => void;
  /** Restore the starting weights. */
  resetWeights: () => void;
  /** Rounded scores for both periods with the current weights. */
  getScore: () => { current: number; previous: number };
  /** Current raw weights (0–10) per factor key. */
  getWeights: () => Record<string, number>;
}

export interface ClientHealthScoreProps extends ClientHealthData {
  /** Controlled period. */
  period?: HealthPeriod;
  defaultPeriod?: HealthPeriod;
  onPeriodChange?: (period: HealthPeriod) => void;
  /** Fires when a weight is committed, weights are reset, or the period changes. */
  onScoreChange?: (detail: HealthScoreDetail) => void;
  labels?: Partial<HealthLabels>;
  className?: string;
  ref?: Ref<ClientHealthScoreHandle>;
}

type F = Required<Omit<HealthFactor, "about" | "note" | "previousNote">> & { about: string; note: string; previousNote: string };

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const num = (v: unknown, d: number) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const fmtDay = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ""; };
const EASE = [0.2, 0.7, 0.2, 1] as const;

/* dial geometry: 270° sweep opening at the bottom */
const R = 88, START = 135;
const polar = (v: number, r: number): [number, number] => {
  const a = (START + 270 * clamp(v, 0, 100) / 100) * Math.PI / 180;
  return [120 + r * Math.cos(a), 120 + r * Math.sin(a)];
};

const PALETTE = cx(
  "[--ch-card:#FCF9F2] [--ch-raise:#FFFEFA] [--ch-tint:#F4EEE2] [--ch-line:#E8E0CF] [--ch-ink:#241A12] [--ch-muted:#5A4E41] [--ch-faint:#6B5F52] [--ch-track:#EDE5D4]",
  "[--ch-good:#276B43] [--ch-good-bg:#E3F0E3] [--ch-good-fill:#3E8E5E] [--ch-warn:#9A5B07] [--ch-warn-bg:#FBEBCB] [--ch-warn-fill:#D4901F] [--ch-bad:#B4341F] [--ch-bad-bg:#F8E0D8] [--ch-bad-fill:#C9492F]",
  "dark:[--ch-card:#1B1713] dark:[--ch-raise:#231E19] dark:[--ch-tint:#241F1A] dark:[--ch-line:#332B24] dark:[--ch-ink:#F3EBDD] dark:[--ch-muted:#C0B3A2] dark:[--ch-faint:#A09281] dark:[--ch-track:#2E2721]",
  "dark:[--ch-good:#7AD39D] dark:[--ch-good-bg:rgb(122_211_157/0.14)] dark:[--ch-good-fill:#5DBB83] dark:[--ch-warn:#F2B653] dark:[--ch-warn-bg:rgb(242_182_83/0.14)] dark:[--ch-warn-fill:#E7A43B] dark:[--ch-bad:#F49A85] dark:[--ch-bad-bg:rgb(244_154_133/0.14)] dark:[--ch-bad-fill:#E2725A]",
);
const BAND_KEY: Record<HealthBand, string> = { healthy: "good", risk: "warn", critical: "bad" };
const bandVars = (b: HealthBand) => {
  const k = BAND_KEY[b];
  return { "--c": `var(--ch-${k})`, "--c-bg": `var(--ch-${k}-bg)`, "--c-fill": `var(--ch-${k}-fill)` } as CSSProperties;
};

/** rAF tween toward a target; instant when reduced motion / preview, held at `from` until `start`. */
function useTween(target: number, { start, instant, duration = 560 }: { start: boolean; instant: boolean; duration?: number }) {
  const [shown, setShown] = useState(instant ? target : 0);
  const cur = useRef(shown);
  useEffect(() => {
    if (!start) return;
    if (instant || Math.abs(target - cur.current) < 0.05) { cur.current = target; setShown(target); return; }
    const a = cur.current, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - k, 3);
      cur.current = a + (target - a) * e;
      setShown(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, instant, duration]);
  return shown;
}

export function ClientHealthScore({
  client, segment, asOf, compareDate, compareLabel, factors: factorsProp, bands: bandsProp,
  period: periodProp, defaultPeriod = "current", onPeriodChange, onScoreChange, labels, className, ref,
}: ClientHealthScoreProps) {
  const L = useMemo(() => ({ ...HEALTH_LABELS, ...labels, ...(compareLabel ? { previous: compareLabel } : {}) }), [labels, compareLabel]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const instant = reduced || preview;
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { amount: 0.25 });
  const start = inView || instant;

  const factors: F[] = useMemo(() => (Array.isArray(factorsProp) ? factorsProp : []).filter(Boolean).map((f, i) => ({
    key: String(f.key || `f${i + 1}`), name: f.name || `Factor ${i + 1}`,
    score: clamp(num(f.score, 0), 0, 100), previous: clamp(num(f.previous, num(f.score, 0)), 0, 100),
    weight: clamp(Math.round(num(f.weight, 5)), 0, 10), about: f.about || "", note: f.note || "", previousNote: f.previousNote || "",
  })), [factorsProp]);
  const bands: HealthBands = { healthy: num(bandsProp?.healthy, 70), risk: num(bandsProp?.risk, 40) };
  const bandOf = (v: number): HealthBand => { const r = Math.round(v); return r >= bands.healthy ? "healthy" : r >= bands.risk ? "risk" : "critical"; };

  /* weights reset whenever a new set of factors arrives (e.g. another client) */
  const baseWeights = () => Object.fromEntries(factors.map(f => [f.key, f.weight])) as Record<string, number>;
  const [wState, setWState] = useState(() => ({ src: factors, w: baseWeights() }));
  const [active, setActive] = useState<string | null>(null);
  if (wState.src !== factors) { setWState({ src: factors, w: baseWeights() }); setActive(null); }
  const weights = wState.src === factors ? wState.w : baseWeights();

  const [periodInner, setPeriodInner] = useState<HealthPeriod>(defaultPeriod);
  const period = periodProp ?? periodInner;

  /* shares: whole-number percentages that always add up to 100 (largest remainder) */
  const sharesFor = (w: Record<string, number>) => {
    const total = factors.reduce((a, f) => a + (w[f.key] || 0), 0);
    const raw = factors.map(f => (total > 0 ? (w[f.key] || 0) / total : 1 / Math.max(1, factors.length)));
    const pct = raw.map(r => Math.floor(r * 100));
    let left = 100 - pct.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r * 100 - pct[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { pct[i]++; left--; } });
    return { raw, pct, zero: total === 0 };
  };
  const calcFor = (w: Record<string, number>, p: HealthPeriod) => {
    const { raw } = sharesFor(w);
    return factors.reduce((a, f, i) => a + (p === "previous" ? f.previous : f.score) * raw[i], 0);
  };
  const sh = sharesFor(weights);
  const value = calcFor(weights, period);
  const other = calcFor(weights, period === "current" ? "previous" : "current");
  const rounded = Math.round(value), otherR = Math.round(other);
  const band = bandOf(value);
  const scoreOf = (f: F, p: HealthPeriod = period) => (p === "previous" ? f.previous : f.score);

  const emit = (w: Record<string, number>, p: HealthPeriod, reason: HealthScoreDetail["reason"]) => {
    if (!onScoreChange) return;
    const s = sharesFor(w), v = Math.round(calcFor(w, p));
    onScoreChange({
      score: v, band: bandOf(v), period: p, reason,
      current: Math.round(calcFor(w, "current")), previous: Math.round(calcFor(w, "previous")),
      weights: Object.fromEntries(factors.map((f, i) => [f.key, s.pct[i]])),
    });
  };
  const setWeights = (w: Record<string, number>) => setWState({ src: factors, w });
  const pending = useRef(false);
  const commit = () => { if (pending.current) { pending.current = false; emit(weights, period, "weight"); } };
  const changePeriod = (p: HealthPeriod) => {
    if (p === period) return;
    if (periodProp === undefined) setPeriodInner(p);
    onPeriodChange?.(p);
    emit(weights, p, "period");
  };
  const resetWeights = () => { const b = baseWeights(); setWeights(b); emit(b, period, "reset"); };
  const isBase = factors.every(f => weights[f.key] === f.weight);

  useImperativeHandle(ref, () => ({
    setWeight: (key, v) => {
      if (!(key in weights)) return;
      const w = { ...weights, [key]: clamp(Math.round(num(v, 0)), 0, 10) };
      setWeights(w); emit(w, period, "weight");
    },
    resetWeights,
    getScore: () => ({ current: Math.round(calcFor(weights, "current")), previous: Math.round(calcFor(weights, "previous")) }),
    getWeights: () => ({ ...weights }),
  }));

  /* dial tween + live announcement */
  const shown = useTween(clamp(value, 0, 100), { start, instant });
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setAnnounce(fill(L.dial, { score: rounded, band: L[band] })), 500);
    return () => window.clearTimeout(t);
  }, [rounded, band, L]);

  const diff = period === "current" ? rounded - otherR : otherR - rounded;
  const tone = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const sign = diff > 0 ? "▲ " : diff < 0 ? "▼ " : "";
  const deltaText = diff === 0 ? fill(L.same, { label: L.previous.toLowerCase() })
    : fill(period === "current" ? L.vsPrev : L.vsNow, { delta: sign + Math.abs(diff), label: L.previous.toLowerCase() });
  const otherLabel = period === "current" ? L.previous : L.current;

  /* insight: active factor or the default lift / drag summary */
  const act = factors.find(f => f.key === active);
  const gaps = factors.map((f, i) => ({ f, gain: scoreOf(f) * sh.raw[i], lost: (100 - scoreOf(f)) * sh.raw[i] }));
  const lift = [...gaps].sort((a, b) => b.gain - a.gain)[0];
  const drag = gaps.filter(g => gaps.length < 2 || g !== lift).sort((a, b) => b.lost - a.lost)[0];

  const onListLeave = () => {
    const el = document.activeElement;
    const li = el instanceof HTMLElement ? el.closest<HTMLElement>("[data-factor]") : null;
    setActive(li && root.current?.contains(li) ? li.dataset.factor || null : null);
  };

  const [kx, ky] = polar(shown, R);
  const [g1x, g1y] = polar(other, R - 13), [g2x, g2y] = polar(other, R + 13);
  const ring = (from: number, to: number, r = R) => ({
    cx: 120, cy: 120, r,
    strokeDasharray: `${Math.max(0, (to - from) / 100 * (2 * Math.PI * r * 0.75))} ${2 * Math.PI * r}`,
    strokeDashoffset: -from / 100 * (2 * Math.PI * r * 0.75),
    transform: `rotate(${START} 120 120)`,
  });
  const zoneR = R + 13;

  return (
    <article
      ref={root}
      className={cx(
        PALETTE,
        "@container relative w-full max-w-[1000px] overflow-hidden rounded-[24px] border border-[var(--ch-line)] bg-[var(--ch-card)] text-[var(--ch-ink)] elev-3",
        className,
      )}
    >
      <span aria-hidden className="grain pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative px-4 pt-5 pb-5 @md:px-6 @md:pt-6 @3xl:px-8 @3xl:pt-7 @3xl:pb-7">
        {/* header */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="grid min-w-0 gap-1.5">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ch-good)]">{L.cap}</span>
            <h2 className="m-0 font-serif text-[25px] leading-[1.1] font-medium tracking-[-0.01em] @2xl:text-[30px]">{client || "Client"}</h2>
            {segment && <p className="m-0 text-[13.5px] text-[var(--ch-muted)]">{segment}</p>}
          </div>
          <div className="grid w-full gap-1.5 @md:w-auto @md:justify-items-start @4xl:justify-items-end">
            <Segmented<HealthPeriod>
              ariaLabel={L.period} value={period} onChange={changePeriod} size="sm"
              className="w-full rounded-full border-[var(--ch-line)] bg-[var(--ch-tint)] @md:w-auto"
              buttonClassName="flex-1 rounded-full px-3.5 py-1.5 @md:flex-none"
              activeClassName="text-[var(--ch-ink)]"
              indicatorClassName="rounded-full bg-[var(--ch-raise)] shadow-[0_1px_3px_-1px_rgb(60_40_15/0.3),0_0_0_1px_var(--ch-line)]"
              options={[{ value: "current", label: L.current }, { value: "previous", label: L.previous }]}
            />
            {(asOf || compareDate) && (
              <span className="text-center font-mono text-[10.5px] tracking-[0.02em] text-[var(--ch-faint)] @md:text-left @4xl:text-right">
                {asOf && fill(L.asOf, { date: fmtDay(asOf) })}{asOf && compareDate && " · "}{compareDate && fill(L.comparedWith, { date: fmtDay(compareDate) })}
              </span>
            )}
          </div>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-5 @3xl:mt-6 @3xl:grid-cols-[minmax(300px,348px)_minmax(0,1fr)] @3xl:gap-7">
          {/* left: dial, legend, insight */}
          <div className="grid content-start gap-4 @3xl:grid-rows-[auto_1fr] @3xl:content-stretch" style={bandVars(band)}>
            <div className="relative grid justify-items-center rounded-[20px] border border-[var(--ch-line)] bg-[var(--ch-raise)] px-4 pt-4 pb-4 shadow-[0_18px_40px_-34px_rgb(60_40_15/0.55)] dark:shadow-[0_18px_40px_-28px_rgb(0_0_0/0.8)]">
              <span aria-hidden className="pointer-events-none absolute inset-x-10 top-6 h-40 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--c-fill)_16%,transparent),transparent)] transition-[background] duration-500" />
              <div role="img" aria-label={`${fill(L.dial, { score: rounded, band: L[band] })} ${deltaText}.`} className="relative aspect-square w-full max-w-[264px]">
                <svg viewBox="0 0 240 240" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                  <circle {...ring(0, 100)} fill="none" stroke="var(--ch-track)" strokeWidth={16} strokeLinecap="round" />
                  {/* risk zones on the outer rim */}
                  <circle {...ring(0, bands.risk - 0.8, zoneR)} fill="none" stroke="var(--ch-bad-fill)" strokeOpacity={band === "critical" ? 0.95 : 0.4} strokeWidth={3.5} className="transition-[stroke-opacity] duration-500" />
                  <circle {...ring(bands.risk + 0.8, bands.healthy - 0.8, zoneR)} fill="none" stroke="var(--ch-warn-fill)" strokeOpacity={band === "risk" ? 0.95 : 0.4} strokeWidth={3.5} className="transition-[stroke-opacity] duration-500" />
                  <circle {...ring(bands.healthy + 0.8, 100, zoneR)} fill="none" stroke="var(--ch-good-fill)" strokeOpacity={band === "healthy" ? 0.95 : 0.4} strokeWidth={3.5} className="transition-[stroke-opacity] duration-500" />
                  {/* score arc */}
                  <circle
                    {...ring(0, Math.max(0.05, shown))} fill="none" stroke="var(--c-fill)" strokeWidth={16} strokeLinecap="round"
                    className="transition-[stroke] duration-500 [filter:drop-shadow(0_4px_8px_color-mix(in_oklab,var(--c-fill)_35%,transparent))]"
                  />
                  {[0, bands.risk, bands.healthy, 100].map(v => {
                    const [x, y] = polar(v, R + 27);
                    return <text key={v} x={x.toFixed(1)} y={(y + 3.5).toFixed(1)} textAnchor="middle" className="fill-[var(--ch-faint)] font-mono text-[9.5px] tabular">{v}</text>;
                  })}
                  {/* marker for the other period */}
                  <line x1={g1x} y1={g1y} x2={g2x} y2={g2y} stroke="var(--ch-ink)" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="3 2.5" strokeLinecap="round" className="transition-all duration-500 motion-reduce:transition-none" />
                  {/* knob */}
                  <circle cx={kx} cy={ky} r={10.5} fill="var(--ch-raise)" stroke="var(--c-fill)" strokeWidth={4} className="transition-[stroke] duration-500" />
                </svg>
                <div aria-hidden className="absolute inset-0 grid place-content-center justify-items-center gap-1.5 pt-1 text-center">
                  <span className="flex items-baseline gap-0.5">
                    <span className="font-display text-[60px] leading-none font-semibold tracking-[-0.04em] tabular">{Math.round(shown)}</span>
                    <small className="font-mono text-[13px] text-[var(--ch-faint)]">{L.of100}</small>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-bg)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--c)] transition-colors duration-500">
                    <span className="size-1.5 rounded-full bg-[var(--c-fill)]" />
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={band} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>{L[band]}</motion.span>
                    </AnimatePresence>
                  </span>
                  <span className={cx(
                    "max-w-[150px] text-[12px] leading-snug font-medium tabular",
                    tone === "up" ? "text-[var(--ch-good)]" : tone === "down" ? "text-[var(--ch-bad)]" : "text-[var(--ch-muted)]",
                  )}>{deltaText}</span>
                </div>
              </div>

              <ul aria-hidden className="m-0 mt-1 flex list-none flex-wrap justify-center gap-x-3.5 gap-y-1.5 p-0 text-[11.5px] text-[var(--ch-muted)]">
                {([["healthy", `${L.healthy} ${bands.healthy}+`], ["risk", `${L.risk} ${bands.risk}–${bands.healthy - 1}`], ["critical", `${L.critical} <${bands.risk}`]] as const).map(([b, t]) => (
                  <li key={b} className={cx("flex items-center gap-1.5 transition-opacity duration-300", band === b ? "font-semibold text-[var(--ch-ink)]" : "")}>
                    <i className="h-1.5 w-3 rounded-full" style={{ background: `var(--ch-${BAND_KEY[b]}-fill)` }} />{t}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <i className="h-3 w-0 border-l-2 border-dashed border-[var(--ch-ink)] opacity-60" />{fill(L.marker, { label: otherLabel, n: otherR })}
                </li>
              </ul>
            </div>

            {/* insight */}
            <section aria-label={L.hintTitle} className="relative overflow-hidden @3xl:min-h-[132px] rounded-[18px] border border-[var(--ch-line)] bg-[var(--ch-tint)] px-4 py-3.5" style={act ? bandVars(bandOf(scoreOf(act))) : undefined}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${act?.key ?? "summary"}-${period}`}
                  initial={instant ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="grid gap-1.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="m-0 text-[14px] font-semibold">{act ? act.name : L.hintTitle}</h3>
                    {act && (
                      <span className="rounded-full bg-[var(--c-bg)] px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-[var(--c)] tabular">
                        {Math.round(scoreOf(act))} · {L[bandOf(scoreOf(act))]}
                      </span>
                    )}
                  </div>
                  {act ? (
                    <>
                      {act.about && <p className="m-0 text-[13px] leading-normal text-[var(--ch-muted)]">{act.about}</p>}
                      {(period === "previous" ? act.previousNote : act.note) && (
                        <p className="m-0 border-l-2 border-[var(--c-fill)] pl-2.5 text-[13px] leading-normal">{period === "previous" ? act.previousNote : act.note}</p>
                      )}
                    </>
                  ) : (
                    <>
                      {lift && (
                        <p className="m-0 flex items-start gap-2 text-[13px] leading-normal text-[var(--ch-muted)]">
                          <span className="mt-[3px] grid size-4 flex-none place-items-center rounded-full bg-[var(--ch-good-bg)] text-[var(--ch-good)]"><Icon name="arrowUp" className="size-2.5" strokeWidth={2.2} /></span>
                          <span>{L.lift}: <b className="font-semibold text-[var(--ch-ink)]">{lift.f.name}</b> {fill(L.adds, { pts: lift.gain.toFixed(1) })}</span>
                        </p>
                      )}
                      {drag && (
                        <p className="m-0 flex items-start gap-2 text-[13px] leading-normal text-[var(--ch-muted)]">
                          <span className="mt-[3px] grid size-4 flex-none place-items-center rounded-full bg-[var(--ch-bad-bg)] text-[var(--ch-bad)]"><Icon name="arrowDown" className="size-2.5" strokeWidth={2.2} /></span>
                          <span>{L.drag}: <b className="font-semibold text-[var(--ch-ink)]">{drag.f.name}</b> {fill(L.costs, { pts: drag.lost.toFixed(1) })} {L.hint}</span>
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>

          {/* right: factors */}
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
              <div className="grid gap-0.5">
                <h3 className="m-0 text-[15px] font-semibold">{L.factors}</h3>
                <span className="text-[12.5px] text-[var(--ch-muted)]">{sh.zero ? L.allZero : L.factorsNote}</span>
              </div>
              <button
                type="button" onClick={resetWeights} disabled={isBase}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-line)] bg-[var(--ch-raise)] px-3 py-1.5 text-[12.5px] font-semibold transition-[opacity,border-color,transform] duration-200 enabled:hover:border-[var(--ch-good)] enabled:active:scale-[0.97] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ch-good)]"
              >
                <Icon name="refresh" className="size-3.5" />{L.reset}
              </button>
            </div>

            <ul
              className="m-0 grid list-none gap-2.5 p-0 @3xl:gap-0 @3xl:rounded-[18px] @3xl:border @3xl:border-[var(--ch-line)] @3xl:bg-[var(--ch-raise)]"
              onPointerLeave={onListLeave}
              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(null); }}
            >
              {factors.map((f, i) => {
                const s = scoreOf(f), o = scoreOf(f, period === "current" ? "previous" : "current");
                const fb = bandOf(s);
                const dd = Math.round(f.score) - Math.round(f.previous);
                const w = weights[f.key] ?? 0;
                const id = `${uid}-w-${f.key}`;
                const isActive = active === f.key;
                return (
                  <li
                    key={f.key} data-factor={f.key}
                    onPointerEnter={() => setActive(f.key)} onFocus={() => setActive(f.key)}
                    style={bandVars(fb)}
                    className={cx(
                      "relative grid gap-2.5 rounded-[16px] border px-3.5 py-3 transition-[background,border-color,opacity,box-shadow] duration-300",
                      "@3xl:rounded-none @3xl:border-0 @3xl:px-4 @3xl:py-3.5 @3xl:[&+&]:border-t @3xl:[&+&]:border-[var(--ch-line)] @3xl:first:rounded-t-[17px] @3xl:last:rounded-b-[17px]",
                      isActive
                        ? "border-[color-mix(in_oklab,var(--c-fill)_40%,var(--ch-line))] bg-[color-mix(in_oklab,var(--c-bg)_55%,var(--ch-raise))] @3xl:bg-[color-mix(in_oklab,var(--c-bg)_45%,var(--ch-raise))]"
                        : "border-[var(--ch-line)] bg-[var(--ch-raise)]",
                      active && !isActive && "@3xl:opacity-75",
                    )}
                  >
                    <span aria-hidden className={cx("absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-[var(--c-fill)] transition-opacity duration-300", isActive ? "opacity-100" : "opacity-0")} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <b className="text-[14px] font-semibold">{f.name}</b>
                        <span className="rounded-full bg-[var(--ch-tint)] px-1.5 py-[2px] font-mono text-[10.5px] font-semibold text-[var(--ch-muted)] tabular">{sh.pct[i]}%</span>
                      </div>
                      <div aria-hidden className="flex flex-none items-baseline gap-2.5">
                        <span className={cx(
                          "font-mono text-[11px] font-semibold tabular",
                          period === "previous" ? "text-[var(--ch-faint)]" : dd > 0 ? "text-[var(--ch-good)]" : dd < 0 ? "text-[var(--ch-bad)]" : "text-[var(--ch-faint)]",
                        )}>
                          {period === "previous" ? fill(L.now, { n: Math.round(f.score) }) : dd === 0 ? "±0" : `${dd > 0 ? "▲" : "▼"} ${Math.abs(dd)}`}
                        </span>
                        <span className="min-w-[2ch] text-right font-display text-[20px] leading-none font-semibold text-[var(--c)] tabular transition-colors duration-300">{Math.round(s)}</span>
                      </div>
                    </div>
                    <div aria-hidden className="relative h-2 rounded-full bg-[var(--ch-track)]">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,color-mix(in_oklab,var(--c-fill)_70%,transparent),var(--c-fill))]"
                        initial={instant ? false : { width: "0%" }}
                        animate={{ width: start ? `${s}%` : "0%" }}
                        transition={{ duration: 0.6, ease: EASE, delay: inView && !instant ? 0.08 * i : 0 }}
                      />
                      <span
                        className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-[var(--ch-ink)] opacity-50 transition-[left] duration-500 motion-reduce:transition-none"
                        style={{ left: `${o}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 @sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <label htmlFor={id} className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-[var(--ch-faint)] uppercase">{L.weight}</label>
                      <input
                        id={id} type="range" min={0} max={10} step={1} value={w}
                        aria-label={`${L.weight} for ${f.name}`}
                        aria-valuetext={`${w} of 10, ${sh.pct[i]}% of the score`}
                        onChange={e => { setWeights({ ...weights, [f.key]: +e.currentTarget.value }); pending.current = true; }}
                        onPointerUp={commit} onKeyUp={commit} onBlur={commit}
                        style={{ "--p": `${w * 10}%` } as CSSProperties}
                        className={cx(
                          "h-6 w-full min-w-0 cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
                          "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,var(--ch-ink)_var(--p),var(--ch-track)_var(--p))]",
                          "[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--ch-ink)] [&::-webkit-slider-thumb]:bg-[var(--ch-raise)] [&::-webkit-slider-thumb]:shadow-[0_2px_6px_-1px_rgb(60_40_15/0.35)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125",
                          "focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ch-good)_35%,transparent)]",
                          "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[var(--ch-track)] [&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[var(--ch-ink)]",
                          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--ch-ink)] [&::-moz-range-thumb]:bg-[var(--ch-raise)] focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ch-good)_35%,transparent)]",
                        )}
                      />
                      <span className="col-span-2 text-[12px] text-[var(--ch-muted)] tabular @sm:col-span-1 @sm:min-w-[98px] @sm:text-right">
                        <b className="font-semibold text-[var(--ch-ink)]">{fill(L.pts, { pts: (s * sh.raw[i]).toFixed(1) })}</b> {L.ofScore}
                      </span>
                    </div>
                    <span className="sr-only">{`${f.name}: ${Math.round(s)} out of 100, ${L[fb]}. Counts for ${sh.pct[i]}% of the score.`}</span>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 text-[12px] leading-normal text-[var(--ch-faint)]">{fill(L.foot, { h: bands.healthy, r: bands.risk, h1: bands.healthy - 1 })}</p>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </article>
  );
}
