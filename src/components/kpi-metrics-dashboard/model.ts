/* Pure maths for the KPI dashboard: values, ratios, deltas, dates and sparkline geometry. */
import type { KpiData, KpiMetric, KpiPeriod } from "./data";

export interface KpiCalc {
  points: number[];
  value: number | null;
  previous: number | null;
  parts?: { of: KpiMetric; per: KpiMetric; ofValue: number | null; perValue: number | null };
}

export interface KpiDelta {
  /** Rounded change (percent, or points for percent metrics). */
  r: number;
  text: string;
  tone: "good" | "bad" | "flat";
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export function findMetric(data: KpiData, id: string): KpiMetric | undefined {
  return data.metrics.find(m => m.id === id);
}

export function calcMetric(data: KpiData, m: KpiMetric, pid: string): KpiCalc {
  if (m.ratio) {
    const a = findMetric(data, m.ratio.of), b = findMetric(data, m.ratio.per);
    if (!a || !b || a.ratio || b.ratio) return { points: [], value: null, previous: null };
    const A = calcMetric(data, a, pid), B = calcMetric(data, b, pid);
    const points = A.points
      .map((v, i) => (B.points[i] > 0 ? v / B.points[i] : null))
      .filter((v): v is number => v !== null);
    return {
      points,
      value: A.value !== null && B.value !== null && B.value > 0 ? A.value / B.value : null,
      previous: A.previous !== null && B.previous !== null && B.previous > 0 ? A.previous / B.previous : null,
      parts: { of: a, per: b, ofValue: A.value, perValue: B.value },
    };
  }
  const raw = m.series?.[pid] ?? [];
  const points = raw.map(v => (Number.isFinite(v) ? v : 0));
  const prev = m.previous?.[pid];
  return { points, value: points.length ? sum(points) : null, previous: typeof prev === "number" && Number.isFinite(prev) ? prev : null };
}

export function deltaOf(m: KpiMetric, c: KpiCalc): KpiDelta | null {
  if (c.value === null || c.previous === null) return null;
  const better = m.better === "down" ? -1 : 1;
  if (m.format === "percent") {
    const r = Math.round((c.value - c.previous) * 1000) / 10;
    return { r, text: `${Math.abs(r).toFixed(1)} pts`, tone: r === 0 ? "flat" : r * better > 0 ? "good" : "bad" };
  }
  if (!(c.previous > 0)) return null;
  const r = Math.round((c.value / c.previous - 1) * 1000) / 10;
  return { r, text: `${Math.abs(r).toFixed(1)}%`, tone: r === 0 ? "flat" : r * better > 0 ? "good" : "bad" };
}

export function formatValue(data: KpiData, m: KpiMetric, v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const loc = data.locale ?? "en-US", cur = data.currency ?? "USD";
  try {
    if (m.format === "currency") return new Intl.NumberFormat(loc, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
    if (m.format === "currency2") return new Intl.NumberFormat(loc, { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${cur} ${v.toFixed(m.format === "currency2" ? 2 : 0)}`;
  }
  if (m.format === "percent") return `${(v * 100).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return Math.round(v).toLocaleString(loc);
}

/* ---------- dates ---------- */
export function endDate(data: KpiData): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.end ?? "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date();
}
function dayBefore(end: Date, offset: number) {
  const d = new Date(end);
  d.setDate(d.getDate() - offset);
  return d;
}
export function spanLabel(a: Date, b: Date, locale: string, year = false): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (year) opts.year = "numeric";
  try {
    const f = new Intl.DateTimeFormat(locale, opts);
    return f.formatRange ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
  } catch {
    return `${a.toDateString()} – ${b.toDateString()}`;
  }
}
export function rangeLabel(data: KpiData, p: KpiPeriod): string {
  const end = endDate(data);
  return p.days ? spanLabel(dayBefore(end, p.days - 1), end, data.locale ?? "en-US", true) : "";
}
export function pointLabel(data: KpiData, p: KpiPeriod, i: number, n: number): string {
  const end = endDate(data), loc = data.locale ?? "en-US";
  const bucket = Math.max(1, p.bucket || 1);
  const endOff = (n - 1 - i) * bucket, startOff = endOff + bucket - 1;
  if (bucket === 1) return dayBefore(end, endOff).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" });
  return spanLabel(dayBefore(end, startOff), dayBefore(end, endOff), loc);
}

/* ---------- sparkline geometry (viewBox 0 0 100 40) ---------- */
export const VB_H = 40;
export interface Geometry {
  ys: number[];
  prevAvg: number | null;
  prevY: number | null;
}
export function geometry(m: KpiMetric, c: KpiCalc): Geometry {
  const pts = c.points;
  const prevAvg = c.previous === null ? null : m.ratio ? c.previous : pts.length ? c.previous / pts.length : null;
  const vals = prevAvg !== null ? [...pts, prevAvg] : pts;
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const Y = (v: number) => 36 - ((v - lo) / (hi - lo)) * 32;
  return { ys: pts.map(Y), prevAvg, prevY: prevAvg === null ? null : Y(prevAvg) };
}

export const SAMPLES = 72;
export function resample(ys: number[], n = SAMPLES): number[] {
  if (!ys.length) return new Array(n).fill(36);
  if (ys.length === 1) return new Array(n).fill(ys[0]);
  return Array.from({ length: n }, (_, j) => {
    const t = (j / (n - 1)) * (ys.length - 1), i = Math.floor(t), f = t - i;
    return i >= ys.length - 1 ? ys[ys.length - 1] : ys[i] + (ys[i + 1] - ys[i]) * f;
  });
}
export function paths(ys: number[]): { line: string; area: string } {
  const n = ys.length;
  if (!n) return { line: "", area: "" };
  const pts = n === 1 ? [[0, ys[0]], [100, ys[0]]] : ys.map((y, i) => [(i / (n - 1)) * 100, y]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  return { line, area: `${line} L100 ${VB_H} L0 ${VB_H} Z` };
}
