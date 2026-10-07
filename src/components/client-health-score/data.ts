/* Client Health Score — types, built-in text and the demo data. */

export type HealthBand = "healthy" | "risk" | "critical";
export type HealthPeriod = "current" | "previous";

export interface HealthFactor {
  /** Stable id, used for weights and callbacks. */
  key: string;
  name: string;
  /** Starting weight, 0–10. Weights are shared as percentages of their total. */
  weight: number;
  /** 0–100 score now. */
  score: number;
  /** 0–100 score for the earlier period (defaults to `score`). */
  previous?: number;
  /** What the factor measures. Shown when the factor is hovered or focused. */
  about?: string;
  /** Evidence behind the current score. */
  note?: string;
  /** Evidence behind the earlier score. */
  previousNote?: string;
}

export interface HealthBands {
  /** Score at or above which the client is Healthy (default 70). */
  healthy: number;
  /** Score at or above which the client is At risk; below is Critical (default 40). */
  risk: number;
}

export const HEALTH_LABELS = {
  cap: "Client health",
  current: "Current", previous: "90 days ago", period: "Compare period", factors: "Score factors",
  factorsNote: "Drag a weight to change how much each factor counts.", reset: "Reset weights",
  weight: "Weight", of100: "/100", healthy: "Healthy", risk: "At risk", critical: "Critical",
  vsPrev: "{delta} vs {label}", vsNow: "{delta} to now", same: "No change vs {label}",
  pts: "{pts} pts", ofScore: "of score", now: "Now {n}",
  asOf: "Scores as of {date}", comparedWith: "compared with {date}",
  hintTitle: "What's driving this score", allZero: "All weights are at 0, so every factor counts equally.",
  lift: "Biggest lift", drag: "Biggest drag", adds: "adds {pts} pts.", costs: "costs {pts} pts.", hint: "Hover or focus a factor for details.",
  foot: "Score = weighted average of the factor scores. Bands: Healthy {h}+, At risk {r}–{h1}, Critical below {r}.",
  dial: "Health score {score} out of 100, {band}.",
  marker: "{label} · {n}",
};
export type HealthLabels = typeof HEALTH_LABELS;

export interface ClientHealthData {
  client: string;
  segment?: string;
  /** YYYY-MM-DD of the current scores. */
  asOf?: string;
  /** YYYY-MM-DD of the earlier scores. */
  compareDate?: string;
  /** Toggle label for the earlier period (default "90 days ago"). */
  compareLabel?: string;
  factors: HealthFactor[];
  bands?: Partial<HealthBands>;
}

export const brightside: ClientHealthData = {
  client: "Brightside Dental",
  segment: "Growth plan · client since Mar 2025 · account owner Jordan Lee",
  asOf: "2026-10-02",
  compareDate: "2026-07-04",
  factors: [
    { key: "engagement", name: "Engagement", weight: 5, score: 82, previous: 61,
      about: "Meeting attendance, reply speed and portal logins over the last 30 days.",
      note: "Joined all 3 monthly reviews this quarter and replies within a day on average.",
      previousNote: "Missed 1 of 3 monthly reviews. Replies took about 3 days." },
    { key: "results", name: "Results vs goal", weight: 5, score: 64, previous: 45,
      about: "Booked new patients this quarter as a share of the agreed goal.",
      note: "41 new patients booked against a goal of 64 (64%).",
      previousNote: "27 new patients booked against a goal of 60 (45%)." },
    { key: "payments", name: "Payments", weight: 3, score: 95, previous: 90,
      about: "Invoices paid in full and on time over the last 6 months.",
      note: "All 6 invoices paid. One was paid 4 days late.",
      previousNote: "All 6 invoices paid. Two were paid late." },
    { key: "support", name: "Support tickets", weight: 3, score: 48, previous: 52,
      about: "Fewer open tickets and faster fixes score higher.",
      note: "5 tickets opened in the last 30 days and 2 are still open.",
      previousNote: "4 tickets opened in the 30 days before and 2 were still open." },
    { key: "usage", name: "Product usage", weight: 4, score: 71, previous: 57,
      about: "How many of the 7 core features the team uses each week.",
      note: "Uses 5 of 7 core features weekly. The reporting dashboard is rarely opened.",
      previousNote: "Used 4 of 7 core features weekly." },
  ],
};

export const harbor: ClientHealthData = {
  client: "Harbor & Pine Realty",
  segment: "Starter plan · client since Nov 2025 · account owner Priya Shah",
  asOf: "2026-10-02",
  compareDate: "2026-07-04",
  factors: [
    { key: "engagement", name: "Engagement", weight: 5, score: 38, previous: 55,
      about: "Meeting attendance, reply speed and portal logins over the last 30 days.",
      note: "Skipped the last 2 monthly reviews. Replies take about a week.", previousNote: "Joined 2 of 3 monthly reviews." },
    { key: "results", name: "Results vs goal", weight: 5, score: 30, previous: 48,
      about: "Qualified seller leads this quarter as a share of the agreed goal.",
      note: "12 qualified leads against a goal of 40 (30%).", previousNote: "19 qualified leads against a goal of 40 (48%)." },
    { key: "payments", name: "Payments", weight: 3, score: 70, previous: 85,
      about: "Invoices paid in full and on time over the last 6 months.",
      note: "One invoice is 21 days overdue.", previousNote: "All invoices paid, one a week late." },
    { key: "support", name: "Support tickets", weight: 3, score: 25, previous: 40,
      about: "Fewer open tickets and faster fixes score higher.",
      note: "9 tickets in the last 30 days and 6 are still open.", previousNote: "6 tickets, 4 still open." },
    { key: "usage", name: "Product usage", weight: 4, score: 41, previous: 52,
      about: "How many of the 7 core features the team uses each week.",
      note: "Uses 3 of 7 core features weekly, and weekly logins are down by half.", previousNote: "Used 4 of 7 core features, but not every week." },
  ],
};
