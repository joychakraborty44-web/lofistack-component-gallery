import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { RevenueGoalTracker, type GoalProgressDetail } from "./RevenueGoalTracker";
import { demoGoal } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const [run, setRun] = useState(0);
  const [last, setLast] = useState<GoalProgressDetail | null>(null);

  if (mode === "preview") return <RevenueGoalTracker data={demoGoal} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <RevenueGoalTracker key={run} data={demoGoal} onProgress={setLast} />
      <div className="w-full max-w-[1000px]">
        <DemoBar note={
          <span aria-live="polite">
            {last && <><b className="font-semibold text-ink">{last.kind === "undo" ? "Undone" : "Sale logged"} · {last.pct}% of goal.</b> onProgress fired{last.crossed.length ? ` (crossed ${last.crossed.join("%, ")}%)` : ""}. </>}
            Example data — not real client results. Fictional clients.
          </span>
        }>
          <DemoButton icon="refresh" onClick={() => { setRun(r => r + 1); setLast(null); }}>Reset demo</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.goal", type: "number", description: "Target amount." },
    { name: "data.start · end", type: "string", description: "First and last day of the goal period, YYYY-MM-DD. Both days count." },
    { name: "data.today", type: "string?", description: "The day progress is measured on (defaults to the real date, kept inside the period)." },
    { name: "data.sales[]", type: "{ client, amount, date }", description: "Amount raised is the sum of these." },
    { name: "data.milestones", type: "number[]", description: "Percentages to mark on the meter (default [25, 50, 75, 100])." },
    { name: "data.eyebrow · title", type: "string?", description: "Optional header text." },
    { name: "data.currency · locale", type: "string", description: "Money and date formatting (default USD, en-US)." },
    { name: "data.recent", type: "number", description: "How many sales to list (default 4)." },
    { name: "labels", type: "Partial<RgtLabels>", description: "Override any built-in text. <b>…</b> marks bold parts." },
    { name: "ref", type: "Ref<RevenueGoalTrackerHandle>", description: "addSale({ client?, amount, date? }), undo() and the current raised total." },
  ],
  usage: `import { useRef } from "react";
import { RevenueGoalTracker, type RevenueGoalTrackerHandle } from "./components/revenue-goal-tracker/RevenueGoalTracker";

const tracker = useRef<RevenueGoalTrackerHandle>(null);

<RevenueGoalTracker
  ref={tracker}
  data={{
    title: "New retainer revenue",
    goal: 120000,
    start: "2026-07-01", end: "2026-09-30",
    sales: [{ client: "Brightside Dental", amount: 4800, date: "2026-07-03" }],
  }}
  onProgress={d => console.log(d.kind, d.raised, d.pct, d.crossed)}
/>

tracker.current?.addSale({ client: "Summit Physio", amount: 3600 });
tracker.current?.undo();`,
  events: [
    { name: "onProgress", description: "Every added or undone sale: { kind, raised, goal, pct, sale, crossed }. Crossing a milestone also shows a toast and, unless reduced motion is on, a small confetti burst." },
  ],
  notes: [
    "Run-rate is the amount raised divided by the days so far. Needed is what is left divided by the days left. Projected is the current run-rate across the whole period.",
    "The form validates the amount (above zero, up to 10,000,000); quick-fill chips include the exact gap to the next milestone.",
    "Undo removes sales added in this session only, newest first.",
  ],
};
