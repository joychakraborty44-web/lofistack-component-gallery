/* Types + demo data for the Weekly Marketing Report. Fictional client — example data, not real results. */

export interface ReportChannel { name: string; spend: number; leads: number; booked: number }
export interface ReportChecklistItem { text: string; done?: boolean }
export interface ReportPrior { label: string; spend: number; leads: number; booked: number }

export interface ReportWeek {
  week: number;
  /** Date range text, e.g. "14–20 Sep 2026". */
  range?: string;
  /** Issue number for the dateline (defaults to the week number). */
  issue?: number;
  headline?: string;
  /** Lead story. The first letter becomes a drop cap. */
  lead?: string;
  /** What the first week is compared against. Later weeks compare with the week before. */
  prior?: ReportPrior;
  /** The four key figures, cost per lead and booking rate are all worked out from these rows. */
  channels: ReportChannel[];
  highlights?: string[];
  lowlights?: string[];
  /** Checklist for the following week. */
  next?: ReportChecklistItem[];
}

export interface WeeklyReportData {
  publication: string;
  client?: string;
  desk?: string;
  preparedBy?: string;
  currency?: string;
  locale?: string;
  weeks: ReportWeek[];
}

export const cedarFitness: WeeklyReportData = {
  publication: "Weekly Marketing Report",
  client: "Cedar Fitness Co.",
  desk: "Marketing desk",
  preparedBy: "Prepared by the growth team",
  currency: "USD",
  weeks: [
    {
      week: 37, range: "7–13 Sep 2026",
      headline: "A steady week as search ads carry the bookings",
      lead: "Leads rose to 167, up 8% on the week before, and booked calls reached 42. Search ads booked the most calls of any channel. Social ads brought in more leads for less money, but fewer of those leads went on to book a call. Referrals stayed small but booked almost half of the people they sent.",
      prior: { label: "Week 36", spend: 2180, leads: 154, booked: 37 },
      channels: [
        { name: "Search Ads", spend: 1240, leads: 52, booked: 14 },
        { name: "Social Ads", spend: 980, leads: 61, booked: 11 },
        { name: "Email", spend: 0, leads: 18, booked: 7 },
        { name: "Organic search", spend: 0, leads: 27, booked: 6 },
        { name: "Referral", spend: 0, leads: 9, booked: 4 },
      ],
      highlights: [
        "Search ads booked 14 calls, the most of any channel.",
        "Cost per lead fell to $13.29 across all channels.",
        "Referrals booked 4 calls from just 9 leads.",
      ],
      lowlights: [
        "Only 18% of social ad leads booked a call, the lowest rate of any channel.",
        "Email brought in 18 leads. No newsletter went out this week.",
      ],
      next: [
        { text: "Send the autumn newsletter", done: true },
        { text: "Shift $100 of the social budget to search ads", done: true },
        { text: "Draft a shorter booking form for social ad pages", done: true },
        { text: "Ask new members for referrals at check-in", done: false },
      ],
    },
    {
      week: 38, range: "14–20 Sep 2026",
      headline: "Newsletter lifts the studio to a 200-lead week",
      lead: "Leads reached 200, up 20% on Week 37, and booked calls rose to 50. The autumn newsletter brought in 31 leads and 11 of the bookings. Search ads booked 17 calls, three more than last week. Social ads spent more but booked only one extra call. Blended cost per lead dropped to $11.80.",
      channels: [
        { name: "Search Ads", spend: 1310, leads: 58, booked: 17 },
        { name: "Social Ads", spend: 1050, leads: 74, booked: 12 },
        { name: "Email", spend: 0, leads: 31, booked: 11 },
        { name: "Organic search", spend: 0, leads: 29, booked: 7 },
        { name: "Referral", spend: 0, leads: 8, booked: 3 },
      ],
      highlights: [
        "Email brought in 31 leads and 11 booked calls after the autumn newsletter.",
        "Search ads booked 17 calls, up from 14.",
        "Cost per lead fell 11% to $11.80.",
      ],
      lowlights: [
        "Social ad spend rose to $1,050, but booked calls only went from 11 to 12.",
        "Referrals slipped to 8 leads and 3 booked calls.",
      ],
      next: [
        { text: "Launch the shorter booking form on social ad pages", done: false },
        { text: "Follow up with newsletter leads who haven't booked", done: true },
        { text: "Review the search keywords with the highest cost per booking", done: false },
        { text: "Add a referral reminder to the members' app", done: false },
      ],
    },
    {
      week: 39, range: "21–27 Sep 2026",
      headline: "Social costs climb as leads ease back",
      lead: "Leads eased to 187 and booked calls to 46 after last week's newsletter peak. Social ad spend rose to $1,180 while bookings from social fell to 9. Organic search had a strong week, with 33 leads and 9 bookings, and referrals booked 5 calls.",
      channels: [
        { name: "Search Ads", spend: 1290, leads: 55, booked: 15 },
        { name: "Social Ads", spend: 1180, leads: 66, booked: 9 },
        { name: "Email", spend: 0, leads: 22, booked: 8 },
        { name: "Organic search", spend: 0, leads: 33, booked: 9 },
        { name: "Referral", spend: 0, leads: 11, booked: 5 },
      ],
      highlights: [
        "Organic search rose to 33 leads and 9 booked calls.",
        "Referrals booked 5 calls from 11 leads.",
        "Search ads booked 15 calls on a steady $1,290 of spend.",
      ],
      lowlights: [
        "Social ads booked 9 calls from $1,180 of spend, about $131 per booking.",
        "Email leads fell back to 22 with no newsletter this week.",
      ],
      next: [
        { text: "Pause the two weakest social ad sets", done: false },
        { text: "Send the October newsletter", done: false },
        { text: "Publish two new class guides for organic search", done: false },
        { text: "Report back on the shorter booking form test", done: false },
      ],
    },
  ],
};
