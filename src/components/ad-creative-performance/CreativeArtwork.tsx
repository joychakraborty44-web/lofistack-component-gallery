import { memo, type ReactNode } from "react";
import type { Creative } from "./data";

/* Abstract stand-in artwork, drawn on a 200 × 150 canvas.
   Deterministic per creative (seeded from id + pattern), so it never changes between renders. */

function seededFrom(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = "fill-[var(--a-paper)]";
const I = "fill-[var(--a-ink)]";
const L = "fill-[var(--lime)]";
const IS = "fill-none stroke-[var(--a-ink)]";
const LS = "fill-none stroke-[var(--lime)]";

function draw(c: Creative): ReactNode[] {
  const art = c.art ?? { pattern: "blocks" as const };
  const r = seededFrom(c.id + (art.pattern || ""));
  const out: ReactNode[] = [];
  switch (art.pattern) {
    case "sun": {
      const cx = 60 + r() * 80;
      out.push(<circle key="s" cx={cx} cy={84} r={38} className={L} />, <rect key="g" x={0} y={84} width={200} height={70} className={P} />);
      for (let i = 0; i < 7; i++) out.push(<rect key={`b${i}`} x={0} y={88 + i * 9} width={200} height={3.5 + i * 0.5} className={I} />);
      break;
    }
    case "stripes": {
      const off = r() * 20;
      for (let i = -6; i < 14; i++) out.push(<rect key={`s${i}`} x={i * 24 + off} y={-60} width={10} height={280} className={I} transform="rotate(28 100 75)" />);
      out.push(<circle key="c" cx={150} cy={46} r={30} className={L} />, <circle key="o" cx={150} cy={46} r={30} className={IS} strokeWidth={4} />);
      break;
    }
    case "dots": {
      const lx = Math.floor(r() * 9) + 1, ly = Math.floor(r() * 6) + 1;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 11; x++) {
        const t = (x / 10 + y / 7) / 2;
        const hit = x === lx && y === ly;
        out.push(<circle key={`${x}-${y}`} cx={10 + x * 18} cy={12 + y * 18} r={+(hit ? 9 : 1.2 + t * 6.4).toFixed(2)} className={hit ? L : I} />);
      }
      break;
    }
    case "arch": {
      const cx = 70 + r() * 60;
      [128, 106, 84, 62].forEach(rad => out.push(<circle key={rad} cx={cx} cy={160} r={rad} className={IS} strokeWidth={7} />));
      out.push(<circle key="c" cx={cx} cy={160} r={40} className={L} />);
      break;
    }
    case "wave": {
      const ph = r() * 6;
      for (let i = 0; i < 8; i++) {
        let d = "";
        for (let x = -10; x <= 210; x += 10) d += `${x === -10 ? "M" : "L"}${x} ${(22 + i * 16 + Math.sin(x / 26 + ph + i * 0.5) * 9).toFixed(1)} `;
        out.push(<path key={i} d={d} className={i === 4 ? LS : IS} strokeWidth={i === 4 ? 6 : 3} strokeLinecap="round" />);
      }
      break;
    }
    case "type": {
      out.push(
        <text key="t" x={12} y={108} fontSize={82} className={`${I} font-condensed`} fontWeight={700} letterSpacing={-2}>{String(art.text || "NEW").slice(0, 6)}</text>,
        <rect key="u" x={14} y={120} width={60 + r() * 50} height={9} className={L} />,
        <circle key="d" cx={178} cy={24} r={8} className={L} />,
      );
      break;
    }
    case "blocks":
    default: {
      const w = 80 + r() * 30, h = 60 + r() * 20;
      out.push(
        <rect key="a" x={0} y={0} width={w} height={h} className={I} />,
        <rect key="b" x={w + 8} y={h + 8} width={200 - w - 8} height={150 - h - 8} className={L} />,
        <rect key="c" x={12} y={h + 20} width={w - 24} height={150 - h - 34} className={IS} strokeWidth={4} />,
        <rect key="d" x={w + 22} y={14} width={200 - w - 36} height={h - 28} className={IS} strokeWidth={4} />,
        <rect key="e" x={w} y={0} width={8} height={150} className={I} />,
        <rect key="f" x={0} y={h} width={200} height={8} className={I} />,
      );
    }
  }
  return out;
}

/** Fills its (positioned) parent. */
export const CreativeArtwork = memo(function CreativeArtwork({ creative, className }: { creative: Creative; className?: string }) {
  const inv = !!creative.art?.invert;
  return (
    <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false"
      className={`absolute inset-0 block size-full ${inv ? "[--a-paper:var(--art-ink)] [--a-ink:var(--art-paper)]" : "[--a-paper:var(--art-paper)] [--a-ink:var(--art-ink)]"} ${className ?? ""}`}>
      <rect x={0} y={0} width={200} height={150} className={P} />
      <g>{draw(creative)}</g>
    </svg>
  );
});
