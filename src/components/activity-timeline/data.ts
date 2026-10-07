/* Activity Timeline — types, built-in text and the demo data. */

export type ActivityType = "call" | "email" | "form" | "deal" | "note";
export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "form", "deal", "note"];
export type ActivitySort = "newest" | "oldest";

export interface ActivityEvent {
  /** Unique key. Used in callbacks and to remember which items are open. */
  id: string;
  type: ActivityType;
  /** ISO date-time (local). Events are grouped by day and sorted by this. */
  time: string;
  /** Who did it. Shown with initials. */
  actor?: string;
  title?: string;
  summary?: string;
  /** [label, value] pairs shown when the event is opened. */
  details?: [string, string][];
  /** Longer text, shown as a quote when opened. */
  note?: string;
}

export const TYPE_LABELS: Record<ActivityType, string> = { call: "Call", email: "Email", form: "Form", deal: "Deal", note: "Note" };

export const ACTIVITY_LABELS = {
  newest: "Newest", oldest: "Oldest", sort: "Sort order",
  activities: "activities", activity: "activity", acrossDays: "across {n} days", acrossDay: "on 1 day",
  last: "Last activity {when}", filterBy: "Filter by type", all: "All activity", clear: "Clear filters",
  today: "Today", yesterday: "Yesterday", justNow: "just now", minAgo: "{n} min ago", hAgo: "{n} h ago",
  showMore: "Show {n} more", showing: "Showing {shown} of {total}", none: "No activity matches these filters.",
  noneTitle: "Nothing here yet", open: "Show details", close: "Hide details",
  announce: "{n} events shown", filterAnnounce: "Showing {list}", events: "{n} events", event: "1 event",
};
export type ActivityLabels = typeof ACTIVITY_LABELS;

export interface ActivityTimelineData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  now?: string;
  events: ActivityEvent[];
}

export const demoTimeline: ActivityTimelineData = {
  eyebrow: "Account activity",
  title: "Brightside Dental",
  subtitle: "Calls, emails, form fills, deals and notes from the last 5 days",
  now: "2026-10-02T16:30:00",
  events: [
    { id: "a21", type: "deal", time: "2026-10-02T16:02:00", actor: "Luis Ortega",
      title: "Deal moved to Proposal sent", summary: "Spring whitening retainer · $4,800 per month",
      details: [["Stage", "Discovery → Proposal sent"], ["Value", "$4,800 / mo"], ["Expected close", "Oct 16"]] },
    { id: "a20", type: "email", time: "2026-10-02T15:20:00", actor: "Luis Ortega",
      title: "Proposal emailed to Dr. Elena Brooks", summary: "Q4 growth proposal with three package options.",
      details: [["Opens", "2"], ["Attachment", "Q4-proposal.pdf"], ["Reply", "None yet"]] },
    { id: "a19", type: "call", time: "2026-10-02T14:05:00", actor: "Luis Ortega",
      title: "Discovery call with Dr. Elena Brooks", summary: "Goals for new-patient bookings and current ad spend.",
      details: [["Duration", "24 min"], ["Outcome", "Proposal requested"], ["Next step", "Send proposal today"]],
      note: "Wants roughly 40 more new patients a month before spring. Open to a longer retainer if reporting stays weekly." },
    { id: "a18", type: "form", time: "2026-10-02T11:42:00", actor: "Website form",
      title: "New lead from “Book a cleaning”", summary: "Jordan Miles asked for a weekday morning appointment.",
      details: [["Source", "Search Ads"], ["Page", "/book-cleaning"], ["First reply", "6 min"]] },
    { id: "a17", type: "note", time: "2026-10-02T09:15:00", actor: "Maya Chen",
      title: "Internal note", summary: "Reception is short-staffed on Fridays. Route calls to Sam until 1 PM." },
    { id: "a16", type: "email", time: "2026-10-01T17:30:00", actor: "Maya Chen",
      title: "September report sent", summary: "712 leads in September; cost per lead down 5.8%.",
      details: [["Opens", "1"], ["Attachment", "September-report.pdf"], ["Recipients", "2"]] },
    { id: "a15", type: "call", time: "2026-10-01T15:10:00", actor: "Maya Chen",
      title: "Check-in call with Sam Patel", summary: "Went through new ad copy for the October campaign.",
      details: [["Duration", "11 min"], ["Outcome", "Copy approved"]] },
    { id: "a14", type: "form", time: "2026-10-01T13:48:00", actor: "Website form",
      title: "New lead from “Free consultation”", summary: "Ana Ruiz asked about clear aligners.",
      details: [["Source", "Social Ads"], ["Page", "/consultation"], ["First reply", "14 min"]] },
    { id: "a13", type: "deal", time: "2026-10-01T10:20:00", actor: "Luis Ortega",
      title: "Deal created: Spring whitening retainer", summary: "Opened from the September report conversation.",
      details: [["Stage", "Discovery"], ["Value", "$4,800 / mo"], ["Owner", "Luis Ortega"]] },
    { id: "a12", type: "note", time: "2026-10-01T09:02:00", actor: "Priya Shah",
      title: "Internal note", summary: "Paused the weakest video ad set and moved its budget to search." },
    { id: "a11", type: "email", time: "2026-09-30T16:40:00", actor: "Elena Brooks",
      title: "Reply from Dr. Elena Brooks", summary: "“Happy with September. Can we talk about spring?”",
      details: [["Thread", "September results"], ["Replied after", "2 h 10 min"]] },
    { id: "a10", type: "form", time: "2026-09-30T14:15:00", actor: "Website form",
      title: "New lead from “Book a cleaning”", summary: "Chris Novak prefers Saturday appointments.",
      details: [["Source", "Search Ads"], ["Page", "/book-cleaning"], ["First reply", "9 min"]] },
    { id: "a09", type: "call", time: "2026-09-30T11:05:00", actor: "Maya Chen",
      title: "Missed call from Sam Patel", summary: "Voicemail about Saturday opening hours. Called back at 11:20.",
      details: [["Duration", "Voicemail · 0:48"], ["Outcome", "Called back"]] },
    { id: "a08", type: "note", time: "2026-09-30T09:30:00", actor: "Priya Shah",
      title: "Internal note", summary: "Launched the October search campaign with three new ad groups." },
    { id: "a07", type: "deal", time: "2026-09-29T15:55:00", actor: "Luis Ortega",
      title: "Deal won: Ad management renewal", summary: "Renewed for another six months.",
      details: [["Stage", "Negotiation → Won"], ["Value", "$2,400 / mo"], ["Term", "6 months"]] },
    { id: "a06", type: "email", time: "2026-09-29T13:30:00", actor: "Maya Chen",
      title: "Invoice #1042 sent", summary: "Monthly ad management fee.",
      details: [["Amount", "$2,400"], ["Due", "Oct 13"], ["Opens", "1"]] },
    { id: "a05", type: "form", time: "2026-09-29T10:10:00", actor: "Website form",
      title: "New lead from “Free consultation”", summary: "Morgan Lee asked about dental implants.",
      details: [["Source", "Organic search"], ["Page", "/consultation"], ["First reply", "21 min"]] },
    { id: "a04", type: "call", time: "2026-09-28T16:20:00", actor: "Maya Chen",
      title: "Strategy call with Dr. Elena Brooks", summary: "Agreed lead and cost targets for Q4.",
      details: [["Duration", "32 min"], ["Outcome", "Targets agreed"], ["Next step", "Share September report"]],
      note: "Q4 targets: 750 leads a month and cost per lead under $28." },
    { id: "a03", type: "note", time: "2026-09-28T14:00:00", actor: "Maya Chen",
      title: "Internal note", summary: "Added Q4 targets to the account plan." },
    { id: "a02", type: "email", time: "2026-09-28T11:30:00", actor: "Priya Shah",
      title: "Welcome sequence updated", summary: "Two new emails added to the new-patient welcome sequence.",
      details: [["Sequence", "New patient welcome"], ["Emails", "5 → 7"]] },
    { id: "a01", type: "form", time: "2026-09-28T09:45:00", actor: "Website form",
      title: "New lead from “Book a cleaning”", summary: "Riley Owens asked for a family appointment.",
      details: [["Source", "Social Ads"], ["Page", "/book-cleaning"], ["First reply", "12 min"]] },
  ],
};
