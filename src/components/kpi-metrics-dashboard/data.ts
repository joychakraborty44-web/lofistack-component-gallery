/* Types + demo data for the KPI Metrics Dashboard. */

export type KpiFormat = "int" | "currency" | "currency2" | "percent";

export interface KpiPeriod {
  id: string;
  label: string;
  /** Number of days the period covers. */
  days: number;
  /** Days per sparkline point (1 = daily). */
  bucket: number;
}

export interface KpiMetric {
  id: string;
  label: string;
  format: KpiFormat;
  /** Per period id, the value of each sparkline point. The tile value is their sum. */
  series?: Record<string, number[]>;
  /** Per period id, the total for the period before (drives the change badge). */
  previous?: Record<string, number>;
  /** Derived metric: `of ÷ per`, worked out for every point and for the total. */
  ratio?: { of: string; per: string };
  /** Whether a rise is good ("up", default) or bad ("down"). */
  better?: "up" | "down";
  /** Keep out of the grid (e.g. only used by a ratio). */
  hidden?: boolean;
}

export interface KpiData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Last day of the data, YYYY-MM-DD. */
  end: string;
  currency?: string;
  locale?: string;
  periods: KpiPeriod[];
  metrics: KpiMetric[];
  source?: string;
}

export const demoData: KpiData = {
  eyebrow: "Performance",
  title: "Growth dashboard",
  subtitle: "Brightside Dental · all channels",
  end: "2026-09-30",
  currency: "USD",
  periods: [
    { id: "7d", label: "7D", days: 7, bucket: 1 },
    { id: "30d", label: "30D", days: 30, bucket: 1 },
    { id: "90d", label: "90D", days: 90, bucket: 6 },
  ],
  metrics: [
    {
      id: "revenue", label: "Revenue", format: "currency",
      series: {
        "7d": [3940, 5280, 4030, 3660, 4230, 5120, 7050],
        "30d": [3790, 3660, 3880, 5560, 2840, 3820, 5260, 3690, 3600, 6140, 7020, 3690, 3870, 5450, 3850, 5410, 4190, 5730, 3640, 4230, 5320, 3860, 4790, 3940, 5280, 4030, 3660, 4230, 5120, 7050],
        "90d": [22980, 22530, 22870, 21600, 23600, 22580, 27320, 23400, 26650, 26150, 23550, 29400, 28500, 25780, 29370],
      },
      previous: { "7d": 31760, "30d": 126100, "90d": 293820 },
    },
    {
      id: "sessions", label: "Sessions", format: "int",
      series: {
        "7d": [726, 691, 535, 525, 752, 742, 701],
        "30d": [644, 670, 665, 703, 451, 463, 708, 660, 636, 748, 735, 507, 471, 686, 637, 753, 708, 682, 516, 558, 706, 665, 660, 726, 691, 535, 525, 752, 742, 701],
        "90d": [3546, 3515, 3647, 3552, 3896, 3710, 3888, 3754, 3709, 3814, 3596, 3994, 3937, 3831, 3946],
      },
      previous: { "7d": 4495, "30d": 18875, "90d": 49186 },
    },
    {
      id: "leads", label: "Leads", format: "int",
      series: {
        "7d": [27, 25, 18, 19, 27, 28, 29],
        "30d": [26, 24, 21, 26, 16, 18, 23, 23, 22, 30, 31, 20, 18, 27, 20, 27, 24, 25, 21, 22, 27, 21, 27, 27, 25, 18, 19, 27, 28, 29],
        "90d": [123, 119, 116, 122, 137, 126, 142, 124, 138, 141, 131, 149, 141, 145, 146],
      },
      previous: { "7d": 167, "30d": 671, "90d": 1588 },
    },
    {
      id: "booked", label: "Booked calls", format: "int",
      series: {
        "7d": [11, 12, 8, 8, 11, 13, 13],
        "30d": [11, 11, 9, 12, 7, 8, 10, 10, 10, 13, 14, 9, 8, 11, 10, 13, 10, 10, 9, 10, 11, 10, 11, 11, 12, 8, 8, 11, 13, 13],
        "90d": [56, 51, 51, 56, 60, 56, 62, 54, 60, 62, 58, 66, 62, 62, 65],
      },
      previous: { "7d": 71, "30d": 294, "90d": 701 },
    },
    { id: "cpl", label: "Cost per lead", format: "currency2", better: "down", ratio: { of: "spend", per: "leads" } },
    { id: "close", label: "Close rate", format: "percent", ratio: { of: "won", per: "booked" } },
    {
      id: "spend", label: "Ad spend", format: "currency", hidden: true,
      series: {
        "7d": [604, 710, 632, 675, 633, 650, 638],
        "30d": [684, 659, 624, 631, 695, 709, 674, 692, 701, 588, 614, 638, 713, 666, 637, 662, 617, 628, 671, 604, 635, 669, 722, 604, 710, 632, 675, 633, 650, 638],
        "90d": [3661, 3850, 3716, 3916, 3746, 3947, 3978, 3943, 3879, 3945, 4002, 3907, 3923, 3905, 3938],
      },
      previous: { "7d": 4546, "30d": 19692, "90d": 55436 },
    },
    {
      id: "won", label: "Deals won", format: "int", hidden: true,
      series: {
        "7d": [3, 4, 3, 3, 3, 4, 5],
        "30d": [3, 3, 3, 4, 2, 3, 4, 3, 3, 5, 5, 3, 3, 4, 3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 4, 3, 3, 3, 4, 5],
        "90d": [18, 18, 17, 17, 18, 18, 21, 18, 20, 19, 18, 23, 21, 20, 22],
      },
      previous: { "7d": 24, "30d": 96, "90d": 227 },
    },
  ],
  source: "Source: CRM, ad accounts and website analytics",
};
