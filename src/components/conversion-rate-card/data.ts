/* Types + demo data for the Conversion Rate Card. */

export interface ChannelInput {
  id: string;
  /** Button / row text. */
  label: string;
  visitors: number;
  conversions: number;
  /** Target rate in percent for this channel (falls back to the card target). */
  target?: number;
  /** Previous period counts — adds the change in points. */
  previous?: { visitors: number; conversions: number };
}

export interface ConversionData {
  eyebrow?: string;
  title?: string;
  client?: string;
  period?: string;
  /** Name of the previous period, e.g. "Aug". */
  compareLabel?: string;
  /** Target rate in percent for the combined "All" view (and any channel without its own). */
  target?: number;
  /** Top of the gauge scale in percent. Worked out from the data if left out. */
  max?: number;
  channels: ChannelInput[];
  /** Set to false to hide the combined "All" view. */
  showAll?: boolean;
}

export interface ChannelChangeDetail {
  channel: string; label: string; rate: number | null; target: number | null; visitors: number; conversions: number;
}
export interface WhatIfDetail {
  channel: string; conversions: number; actual: number; rate: number; target: number | null; gap: number | null;
}

/* Demo content — example data, not real client results (kept from the original). */
export const demoConversion: ConversionData = {
  eyebrow: "Conversion rate",
  title: "Website visitor to booked consultation",
  client: "Brightside Dental",
  period: "1–30 Sep 2026",
  compareLabel: "Aug",
  target: 4.8,
  max: 8,
  channels: [
    { id: "organic", label: "Organic", visitors: 6420, conversions: 244, target: 4.0, previous: { visitors: 6010, conversions: 212 } },
    { id: "paid", label: "Paid", visitors: 4180, conversions: 196, target: 5.0, previous: { visitors: 3870, conversions: 190 } },
    { id: "email", label: "Email", visitors: 1560, conversions: 101, target: 6.0, previous: { visitors: 1420, conversions: 87 } },
  ],
};
