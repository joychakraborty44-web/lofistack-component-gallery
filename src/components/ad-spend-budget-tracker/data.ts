/* Types, pacing maths and demo data for the Ad Spend Budget Tracker. */

export type ChannelIcon = "search" | "social" | "video" | "display" | "dot";
export type PaceStatus = "ok" | "over" | "under";
export type BudgetView = "spent" | "projected";
export type BudgetSort = "default" | "used";

export interface BudgetChannel { id: string; label: string; icon?: ChannelIcon; budget: number; spent: number }

export interface BudgetData {
  eyebrow?: string;
  title?: string;
  /** YYYY-MM — sets the number of days in the month. */
  month?: string;
  /** YYYY-MM-DD — the day spend is counted to (default: today). */
  asOf?: string;
  currency?: string;
  locale?: string;
  /** Fractions of budget; projected spend outside this band is flagged (default 0.05 / 0.15). */
  tolerance?: { over?: number; under?: number };
  channels: BudgetChannel[];
  source?: string;
}

export interface BudgetChangeDetail { id: string; label: string; budget: number; previous: number; spent: number; projected: number; status: PaceStatus }

export const demoData: BudgetData = {
  eyebrow: "Ad spend pacing",
  title: "Brightside Dental · paid media",
  month: "2026-09",
  asOf: "2026-09-18",
  currency: "USD",
  tolerance: { over: 0.05, under: 0.15 },
  channels: [
    { id: "search", label: "Search Ads", icon: "search", budget: 12000, spent: 7480 },
    { id: "social", label: "Social Ads", icon: "social", budget: 8000, spent: 5620 },
    { id: "video", label: "Video Ads", icon: "video", budget: 5000, spent: 2140 },
    { id: "display", label: "Display", icon: "display", budget: 3000, spent: 1770 },
  ],
  source: "Spend synced from ad accounts · 18 Sep, 09:00",
};

/* ---------- maths ---------- */
export interface Calendar { y: number; m: number; n: number; day: number; frac: number }

export function calendar(d: BudgetData): Calendar {
  const today = new Date();
  let y = today.getFullYear(), m = today.getMonth() + 1, day = today.getDate();
  const mm = /^(\d{4})-(\d{2})/.exec(String(d.month ?? ""));
  const aa = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d.asOf ?? ""));
  if (aa) { y = +aa[1]; m = +aa[2]; day = +aa[3]; }
  let n = new Date(y, m, 0).getDate();
  if (mm && (+mm[1] !== y || +mm[2] !== m)) {
    // the "as of" day sits outside the month: the month is either complete or not started
    const after = y * 12 + m > +mm[1] * 12 + +mm[2];
    y = +mm[1]; m = +mm[2]; n = new Date(y, m, 0).getDate();
    day = after ? n : 0;
  }
  day = Math.min(n, Math.max(0, day));
  return { y, m, n, day, frac: n ? day / n : 0 };
}

export interface PaceMetrics {
  budget: number; daily: number; projected: number; usedRatio: number; projRatio: number;
  status: PaceStatus; paceDiff: number; leftDays: number; need: number; runOutDay: number | null;
}

export function tol(d: BudgetData) {
  return { over: d.tolerance?.over ?? 0.05, under: d.tolerance?.under ?? 0.15 };
}
export const statusOf = (ratio: number, t: { over: number; under: number }): PaceStatus =>
  ratio > 1 + t.over ? "over" : ratio < 1 - t.under ? "under" : "ok";

export function paceMetrics(ch: BudgetChannel, cal: Calendar, t: { over: number; under: number }): PaceMetrics {
  const budget = ch.budget > 0 ? ch.budget : 0;
  const daily = cal.day > 0 ? ch.spent / cal.day : 0;
  const projected = cal.day > 0 ? daily * cal.n : ch.spent;
  const usedRatio = budget > 0 ? ch.spent / budget : 0;
  const projRatio = budget > 0 ? projected / budget : 0;
  const leftDays = cal.n - cal.day;
  return {
    budget, daily, projected, usedRatio, projRatio,
    status: statusOf(projRatio, t),
    paceDiff: (usedRatio - cal.frac) * 100,
    leftDays,
    need: leftDays > 0 ? Math.max(0, budget - ch.spent) / leftDays : 0,
    runOutDay: daily > 0 ? Math.ceil(budget / daily) : null,
  };
}
