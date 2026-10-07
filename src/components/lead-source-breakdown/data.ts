/* Types + demo data for the Lead Source Breakdown. Example data — not real client results. */

export type LeadMetric = "leads" | "revenue" | "cpl";

export interface LeadSource {
  id: string;
  label: string;
  leads: number;
  revenue: number;
  /** Ad / programme spend for the period. */
  spend: number;
  /** Start with this source hidden. */
  hidden?: boolean;
}

export interface LeadSourceSet {
  eyebrow?: string;
  title?: string;
  period?: string;
  currency?: string;
  /** Footer note, e.g. where the data comes from. */
  source?: string;
  sources: LeadSource[];
}

export const q3: LeadSourceSet = {
  eyebrow: "Lead sources",
  title: "Where this quarter's leads came from",
  period: "Q3 2026 · 1 Jul – 30 Sep",
  currency: "USD",
  sources: [
    { id: "search", label: "Paid search", leads: 412, revenue: 58400, spend: 14420 },
    { id: "social", label: "Paid social", leads: 356, revenue: 41200, spend: 10680 },
    { id: "organic", label: "Organic search", leads: 268, revenue: 46900, spend: 4020 },
    { id: "referral", label: "Referrals", leads: 154, revenue: 39600, spend: 2310 },
    { id: "email", label: "Email", leads: 118, revenue: 17300, spend: 590 },
    { id: "events", label: "Events", leads: 72, revenue: 12800, spend: 5760 },
  ],
  source: "Source: CRM lead records and ad platform spend",
};

export const q2: LeadSourceSet = {
  ...q3,
  title: "Where last quarter's leads came from",
  period: "Q2 2026 · 1 Apr – 30 Jun",
  sources: [
    { id: "search", label: "Paid search", leads: 365, revenue: 51100, spend: 13140 },
    { id: "social", label: "Paid social", leads: 330, revenue: 36300, spend: 10230 },
    { id: "organic", label: "Organic search", leads: 241, revenue: 41700, spend: 3856 },
    { id: "referral", label: "Referrals", leads: 139, revenue: 35200, spend: 2085 },
    { id: "email", label: "Email", leads: 126, revenue: 16900, spend: 630 },
    { id: "events", label: "Events", leads: 64, revenue: 10400, spend: 5248 },
  ],
};
