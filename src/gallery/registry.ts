import type { ComponentType } from "react";

/* ------------------------------------------------------------
   The 30 components: metadata for the gallery + a lazy loader per
   component so each page ships only its own code.
   ------------------------------------------------------------ */

export type DemoMode = "page" | "preview";

export interface ComponentDocs {
  /** Props / data fields the component accepts. */
  fields: { name: string; type?: string; description: string }[];
  /** A short, copyable usage example (TSX). */
  usage: string;
  /** Callbacks the component exposes. */
  events?: { name: string; description: string }[];
  notes?: string[];
}

/** What every component folder's index.tsx must export. */
export interface ComponentModule {
  /** "page": component + demo controls; "preview": component only, timers paused (homepage thumbnail). */
  Demo: ComponentType<{ mode: DemoMode }>;
  docs: ComponentDocs;
}

export type CategoryId = "analytics" | "ads" | "crm" | "ai" | "seo" | "ops" | "sales";
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "analytics", label: "Analytics" },
  { id: "ads", label: "Ads & Campaigns" },
  { id: "crm", label: "CRM & Clients" },
  { id: "ai", label: "AI & Automation" },
  { id: "seo", label: "SEO" },
  { id: "ops", label: "Operations" },
  { id: "sales", label: "Sales & Reporting" },
];

export interface ComponentMeta {
  num: number;
  slug: string;
  title: string;
  /** short label for menus */
  nav: string;
  category: CategoryId;
  description: string;
  tags: string[];
}

export const COMPONENTS: ComponentMeta[] = [
  {
    num: 1,
    slug: "agent-log-card",
    title: "Agent Log Card",
    nav: "Agent Log",
    category: "ai",
    description: "A record of one AI-agent task, shaped like a ticket stub. The prompt sits above the perforation and the result below it, with the agent, task type, date and status alongside.",
    tags: [
      "Copy & expand",
      "3 statuses"
    ]
  },
  {
    num: 2,
    slug: "campaign-performance",
    title: "Campaign Performance Snapshot",
    nav: "Campaign Performance",
    category: "ads",
    description: "Ad performance at a glance. ROAS is set against spend, next to spend, leads, CPL/CPA and CTR, with a daily results chart you can hover.",
    tags: [
      "No dependencies",
      "Hoverable chart"
    ]
  },
  {
    num: 3,
    slug: "pricing-comparison",
    title: "Pricing Comparison Card",
    nav: "Pricing",
    category: "sales",
    description: "Three plans side by side, with a monthly / yearly switch and one highlighted plan. Prices change smoothly when you switch, and every plan, price and feature comes from editable JSON.",
    tags: [
      "Monthly / yearly",
      "Typed data"
    ]
  },
  {
    num: 4,
    slug: "lead-funnel-analytics",
    title: "Lead Funnel Analytics",
    nav: "Lead Funnel",
    category: "analytics",
    description: "Visitors to leads to booked calls to sales. Each stage shows its count and conversion rate, and a summary picks out the overall rate and the biggest drop-off.",
    tags: [
      "Auto-calculated rates",
      "Typed data"
    ]
  },
  {
    num: 5,
    slug: "kpi-metrics-dashboard",
    title: "KPI Metrics Dashboard",
    nav: "KPI Dashboard",
    category: "analytics",
    description: "Six headline numbers in a bento grid, each with its change against the previous period and a sparkline. Switch between 7, 30 and 90 days, read any chart point by point, and click a tile to pin it into the large slot.",
    tags: [
      "Period switch",
      "Sparkline tooltips",
      "Pin to hero"
    ]
  },
  {
    num: 6,
    slug: "ai-prompt-card",
    title: "AI Prompt Card",
    nav: "AI Prompt",
    category: "ai",
    description: "A saved prompt shown like a file in a code editor, with version tabs and highlighted variables. Fill in the variables, preview the finished prompt with a rough token count, and copy it in one click.",
    tags: [
      "Version tabs",
      "Live variables",
      "Copy to clipboard"
    ]
  },
  {
    num: 7,
    slug: "client-overview-card",
    title: "Client Overview Card",
    nav: "Client Overview",
    category: "crm",
    description: "A CRM profile for one client: health, monthly revenue, tenure and open pipeline at a glance. Switch tabs to see account details, copy a contact’s email or add a note.",
    tags: [
      "Accessible tabs",
      "Notes",
      "Copy to clipboard"
    ]
  },
  {
    num: 8,
    slug: "task-progress-board",
    title: "Task Progress Board",
    nav: "Task Board",
    category: "ops",
    description: "A kanban board with four columns, live column counts and a progress bar. Drag cards between columns, move them with the arrow keys or the Move menu, and filter by assignee.",
    tags: [
      "Drag and drop",
      "Keyboard moves",
      "Assignee filter"
    ]
  },
  {
    num: 9,
    slug: "ad-creative-performance",
    title: "Ad Creative Performance",
    nav: "Ad Creatives",
    category: "ads",
    description: "A gallery of ad creatives with format badges and results. Sort by CTR, CPA, spend or conversions, filter by format, and compare two creatives head to head.",
    tags: [
      "Sort & filter",
      "Head-to-head compare",
      "Generated artwork"
    ]
  },
  {
    num: 10,
    slug: "seo-ranking-tracker",
    title: "SEO Ranking Tracker",
    nav: "SEO Rankings",
    category: "seo",
    description: "Tracked keywords with this week's position, weekly change, best position, search volume and an eight-week rank sparkline. Sort any column, search, filter by rank or movement, and open a row for its full history chart.",
    tags: [
      "Sortable table",
      "Sparklines",
      "Search & filters"
    ]
  },
  {
    num: 11,
    slug: "conversion-rate-card",
    title: "Conversion Rate Card",
    nav: "Conversion Rate",
    category: "analytics",
    description: "A gold-on-charcoal gauge that shows the conversion rate against its target for each channel. Drag the what-if slider to see how many more conversions would close the gap.",
    tags: [
      "SVG gauge",
      "What-if slider"
    ]
  },
  {
    num: 12,
    slug: "activity-timeline",
    title: "Activity Timeline",
    nav: "Activity Timeline",
    category: "crm",
    description: "Calls, emails, form fills, deal changes and notes on a client account, grouped by day on a vertical timeline. Filter by type, open an event for its details, flip the order and load older activity.",
    tags: [
      "Type filters",
      "Expandable events",
      "Show more"
    ]
  },
  {
    num: 13,
    slug: "campaign-status-card",
    title: "Campaign Status Card",
    nav: "Campaign Status",
    category: "ads",
    description: "A campaign's lifecycle from draft to completed, with flight-date progress, budget pacing and channels. Launch, pause, resume or end it: only valid moves are allowed, ending asks to confirm, and every change is logged.",
    tags: [
      "State machine",
      "Confirm dialog",
      "Activity log"
    ]
  },
  {
    num: 14,
    slug: "lead-source-breakdown",
    title: "Lead Source Breakdown",
    nav: "Lead Sources",
    category: "analytics",
    description: "A donut and legend table showing where leads come from, by leads, revenue or cost per lead. Hide a source and the other shares add back up to 100%.",
    tags: [
      "SVG donut",
      "Colour-blind-safe palette",
      "Keyboard chart"
    ]
  },
  {
    num: 15,
    slug: "revenue-growth-chart",
    title: "Revenue Growth Chart",
    nav: "Revenue Growth",
    category: "analytics",
    description: "Monthly revenue as an area chart with the total and growth against last year. Switch between 6 and 12 months, add last year as a dashed line, or show a running total.",
    tags: [
      "SVG chart",
      "Crosshair tooltip",
      "Keyboard stepping"
    ]
  },
  {
    num: 16,
    slug: "appointment-pipeline",
    title: "Appointment Pipeline",
    nav: "Appointments",
    category: "crm",
    description: "A week of bookings shown one day at a time, in Booked, Confirmed, Showed and No-show lanes. Move appointments between lanes and send reminders while the show rate updates.",
    tags: [
      "Day tabs",
      "Status lanes",
      "Live show rate"
    ]
  },
  {
    num: 17,
    slug: "workflow-automation-card",
    title: "Workflow Automation Card",
    nav: "Workflow Automation",
    category: "ai",
    description: "An automation drawn as a node graph on a blueprint grid: trigger, if / else branches, actions and a wait. Switch it on or off, open any step's settings, and watch a test contact run through it step by step with a timed log.",
    tags: [
      "Node graph",
      "SVG connectors",
      "Test run"
    ]
  },
  {
    num: 18,
    slug: "ai-agent-status-panel",
    title: "AI Agent Status Panel",
    nav: "AI Agents",
    category: "ai",
    description: "An ops console for a team of AI agents with live status, queue, success rate and throughput. Start, pause or restart agents, filter by status and retry errors.",
    tags: [
      "Live updates",
      "Status filters"
    ]
  },
  {
    num: 19,
    slug: "notification-center",
    title: "Notification Center",
    nav: "Notifications",
    category: "ops",
    description: "A bell with an unread badge that opens a panel of mentions and system alerts. Switch tabs, open an item to mark it read, dismiss what you don't need or mark everything read at once.",
    tags: [
      "Popover panel",
      "Tabs",
      "Unread badge"
    ]
  },
  {
    num: 20,
    slug: "client-health-score",
    title: "Client Health Score",
    nav: "Client Health",
    category: "crm",
    description: "A 0–100 health dial with a Healthy / At risk / Critical band, built from five weighted factors. Drag the weight sliders and the score recalculates live, or switch to 90 days ago to compare.",
    tags: [
      "Radial dial",
      "Weight sliders",
      "Period compare"
    ]
  },
  {
    num: 21,
    slug: "ad-spend-budget-tracker",
    title: "Ad Spend Budget Tracker",
    nav: "Ad Budget",
    category: "ads",
    description: "Monthly ad spend per channel against today’s ideal pace, with projected month-end spend and over/under warnings. Edit a budget inline and the projections update.",
    tags: [
      "Pacing bars",
      "Inline editing",
      "Sortable"
    ]
  },
  {
    num: 22,
    slug: "form-conversion-card",
    title: "Form Conversion Card",
    nav: "Form Conversion",
    category: "analytics",
    description: "A mini form next to field-by-field completion bars, with the field that loses the most people highlighted in both. Switch devices and open a suggestion for the worst field.",
    tags: [
      "Linked highlight",
      "Device switch",
      "Drop-off analysis"
    ]
  },
  {
    num: 23,
    slug: "seo-audit-scorecard",
    title: "SEO Audit Scorecard",
    nav: "SEO Audit",
    category: "seo",
    description: "A site audit shown as a report card: a letter grade, four category scores and issues grouped by severity. Mark issues as fixed to see the grade recompute, then re-run the audit.",
    tags: [
      "Score rings",
      "Severity filters",
      "Recomputing grade"
    ]
  },
  {
    num: 24,
    slug: "integration-status-grid",
    title: "Integration Status Grid",
    nav: "Integrations",
    category: "ops",
    description: "Eight connected tools with a status light, last sync time, events today and hourly activity. Filter by status, sync one or all, reconnect a dropped tool, and open a details drawer with permissions and sync history.",
    tags: [
      "Status tiles",
      "Simulated sync",
      "Details drawer"
    ]
  },
  {
    num: 25,
    slug: "team-member-performance",
    title: "Team Member Performance",
    nav: "Team Performance",
    category: "ops",
    description: "A sales leaderboard with a top-three podium and a ranked list. Rank by deals, revenue, calls or response time, and open a person to see their trend and targets.",
    tags: [
      "Animated sort",
      "Trend sparklines"
    ]
  },
  {
    num: 26,
    slug: "revenue-goal-tracker",
    title: "Revenue Goal Tracker",
    nav: "Revenue Goal",
    category: "sales",
    description: "Progress toward a revenue goal with milestones, today's pace, and the daily run-rate you have against the one you need. Log a sale and every number updates, with a small celebration when you pass a milestone.",
    tags: [
      "Milestones",
      "Run-rate",
      "Log a sale"
    ]
  },
  {
    num: 27,
    slug: "webhook-event-monitor",
    title: "Webhook Event Monitor",
    nav: "Webhooks",
    category: "ops",
    description: "A developer log of webhook deliveries arriving live, with status, method, endpoint and latency. Filter by status class or event name, inspect headers and a highlighted JSON payload, and replay a failed delivery.",
    tags: [
      "Live stream",
      "JSON inspector",
      "Replay"
    ]
  },
  {
    num: 28,
    slug: "ai-usage-analytics",
    title: "AI Usage Analytics",
    nav: "AI Usage",
    category: "ai",
    description: "Daily AI usage stacked by model tier as tokens, requests or cost, with a monthly quota ring and a month-end cost estimate. Isolate a model or switch between 14 and 30 days.",
    tags: [
      "Stacked bar chart",
      "Quota ring",
      "Keyboard chart"
    ]
  },
  {
    num: 29,
    slug: "customer-journey-map",
    title: "Customer Journey Map",
    nav: "Customer Journey",
    category: "crm",
    description: "Five journey stages with goals, touchpoints, pain points and an emotion curve. Switch between three personas and focus a stage to see its opportunity, a key number and a quote.",
    tags: [
      "Persona switcher",
      "Emotion curve",
      "Responsive swimlanes"
    ]
  },
  {
    num: 30,
    slug: "weekly-marketing-report",
    title: "Weekly Marketing Report",
    nav: "Weekly Report",
    category: "sales",
    description: "A one-page weekly report laid out like a newspaper, with key figures, highlights, a channel table and a checklist. Switch weeks, copy a plain-text summary or print it.",
    tags: [
      "Print stylesheet",
      "Copy summary"
    ]
  }
];

export const loaders: Record<string, () => Promise<ComponentModule>> = {
  "agent-log-card": () => import("../components/agent-log-card"),
  "campaign-performance": () => import("../components/campaign-performance"),
  "pricing-comparison": () => import("../components/pricing-comparison"),
  "lead-funnel-analytics": () => import("../components/lead-funnel-analytics"),
  "kpi-metrics-dashboard": () => import("../components/kpi-metrics-dashboard"),
  "ai-prompt-card": () => import("../components/ai-prompt-card"),
  "client-overview-card": () => import("../components/client-overview-card"),
  "task-progress-board": () => import("../components/task-progress-board"),
  "ad-creative-performance": () => import("../components/ad-creative-performance"),
  "seo-ranking-tracker": () => import("../components/seo-ranking-tracker"),
  "conversion-rate-card": () => import("../components/conversion-rate-card"),
  "activity-timeline": () => import("../components/activity-timeline"),
  "campaign-status-card": () => import("../components/campaign-status-card"),
  "lead-source-breakdown": () => import("../components/lead-source-breakdown"),
  "revenue-growth-chart": () => import("../components/revenue-growth-chart"),
  "appointment-pipeline": () => import("../components/appointment-pipeline"),
  "workflow-automation-card": () => import("../components/workflow-automation-card"),
  "ai-agent-status-panel": () => import("../components/ai-agent-status-panel"),
  "notification-center": () => import("../components/notification-center"),
  "client-health-score": () => import("../components/client-health-score"),
  "ad-spend-budget-tracker": () => import("../components/ad-spend-budget-tracker"),
  "form-conversion-card": () => import("../components/form-conversion-card"),
  "seo-audit-scorecard": () => import("../components/seo-audit-scorecard"),
  "integration-status-grid": () => import("../components/integration-status-grid"),
  "team-member-performance": () => import("../components/team-member-performance"),
  "revenue-goal-tracker": () => import("../components/revenue-goal-tracker"),
  "webhook-event-monitor": () => import("../components/webhook-event-monitor"),
  "ai-usage-analytics": () => import("../components/ai-usage-analytics"),
  "customer-journey-map": () => import("../components/customer-journey-map"),
  "weekly-marketing-report": () => import("../components/weekly-marketing-report"),
};

export const bySlug = (slug: string) => COMPONENTS.find(c => c.slug === slug);
