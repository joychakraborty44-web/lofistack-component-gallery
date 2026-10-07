/* Types + demo data for the Ad Creative Performance gallery.
   Demo numbers are the original page's example data (not real client results). */

export type CreativeFormat = "image" | "video" | "carousel";
export type FormatFilter = "all" | CreativeFormat;
export type CreativeSort = "ctr" | "cpa" | "spend" | "conversions";
export type ArtPattern = "sun" | "stripes" | "dots" | "arch" | "blocks" | "wave" | "type";

export interface CreativeArt {
  pattern: ArtPattern;
  /** Swap paper and ink. */
  invert?: boolean;
  /** Text for the "type" pattern (max 6 characters). */
  text?: string;
}

export interface Creative {
  id: string;
  name: string;
  format: CreativeFormat;
  /** Video only, e.g. "0:15". */
  duration?: string;
  /** Carousel only. */
  slides?: number;
  /** Optional ad text shown under the name. */
  copy?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  /** Stand-in artwork for the real thumbnail. */
  art?: CreativeArt;
}

export interface CreativeSet {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  period?: string;
  currency?: string;
  locale?: string;
  creatives: Creative[];
  /** Footer note. */
  source?: string;
}

export const DEMO_SET: CreativeSet = {
  eyebrow: "Creative performance",
  title: "New-patient offer",
  subtitle: "Brightside Dental · Social Ads · conversions are booked consultations",
  period: "1 – 30 Sep 2026",
  currency: "USD",
  creatives: [
    { id: "smile-30", name: "Smile in 30 days", format: "video", duration: "0:15",
      copy: "A brighter smile before your next big day.",
      impressions: 182400, clicks: 3612, spend: 2140, conversions: 96, art: { pattern: "sun" } },
    { id: "free-consult", name: "Free whitening consult", format: "image",
      copy: "Book a free consult. No pressure, no catch.",
      impressions: 214900, clicks: 2794, spend: 1880, conversions: 71, art: { pattern: "type", text: "FREE", invert: true } },
    { id: "meet-dr", name: "Meet the team", format: "video", duration: "0:30",
      copy: "Say hello to the people behind your check-up.",
      impressions: 96300, clicks: 1541, spend: 1120, conversions: 52, art: { pattern: "arch", invert: true } },
    { id: "before-after", name: "Before & after", format: "carousel", slides: 5,
      copy: "Real smiles, real results. Swipe to see.",
      impressions: 158700, clicks: 3968, spend: 2460, conversions: 88, art: { pattern: "blocks" } },
    { id: "family-plans", name: "Family plans", format: "image",
      copy: "One plan for the whole household.",
      impressions: 121500, clicks: 1215, spend: 940, conversions: 31, art: { pattern: "dots" } },
    { id: "same-week", name: "Same-week appointments", format: "image",
      copy: "Seen this week, not next month.",
      impressions: 88200, clicks: 1764, spend: 760, conversions: 41, art: { pattern: "stripes" } },
    { id: "stories", name: "Patient stories", format: "carousel", slides: 4,
      copy: "Four patients, four first visits.",
      impressions: 132800, clicks: 2125, spend: 1410, conversions: 47, art: { pattern: "wave", invert: true } },
    { id: "gentle", name: "Gentle cleaning", format: "video", duration: "0:06",
      copy: "Nervous about the dentist? We get it.",
      impressions: 204600, clicks: 2455, spend: 1590, conversions: 38, art: { pattern: "type", text: "Ahh." } },
  ],
  source: "CTR = clicks ÷ impressions. Cost per conversion = spend ÷ conversions.",
};
