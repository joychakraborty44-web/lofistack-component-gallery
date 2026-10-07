import { motion, useMotionValueEvent, useSpring } from "motion/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Segmented, cx } from "../../ui";
import { useCountUp, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { ChannelChangeDetail, ConversionData, WhatIfDetail } from "./data";

export interface ConversionLabels {
  all: string; allLong: string; channel: string; conversions: string; visitors: string; target: string;
  actual: string; whatif: string; rateLabel: string; whatifLabel: string;
  below: string; above: string; on: string; noTarget: string;
  need: string; spare: string; exact: string; same: string; result: string;
  vs: string; pts: string; byChannel: string; setTarget: string; reset: string; announce: string;
}

const LABELS: ConversionLabels = {
  all: "All", allLong: "All channels", channel: "Channel", conversions: "Conversions", visitors: "Visitors", target: "Target",
  actual: "Actual", whatif: "What-if", rateLabel: "Conversion rate", whatifLabel: "If conversions were…",
  below: "{gap} pts below target", above: "{gap} pts above target", on: "On target", noTarget: "No target set",
  need: "{n} more at this traffic would reach the {target} target.",
  spare: "{n} above the minimum needed for the {target} target.",
  exact: "Exactly the number needed for the {target} target.",
  same: "Showing the actual result. Drag the slider to test a different number.",
  result: "That would be a rate of {rate}, {status}.",
  vs: "vs {label}", pts: "pts", byChannel: "By channel", setTarget: "Set to target", reset: "Reset",
  announce: "{label}: {rate} conversion rate, {status}.",
};

export interface ConversionRateCardProps extends ConversionData {
  /** Controlled channel id ("all" for the combined view). */
  channel?: string;
  /** Starting channel when uncontrolled (default "all"). */
  defaultChannel?: string;
  /** A target rate in percent that overrides every channel's own target. */
  targetOverride?: number | null;
  onChannelChange?: (detail: ChannelChangeDetail) => void;
  /** Fired when the what-if slider is released, or Set to target / Reset is used. */
  onWhatIfChange?: (detail: WhatIfDetail) => void;
  labels?: Partial<ConversionLabels>;
  /** Number locale (default en-US). */
  locale?: string;
  className?: string;
}

interface Channel {
  id: string; label: string; long: string; visitors: number; conversions: number; target: number | null;
  prev: { visitors: number; conversions: number } | null; rate: number | null; prevRate: number | null; needed: number | null;
}

/* ---------- helpers ---------- */
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function buildChannels(d: ConversionData, override: number | null, L: ConversionLabels): Channel[] {
  const base = num(d.target);
  const list: Channel[] = d.channels.map((c, i) => {
    const visitors = Math.max(0, num(c.visitors) ?? 0);
    const conversions = clamp(num(c.conversions) ?? 0, 0, visitors || Infinity);
    const pv = c.previous && (num(c.previous.visitors) ?? 0) > 0 ? { visitors: c.previous.visitors, conversions: Math.max(0, num(c.previous.conversions) ?? 0) } : null;
    const label = c.label || `Channel ${i + 1}`;
    return { id: String(c.id || `channel-${i + 1}`), label, long: label, visitors, conversions, target: num(c.target) ?? base, prev: pv, rate: null, prevRate: null, needed: null };
  });
  if (list.length > 1 && d.showAll !== false) {
    const sum = (k: "visitors" | "conversions") => list.reduce((a, c) => a + c[k], 0);
    const prevOk = list.every(c => c.prev);
    list.unshift({
      id: "all", label: L.all, long: L.allLong, visitors: sum("visitors"), conversions: sum("conversions"), target: base,
      prev: prevOk ? { visitors: list.reduce((a, c) => a + (c.prev?.visitors ?? 0), 0), conversions: list.reduce((a, c) => a + (c.prev?.conversions ?? 0), 0) } : null,
      rate: null, prevRate: null, needed: null,
    });
  }
  for (const c of list) {
    if (override !== null) c.target = override;
    c.rate = c.visitors > 0 ? (c.conversions / c.visitors) * 100 : null;
    c.prevRate = c.prev ? (c.prev.conversions / c.prev.visitors) * 100 : null;
    c.needed = c.target !== null && c.visitors > 0 ? Math.ceil((c.target / 100) * c.visitors - 1e-9) : null;
  }
  return list;
}

/* ---------- gauge geometry (viewBox units): centre 150,150 · radius 118 · half circle left → right ---------- */
const CX = 150, CY = 150, R = 118;
const ARC = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const point = (f: number, r: number): [number, number] => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
const rot = (f: number) => `rotate(${(f * 180).toFixed(3)} ${CX} ${CY})`;

/** A spring that writes straight to an SVG attribute (no re-render per frame). */
function useSpringAttr(target: number, apply: (v: number) => void, opts: { stiffness: number; damping: number }) {
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const instant = preview || reduced;
  const mv = useSpring(instant ? target : 0, opts);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useMotionValueEvent(mv, "change", v => applyRef.current(v));
  useLayoutEffect(() => {
    if (instant) { mv.jump(target); applyRef.current(target); } else mv.set(target);
  }, [target, instant, mv]);
  return mv;
}

/* ---------- palette ---------- */
const TOKENS = [
  "[--cr-card:#FBFAF7] [--cr-raise:#FFFFFF] [--cr-ink:#1D1C1A] [--cr-muted:#5F5B54] [--cr-faint:#6E6961] [--cr-line:#E5E1D8] [--cr-tint:#F2EFE8]",
  "[--cr-gold:#B7791F] [--cr-gold-ink:#86560F] [--cr-gold-soft:rgba(183,121,31,0.14)] [--cr-good:#2B7449] [--cr-bad:#A93E2A] [--cr-shadow:rgba(36,28,14,0.24)]",
  "[--cr-dial:#1A1917] [--cr-dial-2:#2A2723] [--cr-dial-gold:#F0C05A] [--cr-halo:rgba(240,192,90,0.2)]",
  "dark:[--cr-card:#19191A] dark:[--cr-raise:#232321] dark:[--cr-ink:#EFEBE4] dark:[--cr-muted:#B0AA9F] dark:[--cr-faint:#968F85] dark:[--cr-line:#2E2D2A] dark:[--cr-tint:#201F1D]",
  "dark:[--cr-gold:#F6C453] dark:[--cr-gold-ink:#F6C453] dark:[--cr-gold-soft:rgba(246,196,83,0.12)] dark:[--cr-good:#74D69E] dark:[--cr-bad:#FF9580] dark:[--cr-shadow:rgba(0,0,0,0.6)]",
  "dark:[--cr-dial:#0F0F10] dark:[--cr-dial-2:#1C1B19] dark:[--cr-dial-gold:#F6C453] dark:[--cr-halo:rgba(246,196,83,0.16)]",
  // the dial panel stays charcoal in both themes
  "[--cr-dial-ink:#F5F0E6] [--cr-dial-muted:#B9B0A2] [--cr-dial-line:rgba(245,240,230,0.12)] [--cr-dial-track:rgba(245,240,230,0.09)]",
  "[--cr-dial-good:#84DEAA] [--cr-dial-bad:#FF9F8A] [--cr-arc-from:#9C6516] [--cr-arc-to:#F6C453]",
].join(" ");

type Tone = "bad" | "good" | "on" | "";

const IconTarget = () => <svg viewBox="0 0 16 16" className="size-[13px]" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg>;
const IconReset = () => <svg viewBox="0 0 16 16" className="size-[13px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8a5 5 0 1 0 1.6-3.7" /><path d="M3 2.5v3h3" /></svg>;

export function ConversionRateCard(props: ConversionRateCardProps) {
  const {
    eyebrow, title, client, period, compareLabel, max, channel: channelProp, defaultChannel = "all", targetOverride = null,
    onChannelChange, onWhatIfChange, labels, locale = "en-US", className,
  } = props;
  const L = useMemo(() => ({ ...LABELS, ...labels }), [labels]);
  const uid = useId().replace(/:/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();

  const list = useMemo(() => buildChannels(props, targetOverride, L),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.channels, props.target, props.showAll, targetOverride, L]);
  const scale = useMemo(() => {
    const m = num(max);
    if (m !== null && m > 0) return m;
    const top = Math.max(1, ...list.map(c => Math.max(c.rate ?? 0, c.target ?? 0)));
    return Math.ceil((top * 1.25) / 2) * 2;
  }, [max, list]);

  const [innerCh, setInnerCh] = useState(defaultChannel);
  const chId = channelProp ?? innerCh;
  const c = list.find(x => x.id === chId) ?? list[0] ?? null;

  // what-if value; resets whenever the channel or target changes
  const key = `${c?.id}|${c?.target}`;
  const [wi, setWi] = useState<{ key: string; v: number } | null>(null);
  const conv = c ? (wi && wi.key === key ? wi.v : c.conversions) : 0;
  const isWhat = !!c && conv !== c.conversions;
  const [announce, setAnnounce] = useState("");

  const fmtInt = (v: number) => Math.round(v).toLocaleString(locale);
  const fix = (v: number, d = 2) => v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v: number | null) => (v === null ? "—" : `${fix(v)}%`);
  const statusText = (rate: number | null, target: number | null) => {
    if (rate === null || target === null) return L.noTarget;
    const gap = round2(rate - target);
    if (gap === 0) return L.on;
    return fill(gap < 0 ? L.below : L.above, { gap: fix(Math.abs(gap)) });
  };

  const rate = c && c.visitors > 0 ? (conv / c.visitors) * 100 : 0;
  const gap = c && c.target !== null ? round2(rate - c.target) : null;
  const tone: Tone = gap === null ? "" : gap < 0 ? "bad" : gap > 0 ? "good" : "on";
  const top = c ? Math.max(c.conversions, Math.ceil((c.visitors * scale) / 100), c.needed ?? 0) : 1;

  /* ---- gauge springs ---- */
  const arcRef = useRef<SVGPathElement>(null);
  const ptrRef = useRef<SVGGElement>(null);
  const tgtRef = useRef<SVGGElement>(null);
  const actRef = useRef<SVGGElement>(null);
  const frac = clamp(rate / scale, 0, 1);
  const tFrac = c && c.target !== null ? clamp(c.target / scale, 0, 1) : 0;
  const aFrac = c ? clamp((c.rate ?? 0) / scale, 0, 1) : 0;
  const fMv = useSpringAttr(frac, v => {
    arcRef.current?.setAttribute("stroke-dashoffset", String(100 - clamp(v, 0, 1.02) * 100));
    ptrRef.current?.setAttribute("transform", rot(v));
  }, { stiffness: 120, damping: 15 });
  const tMv = useSpringAttr(tFrac, v => tgtRef.current?.setAttribute("transform", rot(v)), { stiffness: 140, damping: 22 });
  const aMv = useSpringAttr(aFrac, v => actRef.current?.setAttribute("transform", rot(v)), { stiffness: 140, damping: 22 });
  const shownRate = useCountUp(rate, { duration: 650 });

  /* ---- events ---- */
  const pick = (id: string) => {
    if (id === chId) return;
    if (channelProp === undefined) setInnerCh(id);
    const n = list.find(x => x.id === id);
    if (!n) return;
    setAnnounce(fill(L.announce, { label: n.long, rate: pct(n.rate), status: statusText(n.rate, n.target) }));
    onChannelChange?.({ channel: n.id, label: n.long, rate: n.rate, target: n.target, visitors: n.visitors, conversions: n.conversions });
  };
  const emitWhatIf = (v: number) => {
    if (!c) return;
    const r = c.visitors > 0 ? (v / c.visitors) * 100 : 0;
    onWhatIfChange?.({ channel: c.id, conversions: v, actual: c.conversions, rate: r, target: c.target, gap: c.target === null ? null : r - c.target });
  };
  const setTo = (v: number) => { setWi({ key, v }); emitWhatIf(v); };

  // the native `change` event fires once on release (React's onChange fires on every input)
  const rangeRef = useRef<HTMLInputElement>(null);
  const releaseRef = useRef<(v: number) => void>(emitWhatIf);
  releaseRef.current = emitWhatIf;
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) return;
    const on = () => releaseRef.current(Math.round(+el.value));
    el.addEventListener("change", on);
    return () => el.removeEventListener("change", on);
  }, []);

  /* ---- what-if sentence ---- */
  let result: ReactNode = null;
  if (c) {
    const parts: ReactNode[] = [];
    if (!isWhat) parts.push(L.same);
    else {
      const [a, b] = L.result.split("{rate}");
      const [b1, b2] = (b ?? "").split("{status}");
      parts.push(a, <b key="r" className="font-semibold text-[var(--cr-ink)]">{pct(rate)}</b>, b1,
        <b key="s" className={cx("font-semibold", tone === "bad" ? "text-[var(--cr-bad)]" : tone === "good" ? "text-[var(--cr-good)]" : "text-[var(--cr-ink)]")}>{statusText(rate, c.target)}</b>, b2);
    }
    if (c.needed !== null && c.target !== null) {
      const diff = c.needed - conv, tgt = `${fix(c.target)}%`;
      parts.push(" ", diff > 0 ? fill(L.need, { n: fmtInt(diff), target: tgt }) : diff < 0 ? fill(L.spare, { n: fmtInt(-diff), target: tgt }) : fill(L.exact, { target: tgt }));
    }
    result = parts;
  }

  let delta = "";
  if (c && !isWhat && c.prevRate !== null && c.rate !== null) {
    const dp = round2(c.rate - c.prevRate);
    delta = `${dp > 0 ? "▲" : dp < 0 ? "▼" : "▶"} ${fix(Math.abs(dp))} ${L.pts} ${fill(L.vs, { label: compareLabel ?? "" })}`.trim();
  } else if (c && isWhat) delta = `${L.actual} ${pct(c.rate)}`;

  const steps = Math.round(scale * 2);
  const ticks = Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps, major = i % 2 === 0;
    const [x1, y1] = point(f, R + 11), [x2, y2] = point(f, R + (major ? 20 : 15));
    return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} stroke="var(--cr-dial-muted)" strokeWidth={major ? 1.4 : 1} opacity={major ? 0.75 : 0.35} />;
  });

  const statusTone = tone === "bad" ? "text-[var(--cr-dial-bad)]" : tone === "good" ? "text-[var(--cr-dial-good)]" : tone === "on" ? "text-[var(--cr-dial-gold)]" : "text-[var(--cr-dial-ink)]";
  const p = top > 0 ? (conv / top) * 100 : 0;

  return (
    <section aria-label={title || L.rateLabel} className={cx("@container w-full max-w-[960px] font-sans text-[var(--cr-ink)]", TOKENS, className)}>
      <div className="relative grid gap-2.5 rounded-[20px] border border-[var(--cr-line)] bg-[var(--cr-card)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_34px_70px_-48px_var(--cr-shadow),0_2px_8px_-5px_var(--cr-shadow)] @lg:gap-3.5 @lg:p-3.5 @3xl:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] @3xl:rounded-[26px] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_34px_70px_-40px_var(--cr-shadow)]">

        {/* ---------------- dial panel (charcoal in both themes) ---------------- */}
        <div className="relative order-3 grid content-start gap-4 overflow-hidden rounded-[18px] px-4 pb-4 pt-[18px] text-[var(--cr-dial-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04)] [background:radial-gradient(70%_55%_at_50%_58%,var(--cr-halo),transparent_70%),linear-gradient(160deg,var(--cr-dial-2),var(--cr-dial)_62%)] @lg:px-[22px] @lg:pb-[18px] @lg:pt-[22px] @3xl:order-none @3xl:px-6 @3xl:pb-5">
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] [background:repeating-linear-gradient(115deg,rgba(255,255,255,0.018)_0_2px,transparent_2px_7px)]" />
          {/* gold sheen along the top edge */}
          <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(246,196,83,0.55),transparent)]" />

          <div className="relative flex items-start justify-between gap-2.5">
            <span className="min-w-0 pt-px font-mono text-[10.5px] font-medium uppercase leading-[1.45] tracking-[0.12em] text-[var(--cr-dial-muted)]">{c ? `${c.long} · ${L.rateLabel}` : L.rateLabel}</span>
            <span className={cx("shrink-0 rounded-full px-2 py-[5px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] transition-colors duration-300",
              isWhat ? "bg-[var(--cr-dial-gold)] text-[var(--cr-dial)]" : "text-[var(--cr-dial-muted)] shadow-[inset_0_0_0_1px_var(--cr-dial-line)]")}>{isWhat ? L.whatif : L.actual}</span>
          </div>

          <div className="@container relative w-full max-w-[380px] justify-self-center">
            <svg viewBox="0 0 300 168" className="block h-auto w-full overflow-visible" aria-hidden focusable="false">
              <defs>
                <linearGradient id={`${uid}-g`} gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
                  <stop offset="0" stopColor="var(--cr-arc-from)" />
                  <stop offset="1" stopColor="var(--cr-arc-to)" />
                </linearGradient>
              </defs>
              <g>{ticks}</g>
              <text x={CX - R} y="166" textAnchor="middle" fill="var(--cr-dial-muted)" className="font-mono text-[9.5px] tracking-[0.04em]">0%</text>
              <text x={CX + R} y="166" textAnchor="middle" fill="var(--cr-dial-muted)" className="font-mono text-[9.5px] tracking-[0.04em]">{fix(scale, Number.isInteger(scale) ? 0 : 1)}%</text>
              <path d={ARC} pathLength={100} fill="none" stroke="var(--cr-dial-track)" strokeWidth={14} strokeLinecap="round" />
              <path ref={arcRef} d={ARC} pathLength={100} fill="none" stroke={`url(#${uid}-g)`} strokeWidth={14} strokeLinecap="round"
                strokeDasharray="100 200" strokeDashoffset={100 - clamp(fMv.get(), 0, 1.02) * 100}
                className={cx("transition-opacity duration-300 [filter:drop-shadow(0_0_7px_var(--cr-halo))]", isWhat && "opacity-80")} />
              {c && c.target !== null && (
                <g ref={tgtRef} transform={rot(tMv.get())}>
                  <line x1={CX - R - 15} y1={CY} x2={CX - R + 13} y2={CY} stroke="var(--cr-dial-ink)" strokeWidth={2.4} strokeLinecap="round" />
                  <circle cx={CX - R - 17} cy={CY} r={2.6} fill="var(--cr-dial-ink)" />
                </g>
              )}
              <g ref={actRef} transform={rot(aMv.get())} className={cx("transition-opacity duration-300", isWhat ? "opacity-100" : "opacity-0")}>
                <circle cx={CX - R} cy={CY} r={4.5} fill="var(--cr-dial-ink)" stroke="var(--cr-dial)" strokeWidth={2} />
              </g>
              <g ref={ptrRef} transform={rot(fMv.get())}>
                <line x1={CX - R + 22} y1={CY} x2={CX - R + 40} y2={CY} stroke="var(--cr-dial-gold)" strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
                <circle cx={CX - R} cy={CY} r={9} fill="var(--cr-dial)" stroke="var(--cr-dial-gold)" strokeWidth={3} />
                <circle cx={CX - R} cy={CY} r={3} fill="var(--cr-dial-gold)" />
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-x-0 bottom-[9%] grid justify-items-center gap-0.5">
              <span className="font-mono text-[max(9.5px,2.9cqi)] font-medium uppercase leading-none tracking-[0.14em] text-[var(--cr-dial-muted)]">{isWhat ? L.whatif : L.actual}</span>
              <span className="relative inline-flex items-start overflow-hidden font-serif text-[19cqi] font-normal leading-none tracking-[-0.035em] text-[var(--cr-dial-gold)] [font-variant-numeric:lining-nums_tabular-nums] [text-shadow:0_0_26px_var(--cr-halo)]">
                <span>{c && c.rate !== null ? fix(shownRate) : "—"}</span>
                <span className="ml-[0.06em] mt-[0.16em] text-[0.42em] tracking-normal text-[var(--cr-dial-muted)]">%</span>
                {!preview && !reduced && c && (
                  <motion.span key={c.id} aria-hidden initial={{ x: "-120%", opacity: 0 }} animate={{ x: "160%", opacity: [0, 0.9, 0] }} transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-y-0 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,240,200,0.55),transparent)] mix-blend-overlay" />
                )}
              </span>
            </div>
          </div>

          <div className="relative -mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {c && (
              <span className={cx("inline-flex items-center gap-[7px] rounded-full bg-[rgba(245,240,230,0.07)] py-[7px] pl-2.5 pr-3 text-[12.5px] font-semibold leading-none tabular shadow-[inset_0_0_0_1px_var(--cr-dial-line)] transition-colors duration-300", statusTone)}>
                <span aria-hidden className="size-[7px] rounded-full bg-current" />{statusText(rate, c.target)}
              </span>
            )}
            {delta && <span className="text-[12px] font-medium leading-none tabular text-[var(--cr-dial-muted)]">{delta}</span>}
          </div>

          <div className="relative grid gap-2 border-t border-[var(--cr-dial-line)] pt-3.5">
            <h3 className="font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.12em] text-[var(--cr-dial-muted)]">{L.byChannel}</h3>
            <div role="group" aria-label={L.byChannel} className="grid gap-0.5 @lg:@max-3xl:grid-cols-2 @lg:@max-3xl:gap-x-7">
              {list.map(ch => {
                const on = ch.id === c?.id;
                return (
                  <button key={ch.id} type="button" aria-pressed={on} onClick={() => pick(ch.id)}
                    aria-label={`${ch.long}: ${pct(ch.rate)}${ch.rate === null ? "" : `, ${statusText(ch.rate, ch.target)}`}`}
                    className={cx("group/ch -mx-2.5 grid grid-cols-[62px_minmax(0,1fr)_50px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium leading-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--cr-dial-gold)] @lg:grid-cols-[74px_minmax(0,1fr)_56px] @lg:gap-3",
                      on ? "bg-[rgba(240,192,90,0.10)]" : "hover:bg-[rgba(245,240,230,0.05)]")}>
                    <span className={cx("truncate leading-[1.35] transition-colors", on ? "text-[var(--cr-dial-ink)]" : "text-[var(--cr-dial-muted)]")}>{ch.label}</span>
                    <span aria-hidden className="relative h-1.5 rounded-full bg-[var(--cr-dial-track)]">
                      <motion.span className={cx("absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--cr-arc-from),var(--cr-arc-to))] transition-opacity", on ? "opacity-100" : "opacity-55 group-hover/ch:opacity-100")}
                        initial={preview ? false : { width: 0 }} animate={{ width: `${clamp(((ch.rate ?? 0) / scale) * 100, 0, 100)}%` }}
                        transition={{ duration: reduced ? 0 : 0.7, ease: [0.2, 0.7, 0.2, 1] }} />
                      {ch.target !== null && <span className="absolute -inset-y-1 -ml-px w-0.5 rounded-sm bg-[var(--cr-dial-ink)] opacity-80 transition-[left] duration-500" style={{ left: `${clamp((ch.target / scale) * 100, 0, 100)}%` }} />}
                    </span>
                    <span className="text-right font-serif text-[15px] tabular text-[var(--cr-dial-ink)]">{pct(ch.rate)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------------- details column (flattens below 768px so the order reads: title, switch, gauge, figures, what-if) ---------------- */}
        <div className="contents @3xl:grid @3xl:min-w-0 @3xl:content-start @3xl:gap-[22px] @3xl:py-3.5 @3xl:pl-2 @3xl:pr-3.5">
          <header className="order-1 grid gap-2 px-1.5 pb-0.5 pt-2 @lg:px-2 @lg:pt-2.5 @3xl:order-none @3xl:p-0">
            {eyebrow && <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.12em] text-[var(--cr-gold-ink)]">{eyebrow}</span>}
            {title && <h2 className="text-balance font-serif text-[23px] font-normal leading-[1.12] tracking-[-0.015em] @3xl:text-[29px]">{title}</h2>}
            {(client || period) && <p className="text-[13.5px] text-[var(--cr-muted)]">{[client, period].filter(Boolean).join(" · ")}</p>}
          </header>

          {list.length > 0 && (
            <Segmented<string>
              ariaLabel={L.channel} value={c?.id ?? ""} onChange={pick}
              className="order-2 flex! w-full rounded-[14px]! border-[var(--cr-line)]! bg-[var(--cr-tint)]! @3xl:order-none"
              buttonClassName="min-w-0 flex-1 rounded-[10px]! px-1! py-2.5! text-[12.5px]! font-semibold! @lg:px-2.5! @lg:text-[13px]! focus-visible:outline-[var(--cr-gold)]"
              activeClassName="text-[var(--cr-ink)]!"
              indicatorClassName="rounded-[10px]! bg-[var(--cr-raise)]! shadow-[0_1px_2px_var(--cr-shadow),0_0_0_1px_var(--cr-line),inset_0_-2px_0_var(--cr-gold)]!"
              options={list.map(ch => ({ value: ch.id, label: ch.label }))}
            />
          )}

          <dl className="order-4 mx-1.5 grid grid-cols-3 border-y border-[var(--cr-line)] @lg:mx-2 @3xl:order-none @3xl:mx-0">
            {[
              [L.conversions, c ? fmtInt(c.conversions) : "—"],
              [L.visitors, c ? fmtInt(c.visitors) : "—"],
              [L.target, c && c.target !== null ? `${fix(c.target)}%` : "—"],
            ].map(([k, v], i) => (
              <div key={k} className={cx("grid min-w-0 gap-1.5 py-3.5 pr-2 @lg:gap-2 @lg:py-4 @lg:pr-4", i > 0 && "border-l border-[var(--cr-line)] pl-2.5 @lg:pl-4")}>
                <dt className="font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-[var(--cr-faint)]">{k}</dt>
                <dd className="font-serif text-[20px] leading-none tracking-[-0.02em] [font-variant-numeric:lining-nums_tabular-nums] [overflow-wrap:anywhere] @lg:text-[26px]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className={cx("order-5 grid gap-3 rounded-2xl border bg-[linear-gradient(180deg,var(--cr-raise),var(--cr-card))] px-3.5 pb-3.5 pt-4 transition-[border-color,box-shadow] duration-300 @lg:px-[18px] @lg:pb-4 @lg:pt-[18px] @3xl:order-none",
            isWhat ? "border-[color-mix(in_oklab,var(--cr-gold)_55%,var(--cr-line))] shadow-[0_0_0_4px_var(--cr-gold-soft)]" : "border-[var(--cr-line)]")}>
            <div className="flex items-baseline justify-between gap-2.5">
              <label htmlFor={`${uid}-r`} className="text-[14px] font-semibold leading-[1.3]">{L.whatifLabel}</label>
              <output htmlFor={`${uid}-r`} className="font-serif text-[22px] leading-none tracking-[-0.02em] tabular text-[var(--cr-gold-ink)] @lg:text-[26px]">{fmtInt(conv)}</output>
            </div>
            <input ref={rangeRef} id={`${uid}-r`} type="range" min={0} max={top} step={1} value={conv} disabled={!c || c.visitors <= 0}
              onChange={e => c && setWi({ key, v: Math.round(+e.target.value) })}
              aria-valuetext={`${fmtInt(conv)} conversions, ${pct(rate)}`}
              style={{ ["--p" as string]: `${p.toFixed(2)}%` }}
              className={cx("h-[26px] w-full cursor-pointer appearance-none bg-transparent focus:outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cr-gold)] disabled:cursor-not-allowed disabled:opacity-50",
                "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:linear-gradient(90deg,var(--cr-gold)_var(--p),var(--cr-line)_var(--p))]",
                "[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--cr-gold)] [&::-webkit-slider-thumb]:bg-[var(--cr-raise)] [&::-webkit-slider-thumb]:shadow-[0_2px_6px_-1px_var(--cr-shadow),0_0_0_4px_var(--cr-gold-soft)] [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-110 motion-reduce:[&::-webkit-slider-thumb]:transition-none",
                "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[var(--cr-line)] [&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[var(--cr-gold)]",
                "[&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--cr-gold)] [&::-moz-range-thumb]:bg-[var(--cr-raise)]")} />
            <div aria-hidden className="-mt-1.5 flex justify-between font-mono text-[11px] font-medium leading-none tabular text-[var(--cr-faint)]">
              <span>0</span><span>{fmtInt(top)}</span>
            </div>
            <p className="min-h-[2.9em] text-[13.5px] leading-normal text-[var(--cr-muted)]">{result}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!c || c.needed === null || conv === c.needed}
                onClick={() => c && c.needed !== null && setTo(clamp(c.needed, 0, top))}
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-[var(--cr-ink)] bg-[var(--cr-ink)] px-[13px] py-[9px] text-[12.5px] font-semibold leading-none text-[var(--cr-card)] transition-[background-color,border-color,scale] duration-200 enabled:hover:border-[var(--cr-gold-ink)] enabled:hover:bg-[var(--cr-gold-ink)] enabled:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-gold)] disabled:opacity-45">
                <IconTarget />{L.setTarget}
              </button>
              <button type="button" disabled={!isWhat} onClick={() => c && setTo(c.conversions)}
                className="inline-flex items-center gap-[7px] rounded-[10px] border border-[var(--cr-line)] bg-[var(--cr-raise)] px-[13px] py-[9px] text-[12.5px] font-semibold leading-none transition-[border-color,color,scale] duration-200 enabled:hover:border-[var(--cr-gold)] enabled:hover:text-[var(--cr-gold-ink)] enabled:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-gold)] disabled:opacity-45">
                <IconReset />{L.reset}
              </button>
            </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </section>
  );
}
