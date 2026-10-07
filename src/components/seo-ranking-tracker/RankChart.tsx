import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { cx } from "../../ui";
import { usePreviewMode } from "../../lib/hooks";
import type { SeoLabels } from "./data";
import type { RankRow } from "./model";

/* Eight-week rank history for one keyword. Rank 1 sits at the top.
   Hover / touch to inspect a week; when focused, ← → Home End step through weeks. */

export function RankChart({ r, weeks, L, announce }: { r: RankRow; weeks: string[]; L: SeoLabels; announce: (msg: string) => void }) {
  const preview = usePreviewMode();
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, "") + "clip";
  const plotRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const pts = r.history, n = pts.length;
  const wk = (i: number) => (weeks[i] != null ? String(weeks[i]) : `W${i + 1}`);

  const vals = pts.filter((v): v is number => v != null);
  if (r.best != null) vals.push(r.best);
  const lo = vals.length ? Math.max(1, Math.min(...vals) - 1) : 1;
  let hi = vals.length ? Math.max(...vals) + 1 : 10;
  if (hi - lo < 4) hi = lo + 4;
  const xp = (i: number) => (n > 1 ? 3 + (i * 94) / (n - 1) : 50);
  const yp = (v: number) => 6 + ((v - lo) / (hi - lo)) * 88;
  const range = hi - lo, step = range <= 6 ? 1 : range <= 12 ? 2 : range <= 30 ? 5 : 10;
  const ticks: number[] = [];
  if (lo === 1) ticks.push(1);
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) if (!ticks.includes(t) && t >= lo) ticks.push(t);
  const bestY = r.best != null ? yp(r.best) : null;
  const bandBottom = lo <= 10 ? yp(Math.min(10.5, hi)) : null;

  // contiguous segments (gaps where the keyword was not ranking)
  const segs: number[][] = [];
  let cur: number[] = [];
  pts.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(i); });
  if (cur.length) segs.push(cur);
  const lineD = (seg: number[]) => seg.map((i, k) => `${k ? "L" : "M"}${xp(i)} ${yp(pts[i] as number)}`).join(" ");

  const tipFor = (i: number) => {
    const v = pts[i], p = i > 0 ? pts[i - 1] : null;
    let line = "";
    if (v != null && p != null) { const c = p - v; line = c === 0 ? L.same : `${c > 0 ? "▲" : "▼"} ${Math.abs(c)} ${L.vsPrev}`; }
    return { v, line };
  };
  const show = (i: number) => {
    setActive(i);
    if (i < 0) return;
    const { v, line } = tipFor(i);
    announce(`${wk(i)}: ${v == null ? L.notRankingLong : `${L.position1} ${v}`}${line ? `, ${line}` : ""}`);
  };
  const onMove = (e: PointerEvent) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || !n) return;
    const rel = ((e.clientX - box.left) / box.width) * 100;
    let best = 0, bd = Infinity;
    pts.forEach((_, i) => { const d = Math.abs(xp(i) - rel); if (d < bd) { bd = d; best = i; } });
    if (best !== active) show(best);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!n) return;
    let i = active < 0 ? n - 1 : active;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else return;
    e.preventDefault();
    show(i);
  };

  const tip = active >= 0 ? tipFor(active) : null;
  const tipBelow = tip?.v != null && yp(tip.v) < 45;
  const lab = "pointer-events-none absolute whitespace-nowrap font-mono text-[10.5px] font-medium leading-none text-ink-3";

  return (
    <div ref={chartRef} tabIndex={0} role="group" aria-label={`${L.history}: ${r.keyword}. ${L.chartHint}`}
      onFocus={() => show(active >= 0 ? active : n - 1)} onBlur={() => setActive(-1)} onKeyDown={onKey}
      className="relative min-w-0 rounded-xl border border-line bg-surface pb-8 pl-11 pr-4 pt-3.5 outline-none elev-1 focus-visible:ring-2 focus-visible:ring-[var(--srt)] @max-xl:pl-9 @max-xl:pr-3">
      <p aria-hidden className="m-0 mb-3 -ml-7 flex flex-wrap justify-between gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 @max-xl:-ml-5">
        <span>{L.history}</span><span>{wk(0)} – {wk(n - 1)}</span>
      </p>
      <div ref={plotRef} aria-hidden onPointerMove={onMove} onPointerDown={onMove}
        onPointerLeave={() => { if (document.activeElement !== chartRef.current) setActive(-1); }}
        className="relative h-[164px] cursor-crosshair touch-pan-y @max-xl:h-[140px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <motion.rect x={-2} y={-10} height={120} initial={preview ? false : { width: 0 }} animate={{ width: 104 }} transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: 0.1 }} />
            </clipPath>
          </defs>
          {bandBottom != null && <rect x={0} y={0} width={100} height={bandBottom} className="fill-[color-mix(in_oklab,var(--srt)_7%,transparent)]" />}
          {ticks.map(t => <line key={t} x1={0} x2={100} y1={yp(t)} y2={yp(t)} vectorEffect="non-scaling-stroke" className="stroke-line" strokeWidth={1} />)}
          {bestY != null && <line x1={0} x2={100} y1={bestY} y2={bestY} vectorEffect="non-scaling-stroke" stroke="var(--srt)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />}
          <g clipPath={`url(#${clipId})`}>
            {segs.map(seg => seg.length > 1 && (
              <path key={`a${seg[0]}`} d={`${lineD(seg)} L${xp(seg[seg.length - 1])} 100 L${xp(seg[0])} 100 Z`} fill="var(--srt)" opacity={0.09} />
            ))}
            {segs.map(seg => (
              <path key={`l${seg[0]}`} d={lineD(seg)} fill="none" stroke="var(--srt)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {active >= 0 && <line x1={xp(active)} x2={xp(active)} y1={0} y2={100} vectorEffect="non-scaling-stroke" className="stroke-ink-3" strokeDasharray="2 3" opacity={0.8} />}
        </svg>
        {ticks.map(t => <span key={t} className={cx(lab, "-left-2.5 -translate-x-full -translate-y-1/2")} style={{ top: `${yp(t)}%` }}>#{t}</span>)}
        {bandBottom != null && (bestY == null || bestY > 26) && (
          <span className={cx(lab, "right-0.5 top-0.5 font-semibold tracking-[0.04em] text-[var(--srt)] opacity-90")}>{L.top10}</span>
        )}
        {r.best != null && bestY != null && (
          <span className={cx(lab, "left-1.5 font-semibold tracking-[0.04em] text-[var(--srt)]", bestY < 20 ? "translate-y-[35%]" : "-translate-y-[120%]")} style={{ top: `${bestY}%` }}>
            {L.best} #{r.best}
          </span>
        )}
        {pts.map((_, i) => (
          <span key={`x${i}`} className={cx(lab, "-bottom-5 -translate-x-1/2", n > 6 && (n - 1 - i) % 2 === 1 && "@max-xl:hidden")} style={{ left: `${xp(i)}%` }}>{wk(i)}</span>
        ))}
        {pts.map((v, i) => v != null && (
          <motion.span key={`d${i}`}
            initial={preview ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: active === i ? 1.45 : 1 }}
            transition={{ duration: 0.25, delay: preview || active >= 0 ? 0 : 0.1 + i * 0.09 }}
            className={cx("pointer-events-none absolute -ml-[4.5px] -mt-[4.5px] size-[9px] rounded-full shadow-[inset_0_0_0_2px_var(--srt)]",
              active === i ? "bg-[var(--srt)] ring-4 ring-[color-mix(in_oklab,var(--srt)_18%,transparent)]" : i === n - 1 ? "bg-[var(--srt)]" : "bg-surface")}
            style={{ left: `${xp(i)}%`, top: `${yp(v)}%` }} />
        ))}
        {tip && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
            className={cx("pointer-events-none absolute z-20 min-w-[96px] whitespace-nowrap rounded-lg bg-ink px-2.5 py-2 text-[12px] leading-snug text-canvas shadow-lg",
              tipBelow ? "translate-x-[-50%] translate-y-3.5" : "translate-x-[-50%] translate-y-[calc(-100%-12px)]")}
            style={{ left: `${Math.min(Math.max(xp(active), 12), 88)}%`, top: `${tip.v == null ? 50 : yp(tip.v)}%` }}>
            <small className="block font-mono text-[11px] opacity-75">{wk(active)}</small>
            <b className="block font-mono text-[15px] font-semibold">{tip.v == null ? L.notRanking : `#${tip.v}`}</b>
            {tip.line && <small className="block font-mono text-[11px] opacity-75">{tip.line}</small>}
          </motion.div>
        )}
      </div>
      <table className="sr-only">
        <caption>{L.history}: {r.keyword}</caption>
        <tbody>{pts.map((v, i) => <tr key={i}><th scope="row">{wk(i)}</th><td>{v == null ? L.notRankingLong : `#${v}`}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
