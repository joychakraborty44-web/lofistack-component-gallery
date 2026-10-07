/* Types + demo data for the Team Member Performance leaderboard (fictional team, not real results). */

export type TeamMetric = "deals" | "revenue" | "calls" | "response";

export interface PeriodInfo {
  label: string;
  range?: string;
  /** e.g. "last week" — used for rank-change and delta texts. */
  compare?: string;
  /** Names of the trend points, oldest first. */
  axis?: string[];
}

export interface MemberPeriod {
  deals: number[];
  revenue: number[];
  calls: number[];
  /** Average first reply to a new lead, in minutes (lower is better). */
  response: number[];
  /** Targets for this period. Response is a maximum. */
  target?: Partial<Record<TeamMetric, number>>;
}

export interface TeamMember {
  id: string;
  name: string;
  role?: string;
  periods: Record<string, MemberPeriod>;
}

export interface TeamData {
  eyebrow?: string;
  title?: string;
  team?: string;
  currency?: string;
  locale?: string;
  footnote?: string;
  periods: Record<string, PeriodInfo>;
  members: TeamMember[];
}

export const DEMO_TEAM: TeamData = {
  eyebrow: "Sales leaderboard",
  title: "Team performance",
  team: "Cedar Fitness Co. sales team",
  currency: "USD",
  periods: {
    week: { label: "This week", range: "Week 39 · 21–27 Sep 2026", compare: "last week", axis: ["W34", "W35", "W36", "W37", "W38", "W39"] },
    month: { label: "This month", range: "September 2026", compare: "last month", axis: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"] },
  },
  members: [
    { id: "mo", name: "Maya Okafor", role: "Account Executive", periods: {
      week: { deals: [5, 6, 4, 4, 6, 5], revenue: [11600, 14150, 8950, 9450, 14750, 11250], calls: [69, 79, 57, 76, 60, 68], response: [15, 16, 17, 10, 14, 16],
        target: { deals: 5, revenue: 12000, calls: 80, response: 15 } },
      month: { deals: [19, 17, 16, 26, 19, 28], revenue: [53650, 48500, 44050, 60950, 52300, 62850], calls: [307, 353, 319, 304, 271, 252], response: [15, 15, 17, 13, 14, 17],
        target: { deals: 20, revenue: 50000, calls: 340, response: 15 } } } },
    { id: "dr", name: "Daniel Reyes", role: "Account Executive", periods: {
      week: { deals: [3, 4, 5, 4, 3, 5], revenue: [7100, 8700, 12750, 8250, 7200, 11700], calls: [68, 66, 77, 80, 59, 67], response: [16, 16, 18, 13, 13, 19],
        target: { deals: 5, revenue: 12000, calls: 80, response: 15 } },
      month: { deals: [19, 15, 15, 18, 13, 21], revenue: [49400, 30400, 33000, 42300, 28500, 50750], calls: [324, 319, 391, 315, 312, 348], response: [17, 14, 15, 21, 22, 18],
        target: { deals: 20, revenue: 50000, calls: 340, response: 15 } } } },
    { id: "pn", name: "Priya Nair", role: "Senior Account Executive", periods: {
      week: { deals: [3, 3, 4, 5, 5, 6], revenue: [10850, 10650, 12700, 19300, 18250, 20100], calls: [62, 49, 56, 64, 61, 54], response: [11, 19, 14, 18, 19, 15],
        target: { deals: 5, revenue: 12000, calls: 80, response: 15 } },
      month: { deals: [23, 20, 25, 15, 17, 19], revenue: [81400, 75900, 96250, 48250, 54800, 68200], calls: [260, 291, 289, 285, 262, 211], response: [15, 18, 14, 11, 20, 15],
        target: { deals: 20, revenue: 50000, calls: 340, response: 15 } } } },
    { id: "tl", name: "Tom Lindqvist", role: "Sales Development Rep", periods: {
      week: { deals: [2, 3, 2, 3, 3, 3], revenue: [3350, 4850, 2950, 4050, 4350, 4550], calls: [135, 119, 123, 141, 131, 109], response: [12, 14, 11, 10, 10, 14],
        target: { deals: 3, revenue: 5000, calls: 120, response: 10 } },
      month: { deals: [10, 11, 7, 11, 14, 8], revenue: [16650, 14800, 9250, 18100, 21100, 11600], calls: [407, 455, 402, 472, 502, 421], response: [13, 9, 14, 16, 12, 12],
        target: { deals: 12, revenue: 20000, calls: 500, response: 10 } } } },
    { id: "ab", name: "Aisha Bello", role: "Account Executive", periods: {
      week: { deals: [4, 4, 4, 4, 4, 4], revenue: [10100, 11350, 11100, 10850, 11300, 11200], calls: [75, 71, 78, 76, 78, 69], response: [19, 20, 16, 14, 15, 22],
        target: { deals: 5, revenue: 12000, calls: 80, response: 15 } },
      month: { deals: [16, 20, 15, 22, 22, 21], revenue: [39950, 45800, 39550, 55400, 57400, 47250], calls: [337, 403, 358, 343, 386, 328], response: [16, 13, 16, 20, 13, 17],
        target: { deals: 20, revenue: 50000, calls: 340, response: 15 } } } },
    { id: "mb", name: "Marco Bianchi", role: "Sales Development Rep", periods: {
      week: { deals: [3, 3, 2, 3, 3, 4], revenue: [4400, 4800, 3000, 4800, 4150, 5200], calls: [115, 135, 111, 131, 132, 117], response: [12, 8, 10, 10, 9, 9],
        target: { deals: 3, revenue: 5000, calls: 120, response: 10 } },
      month: { deals: [9, 10, 11, 13, 16, 12], revenue: [13600, 13600, 16300, 20000, 22350, 18600], calls: [390, 523, 380, 442, 479, 432], response: [10, 11, 13, 7, 13, 9],
        target: { deals: 12, revenue: 20000, calls: 500, response: 10 } } } },
    { id: "hs", name: "Hana Sato", role: "Account Executive", periods: {
      week: { deals: [3, 2, 3, 4, 2, 5], revenue: [7650, 5600, 9000, 12400, 5200, 15800], calls: [66, 81, 83, 80, 74, 84], response: [18, 24, 16, 15, 20, 27],
        target: { deals: 5, revenue: 12000, calls: 80, response: 15 } },
      month: { deals: [12, 10, 16, 13, 14, 20], revenue: [29700, 29850, 47950, 32100, 41300, 63900], calls: [363, 303, 336, 337, 278, 299], response: [16, 20, 22, 20, 26, 26],
        target: { deals: 20, revenue: 50000, calls: 340, response: 15 } } } },
    { id: "lm", name: "Leo Moreau", role: "Sales Development Rep", periods: {
      week: { deals: [1, 2, 3, 3, 2, 3], revenue: [1750, 3000, 5000, 4550, 2700, 4250], calls: [110, 112, 99, 102, 111, 104], response: [12, 15, 10, 12, 12, 12],
        target: { deals: 3, revenue: 5000, calls: 120, response: 10 } },
      month: { deals: [12, 10, 8, 10, 14, 10], revenue: [20850, 17150, 14350, 17250, 19100, 18100], calls: [476, 677, 576, 523, 667, 636], response: [14, 12, 9, 12, 15, 13],
        target: { deals: 12, revenue: 20000, calls: 500, response: 10 } } } },
  ],
};
