/* Revenue Goal Tracker — types + demo data (fictional clients, not real revenue). */

export interface Sale {
  client: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

export interface RevenueGoalData {
  eyebrow?: string;
  title?: string;
  /** Target amount. */
  goal: number;
  /** ISO currency code (default USD). */
  currency?: string;
  /** Money and date locale (default en-US). */
  locale?: string;
  /** First and last day of the goal period, YYYY-MM-DD. Both days count. */
  start: string;
  end: string;
  /** The day progress is measured on (defaults to the real date). */
  today?: string;
  /** Percentages to mark on the meter (default [25, 50, 75, 100]). */
  milestones?: number[];
  sales: Sale[];
  /** How many sales to list (default 4). */
  recent?: number;
}

/** Text with {placeholders}; <b>…</b> marks bold parts (rendered as React nodes, never as HTML). */
export const RGT_LABELS = {
  of: "raised of {goal} goal", dayOf: "Day {n} of {total}", ended: "Period ended", notStarted: "Starts {date}",
  onPace: "On pace", behind: "Behind pace", reached: "Goal reached",
  pace: "Pace today {v}", next: "Next milestone {m}% · {left} to go", allHit: "Every milestone reached",
  behindBy: "{v} behind today's pace", aheadBy: "{v} ahead of today's pace",
  runRate: "Run-rate", current: "Current", needed: "Needed", perDay: "/day",
  verdictBehind: "Raise <b>{need}</b> a day from now on to hit the goal. At today's rate you'd finish near <b>{proj}</b> ({pct}).",
  verdictAhead: "At today's rate you'd finish near <b>{proj}</b> ({pct}). Keep above <b>{need}</b> a day to stay on track.",
  verdictDone: "The goal is met with <b>{days}</b> to spare. Everything from here is extra.",
  daysLeft: "Days left", remaining: "Remaining", projected: "Projected", ofGoal: "{pct} of goal", days: "{n} days", day: "1 day",
  log: "Log a sale", client: "Client", clientPh: "Optional", amount: "Amount", add: "Add sale",
  toNext: "To {m}%", recent: "Recent sales", undo: "Undo last sale", fresh: "New",
  errAmount: "Enter an amount greater than zero.", errBig: "That looks too large. Enter up to {max}.",
  unnamed: "Unnamed sale", toast: "<b>{m}% milestone reached</b> · {v} raised", toastGoal: "<b>Goal reached!</b> {v} raised",
  trend: "Raised vs pace", raisedKey: "Raised", paceKey: "Pace", projKey: "Projection", goalKey: "Goal",
  added: "Added {v}. Total {total}, {pct} of goal.", undone: "Removed {v} from {client}. Total {total}.", close: "Dismiss",
};
export type RgtLabels = typeof RGT_LABELS;

export const demoGoal: RevenueGoalData = {
  eyebrow: "Q3 2026 revenue goal",
  title: "New retainer revenue",
  goal: 120000,
  currency: "USD",
  start: "2026-07-01",
  end: "2026-09-30",
  today: "2026-08-19",
  milestones: [25, 50, 75, 100],
  sales: [
    { client: "Brightside Dental", amount: 4800, date: "2026-07-03" },
    { client: "Cedar Fitness Co.", amount: 2400, date: "2026-07-07" },
    { client: "Harbor & Pine Realty", amount: 6500, date: "2026-07-10" },
    { client: "Maple Street Bakery", amount: 1850, date: "2026-07-14" },
    { client: "Northgate Auto Care", amount: 3200, date: "2026-07-17" },
    { client: "Lumen Yoga Studio", amount: 2250, date: "2026-07-22" },
    { client: "Riverbend Vet Clinic", amount: 5400, date: "2026-07-28" },
    { client: "Oakline Roofing", amount: 7800, date: "2026-08-02" },
    { client: "Summit Physio", amount: 3600, date: "2026-08-05" },
    { client: "Bluebird Florist", amount: 1500, date: "2026-08-09" },
    { client: "Brightside Dental", amount: 4800, date: "2026-08-12" },
    { client: "Cedar Fitness Co.", amount: 2400, date: "2026-08-14" },
    { client: "Harbor & Pine Realty", amount: 6500, date: "2026-08-17" },
    { client: "Greenway Landscaping", amount: 4350, date: "2026-08-18" },
  ],
};
