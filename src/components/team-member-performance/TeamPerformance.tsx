import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Icon, Segmented, cx } from "../../ui";
import { usePreviewMode } from "../../lib/hooks";
import type { PeriodInfo, TeamData, TeamMetric } from "./data";

/* ------------------------------------------------------------
   Team Member Performance — deep purple + gold leaderboard.
   Podium 2-1-3, ranked list, metric + period switches, rank
   change vs the previous period, expandable trend + targets.
   ------------------------------------------------------------ */

export interface TeamPerformanceProps {
  data: TeamData;
  /** Controlled ranking metric (default revenue). */
  metric?: TeamMetric;
  defaultMetric?: TeamMetric;
  onMetricChange?: (detail: { metric: TeamMetric; period: string }) => void;
  /** Controlled period key (a key of data.periods). */
  period?: string;
  defaultPeriod?: string;
  onPeriodChange?: (detail: { period: string }) => void;
  /** Fired when a person is opened or closed. */
  onMemberSelect?: (detail: { id: string; name: string; rank: number; metric: TeamMetric; period: string; value: number | null; expanded: boolean }) => void;
  className?: string;
}

export const METRICS: TeamMetric[] = ["deals", "revenue", "calls", "response"];
const LABEL: Record<TeamMetric, string> = { deals: "Deals won", revenue: "Revenue", calls: "Calls", response: "Response time" };
const SHORT: Record<TeamMetric, string> = { deals: "Deals", revenue: "Revenue", calls: "Calls", response: "Response" };

export interface RankedMember {
  id: string; name: string; role: string;
  series: Record<TeamMetric, (number | null)[]>;
  cur: (k: TeamMetric) => number | null;
  prev: (k: TeamMetric) => number | null;
  target: Partial<Record<TeamMetric, number>>;
  value: number | null; prevValue: number | null;
  rank: number; prevRank: number | null; move: number | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Rank everyone for a metric + period, and work out the previous period's rank too. */
export function rankMembers(data: TeamData, metric: TeamMetric, period: string): RankedMember[] {
  const low = metric === "response";
  const rows = (data.members ?? []).map((m, i) => {
    const p = m.periods?.[period];
    const series = Object.fromEntries(METRICS.map(k => [k, Array.isArray(p?.[k]) ? p![k].map(num) : []])) as Record<TeamMetric, (number | null)[]>;
    const cur = (k: TeamMetric) => { const a = series[k]; return a.length ? a[a.length - 1] : null; };
    const prev = (k: TeamMetric) => { const a = series[k]; return a.length > 1 ? a[a.length - 2] : null; };
    return { id: String(m.id || `m${i + 1}`), name: m.name || `Member ${i + 1}`, role: m.role || "", series, cur, prev, target: p?.target ?? {},
      value: cur(metric), prevValue: prev(metric), rank: 0, prevRank: null as number | null, move: null as number | null };
  });
  const cmp = (which: "cur" | "prev") => (a: RankedMember, b: RankedMember) => {
    const x = which === "cur" ? a.value : a.prevValue, y = which === "cur" ? b.value : b.prevValue;
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (x !== y) return low ? x - y : y - x;
    const rx = which === "cur" ? a.cur("revenue") : a.prev("revenue"), ry = which === "cur" ? b.cur("revenue") : b.prev("revenue");
    if ((rx || 0) !== (ry || 0)) return (ry || 0) - (rx || 0);
    return a.name.localeCompare(b.name);
  };
  [...rows].sort(cmp("prev")).forEach((r, i) => { r.prevRank = r.prevValue == null ? null : i + 1; });
  rows.sort(cmp("cur")).forEach((r, i) => { r.rank = i + 1; r.move = r.prevRank == null ? null : r.prevRank - r.rank; });
  return rows;
}

const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const hue = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

const THEME = [
  "[--card:#FCFBFF] dark:[--card:#15101F] [--raise:#FFFFFF] dark:[--raise:#1D1729] [--tint:#F4F1FA] dark:[--tint:#1B1526] [--hair:#E7E2F1] dark:[--hair:#2B233A]",
  "[--pur:#5B21B6] dark:[--pur:#C4B5FD] [--pur-soft:rgb(91_33_182/0.08)] dark:[--pur-soft:rgb(196_181_253/0.10)]",
  "[--gold:#B45309] dark:[--gold:#FBBF24] [--gold-soft:rgb(180_83_9/0.10)] dark:[--gold-soft:rgb(251_191_36/0.12)]",
  "[--good:#15803D] dark:[--good:#6EE7A0] [--bad:#B91C1C] dark:[--bad:#FCA5A5] [--shade:rgb(40_18_80/0.22)] dark:[--shade:rgb(0_0_0/0.65)]",
  "[--av-sat:58%] dark:[--av-sat:38%] [--av-bg:90%] dark:[--av-bg:26%] [--av-fg:27%] dark:[--av-fg:86%]",
  "[--pod:#22094F] dark:[--pod:#170636] [--pod-2:#3F1A8C] dark:[--pod-2:#2D1268]",
  "[--m1:#FBBF24] [--m2:#DCD6EC] [--m3:#E9A97A]",
].join(" ");

const Crown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 30 20" fill="currentColor" aria-hidden className={className}><path d="M2 6.5 8.5 11 15 2l6.5 9L28 6.5 25.5 18h-21Z" /><circle cx="2" cy="5.5" r="2" /><circle cx="15" cy="2" r="2" /><circle cx="28" cy="5.5" r="2" /></svg>
);
const Trophy = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden className="size-[13px]"><path d="M5 2.5h6v3.5a3 3 0 0 1-6 0V2.5Z" /><path d="M5 4H2.8a2 2 0 0 0 2.4 2.6M11 4h2.2a2 2 0 0 1-2.4 2.6M8 9v2.5M5.5 13.5h5" /></svg>
);

export function TeamPerformance({ data, metric: mProp, defaultMetric = "revenue", onMetricChange, period: pProp, defaultPeriod, onPeriodChange, onMemberSelect, className }: TeamPerformanceProps) {
  const uid = useId();
  const preview = usePreviewMode();
  const periodKeys = useMemo(() => {
    const k = Object.keys(data.periods ?? {});
    if (k.length) return k;
    const m = data.members?.[0];
    return m?.periods ? Object.keys(m.periods) : ["week"];
  }, [data]);
  const [mInner, setMInner] = useState<TeamMetric>(defaultMetric);
  const [pInner, setPInner] = useState<string>(defaultPeriod ?? periodKeys[0]);
  const metric = METRICS.includes(mProp ?? mInner) ? (mProp ?? mInner) : "revenue";
  const period = periodKeys.includes(pProp ?? pInner) ? (pProp ?? pInner) : periodKeys[0];
  const [open, setOpen] = useState<string | null>(null);
  const [live, setLive] = useState("");

  const pi = data.periods?.[period];
  const info: Required<PeriodInfo> = { label: pi?.label || period, range: pi?.range || "", compare: pi?.compare || "", axis: pi?.axis ?? [] };
  const loc = data.locale || "en-US";
  const fmt = (k: TeamMetric, v: number | null) => {
    if (v == null) return "—";
    if (k === "revenue") {
      try { return new Intl.NumberFormat(loc, { style: "currency", currency: data.currency || "USD", maximumFractionDigits: 0 }).format(v); }
      catch { return Math.round(v).toLocaleString(loc); }
    }
    if (k === "response") return `${Math.round(v).toLocaleString(loc)} min`;
    return Math.round(v).toLocaleString(loc);
  };

  const rows = useMemo(() => rankMembers(data, metric, period), [data, metric, period]);
  const openId = open && rows.some(r => r.id === open) ? open : null;
  const top = rows.slice(0, 3), rest = rows.slice(3);
  const best = Object.fromEntries(METRICS.map(k => {
    const v = rows.map(r => r.cur(k)).filter((x): x is number => x != null && x > 0);
    return [k, v.length ? (k === "response" ? Math.min(...v) : Math.max(...v)) : null];
  })) as Record<TeamMetric, number | null>;

  /* team figure for the ranking metric */
  const vals = rows.map(r => r.value).filter((v): v is number => v != null);
  const teamTotal = vals.length ? (metric === "response" ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0)) : null;
  const tg = rows.map(r => num(r.target[metric])).filter((v): v is number => v != null);
  const teamPct = teamTotal != null && metric !== "response" && tg.length === rows.length && tg.length ? teamTotal / tg.reduce((a, b) => a + b, 0) : null;

  const announce = (m: TeamMetric, p: string) => {
    const r = rankMembers(data, m, p)[0];
    const pl = (data.periods?.[p]?.label || p).toLowerCase();
    if (r) setLive(`Ranked by ${LABEL[m].toLowerCase()}, ${pl}. ${r.name} leads with ${fmt(m, r.value)}.`);
  };
  const setMetric = (m: TeamMetric) => { if (m === metric) return; setMInner(m); onMetricChange?.({ metric: m, period }); announce(m, period); };
  const setPeriod = (p: string) => { if (p === period) return; setPInner(p); onPeriodChange?.({ period: p }); announce(metric, p); };
  const toggle = (r: RankedMember) => {
    const next = openId === r.id ? null : r.id;
    setOpen(next);
    onMemberSelect?.({ id: r.id, name: r.name, rank: r.rank, metric, period, value: r.value, expanded: next === r.id });
  };

  const chg = (r: RankedMember, onPodium = false) => {
    const text = r.move == null ? "New" : r.move > 0 ? `▲ ${r.move}` : r.move < 0 ? `▼ ${-r.move}` : "–";
    const title = r.move == null ? "New" : r.move > 0 ? `Up ${r.move} from ${info.compare}` : r.move < 0 ? `Down ${-r.move} from ${info.compare}` : `Same rank as ${info.compare}`;
    const dir = r.move == null || r.move === 0 ? "same" : r.move > 0 ? "up" : "down";
    return (
      <span title={title} className={cx("inline-flex items-center gap-[3px] whitespace-nowrap rounded-full px-[7px] py-1 text-[11px] font-semibold leading-none tabular",
        onPodium ? cx("bg-white/[0.08]", dir === "up" ? "text-[#86EFAC]" : dir === "down" ? "text-[#FDA4AF]" : "text-[#CBBEF0]")
          : dir === "up" ? "bg-[color-mix(in_oklab,var(--good)_11%,transparent)] text-[var(--good)]"
          : dir === "down" ? "bg-[color-mix(in_oklab,var(--bad)_10%,transparent)] text-[var(--bad)]" : "bg-[var(--tint)] text-ink-3")}>
        <span aria-hidden>{text}</span><span className="sr-only">{title}</span>
      </span>
    );
  };
  const avatar = (r: RankedMember, cls: string, style?: CSSProperties, children?: ReactNode) => (
    <motion.span layoutId={preview ? undefined : `${uid}-av-${r.id}`} aria-hidden transition={{ type: "spring", stiffness: 300, damping: 32 }}
      style={{ "--h": hue(r.id), ...style } as CSSProperties}
      className={cx("relative grid shrink-0 place-items-center rounded-full font-display font-semibold tracking-[0.01em]", cls)}>
      {initials(r.name)}{children}
    </motion.span>
  );

  const segTheme = { className: "bg-[var(--tint)]! border-[var(--hair)]!", activeClassName: "text-[var(--pur)]!", indicatorClassName: "bg-[var(--raise)]! shadow-[0_1px_3px_-1px_var(--shade),0_0_0_1px_var(--hair)]!" };
  const podDetailId = `${uid}-pod-detail`;
  const openTop = top.find(r => r.id === openId);
  const stepH: Record<number, string> = { 1: "h-[86px]", 2: "h-[60px]", 3: "h-[42px]" };

  return (
    <article aria-labelledby={data.title ? `${uid}-title` : undefined}
      className={cx("@container relative grid w-full max-w-[1040px] grid-cols-[minmax(0,1fr)] gap-4 rounded-[18px] border border-[var(--hair)] bg-[var(--card)] px-3.5 pb-3.5 pt-[18px] text-ink shadow-[0_32px_64px_-46px_var(--shade),0_2px_6px_-4px_var(--shade)] @lg:gap-[18px] @lg:rounded-[22px] @lg:px-5 @lg:pb-[18px] @lg:pt-[22px] @3xl:px-[26px] @3xl:pb-5 @3xl:pt-[26px]", THEME, className)}>

      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5">
        <div className="grid min-w-0 gap-1.5">
          {data.eyebrow && <span className="inline-flex items-center gap-[7px] font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--gold)]"><Trophy />{data.eyebrow}</span>}
          {data.title && <h2 id={`${uid}-title`} className="m-0 font-display text-[clamp(22px,3.4cqi,29px)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance">{data.title}</h2>}
          <p className="m-0 text-[13.5px] text-ink-2">{[data.team, info.range].filter(Boolean).join(" · ")}</p>
        </div>
        <Segmented ariaLabel="Period" value={period} onChange={setPeriod} {...segTheme}
          className={cx(segTheme.className, "w-full @lg:w-auto [&>button]:flex-1 @lg:[&>button]:flex-none")}
          options={periodKeys.map(k => ({ value: k, label: data.periods?.[k]?.label || k }))} />
      </header>

      {/* sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-2.5">
        <div className="flex w-full flex-wrap items-center gap-2.5 @2xl:w-auto">
          <span className="font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.1em] text-ink-3">Rank by</span>
          <Segmented<TeamMetric> ariaLabel="Rank by" value={metric} onChange={setMetric} {...segTheme}
            className={cx(segTheme.className, "grid! w-full grid-cols-2 @lg:inline-flex! @lg:w-auto")}
            options={METRICS.map(k => ({ value: k, label: LABEL[k] }))} />
        </div>
        {teamTotal != null && (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 text-[13px] text-ink-2 tabular">
            <span>Team{metric === "response" ? " avg" : ""}</span>
            <b className="font-display text-[15px] font-semibold leading-none text-ink">{fmt(metric, teamTotal)}</b>
            {teamPct != null && (
              <span className={cx("rounded-full px-2 py-1 text-[11.5px] font-semibold leading-none", teamPct < 1 ? "bg-[var(--pur-soft)] text-[var(--pur)]" : "bg-[var(--gold-soft)] text-[var(--gold)]")}>
                {Math.round(teamPct * 100)}% of target
              </span>
            )}
          </p>
        )}
      </div>

      <LayoutGroup id={uid}>
        {/* podium */}
        {top.length > 0 && (
          <section aria-label="Top three"
            className="relative grid gap-1.5 overflow-hidden rounded-[18px] p-2.5 text-[#F6F1FF] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] @lg:grid-cols-3 @lg:items-end @lg:gap-2 @lg:px-3.5 @lg:pb-0 @lg:pt-5 @3xl:gap-3.5 @3xl:px-[26px] @3xl:pt-[26px]"
            style={{ background: "radial-gradient(42% 70% at 50% 30%, rgb(251 191 36 / 0.20), transparent 70%), radial-gradient(90% 120% at 50% 120%, var(--pod-2), transparent 70%), linear-gradient(180deg, var(--pod-2), var(--pod))" }}>
            <span aria-hidden className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000,transparent_75%)]"
              style={{ background: "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.09) 1px, transparent 1.4px) 0 0 / 16px 16px" }} />
            {top.map(r => {
              const place = r.rank;
              const isOpen = openId === r.id;
              const medal = place === 1 ? "var(--m1)" : place === 2 ? "var(--m2)" : "var(--m3)";
              return (
                <div key={place} className={cx("relative grid min-w-0 content-end justify-items-stretch @lg:justify-items-center", place === 1 ? "@lg:order-2" : place === 2 ? "@lg:order-1" : "@lg:order-3")}
                  style={{ "--m": medal } as CSSProperties}>
                  <button type="button" aria-expanded={isOpen} aria-controls={podDetailId} onClick={() => toggle(r)}
                    aria-label={`${r.rank}. ${r.name}, ${LABEL[metric]} ${fmt(metric, r.value)}. ${r.move == null ? "New" : r.move > 0 ? `Up ${r.move} from ${info.compare}` : r.move < 0 ? `Down ${-r.move} from ${info.compare}` : `Same rank as ${info.compare}`}.`}
                    className={cx("relative z-[1] grid w-full min-w-0 items-center gap-x-3.5 gap-y-1 rounded-2xl p-3 text-left transition-[background-color,box-shadow] duration-300 focus-visible:outline-[var(--m)]",
                      "grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'av_name_val'_'av_role_chg'] bg-white/[0.05]",
                      "@lg:grid-cols-1 @lg:justify-items-center @lg:gap-1.5 @lg:bg-transparent @lg:px-2 @lg:pb-3.5 @lg:pt-3 @lg:text-center @lg:[grid-template-areas:'crown'_'av'_'name'_'role'_'val'_'chg']",
                      isOpen ? "bg-white/[0.10]! shadow-[inset_0_0_0_1px_rgb(251_191_36/0.45)]" : "hover:bg-white/[0.06]")}>
                    <span aria-hidden className={cx("hidden [grid-area:crown] @lg:block", place === 1 ? "-mb-1 h-5" : "h-3")}>
                      {place === 1 && (
                        <motion.span className="block" initial={preview ? false : { y: -10, opacity: 0, rotate: -12 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.35 }}>
                          <Crown className="h-5 w-[30px] text-[#FBBF24] drop-shadow-[0_2px_6px_rgb(251_191_36/0.5)]" />
                        </motion.span>
                      )}
                    </span>
                    {avatar(r, cx("[grid-area:av] size-[46px] text-[16px] bg-[hsl(var(--h)_62%_86%)] text-[hsl(var(--h)_55%_22%)]",
                      place === 1 ? "@lg:size-16 @lg:text-[23px] @3xl:size-[78px] @3xl:text-[28px] shadow-[0_0_0_3px_var(--pod),0_0_0_6px_var(--m),0_0_34px_-2px_rgb(251_191_36/0.55)]"
                        : "@lg:size-[52px] @lg:text-[19px] @3xl:size-16 @3xl:text-[23px] shadow-[0_0_0_3px_var(--pod),0_0_0_5px_var(--m),0_10px_26px_-8px_rgb(0_0_0/0.6)]"), undefined,
                      <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-[var(--m)] font-display text-[12px] font-bold text-[#2A1406] shadow-[0_0_0_2px_var(--pod)]">{place}</span>)}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                        className="min-w-0 max-w-full truncate font-display text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] [grid-area:name] @lg:mt-2">{r.name}</motion.span>
                    </AnimatePresence>
                    <span className="min-w-0 max-w-full truncate text-[12px] text-[#CBBEF0] [grid-area:role]">{r.role}</span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={`${r.id}-${metric}-${period}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
                        className={cx("justify-self-end font-display font-bold leading-none tracking-[-0.03em] tabular [grid-area:val] @lg:mt-1 @lg:justify-self-center",
                          place === 1 ? "text-[20px] text-[#FBBF24] [text-shadow:0_0_22px_rgb(251_191_36/0.35)] @lg:text-[clamp(26px,4.4cqi,36px)]" : "text-[20px] @lg:text-[clamp(22px,3.6cqi,30px)]")}>
                        {fmt(metric, r.value)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="justify-self-end [grid-area:chg] @lg:justify-self-center">{chg(r, true)}</span>
                  </button>
                  <motion.div key={`${metric}-${period}`} aria-hidden initial={preview ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 160, damping: 20, delay: place === 1 ? 0.12 : place === 2 ? 0.04 : 0.2 }}
                    className={cx("hidden w-full origin-bottom place-items-start justify-center rounded-t-xl pt-2.5 font-display text-[26px] font-bold leading-none @lg:grid", stepH[place],
                      place === 1 ? "bg-[linear-gradient(180deg,rgb(251_191_36/0.28),rgb(251_191_36/0.06))] text-[rgb(251_191_36/0.55)] shadow-[inset_0_1px_0_rgb(251_191_36/0.5)]"
                        : "bg-[linear-gradient(180deg,rgb(255_255_255/0.12),rgb(255_255_255/0.07))] text-white/[0.22] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]")}>
                    {place}
                  </motion.div>
                </div>
              );
            })}
          </section>
        )}
        <div id={podDetailId}>
          <AnimatePresence initial={false}>
            {openTop && (
              <Expand key={openTop.id}><Detail r={openTop} metric={metric} info={info} fmt={fmt} /></Expand>
            )}
          </AnimatePresence>
        </div>

        {/* ranked list */}
        {rest.length > 0 && (
          <div aria-hidden className="hidden grid-cols-[34px_52px_minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_22px] items-center gap-x-3 px-3.5 font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.08em] text-ink-3 @3xl:grid">
            <span>#</span><span /><span>Member</span>
            {METRICS.map(k => <span key={k} className={cx("text-right transition-colors", k === metric && "text-[var(--pur)]")}>{SHORT[k]}</span>)}
            <span />
          </div>
        )}
        {rows.length === 0 ? (
          <p className="m-0 p-[26px] text-center text-[13px] text-ink-3">No team members to show.</p>
        ) : rest.length > 0 && (
          <ol start={4} className="-mt-1 m-0 grid list-none gap-1.5 p-0 @3xl:-mt-2">
            {rest.map(r => {
              const isOpen = openId === r.id;
              return (
                <motion.li key={r.id} layout={preview ? false : "position"} transition={{ type: "spring", stiffness: 340, damping: 34 }} className="grid gap-1.5">
                  <button type="button" aria-expanded={isOpen} aria-controls={`${uid}-d-${r.id}`} onClick={() => toggle(r)}
                    className={cx("grid w-full items-center gap-x-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-[var(--pur)] @lg:px-3.5",
                      "grid-cols-[22px_minmax(0,1fr)_minmax(0,auto)_16px] @lg:grid-cols-[30px_50px_minmax(0,1fr)_minmax(0,auto)_18px] @3xl:grid-cols-[34px_52px_minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_22px] @3xl:gap-x-3",
                      isOpen ? "border-[var(--pur)] bg-[var(--raise)] shadow-[0_0_0_3px_var(--pur-soft)]" : "border-[var(--hair)] hover:border-[color-mix(in_oklab,var(--pur)_25%,var(--hair))] hover:bg-[var(--raise)]")}>
                    <span className="font-display text-[17px] font-bold leading-none text-ink-3 tabular">{r.rank}</span>
                    <span className="hidden @lg:block">{chg(r)}</span>
                    <span className="flex min-w-0 items-center gap-[11px]">
                      {avatar(r, "size-[34px] text-[12px] @lg:size-10 @lg:text-[14px] bg-[hsl(var(--h)_var(--av-sat)_var(--av-bg))] text-[hsl(var(--h)_55%_var(--av-fg))]")}
                      <span className="grid min-w-0 gap-[3px]">
                        <span className="truncate font-display text-[14.5px] font-semibold leading-[1.2]">{r.name}</span>
                        <span className="truncate text-[12px] text-ink-3">{r.role}</span>
                      </span>
                    </span>
                    {METRICS.map(k => {
                      const v = r.cur(k), on = k === metric;
                      const p = v == null || !best[k] ? 0 : k === "response" ? best[k]! / v : v / best[k]!;
                      return (
                        <span key={k} className={cx("justify-items-end gap-[5px] tabular", on ? "grid min-w-0 @lg:min-w-[86px] @3xl:min-w-0" : "hidden @3xl:grid")}>
                          <span className={cx("leading-none", on ? "font-display text-[15px] font-bold text-ink" : "text-[14px] font-medium text-ink-2")}>
                            <span className="sr-only">{LABEL[k]}: </span>{fmt(k, v)}
                          </span>
                          <span aria-hidden className={cx("h-1 w-full max-w-[86px] overflow-hidden rounded-full bg-[var(--tint)]", !on && "invisible")}>
                            <motion.span className="block h-full rounded-full bg-[var(--pur)]" initial={preview ? false : { width: 0 }}
                              animate={{ width: `${Math.max(2, Math.min(100, p * 100))}%` }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }} />
                          </span>
                        </span>
                      );
                    })}
                    <Icon name="chevronDown" className={cx("size-4 justify-self-end transition-[transform,color] duration-300", isOpen ? "rotate-180 text-[var(--pur)]" : "text-ink-3")} strokeWidth={1.7} />
                  </button>
                  <div id={`${uid}-d-${r.id}`}>
                    <AnimatePresence initial={false}>
                      {isOpen && <Expand key="d"><Detail r={r} metric={metric} info={info} fmt={fmt} /></Expand>}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </LayoutGroup>

      <p className="m-0 flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-dashed border-[var(--hair)] pt-3 text-[12px] text-ink-3">
        <span>{metric === "response" ? "Response time is the average first reply to a new lead, in minutes. Lower is better." : data.footnote || ""}</span>
        <span>{info.compare ? `▲▼ Rank change vs ${info.compare}` : ""}</span>
      </p>
      <p className="sr-only" aria-live="polite">{live}</p>
    </article>
  );
}

function Expand({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.36, ease: [0.2, 0.7, 0.2, 1] }} className="overflow-hidden">
      {children}
    </motion.div>
  );
}

/* ---------------- detail: trend + targets ---------------- */
function Detail({ r, metric, info, fmt }: { r: RankedMember; metric: TeamMetric; info: Required<PeriodInfo>; fmt: (k: TeamMetric, v: number | null) => string }) {
  const preview = usePreviewMode();
  const [hover, setHover] = useState<number | null>(null);
  const series = r.series[metric].filter((v): v is number => v != null);
  const goal = num(r.target[metric]);
  const diff = r.value != null && r.prevValue != null ? r.value - r.prevValue : null;
  const W = 240, H = 70, pad = 6, CH = 86;
  const lo = Math.min(...series, goal ?? Infinity), hi = Math.max(...series, goal ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / Math.max(1, series.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const names = info.axis.length === series.length ? info.axis : series.map((_, i) => String(i + 1));

  return (
    <div className="mt-0.5 grid gap-x-[26px] gap-y-[18px] rounded-[14px] border border-[var(--hair)] bg-[var(--raise)] p-3.5 shadow-[0_18px_36px_-30px_var(--shade)] @lg:px-5 @lg:py-[18px] @3xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="m-0 mb-2.5 flex flex-wrap justify-between gap-2.5 font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-ink-3">
          <span>{LABEL[metric]} trend</span>
          {diff != null && <b className="font-semibold tracking-[0.04em] text-ink">{diff > 0 ? "+" : diff < 0 ? "−" : "±"}{fmt(metric, Math.abs(diff))} vs {info.compare}</b>}
        </p>
        {series.length > 1 && (
          <>
            <div className="relative" onPointerLeave={() => setHover(null)}>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="block h-[86px] w-full overflow-visible">
                <motion.path d={`M0,${H} L${pts.join(" L")} L${W},${H} Z`} className="fill-[var(--pur-soft)]" initial={preview ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
                {goal != null && <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} className="stroke-[var(--gold)]" strokeWidth={1.2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
                <motion.polyline points={pts.join(" ")} fill="none" className="stroke-[var(--pur)]" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  initial={preview ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} />
              </svg>
              {series.map((v, i) => {
                const last = i === series.length - 1;
                return (
                  <span key={i} onPointerEnter={() => setHover(i)} aria-hidden
                    className="absolute -ml-3 -mt-3 grid size-6 place-items-center"
                    style={{ left: `${((x(i) / W) * 100).toFixed(2)}%`, top: `${((y(v) / H) * CH).toFixed(1)}px` }}>
                    <span className={cx("box-border size-2 rounded-full border-[1.6px] transition-transform duration-150", last ? "border-[var(--gold)] bg-[var(--gold)] shadow-[0_0_0_3px_var(--gold-soft)]" : "border-[var(--pur)] bg-[var(--raise)]", hover === i && "scale-150")} />
                    {hover === i && (
                      <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className={cx("pointer-events-none absolute bottom-[calc(100%+2px)] z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-canvas shadow-lg tabular", i === 0 ? "left-0" : last ? "right-0" : "left-1/2 -translate-x-1/2")}>
                        {names[i]} · {fmt(metric, v)}
                      </motion.span>
                    )}
                  </span>
                );
              })}
            </div>
            <div aria-hidden className="mt-1.5 flex justify-between font-mono text-[10.5px] font-medium leading-none text-ink-3">
              {names.map((nm, i) => <span key={i} className={cx(i === names.length - 1 && "font-semibold text-ink")}>{nm}</span>)}
            </div>
            <p className="m-0 mt-2 flex flex-wrap gap-3.5 text-[12px] text-ink-2">
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="w-3.5 border-t-2 border-[var(--pur)]" />{LABEL[metric]}</span>
              {goal != null && <span className="inline-flex items-center gap-1.5"><i aria-hidden className="w-3.5 border-t-2 border-dashed border-[var(--gold)]" />Target {metric === "response" ? `≤ ${fmt(metric, goal)}` : fmt(metric, goal)}</span>}
            </p>
            <p className="sr-only">{`${LABEL[metric]} trend: ${series.map((v, i) => `${names[i]} ${fmt(metric, v)}`).join(", ")}.`}</p>
          </>
        )}
      </div>
      <div className="grid content-start gap-3">
        <p className="m-0 flex flex-wrap justify-between gap-2.5 font-mono text-[10.5px] font-medium uppercase leading-[1.2] tracking-[0.1em] text-ink-3">
          <span>Target progress</span><b className="font-semibold tracking-[0.04em] text-ink">{info.label}</b>
        </p>
        {METRICS.map((k, idx) => {
          const v = r.cur(k), g = num(r.target[k]);
          if (g == null || v == null) return null;
          const low = k === "response";
          const p = low ? (v <= 0 ? 1 : Math.min(1, g / v)) : Math.min(1, v / g);
          const met = low ? v <= g : v >= g;
          return (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-1.5 text-[13px]">
              <span className={cx(k === metric ? "font-semibold text-ink" : "text-ink-2")}>{LABEL[k]}{met && <span className="ml-1.5 text-[11px] font-semibold text-[var(--gold)]">✓ met</span>}</span>
              <span className="text-[12.5px] text-ink-2 tabular"><b className="font-semibold text-ink">{fmt(k, v)}</b> / {low ? `≤ ${fmt(k, g)}` : fmt(k, g)}{!low && ` · ${Math.round((v / g) * 100)}%`}</span>
              <span aria-hidden className="relative col-span-2 h-[7px] overflow-hidden rounded-full bg-[var(--tint)]">
                <motion.span initial={preview ? false : { width: 0 }} animate={{ width: `${(p * 100).toFixed(1)}%` }} transition={{ duration: 0.6, delay: 0.05 * idx, ease: [0.2, 0.7, 0.2, 1] }}
                  className={cx("absolute inset-y-0 left-0 rounded-full", met ? "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--gold)_70%,transparent),var(--gold))]" : "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--pur)_70%,transparent),var(--pur))]")} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
