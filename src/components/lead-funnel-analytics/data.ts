/* Lead Funnel Analytics — types, built-in text and the demo data. */

export interface FunnelStage {
  label: string;
  count: number;
}

export interface FunnelCompare {
  /** Shown as "vs {label}", e.g. "last quarter". */
  label: string;
  /** Counts for the earlier period, same order and length as `stages`. */
  stages: number[];
}

export type FunnelScale = "sqrt" | "linear";

export const LEAD_FUNNEL_LABELS = {
  overall: "Overall conversion",
  overallSub: "{last} of {first} {firstLabel}",
  drop: "Biggest drop-off",
  dropSub: "{pct} didn't continue",
  best: "Strongest step",
  bestSub: "{pct} moved on",
  share: "{pct} of {firstLabel}",
  moved: "moved on",
  dropped: "{n} dropped",
  vs: "vs {label}",
  pts: "pts",
  scaleSqrt: "Bar widths use a square-root scale so smaller stages stay readable.",
  scaleLinear: "Bar widths are drawn to scale.",
  empty: "Add two or more stages to draw the funnel.",
};
export type LeadFunnelLabels = typeof LEAD_FUNNEL_LABELS;

export interface LeadFunnelData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  period?: string;
  stages: FunnelStage[];
  compare?: FunnelCompare;
  source?: string;
}

export const demoFunnel: LeadFunnelData = {
  eyebrow: "Lead funnel",
  title: "Inbound pipeline · all channels",
  subtitle: "Website visit to closed sale",
  period: "1 Jul – 30 Sep 2026",
  stages: [
    { label: "Visitors", count: 8640 },
    { label: "Leads", count: 1296 },
    { label: "Booked", count: 544 },
    { label: "Converted", count: 196 },
  ],
  compare: { label: "last quarter", stages: [7910, 1107, 432, 147] },
  source: "Source: CRM and website analytics",
};
