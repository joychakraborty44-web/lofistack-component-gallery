/* Types + demo data for the Revenue Growth Chart. */

export type RevenueRange = "6m" | "12m";

export interface RevenuePoint {
  /** "YYYY-MM", oldest first. */
  month: string;
  revenue: number;
  /** Same month a year earlier (optional — used for growth figures and the dashed line). */
  lastYear?: number | null;
}

export interface RevenueChartData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** ISO currency code (default USD). */
  currency?: string;
  /** Number / date locale (default en-US). */
  locale?: string;
  series: RevenuePoint[];
  /** Footer note. */
  source?: string;
}

export const demoRevenue: RevenueChartData = {
  eyebrow: "Revenue growth",
  title: "Membership revenue · Cedar Fitness Co.",
  subtitle: "Memberships and class packs, by month",
  currency: "USD",
  series: [
    { month: "2025-10", revenue: 31200, lastYear: 24800 },
    { month: "2025-11", revenue: 32850, lastYear: 25900 },
    { month: "2025-12", revenue: 30400, lastYear: 23700 },
    { month: "2026-01", revenue: 36900, lastYear: 29800 },
    { month: "2026-02", revenue: 38200, lastYear: 30500 },
    { month: "2026-03", revenue: 39750, lastYear: 31200 },
    { month: "2026-04", revenue: 41300, lastYear: 32400 },
    { month: "2026-05", revenue: 42100, lastYear: 33100 },
    { month: "2026-06", revenue: 40800, lastYear: 31900 },
    { month: "2026-07", revenue: 44600, lastYear: 34300 },
    { month: "2026-08", revenue: 47900, lastYear: 36200 },
    { month: "2026-09", revenue: 52400, lastYear: 38900 },
  ],
  source: "Source: billing system export",
};
