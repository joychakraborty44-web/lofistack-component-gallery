import type { SeoFilter, SeoRankingData, SeoSort, SeoSortKey } from "./data";

/* Pure helpers: normalise keywords into rows with derived fields, filter and sort them. */

export interface RankRow {
  id: number;
  /** Stable React key (keyword + index). */
  key: string;
  keyword: string;
  url: string;
  intent: string;
  volume: number;
  history: (number | null)[];
  /** This week's position (null = not ranking). */
  pos: number | null;
  /** Last week's position. */
  prev: number | null;
  /** Positions gained since last week (positive = better). */
  change: number | null;
  best: number | null;
  isNew: boolean;
  isLost: boolean;
  chgSort: number;
  /** Positions gained across the whole history (first ranked value → now). */
  trend: number;
  min: number | null;
  max: number | null;
}

export const FILTERS: SeoFilter[] = ["all", "top3", "top10", "improved", "declined"];

/** Default direction when a column is first sorted. */
export const SORT_DEFAULT_DIR: Record<SeoSortKey, "asc" | "desc"> = { keyword: "asc", position: "asc", change: "desc", best: "asc", volume: "desc" };

export const SORT_OPTIONS: [string, string][] = [
  ["position:asc", "Position · best first"], ["position:desc", "Position · worst first"],
  ["change:desc", "Change · biggest gain"], ["change:asc", "Change · biggest drop"],
  ["volume:desc", "Volume · highest"], ["best:asc", "Best position"], ["keyword:asc", "Keyword · A–Z"],
];

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function buildRows(data: SeoRankingData): RankRow[] {
  const list = Array.isArray(data.keywords) ? data.keywords : [];
  return list.map((k, i) => {
    const history = (Array.isArray(k.history) ? k.history : []).map(v => { const n = num(v); return n != null && n >= 1 ? Math.round(n) : null; });
    const len = history.length;
    const pos = len ? history[len - 1] : null;
    const prev = len > 1 ? history[len - 2] : null;
    const ranked = history.filter((v): v is number => v != null);
    let best = num(k.best);
    if (ranked.length) best = best == null ? Math.min(...ranked) : Math.min(best, ...ranked);
    const isNew = pos != null && prev == null && len > 1;
    const isLost = pos == null && prev != null;
    const change = pos != null && prev != null ? prev - pos : null;
    const first = ranked.length ? (history.find(v => v != null) ?? null) : null;
    const keyword = String(k.keyword || `Keyword ${i + 1}`);
    return {
      id: i, key: `${keyword}-${i}`, keyword, url: String(k.url || ""), intent: k.intent ? String(k.intent) : "",
      volume: Math.max(0, num(k.volume) ?? 0), history, pos, prev, change, best, isNew, isLost,
      chgSort: isNew ? 0.5 : isLost ? -1000 : change ?? 0,
      trend: first != null && pos != null ? first - pos : 0,
      min: ranked.length ? Math.min(...ranked) : null, max: ranked.length ? Math.max(...ranked) : null,
    };
  });
}

export function matches(r: RankRow, f: SeoFilter): boolean {
  if (f === "top3") return r.pos != null && r.pos <= 3;
  if (f === "top10") return r.pos != null && r.pos <= 10;
  if (f === "improved") return (r.change != null && r.change > 0) || r.isNew;
  if (f === "declined") return (r.change != null && r.change < 0) || r.isLost;
  return true;
}

export function visibleRows(rows: RankRow[], filter: SeoFilter, sort: SeoSort, query: string): RankRow[] {
  const q = query.trim().toLowerCase();
  const val = (r: RankRow): number | string => sort.key === "keyword" ? r.keyword.toLowerCase() : sort.key === "position" ? r.pos ?? 999
    : sort.key === "change" ? r.chgSort : sort.key === "best" ? r.best ?? 999 : r.volume;
  return rows
    .filter(r => matches(r, filter) && (!q || r.keyword.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)))
    .sort((a, b) => {
      const va = val(a), vb = val(b);
      let c = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
      if (sort.dir === "desc") c = -c;
      return c || (a.pos ?? 999) - (b.pos ?? 999) || a.keyword.localeCompare(b.keyword);
    });
}

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
