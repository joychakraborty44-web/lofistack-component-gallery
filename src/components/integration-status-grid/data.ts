/* Types + demo data for the Integration Status Grid. */

export type IntegrationStatus = "connected" | "warning" | "disconnected";
export type IntegrationIcon = "crm" | "card" | "calendar" | "mail" | "sms" | "chat" | "sheet" | "hub" | "plug";
export type IntegrationFilter = "all" | IntegrationStatus;

export interface SyncHistoryEntry {
  minutesAgo: number;
  result: "ok" | "fail";
  events?: number;
  note?: string;
}

export interface Integration {
  id: string;
  name: string;
  /** Built-in glyph (falls back to `plug`). */
  icon?: IntegrationIcon;
  description?: string;
  status: IntegrationStatus;
  /** What is wrong (shown on warning / disconnected tiles). */
  issue?: string;
  /** Whether a sync or a reconnect clears the issue. */
  fix?: "sync" | "reconnect";
  /** Minutes since the last good sync. Shown as relative time and kept up to date. */
  lastSyncMinutes?: number;
  /** Events handled since midnight. */
  eventsToday?: number;
  /** Events per hour for the last 12 hours, oldest first. */
  activity?: number[];
  account?: string;
  connectedSince?: string;
  interval?: string;
  scopes?: string[];
  history?: SyncHistoryEntry[];
}

export interface IntegrationGridData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footnote?: string;
  integrations: Integration[];
}

export const demoIntegrations: IntegrationGridData = {
  eyebrow: "Integrations",
  title: "Connected tools",
  subtitle: "Harbor & Pine Realty workspace",
  footnote: "Events are counted since midnight, workspace time.",
  integrations: [
    { id: "crm", name: "CRM", icon: "crm", description: "Contacts, deals and pipelines", status: "connected",
      lastSyncMinutes: 4, eventsToday: 1284, interval: "Every 5 min", account: "ops@harborpine.example", connectedSince: "Mar 2025",
      scopes: ["Read and write contacts", "Read deals and pipelines", "Create notes and tasks"],
      activity: [62, 88, 104, 131, 97, 120, 142, 118, 96, 110, 121, 95] },
    { id: "payments", name: "Payments", icon: "card", description: "Invoices and card payments", status: "connected",
      lastSyncMinutes: 11, eventsToday: 86, interval: "Every 15 min", account: "billing@harborpine.example", connectedSince: "Jan 2025",
      scopes: ["Read invoices", "Read payments and refunds"],
      activity: [4, 6, 9, 7, 11, 8, 5, 9, 10, 6, 7, 4] },
    { id: "calendar", name: "Calendar sync", icon: "calendar", description: "Showings and booked calls", status: "warning",
      issue: "Sync delayed. The last attempt timed out.", fix: "sync",
      lastSyncMinutes: 47, eventsToday: 142, interval: "Every 10 min", account: "agents@harborpine.example", connectedSince: "Feb 2025",
      scopes: ["Read and write calendar events", "Read free / busy"],
      activity: [9, 14, 12, 18, 16, 21, 15, 19, 11, 7, 0, 0],
      history: [
        { minutesAgo: 7, result: "fail", note: "Timed out after 30 s" },
        { minutesAgo: 27, result: "fail", note: "Timed out after 30 s" },
        { minutesAgo: 47, result: "ok", events: 11 },
      ] },
    { id: "email", name: "Email delivery", icon: "mail", description: "Campaign and one-to-one email", status: "connected",
      lastSyncMinutes: 2, eventsToday: 3410, interval: "Live", account: "mail.harborpine.example", connectedSince: "Nov 2024",
      scopes: ["Send email", "Read opens, clicks and bounces"],
      activity: [210, 260, 340, 410, 380, 290, 330, 360, 300, 270, 250, 230] },
    { id: "sms", name: "SMS gateway", icon: "sms", description: "Text messages and replies", status: "disconnected",
      issue: "Sign-in expired. Reconnect to resume texts.", fix: "reconnect",
      lastSyncMinutes: 1560, eventsToday: 0, interval: "Live", account: "Main office number", connectedSince: "Apr 2025",
      scopes: ["Send and receive SMS", "Read delivery receipts"],
      activity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      history: [
        { minutesAgo: 1500, result: "fail", note: "Sign-in expired" },
        { minutesAgo: 1560, result: "ok", events: 23 },
      ] },
    { id: "chat", name: "Team chat", icon: "chat", description: "Alerts to team channels", status: "connected",
      lastSyncMinutes: 6, eventsToday: 412, interval: "Live", account: "Harbor & Pine team", connectedSince: "Dec 2024",
      scopes: ["Post to selected channels"],
      activity: [18, 25, 31, 42, 37, 29, 40, 44, 36, 33, 41, 36] },
    { id: "sheets", name: "Spreadsheets", icon: "sheet", description: "Weekly listing export", status: "warning",
      issue: "Access expires in 3 days. Reconnect to renew it.", fix: "reconnect",
      lastSyncMinutes: 112, eventsToday: 38, interval: "Every hour", account: "listings@harborpine.example", connectedSince: "May 2025",
      scopes: ["Read and write one spreadsheet"],
      activity: [3, 4, 2, 5, 3, 4, 6, 3, 4, 4, 0, 0] },
    { id: "hub", name: "Automation hub", icon: "hub", description: "Workflows and webhooks", status: "connected",
      lastSyncMinutes: 1, eventsToday: 926, interval: "Live", account: "12 active workflows", connectedSince: "Nov 2024",
      scopes: ["Run workflows", "Receive webhooks"],
      activity: [58, 71, 80, 92, 77, 69, 85, 90, 74, 81, 88, 61] },
  ],
};
