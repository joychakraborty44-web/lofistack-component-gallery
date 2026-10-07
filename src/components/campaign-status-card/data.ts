/* Types, lifecycle rules and demo data for the Campaign Status Card. */

export type CampaignStatus = "draft" | "scheduled" | "live" | "paused" | "completed";
export type CampaignAction = "schedule" | "launch" | "pause" | "resume" | "end";
export type LogVerb = "created" | "scheduled" | "launched" | "paused" | "resumed" | "ended";
export type ChannelType = "search" | "social" | "video" | "display" | "email";

export interface CampaignChannel { name: string; type: ChannelType; spent: number; leads: number }
export interface CampaignLogEntry { action: LogVerb; by: string; /** "YYYY-MM-DDTHH:mm" (local) or ISO */ at: string }

export interface CampaignData {
  id?: string;
  name: string;
  client?: string;
  objective?: string;
  owner?: string;
  status?: CampaignStatus;
  /** Date used for flight and pacing maths, YYYY-MM-DD (default: the real date). */
  today?: string;
  flight?: { start: string; end: string };
  budget: number;
  spent: number;
  currency?: string;
  locale?: string;
  channels: CampaignChannel[];
  /** Past changes, oldest first. */
  log: CampaignLogEntry[];
  /** Name recorded for changes made in the card (default "you"). */
  user?: string;
}

export interface StatusChangeDetail { from: CampaignStatus; to: CampaignStatus; action: CampaignAction; by: string; at: string }

export const STEPS: CampaignStatus[] = ["draft", "scheduled", "live", "paused", "completed"];
export const STATE_LABEL: Record<CampaignStatus, string> = { draft: "Draft", scheduled: "Scheduled", live: "Live", paused: "Paused", completed: "Completed" };
export const ACTIONS: Record<CampaignAction, { label: string; from: CampaignStatus[]; to: CampaignStatus; verb: LogVerb; confirm?: boolean }> = {
  schedule: { label: "Schedule", from: ["draft"], to: "scheduled", verb: "scheduled" },
  launch: { label: "Launch now", from: ["draft", "scheduled"], to: "live", verb: "launched" },
  pause: { label: "Pause", from: ["live"], to: "paused", verb: "paused" },
  resume: { label: "Resume", from: ["paused"], to: "live", verb: "resumed" },
  end: { label: "End campaign", from: ["scheduled", "live", "paused"], to: "completed", verb: "ended", confirm: true },
};
export const ACTION_ORDER: CampaignAction[] = ["schedule", "launch", "pause", "resume", "end"];
export const VERB_STATE: Record<LogVerb, CampaignStatus> = { created: "draft", scheduled: "scheduled", launched: "live", paused: "paused", resumed: "live", ended: "completed" };
export const VERB_LABEL: Record<LogVerb, string> = { created: "Created", scheduled: "Scheduled", launched: "Launched", paused: "Paused", resumed: "Resumed", ended: "Ended" };
export const PRIMARY: Partial<Record<CampaignStatus, CampaignAction>> = { draft: "schedule", scheduled: "launch", live: "pause", paused: "resume" };
export const HINTS: Record<CampaignStatus, string> = {
  draft: "Drafts can be scheduled for the planned start date or launched straight away.",
  scheduled: "Goes live automatically on the start date. You can launch it early or cancel it.",
  live: "Delivering now. Pause to stop spend for a while, or end the campaign.",
  paused: "Spend is on hold. Resume to pick up where it left off, or end the campaign.",
  completed: "This campaign has ended. No more changes can be made.",
};
export const CH_STATE: Record<CampaignStatus, string> = { draft: "Not started", scheduled: "Waiting to start", live: "Delivering", paused: "Paused", completed: "Ended" };

export const demoLive: CampaignData = {
  id: "CMP-2041",
  name: "Fall Smile Makeover",
  client: "Brightside Dental",
  objective: "Lead generation",
  owner: "Maya Ortiz",
  status: "live",
  today: "2026-10-02",
  flight: { start: "2026-09-22", end: "2026-10-21" },
  budget: 12000,
  spent: 4520,
  currency: "USD",
  channels: [
    { name: "Search Ads", type: "search", spent: 2080, leads: 61 },
    { name: "Social Ads", type: "social", spent: 1690, leads: 79 },
    { name: "Video Ads", type: "video", spent: 750, leads: 12 },
  ],
  log: [
    { action: "created", by: "Maya Ortiz", at: "2026-09-14T10:12" },
    { action: "scheduled", by: "Maya Ortiz", at: "2026-09-18T16:40" },
    { action: "launched", by: "Scheduler", at: "2026-09-22T09:00" },
  ],
};

/** The "Start from: Draft" demo: same campaign, not yet scheduled. */
export const demoDraft: CampaignData = {
  ...demoLive,
  status: "draft",
  spent: 0,
  flight: { start: "2026-10-06", end: "2026-11-04" },
  channels: demoLive.channels.map(c => ({ ...c, spent: 0, leads: 0 })),
  log: [{ action: "created", by: "Maya Ortiz", at: "2026-09-29T14:05" }],
};
