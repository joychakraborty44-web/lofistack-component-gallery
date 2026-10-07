/* Campaign Performance Snapshot — types + demo data (example figures, not real campaign data). */

export type CampaignStatus = "active" | "learning" | "paused" | "ended";

/** Optional % change vs the previous period, per metric. A lower CPL/CPA counts as good. */
export interface CampaignDeltas {
  spend?: number;
  results?: number;
  cost?: number;
  ctr?: number;
  roas?: number;
}

export interface CampaignData {
  /** Campaign name. */
  name: string;
  /** Ad platform, e.g. "Meta Ads". Its first letter becomes the platform mark. */
  platform: string;
  /** active · learning · paused · ended (any other string shows as a neutral pill). */
  status: CampaignStatus | (string & {});
  /** Date range, YYYY-MM-DD. */
  start: string;
  end?: string;
  /** Any ISO currency code (default USD). */
  currency?: string;
  /** Total spend. */
  spend: number | null;
  /** Lead or conversion count. */
  results: number | null;
  /** What to call the results (default "Conversions"). "Leads" → cost shows as CPL, anything else → CPA. */
  resultLabel?: string;
  /** Optional cost per result. Worked out as spend ÷ results when left out. */
  cost?: number | null;
  /** Optional cost label override (default CPL for leads, CPA otherwise). */
  costLabel?: string;
  /** Click-through rate in percent (1.84 = 1.84%). */
  ctr: number | null;
  /** Return on ad spend as a multiple (4.2 = 4.2×). Revenue = spend × ROAS. */
  roas: number | null;
  /** Daily results, oldest first, starting on `start`. */
  series: number[];
  deltas?: CampaignDeltas;
}

export const demoCampaign: CampaignData = {
  name: "Autumn Lead Gen — Retargeting",
  platform: "Meta Ads",
  status: "active",
  start: "2026-09-01",
  end: "2026-09-24",
  currency: "USD",
  spend: 12480,
  results: 386,
  resultLabel: "Leads",
  ctr: 1.84,
  roas: 4.2,
  series: [9, 11, 10, 13, 12, 14, 11, 15, 16, 14, 17, 15, 18, 19, 16, 17, 20, 18, 21, 19, 22, 20, 23, 16],
  deltas: { spend: 6.0, results: 14.3, cost: -7.3, ctr: 3.9, roas: 9.8 },
};
