/* AI Agent Status Panel — types + demo data (simulated agents, not a real system). */

export type AgentStatus = "running" | "idle" | "error" | "paused";
/** Runtime state also includes the transient "restarting". */
export type AgentState = AgentStatus | "restarting";
export type AgentFilter = "all" | AgentStatus;
export type AgentAction = "start" | "pause" | "restart" | "retry";

export interface AgentError {
  code?: string;
  /** Time the error happened, e.g. "14:28". */
  at?: string;
  message: string;
}

export interface AgentInput {
  id: string;
  name: string;
  /** Model label, e.g. "Large model". */
  model?: string;
  status: AgentStatus;
  /** What the agent is working on. */
  task?: string;
  /** Items waiting. */
  queue: number;
  processed: number;
  succeeded: number;
  /** Simulation only: average items per update. */
  load?: number;
  /** Simulation only: share of items that fail (0–1). */
  failRate?: number;
  /** Shown when an error row is opened. */
  error?: AgentError;
}

export interface AgentFleetData {
  path?: string;
  title?: string;
  subtitle?: string;
  /** Makes the simulated updates repeat the same way each time. */
  seed?: number;
  agents: AgentInput[];
}

export const ASP_LABELS = {
  running: "Running", idle: "Idle", error: "Error", paused: "Paused", restarting: "Restarting", all: "All",
  live: "Live", stopped: "Paused", pauseLive: "Pause live updates", resumeLive: "Resume live updates",
  agentsRunning: "Running", queue: "Queue", processed: "Processed", success: "Success", throughput: "Throughput",
  perMin: "/min", task: "Current task", agent: "Agent", actions: "Actions",
  start: "Start", pause: "Pause", restart: "Restart", retry: "Retry now", showError: "Show error", hideError: "Hide error",
  waiting: "Waiting for new work", restartingTask: "Restarting…", filterLabel: "Filter by status",
  hint: "Updates every {s}s", empty: "No agents with this status.", log: "Event log", tick: "tick {n}",
  tickLine: "{n} processed · {f} failed · {q} queued", noWork: "no work processed · {q} queued",
  actionLine: "{name} · {action}", logStart: "started by you", logPause: "paused by you", logRestart: "restart requested", logRetry: "retry requested",
  nowRunning: "{name} picked up new work", nowIdle: "{name} queue empty, now idle",
  restarted: "{name} restarted", failed: "{name} failed: {message}", loaded: "{n} agents loaded",
  announce: "{name} is now {status}.",
};
export type AspLabels = typeof ASP_LABELS;

export const demoFleet: AgentFleetData = {
  path: "studio / agents",
  title: "Agent fleet",
  subtitle: "6 agents · shared workspace",
  seed: 42,
  agents: [
    { id: "agt-01", name: "Lead Qualifier", model: "Large model", status: "running", task: "Scoring new form leads · Brightside Dental", queue: 14, processed: 1286, succeeded: 1262, load: 3, failRate: 0.02 },
    { id: "agt-02", name: "Inbox Triage", model: "Fast model", status: "running", task: "Sorting the support inbox · Cedar Fitness Co.", queue: 31, processed: 2410, succeeded: 2391, load: 4, failRate: 0.01 },
    { id: "agt-03", name: "Ad Copy Writer", model: "Large model", status: "idle", task: "Writing ad variations for the October offer", queue: 0, processed: 148, succeeded: 141, load: 1, failRate: 0.04 },
    {
      id: "agt-04", name: "Appointment Setter", model: "Fast model", status: "error", task: "Booking consultations · Harbor & Pine Realty", queue: 9, processed: 612, succeeded: 577, load: 2, failRate: 0.03,
      error: { code: "409", at: "14:28", message: "Calendar sync rejected the booking. The 2:30 pm slot on 2 Oct is already taken. Stopped after 3 retries." },
    },
    { id: "agt-05", name: "Report Builder", model: "Large model", status: "paused", task: "Weekly report · Harbor & Pine Realty", queue: 3, processed: 88, succeeded: 88, load: 1, failRate: 0 },
    { id: "agt-06", name: "Review Responder", model: "Fast model", status: "running", task: "Drafting replies to new reviews · Cedar Fitness Co.", queue: 6, processed: 734, succeeded: 719, load: 2, failRate: 0.02 },
  ],
};
