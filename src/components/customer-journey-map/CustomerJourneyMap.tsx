import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import type { JourneyData, JourneyStage, Persona, StageEntry, StageSelectDetail, StageTone, TouchKind } from "./data";

/* ------------------------------------------------------------
   Customer Journey Map — pastel stage swimlanes (goal, touchpoints,
   pain points) with an emotion curve. Switch persona to morph the
   curve; focus a stage for its opportunity, key number and quote.
   Wide: columns + curve + detail card. Narrow: vertical sequence
   with a sentiment meter per stage and inline details.
   ------------------------------------------------------------ */

export interface CustomerJourneyMapProps {
  data: JourneyData;
  /** Initial persona id (default: the first). */
  defaultPersona?: string;
  /** Initial focused stage id (default: none). */
  defaultStage?: string;
  onStageSelect?: (detail: StageSelectDetail) => void;
  onPersonaChange?: (detail: { persona: string; name: string }) => void;
  className?: string;
}

const THEME = [
  "[--card:#fffcf7] [--tint:#f6f0e7] [--curve:#1f1a17] [--pos:#23825a] [--neu:#a07a06] [--neg:#cc4a33] [--kick:#b4532a]",
  "[--peach:#fde3d3] [--peach-s:#b4532a] [--butter:#fbf0c2] [--butter-s:#8c6a04] [--mint:#d6f0e0] [--mint-s:#23825a] [--sky:#d8e9f8] [--sky-s:#2f6fb0] [--lilac:#e7dff6] [--lilac-s:#6e4fbf]",
  "dark:[--card:#1a1613] dark:[--tint:#231e1a] dark:[--curve:#f3ece4] dark:[--pos:#5ccb94] dark:[--neu:#e8c04a] dark:[--neg:#ff8a73] dark:[--kick:#f59a73]",
  "dark:[--peach:#3a261d] dark:[--peach-s:#f59a73] dark:[--butter:#352d15] dark:[--butter-s:#e8c04a] dark:[--mint:#1b3126] dark:[--mint-s:#5ccb94] dark:[--sky:#1c2b3b] dark:[--sky-s:#6faeea] dark:[--lilac:#2a223d] dark:[--lilac-s:#a98af0]",
].join(" ");
const TONES: StageTone[] = ["peach", "butter", "mint", "sky", "lilac"];
const AVATARS = ["#B4532A", "#2F6F9F", "#6B4FB0", "#2E7D5B", "#A3336A"];
const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
const WIDE = 768;

/* ---------- helpers ---------- */
const clampScore = (v: number | null | undefined) => Math.max(-2, Math.min(2, v ?? 0));
type Feel = "pos" | "neu" | "neg";
const feelOf = (s: number): Feel => (s >= 0.5 ? "pos" : s <= -0.5 ? "neg" : "neu");
const signed = (s: number) => (s > 0 ? `+${s}` : s < 0 ? `−${Math.abs(s)}` : "0");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

const MOUTHS: Record<number, number[]> = {
  2: [-7, 2, 0, 11, 7, 2], 1: [-6, 3, 0, 8.5, 6, 3], 0: [-5.5, 5, 0, 5, 5.5, 5], [-1]: [-6, 7.5, 0, 2.5, 6, 7.5], [-2]: [-7, 8.5, 0, -0.5, 7, 8.5],
};
/** Continuous mouth: interpolates between the five expressions, so faces morph smoothly. */
function mouth(score: number) {
  const s = clampScore(score), lo = Math.floor(s), hi = Math.ceil(s), f = s - lo;
  const a = MOUTHS[lo], b = MOUTHS[hi];
  const v = a.map((x, i) => (x + (b[i] - x) * f).toFixed(2));
  return `M${v[0]},${v[1]} Q${v[2]},${v[3]} ${v[4]},${v[5]}`;
}

function FaceShape({ score, halo = false, on = false }: { score: number; halo?: boolean; on?: boolean }) {
  const feel = feelOf(Math.round(clampScore(score)));
  return (
    <>
      {halo && <circle r={24} fill={`var(--${feel})`} fillOpacity={on ? 0.22 : 0} className="transition-[fill-opacity] duration-300" />}
      <circle r={15} fill="var(--card)" stroke={`var(--${feel})`} strokeWidth={2.5} className="transition-[stroke] duration-300" />
      <circle cx={-5} cy={-3.5} r={1.7} fill="var(--ink)" />
      <circle cx={5} cy={-3.5} r={1.7} fill="var(--ink)" />
      <path d={mouth(score)} fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeLinecap="round" />
    </>
  );
}
const Face = ({ score, className = "size-6" }: { score: number; className?: string }) => (
  <svg viewBox="-18 -18 36 36" aria-hidden focusable="false" className={cx("shrink-0", className)}><FaceShape score={score} /></svg>
);

const G: Record<TouchKind, ReactNode> = {
  search: <path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5" />,
  social: <path d="M5.5 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 14c0-2.5 1.8-4 4-4s4 1.5 4 4M11 7a2 2 0 1 0 0-4M12 10c1.5.3 2.5 1.6 2.5 3.5" />,
  review: <path d="m8 1.8 1.9 3.9 4.2.6-3 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3-3 4.2-.6z" />,
  web: <><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M1.5 5.5h13M4 4h.01M6 4h.01" /></>,
  chat: <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3A1.5 1.5 0 0 1 2 9.5z" />,
  phone: <path d="M3.2 1.8h2.4l1.2 3-1.6 1a8 8 0 0 0 5 5l1-1.6 3 1.2v2.4a1.4 1.4 0 0 1-1.5 1.4A12.5 12.5 0 0 1 1.8 3.3a1.4 1.4 0 0 1 1.4-1.5Z" />,
  email: <><rect x="1.5" y="3" width="13" height="10" rx="2" /><path d="m2 4 6 5 6-5" /></>,
  sms: <><rect x="3.5" y="1.5" width="9" height="13" rx="2" /><path d="M6 4.5h4M6 7h4M6 9.5h2.5" /></>,
  visit: <path d="M2 14.5V6.5L8 2l6 4.5v8M6 14.5v-4h4v4" />,
};
const Glyph = ({ kind, className = "size-3" }: { kind: TouchKind; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden>{G[kind] ?? G.web}</svg>
);
const Chevron = ({ d, className = "size-4" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------- small blocks ---------- */
const Label = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">{children}</span>
);
function Block({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cx("grid min-w-0 content-start gap-1.5 rounded-xl bg-[var(--card)] p-3.5", className)}><Label>{label}</Label>{children}</div>;
}
function MetricBlock({ e, className }: { e: StageEntry; className?: string }) {
  return (
    <Block label="Number to watch" className={className}>
      <span className="font-display text-[30px] font-bold leading-none tracking-[-0.02em] text-[var(--cs)] tabular">{e.metric?.value || "—"}</span>
      {e.metric?.label && <span className="text-[12.5px] leading-snug text-ink-2">{e.metric.label}</span>}
    </Block>
  );
}
function QuoteBlock({ e, name, className }: { e: StageEntry; name: string; className?: string }) {
  if (!e.quote) return null;
  return (
    <figure className={cx("grid min-w-0 content-start gap-1.5 rounded-xl bg-[var(--card)] p-3.5", className)}>
      <Label>In their words</Label>
      <blockquote className="font-serif text-[15px] italic leading-snug">“{e.quote}”</blockquote>
      <figcaption className="mt-1 text-[12px] text-ink-2">— {name}</figcaption>
    </figure>
  );
}

/* ---------- component ---------- */
export function CustomerJourneyMap({ data, defaultPersona, defaultStage, onStageSelect, onPersonaChange, className }: CustomerJourneyMapProps) {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const uid = useId();
  const stages: Required<JourneyStage>[] = useMemo(() => data.stages.map((s, i) => ({
    id: s.id || `stage-${i + 1}`, label: s.label || `Stage ${i + 1}`, tone: s.tone && TONES.includes(s.tone) ? s.tone : TONES[i % TONES.length],
  })), [data.stages]);
  const personas: (Persona & { color: string })[] = useMemo(
    () => data.personas.map((p, i) => ({ ...p, color: p.color ?? AVATARS[i % AVATARS.length] })), [data.personas]);

  const [personaId, setPersonaId] = useState(() => personas.find(p => p.id === defaultPersona)?.id ?? personas[0]?.id ?? "");
  const [stage, setStage] = useState(() => (stages.some(s => s.id === defaultStage) ? defaultStage! : ""));
  const [announce, setAnnounce] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const animate = !reduced && !preview && mounted;

  const p = personas.find(x => x.id === personaId) ?? null;
  const entries: StageEntry[] = useMemo(() => stages.map(s => {
    const e = p?.stages?.[s.id];
    const score = clampScore(e?.emotion);
    return {
      goal: e?.goal ?? "", touchpoints: e?.touchpoints ?? [], pains: e?.pains ?? [], emotion: score,
      mood: e?.mood || (score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral"),
      opportunity: e?.opportunity ?? "", metric: e?.metric ?? { value: "", label: "" }, quote: e?.quote ?? "",
    };
  }), [p, stages]);
  const firstName = (p?.name ?? "").split(" ")[0];
  const onIdx = stages.findIndex(s => s.id === stage);

  /* ---- emotion curve tween ---- */
  const target = useMemo(() => entries.map(e => e.emotion), [entries]);
  const [scores, setScores] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const from = shown.current;
    if (!animate || from.length !== target.length) { shown.current = target; setScores(target); return; }
    if (from.every((v, i) => v === target[i])) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / 480));
      const v = target.map((x, i) => from[i] + (x - from[i]) * k);
      shown.current = v;
      setScores(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  /* ---- layout measurement ---- */
  const [rootRef, rootW] = useWidth<HTMLDivElement>();
  const wide = rootW >= WIDE;
  const [curveRef, curveW] = useWidth<HTMLDivElement>();
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [xs, setXs] = useState<number[]>([]);
  useLayoutEffect(() => {
    const box = curveRef.current;
    if (!box || !curveW) { setXs([]); return; }
    const br = box.getBoundingClientRect();
    setXs(colRefs.current.slice(0, stages.length).map(c => { const r = c?.getBoundingClientRect(); return r ? r.left + r.width / 2 - br.left : 0; }));
  }, [curveW, stages.length, curveRef]);
  const H = 180, TOP = 24, BOTTOM = 72;
  const yOf = (s: number) => TOP + ((2 - s) / 4) * (H - TOP - BOTTOM);
  const pts = xs.map((x, i) => [x, yOf(scores[i] ?? 0)] as const);
  let d = "";
  pts.forEach((pt, i) => {
    if (!i) { d = `M${pt[0].toFixed(1)},${pt[1].toFixed(1)}`; return; }
    const p0 = pts[i - 2] ?? pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] ?? pt, t = 0.18;
    const c1 = [p1[0] + (pt[0] - p0[0]) * t, p1[1] + (pt[1] - p0[1]) * t];
    const c2 = [pt[0] - (p3[0] - p1[0]) * t, pt[1] - (p3[1] - p1[1]) * t];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
  });

  /* ---- selection ---- */
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (id: string | null, focus = false) => {
    const next = id && stages.some(s => s.id === id) ? id : "";
    if (next === stage) return;
    setStage(next);
    const i = stages.findIndex(s => s.id === next), e = i >= 0 ? entries[i] : null;
    if (next && e) setAnnounce(`${stages[i].label}, stage ${i + 1} of ${stages.length}. ${p?.name ?? ""} feels ${e.mood.toLowerCase()}.`);
    else setAnnounce("Stage focus cleared.");
    if (focus && i >= 0) btnRefs.current[i]?.focus({ preventScroll: true });
    onStageSelect?.({ stage: next || null, label: i >= 0 ? stages[i].label : null, index: i, persona: personaId, emotion: e ? e.emotion : null, mood: e ? e.mood : null });
  };
  const choosePersona = (id: string) => {
    if (id === personaId) return;
    setPersonaId(id);
    const np = personas.find(x => x.id === id);
    setAnnounce(`Showing ${np?.name ?? ""}'s journey.`);
    onPersonaChange?.({ persona: id, name: np?.name ?? "" });
  };
  const onStageKey = (e: KeyboardEvent, i: number) => {
    const n = stages.length;
    const map: Record<string, number> = { ArrowRight: Math.min(n - 1, i + 1), ArrowDown: Math.min(n - 1, i + 1), ArrowLeft: Math.max(0, i - 1), ArrowUp: Math.max(0, i - 1), Home: 0, End: n - 1 };
    if (e.key === "Escape") { if (stage) { e.preventDefault(); select(null); } return; }
    if (!(e.key in map)) return;
    e.preventDefault();
    select(stages[map[e.key]].id);
    btnRefs.current[map[e.key]]?.focus();
  };
  const onColumnClick = (ev: MouseEvent, id: string, i: number) => {
    const fromBtn = (ev.target as HTMLElement).closest("button[data-stage-btn]");
    if (!wide && !fromBtn) return;
    select(stage === id ? null : id);
    if (fromBtn || wide) btnRefs.current[i]?.focus({ preventScroll: true });
  };

  // glance (no stage focused)
  let hi = 0, lo = 0;
  entries.forEach((e, k) => { if (e.emotion > entries[hi].emotion) hi = k; if (e.emotion < entries[lo].emotion) lo = k; });
  const roving = Math.max(0, onIdx);

  const rows = [["Stage"], ["Customer goal"], ["Touchpoints"], ["Pain points"], ["Emotion", "Higher is happier"]];

  return (
    <div ref={rootRef} className={cx("@container w-full max-w-[1080px]", className)}>
      <article className={cx(THEME, "relative w-full rounded-[24px] border border-line bg-[var(--card)] px-3 pb-4 pt-5 text-ink elev-3 @md:px-5 @3xl:px-6 @3xl:pb-6 @3xl:pt-7")}
        aria-labelledby={`${uid}-t`}>
        {/* ---------- header ---------- */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1">
          <div className="grid min-w-0 max-w-[560px] gap-1.5">
            {data.eyebrow && <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--kick)]">{data.eyebrow}</span>}
            {data.title && <h2 id={`${uid}-t`} className="font-display text-[20px] font-bold leading-tight tracking-[-0.02em] text-balance @3xl:text-[26px]">{data.title}</h2>}
            {data.subtitle && <p className="text-[13.5px] text-ink-2">{data.subtitle}</p>}
          </div>
          {personas.length > 1 && (
            <div role="group" aria-label="Persona" className="grid w-full gap-1.5 @lg:flex @lg:w-auto @lg:flex-wrap">
              {personas.map(x => {
                const on = x.id === personaId;
                return (
                  <button key={x.id} type="button" aria-pressed={on} onClick={() => choosePersona(x.id)}
                    className={cx("relative inline-flex items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-3.5 text-left transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink @lg:rounded-full",
                      on ? "border-ink bg-[var(--tint)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--ink)_10%,transparent)]" : "border-line bg-[var(--card)] hover:border-ink-3")}>
                    <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold tracking-[0.02em] text-white" style={{ background: x.color }}>{initials(x.name)}</span>
                    <span className="grid leading-tight">
                      <b className="text-[12.5px] font-semibold text-ink">{x.name}</b>
                      <small className="text-[11px] text-ink-3">{x.role}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={personaId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
            className="mt-3.5 px-1 text-[13.5px] text-ink-2">
            {p ? <><b className="font-semibold text-ink">{p.name}{p.role ? ` · ${p.role}` : ""}</b>{p.summary ? `  ${p.summary}` : ""}</> : "Add a persona to see the journey."}
          </motion.p>
        </AnimatePresence>

        {/* ---------- map ---------- */}
        <div className="relative mt-5 grid gap-3 @3xl:grid-cols-[96px_repeat(var(--n),minmax(0,1fr))] @3xl:grid-rows-[auto_auto_auto_auto_180px] @3xl:gap-x-2 @3xl:gap-y-0"
          style={{ "--n": Math.max(1, stages.length) } as CSSProperties}>
          {rows.map((r, i) => (
            <div key={r[0]} aria-hidden style={{ gridRow: i + 1 }}
              className={cx("hidden pr-2 font-mono text-[10px] font-medium uppercase leading-snug tracking-[0.08em] text-ink-3 @3xl:col-start-1 @3xl:block",
                i === 0 ? "self-center" : "border-t border-dashed border-line pb-3 pt-3.5")}>
              {r[0]}
              {r[1] && <small className="mt-1.5 block font-sans text-[11px] normal-case tracking-normal">{r[1]}</small>}
            </div>
          ))}

          {stages.map((s, i) => {
            const e = entries[i];
            const on = stage === s.id;
            const dim = !!stage && !on;
            const sc = Math.round(e.emotion);
            const feel = feelOf(sc);
            const cellAnim = (k: number) => ({

              initial: animate ? { opacity: 0, y: 4 } : false,
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.32, delay: i * 0.04 + k * 0.025 },
            } as const);
            return (
              <div key={s.id} ref={el => { colRefs.current[i] = el; }} onClick={ev => onColumnClick(ev, s.id, i)}
                style={{ "--c": `var(--${s.tone})`, "--cs": `var(--${s.tone}-s)`, "--col": i + 2, "--f": `var(--${feel})` } as CSSProperties}
                className={cx("relative grid min-w-0 grid-cols-1 rounded-2xl bg-[var(--c)] transition-[opacity,filter,box-shadow,transform] duration-300 [grid-template-areas:'head'_'feel'_'goal'_'touch'_'pain'_'extra']",
                  "@md:grid-cols-2 @md:[grid-template-areas:'head_head'_'goal_feel'_'touch_pain'_'extra_extra']",
                  "@3xl:row-span-5 @3xl:row-start-1 @3xl:cursor-pointer @3xl:grid-cols-1 @3xl:grid-rows-subgrid @3xl:[grid-column:var(--col)] @3xl:[grid-template-areas:none]",
                  "hover:shadow-[0_0_0_1.5px_color-mix(in_oklab,var(--cs)_45%,transparent)]",
                  on && "shadow-[0_0_0_2px_var(--cs),0_22px_36px_-24px_rgb(52_36_22/0.4)]! @3xl:-translate-y-0.5 motion-reduce:translate-y-0",
                  dim && "opacity-70 @3xl:opacity-45 @3xl:saturate-[.55]",
                  i < stages.length - 1 && "after:absolute after:-bottom-3 after:left-7 after:h-3 after:w-0.5 after:bg-line-strong @3xl:after:hidden")}>
                {/* head */}
                <div className="p-1.5 [grid-area:head] @3xl:[grid-area:auto]">
                  <button ref={el => { btnRefs.current[i] = el; }} type="button" data-stage-btn aria-pressed={on} tabIndex={i === roving ? 0 : -1}
                    onKeyDown={ev => onStageKey(ev, i)}
                    className="flex w-full items-center gap-2 rounded-[11px] bg-[color-mix(in_oklab,var(--card)_55%,transparent)] px-2 py-2.5 text-left font-display text-[14px] font-bold leading-tight tracking-[-0.01em] text-ink transition-colors hover:bg-[var(--card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs)]">
                    <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-[var(--cs)] font-mono text-[10.5px] font-bold text-[var(--card)]">{i + 1}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{s.label}</span>
                    <span className="sr-only">, stage {i + 1} of {stages.length}, feeling {e.mood.toLowerCase()}</span>
                    <motion.span aria-hidden className="ml-auto text-ink-2 @3xl:hidden" animate={{ rotate: on ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <Chevron d="m4 6 4 4 4-4" />
                    </motion.span>
                  </button>
                </div>
                {/* goal */}
                <div className="grid content-start gap-1.5 border-t border-dashed border-[color-mix(in_oklab,var(--cs)_28%,transparent)] p-3 [grid-area:goal] @3xl:[grid-area:auto]">
                  <span className="@3xl:sr-only"><Label>Customer goal</Label></span>
                  <motion.p key={personaId} {...cellAnim(0)} className="text-[13px] leading-snug">{e.goal || "—"}</motion.p>
                </div>
                {/* touchpoints */}
                <div className="grid content-start gap-1.5 border-t border-dashed border-[color-mix(in_oklab,var(--cs)_28%,transparent)] p-3 [grid-area:touch] @3xl:[grid-area:auto]">
                  <span className="@3xl:sr-only"><Label>Touchpoints</Label></span>
                  <motion.ul key={personaId} {...cellAnim(1)} className="flex flex-wrap gap-1.5">
                    {e.touchpoints.map((t, k) => (
                      <li key={t.label + k} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--card)_72%,transparent)] py-1 pl-1.5 pr-2 text-[11.5px] font-medium leading-tight">
                        <span className="text-[var(--cs)]"><Glyph kind={t.kind} /></span>{t.label}
                      </li>
                    ))}
                  </motion.ul>
                </div>
                {/* pains */}
                <div className="grid content-start gap-1.5 border-t border-dashed border-[color-mix(in_oklab,var(--cs)_28%,transparent)] p-3 [grid-area:pain] @md:border-l @3xl:border-l-0 @3xl:[grid-area:auto]">
                  <span className="@3xl:sr-only"><Label>Pain points</Label></span>
                  <motion.ul key={personaId} {...cellAnim(2)} className="grid gap-1.5">
                    {e.pains.map((x, k) => (
                      <li key={k} className="grid grid-cols-[12px_minmax(0,1fr)] gap-1.5 text-[12.5px] leading-snug text-ink-2">
                        <span aria-hidden className="mt-[5px] size-[7px] rotate-45 rounded-[2px] bg-[var(--neg)]" />{x}
                      </li>
                    ))}
                  </motion.ul>
                </div>
                {/* feel */}
                <div className="flex flex-col border-t border-dashed border-[color-mix(in_oklab,var(--cs)_28%,transparent)] p-3 [grid-area:feel] @md:border-l @3xl:justify-end @3xl:border-l-0 @3xl:pb-2.5 @3xl:[grid-area:auto]">
                  <span className="mb-1.5 @3xl:sr-only"><Label>Emotion</Label></span>
                  {/* wide: mood under the curve */}
                  <div className="hidden text-center @3xl:block" aria-hidden>
                    <span className="block text-[12.5px] font-semibold leading-tight">{e.mood}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-ink-2 tabular">{signed(sc)}</span>
                  </div>
                  {/* narrow: sentiment meter */}
                  <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 @3xl:hidden">
                    <Face score={scores[i] ?? e.emotion} className="row-span-2 size-[30px]" />
                    <b className="text-[13px] font-semibold leading-tight">{e.mood} · {signed(sc)}</b>
                    <span aria-hidden className="grid grid-cols-5 gap-[3px]">
                      {[-2, -1, 0, 1, 2].map(k => {
                        const lit = sc === 0 ? k === 0 : sc > 0 ? k > 0 && k <= sc : k < 0 && k >= sc;
                        return <i key={k} className={cx("h-1.5 rounded-[2px] transition-colors duration-300", lit ? "bg-[var(--f)]" : "bg-ink/10")} />;
                      })}
                    </span>
                  </div>
                </div>
                {/* narrow: inline details */}
                <AnimatePresence initial={false}>
                  {on && !wide && (
                    <motion.div key="extra" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden [grid-area:extra] @3xl:hidden">
                      <div className="grid gap-2.5 px-2.5 pb-3">
                        <div className="grid gap-2.5 @md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
                          <Block label="Opportunity" className="bg-[color-mix(in_oklab,var(--card)_85%,transparent)]"><p className="text-[13.5px] leading-relaxed">{e.opportunity || "—"}</p></Block>
                          <MetricBlock e={e} className="bg-[color-mix(in_oklab,var(--card)_85%,transparent)]" />
                        </div>
                        <QuoteBlock e={e} name={p?.name ?? ""} className="bg-[color-mix(in_oklab,var(--card)_85%,transparent)]" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* emotion curve overlay (wide) */}
          <div ref={curveRef} aria-hidden className="pointer-events-none relative z-[2] hidden min-w-0 @3xl:col-[2/-1] @3xl:row-start-5 @3xl:block">
            {curveW > 0 && pts.length > 0 && (
              <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${curveW} ${H}`} focusable="false">
                <line x1={0} x2={curveW} y1={yOf(0)} y2={yOf(0)} stroke="var(--curve)" strokeOpacity={0.22} strokeDasharray="2 4" />
                {pts.length > 1 && (
                  <>
                    <defs>
                      <linearGradient id={`${uid}-area`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--curve)" stopOpacity={0.09} />
                        <stop offset="100%" stopColor="var(--curve)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <path d={`${d}L${pts[pts.length - 1][0].toFixed(1)},${H - BOTTOM + 8}L${pts[0][0].toFixed(1)},${H - BOTTOM + 8}Z`} fill={`url(#${uid}-area)`} />
                    <motion.path d={d} fill="none" stroke="var(--curve)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
                      initial={preview || reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
                  </>
                )}
                {pts.map((pt, i) => (
                  <g key={stages[i].id} transform={`translate(${pt[0].toFixed(1)},${pt[1].toFixed(1)})`}
                    className={cx("transition-opacity duration-300", stage && stage !== stages[i].id && "opacity-40")}>
                    <FaceShape score={scores[i] ?? 0} halo on={stage === stages[i].id} />
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* ---------- detail card (wide) ---------- */}
        {wide && p && stages.length > 0 && (
          <section aria-label="Stage details"
            style={onIdx >= 0 ? ({ "--c": `var(--${stages[onIdx].tone})`, "--cs": `var(--${stages[onIdx].tone}-s)` } as CSSProperties) : undefined}
            className={cx("mt-4 rounded-2xl border p-5 transition-colors duration-300",
              onIdx >= 0 ? "border-[color-mix(in_oklab,var(--cs)_35%,transparent)] bg-[color-mix(in_oklab,var(--c)_55%,var(--card))]" : "border-line bg-[var(--tint)]")}>
            <AnimatePresence mode="wait" initial={false}>
              {onIdx < 0 ? (
                <motion.div key="glance" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}
                  className="flex flex-wrap items-center gap-3.5">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: p.color }}>{initials(p.name)}</span>
                  <div className="grid min-w-0 flex-[1_1_260px] gap-0.5">
                    <b className="font-display text-[14.5px] font-semibold">{firstName}'s journey at a glance</b>
                    <span className="text-[13px] leading-relaxed text-ink-2">
                      High point: {stages[hi].label} ({entries[hi].mood.toLowerCase()}). Low point: {stages[lo].label} ({entries[lo].mood.toLowerCase()}). Pick a stage to see the opportunity, a key number and what {firstName} said.
                    </span>
                  </div>
                  <button type="button" onClick={() => select(stages[lo].id, true)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-ink px-3.5 text-[12.5px] font-semibold text-[var(--card)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                    <Face score={entries[lo].emotion} className="size-4" />Show the low point
                  </button>
                </motion.div>
              ) : (
                <motion.div key={`${personaId}-${stage}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24, ease: EASE }}
                  className="grid gap-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                    <div className="grid min-w-0 flex-auto gap-1">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Stage {onIdx + 1} of {stages.length} · {p.name}</span>
                      <h3 className="font-display text-[20px] font-bold leading-tight tracking-[-0.015em]">{stages[onIdx].label}</h3>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--card)] py-1 pl-1 pr-3 text-[12.5px] font-semibold tabular"
                      style={{ boxShadow: `inset 0 0 0 1.5px var(--${feelOf(Math.round(entries[onIdx].emotion))})` }}>
                      <Face score={entries[onIdx].emotion} />{entries[onIdx].mood} · {signed(Math.round(entries[onIdx].emotion))}
                    </span>
                    <div className="inline-flex gap-1.5">
                      {([
                        ["Previous stage", "M10 3 5 8l5 5", () => select(stages[onIdx - 1].id, true), onIdx === 0],
                        ["Next stage", "m6 3 5 5-5 5", () => select(stages[onIdx + 1].id, true), onIdx === stages.length - 1],
                        ["Clear stage focus", "m4 4 8 8M12 4l-8 8", () => select(null), false],
                      ] as const).map(([label, path, fn, dis]) => (
                        <button key={label} type="button" aria-label={label} disabled={dis} onClick={fn}
                          className="grid size-[34px] place-items-center rounded-[10px] border border-line bg-[var(--card)] text-ink transition-colors enabled:hover:border-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                          <Chevron d={path} className="size-[15px]" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.1fr)] gap-3">
                    <Block label="Opportunity"><p className="text-[13.5px] leading-relaxed">{entries[onIdx].opportunity || "—"}</p></Block>
                    <MetricBlock e={entries[onIdx]} />
                    <QuoteBlock e={entries[onIdx]} name={p.name} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </article>
    </div>
  );
}
