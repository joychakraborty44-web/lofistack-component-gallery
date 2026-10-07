/* AI Usage Analytics — types, built-in text and the demo data. */

export type UsageMetric = "tokens" | "requests" | "cost";
export const USAGE_METRICS: UsageMetric[] = ["tokens", "requests", "cost"];
export type UsageRange = 14 | 30;

export interface UsageModel {
  id: string;
  label: string;
  /** Blended price per million tokens. */
  pricePerMillion: number;
}

export interface UsageSeries {
  /** One number per day from `start`. */
  tokens?: number[];
  requests?: number[];
}

export interface AiUsageData {
  eyebrow?: string;
  title?: string;
  /** ISO date of the first day in the series. */
  start?: string;
  /** ISO date of the last day in the series. */
  asOf?: string;
  /** ISO date the billing month began. Quota and cost count from here. */
  billingStart?: string;
  /** Monthly token allowance. */
  quota: number;
  /** Optional monthly spend limit for the cost estimate. */
  budget?: number;
  currency?: string;
  locale?: string;
  /** In stack order, bottom first. Up to three. */
  models: UsageModel[];
  series: Record<string, UsageSeries>;
  source?: string;
}

export const USAGE_LABELS = {
  metricGroup: "Measure", rangeGroup: "Date range",
  tokens: "Tokens", requests: "Requests", cost: "Cost",
  range14: "14D", range30: "30D",
  kTotal: "Total · {n} days", kAvg: "Daily average", kPeak: "Peak day",
  weekdayAvg: "weekdays {v}", isolated: "{name} only",
  hint: "Select a model to show it alone",
  chart: "Daily {metric} by model, last {n} days. Use the left and right arrow keys to step through days.",
  total: "Total", day: "Day",
  quota: "Monthly token quota", through: "to {date}", resets: "Resets {date}",
  used: "Used", projected: "Forecast", ofQuota: "of quota", leftLabel: "Left this month", days: "{n} days",
  ofTokens: "of quota",
  costHead: "Cost estimate", mtd: "month to date", projectedCost: "Projected {v}",
  budget: "Budget {v}", under: "Under budget", over: "Over budget",
  byModel: "By model, this month", perM: "{v} per 1M tokens",
  noData: "No usage in this range.",
};
export type UsageLabels = typeof USAGE_LABELS;

export const demoUsage: AiUsageData = {
  eyebrow: "AI usage",
  title: "Workspace usage · Cedar Fitness Co.",
  start: "2026-08-26",
  asOf: "2026-09-24",
  billingStart: "2026-09-01",
  quota: 400000000,
  budget: 300,
  currency: "USD",
  models: [
    { id: "large", label: "Large model", pricePerMillion: 6.0 },
    { id: "fast", label: "Fast model", pricePerMillion: 0.6 },
    { id: "embed", label: "Embeddings", pricePerMillion: 0.1 },
  ],
  series: {
    large: {
      tokens: [1003000, 1126000, 1308000, 697000, 749000, 1169000, 1196000, 1067000, 1388000, 1249000, 653000, 767000, 1432000, 1207000, 1117000, 1337000, 1442000, 610000, 771000, 1265000, 1376000, 1355000, 1156000, 1186000, 828000, 690000, 1522000, 1464000, 1433000, 1384000],
      requests: [932, 909, 825, 478, 503, 857, 854, 856, 821, 846, 505, 518, 903, 907, 915, 871, 1016, 495, 523, 1034, 1045, 1003, 1026, 1061, 580, 569, 1006, 984, 1079, 1021],
    },
    fast: {
      tokens: [3138000, 3628000, 3262000, 2113000, 1968000, 3800000, 3926000, 3554000, 3369000, 3431000, 2020000, 2043000, 3816000, 3931000, 3254000, 3605000, 4096000, 1772000, 2156000, 3305000, 3213000, 3508000, 4021000, 3390000, 2419000, 2362000, 3700000, 3541000, 4404000, 4253000],
      requests: [4805, 5175, 5376, 3031, 2917, 5077, 5344, 5324, 5178, 5143, 2815, 3000, 5195, 5913, 5062, 5662, 6045, 2783, 2945, 5669, 6169, 5424, 6020, 6022, 3500, 3160, 6039, 5703, 5599, 6521],
    },
    embed: {
      tokens: [6306000, 6264000, 6326000, 2930000, 3734000, 5444000, 6533000, 6003000, 6488000, 5966000, 3859000, 3464000, 6490000, 5618000, 7348000, 5732000, 6973000, 3701000, 4008000, 10626000, 5990000, 6063000, 6675000, 7506000, 4007000, 3435000, 7301000, 7854000, 7191000, 6889000],
      requests: [2365, 2428, 2166, 1319, 1432, 2323, 2619, 2298, 2672, 2439, 1358, 1430, 2444, 2695, 2405, 2778, 2460, 1348, 1356, 3684, 2879, 2680, 2412, 2427, 1455, 1458, 2627, 3001, 2545, 2586],
    },
  },
  source: "Usage metered hourly · prices are blended per million tokens",
};
