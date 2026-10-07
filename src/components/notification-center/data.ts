/* Types + demo data for the Notification Center. */

export type NotificationType = "mention" | "system";
export type SystemIcon = "payment" | "warning" | "report" | "automation" | "integration";

export interface NotificationItem {
  /** Unique key (generated if left out). */
  id?: string;
  /** "mention" or "system" — sets the tab. */
  type: NotificationType;
  /** ISO date-time (local) or Date. Defaults to `now`. */
  time?: string | Date;
  read?: boolean;
  /** Mentions: "<actor> <text> <target>", e.g. "Maya Chen mentioned you in Q4 plan". */
  actor?: string;
  text?: string;
  target?: string;
  /** System alerts: heading and icon. */
  title?: string;
  icon?: SystemIcon;
  /** Optional second line or quote. */
  body?: string;
  /** Optional inline action button; `done` is the label after it was used. */
  action?: { label: string; done?: string };
}

export const demoNow = "2026-10-02T16:30:00";

/* Demo content — fictional clients and teammates (kept verbatim from the original). */
export const demoNotifications: NotificationItem[] = [
  { id: "m1", type: "mention", time: "2026-10-02T16:18:00", read: false, actor: "Maya Chen", text: "mentioned you in", target: "Brightside Dental · Q4 plan", body: "“Can you check the cost-per-lead target before Friday’s call?”" },
  { id: "s1", type: "system", icon: "payment", time: "2026-10-02T15:52:00", read: false, title: "Payment received", body: "Cedar Fitness Co. paid invoice #1043 · $1,850" },
  { id: "m2", type: "mention", time: "2026-10-02T14:40:00", read: false, actor: "Luis Ortega", text: "assigned you", target: "Proposal review", body: "Due Mon, Oct 5" },
  { id: "s2", type: "system", icon: "warning", time: "2026-10-02T13:05:00", read: false, title: "Calendar sync needs attention", body: "Reconnect it to keep booked calls flowing into the CRM.", action: { label: "Reconnect", done: "Reconnected" } },
  { id: "m3", type: "mention", time: "2026-10-02T11:20:00", read: true, actor: "Priya Shah", text: "replied to your comment on", target: "October search campaign", body: "“Budget moved. The new ad groups are live.”" },
  { id: "s3", type: "system", icon: "report", time: "2026-10-01T18:00:00", read: false, title: "Weekly report is ready", body: "Harbor & Pine Realty · Week 39" },
  { id: "m4", type: "mention", time: "2026-10-01T15:30:00", read: true, actor: "Maya Chen", text: "mentioned you in", target: "Team chat · #client-wins", body: "“Brightside renewed for another six months.”" },
  { id: "s4", type: "system", icon: "automation", time: "2026-10-01T09:00:00", read: true, title: "Workflow paused", body: "“Missed-call text back” reached its daily limit of 200 messages." },
  { id: "m5", type: "mention", time: "2026-09-29T16:10:00", read: true, actor: "Luis Ortega", text: "shared a file with you:", target: "Q4-proposal.pdf" },
  { id: "s5", type: "system", icon: "integration", time: "2026-09-28T08:00:00", read: true, title: "Integration connected", body: "Spreadsheets sync is now on for Cedar Fitness Co." },
];

/** Samples the demo's "Simulate new notification" button cycles through. */
export const demoSamples: NotificationItem[] = [
  { type: "mention", actor: "Priya Shah", text: "mentioned you in", target: "Cedar Fitness Co. · Ad review", body: "“Two new creatives are ready for your sign-off.”" },
  { type: "system", icon: "payment", title: "Payment received", body: "Harbor & Pine Realty paid invoice #1044 · $2,400" },
  { type: "system", icon: "report", title: "Monthly report is ready", body: "Brightside Dental · September" },
  { type: "mention", actor: "Maya Chen", text: "replied to", target: "Q4 plan", body: "“Target confirmed: under $28 per lead.”" },
];
