/* SEO Ranking Tracker — types + demo data (fictional sites and rankings, not real client results). */

export interface SeoKeyword {
  /** The search term being tracked. */
  keyword: string;
  /** The page that ranks for it. */
  url?: string;
  /** Optional tag, e.g. Local, Commercial, Brand. */
  intent?: string;
  /** Average monthly searches. */
  volume?: number;
  /** Optional all-time best. The lowest value in history is used if it is better. */
  best?: number;
  /** Weekly positions, oldest first. Last value = this week. null = not in the top 100. */
  history: (number | null)[];
}

export interface SeoRankingData {
  eyebrow?: string;
  title?: string;
  /** Site line under the title. */
  site?: string;
  /** Date text shown top right. */
  period?: string;
  /** Labels for each history point, e.g. "Sep 25". */
  weeks?: string[];
  /** Footer note. */
  source?: string;
  keywords: SeoKeyword[];
}

export type SeoFilter = "all" | "top3" | "top10" | "improved" | "declined";
export type SeoSortKey = "keyword" | "position" | "change" | "best" | "volume";
export type SeoSortDir = "asc" | "desc";
export interface SeoSort { key: SeoSortKey; dir: SeoSortDir }

export const SEO_LABELS = {
  searchLabel: "Search keywords", searchPlaceholder: "Filter keywords or URLs",
  filterGroup: "Filter keywords", all: "All", top3: "Top 3", top10: "Top 10", improved: "Improved", declined: "Declined",
  keyword: "Keyword", position: "Position", change: "Change", best: "Best", volume: "Volume", trend: "8-week trend",
  avg: "Avg. position", inTop3: "In top 3", inTop10: "In top 10", thisWeek: "Moved this week",
  up: "up", down: "down", better: "better", worse: "worse", same: "no change",
  spread: "Position spread", notRanking: "Not ranking", notRankingLong: "Not in the top 100",
  showing: "Showing {shown} of {total} keywords", empty: "No keywords match these filters.", clear: "Clear filters",
  sortBy: "Sort", newLabel: "New", lost: "Lost", vsPrev: "vs previous week",
  url: "Ranking URL", bestEver: "Best position", range: "8-week range", moved: "Over 8 weeks", volumeLong: "Monthly searches", now: "This week",
  history: "Rank history", chartHint: "Use the left and right arrow keys to step through the weeks.",
  expand: "Show history for {kw}", announceFilter: "{n} keywords shown", announceSort: "Sorted by {col}, {dir}",
  asc: "ascending", desc: "descending", positions: "positions", position1: "position",
};
export type SeoLabels = typeof SEO_LABELS;

const WEEKS = ["Aug 14", "Aug 21", "Aug 28", "Sep 4", "Sep 11", "Sep 18", "Sep 25", "Oct 2"];

export const brightsideData: SeoRankingData = {
  eyebrow: "Rank tracking",
  title: "Organic keyword positions",
  site: "brightside-dental.example · local results, desktop",
  period: "Week of 2 Oct 2026 · vs 25 Sep",
  weeks: WEEKS,
  source: "Weekly position checks, top 100 results",
  keywords: [
    { keyword: "emergency dentist near me", url: "/emergency-dental", intent: "Local", volume: 6600, best: 3, history: [14, 12, 11, 9, 8, 6, 5, 4] },
    { keyword: "teeth whitening cost", url: "/teeth-whitening", intent: "Commercial", volume: 2900, best: 3, history: [9, 9, 8, 8, 7, 7, 6, 3] },
    { keyword: "clear aligners near me", url: "/clear-aligners", intent: "Local", volume: 1900, best: 2, history: [5, 4, 4, 3, 3, 2, 2, 2] },
    { keyword: "dental implants price", url: "/dental-implants", intent: "Commercial", volume: 4400, history: [22, 19, 18, 16, 15, 13, 12, 11] },
    { keyword: "family dentist brightside", url: "/", intent: "Brand", volume: 880, history: [1, 1, 1, 1, 1, 1, 1, 1] },
    { keyword: "root canal specialist", url: "/root-canal", intent: "Commercial", volume: 1300, best: 5, history: [6, 7, 7, 8, 9, 9, 8, 11] },
    { keyword: "kids dentist", url: "/pediatric-dentistry", intent: "Local", volume: 2400, history: [18, 17, 15, 14, 12, 10, 9, 8] },
    { keyword: "sedation dentistry", url: "/sedation", intent: "Informational", volume: 720, best: 9, history: [11, 11, 10, 12, 13, 14, 15, 17] },
    { keyword: "dentist open saturday", url: "/hours", intent: "Local", volume: 1600, history: [3, 3, 2, 2, 2, 1, 1, 1] },
    { keyword: "veneers before and after", url: "/veneers", intent: "Informational", volume: 3600, history: [31, 28, 27, 25, 24, 22, 21, 19] },
    { keyword: "gum disease treatment", url: "/periodontics", intent: "Commercial", volume: 1000, best: 7, history: [8, 8, 9, 9, 10, 11, 11, 13] },
    { keyword: "same day crowns", url: "/crowns", intent: "Commercial", volume: 590, history: [15, 14, 13, 10, 9, 7, 7, 6] },
    { keyword: "dental bonding cost", url: "/cosmetic-bonding", intent: "Commercial", volume: 480, history: [null, null, 48, 41, 36, 30, 27, 24] },
  ],
};

export const cedarData: SeoRankingData = {
  eyebrow: "Rank tracking",
  title: "Organic keyword positions",
  site: "cedarfitness.example · local results, mobile",
  period: "Week of 2 Oct 2026 · vs 25 Sep",
  weeks: WEEKS,
  source: "Weekly position checks, top 100 results",
  keywords: [
    { keyword: "gym near me", url: "/", intent: "Local", volume: 9900, history: [24, 22, 21, 19, 18, 18, 16, 15] },
    { keyword: "personal trainer near me", url: "/personal-training", intent: "Local", volume: 2900, history: [7, 7, 6, 6, 5, 5, 4, 4] },
    { keyword: "hiit classes", url: "/classes/hiit", intent: "Local", volume: 1300, history: [12, 10, 9, 9, 8, 7, 7, 5] },
    { keyword: "24 hour gym", url: "/membership", intent: "Commercial", volume: 5400, best: 8, history: [9, 9, 10, 11, 11, 12, 13, 15] },
    { keyword: "beginner yoga class", url: "/classes/yoga", intent: "Local", volume: 1000, history: [3, 3, 3, 2, 2, 2, 1, 1] },
    { keyword: "gym membership prices", url: "/pricing", intent: "Commercial", volume: 2400, best: 4, history: [6, 6, 5, 5, 6, 6, 5, 6] },
    { keyword: "spin class schedule", url: "/classes/cycle", intent: "Local", volume: 720, best: 1, history: [2, 2, 2, 3, 3, 4, 4, 4] },
    { keyword: "strength training program", url: "/blog/strength-101", intent: "Informational", volume: 1900, history: [null, null, null, 62, 44, 38, 31, 28] },
    { keyword: "kettlebell class", url: "/classes/kettlebell", intent: "Local", volume: 390, history: [null, null, null, null, null, null, null, 37] },
  ],
};
