import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { CampaignPerformance, type CampaignDayPoint } from "./CampaignPerformance";
import { demoCampaign, type CampaignStatus } from "./data";

type Goal = "Leads" | "Purchases";

export function Demo({ mode }: { mode: DemoMode }) {
  const [status, setStatus] = useState<CampaignStatus>("active");
  const [goal, setGoal] = useState<Goal>("Leads");
  const [day, setDay] = useState<CampaignDayPoint | null>(null);

  if (mode === "preview") return <CampaignPerformance {...demoCampaign} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <CampaignPerformance {...demoCampaign} status={status} resultLabel={goal} onDayFocus={setDay} />
      <div className="w-full max-w-[1000px]">
        <DemoBar note={<>Example data — not real client results.{day && <span className="ml-1 text-ink-2 tabular">onDayFocus: {day.label} · {day.value} {goal.toLowerCase()}</span>}</>}>
          <ControlGroup label="Status">
            <Segmented size="sm" ariaLabel="Preview status" value={status} onChange={setStatus}
              options={[{ value: "active", label: "Active" }, { value: "learning", label: "Learning" }, { value: "paused", label: "Paused" }, { value: "ended", label: "Ended" }]} />
          </ControlGroup>
          <ControlGroup label="Goal">
            <Segmented size="sm" ariaLabel="Preview result type" value={goal} onChange={setGoal}
              options={[{ value: "Leads", label: "Leads" }, { value: "Purchases", label: "Purchases" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "name · platform", type: "string", description: "Campaign name and ad platform. The platform's first letter becomes its mark." },
    { name: "status", type: '"active" | "learning" | "paused" | "ended"', description: "Lifecycle status shown on the hero. Any other string shows as a neutral pill." },
    { name: "start · end", type: "string", description: "Date range, YYYY-MM-DD. The day count and chart axis are worked out from it." },
    { name: "spend · currency", type: "number · string", description: "Total spend; any ISO currency code (default USD)." },
    { name: "results · resultLabel", type: "number · string", description: "Lead or conversion count, and what to call it (default \"Conversions\")." },
    { name: "cost · costLabel", type: "number? · string?", description: "Optional. Worked out as spend ÷ results. Shown as CPL for leads, CPA otherwise." },
    { name: "ctr · roas", type: "number", description: "CTR in percent (1.84 = 1.84%); ROAS as a multiple (4.2 = 4.2×). Revenue is spend × ROAS." },
    { name: "series", type: "number[]", description: "Daily results for the chart, oldest first, starting on start." },
    { name: "deltas", type: "{ spend?, results?, cost?, ctr?, roas? }", description: "Optional % change vs the previous period. A lower CPL/CPA shows as good." },
    { name: "className", type: "string", description: "Extra classes for the root element." },
  ],
  usage: `import { CampaignPerformance } from "./components/campaign-performance/CampaignPerformance";

<CampaignPerformance
  name="Autumn Lead Gen — Retargeting"
  platform="Meta Ads"
  status="active"
  start="2026-09-01" end="2026-09-24"
  spend={12480} currency="USD"
  results={386} resultLabel="Leads"
  ctr={1.84} roas={4.2}
  series={[9, 11, 10, 13 /* … one value per day */]}
  deltas={{ spend: 6, results: 14.3, cost: -7.3, ctr: 3.9, roas: 9.8 }}
  onDayFocus={day => console.log(day?.label, day?.value)}
/>`,
  events: [
    { name: "onDayFocus", description: "Called with { index, label, value } when a day is highlighted in the chart (hover, touch or arrow keys), and with null when the highlight clears." },
  ],
  notes: [
    "Revenue is worked out as spend × ROAS; the break-even marker sits where revenue equals spend.",
    "The chart is keyboard-steppable: focus it, then use ← → Home End (Esc clears). A visually hidden table carries every daily value.",
    "Every value is a prop, so the card re-renders live when data changes.",
  ],
};
