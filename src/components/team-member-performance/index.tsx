import { useMemo, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { TeamPerformance } from "./TeamPerformance";
import { DEMO_TEAM } from "./data";

type Size = "5" | "8";

export function Demo({ mode }: { mode: DemoMode }) {
  const [size, setSize] = useState<Size>("8");
  const [event, setEvent] = useState("");
  const data = useMemo(() => ({ ...DEMO_TEAM, members: DEMO_TEAM.members.slice(0, +size) }), [size]);
  if (mode === "preview") return <TeamPerformance data={DEMO_TEAM} />;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <TeamPerformance data={data} defaultMetric="revenue" defaultPeriod="week"
        onMemberSelect={d => setEvent(`${d.name} · #${d.rank} ${d.expanded ? "opened" : "closed"}. The card fired onMemberSelect.`)}
        onMetricChange={d => setEvent(`onMetricChange fired: ${d.metric} · ${d.period}.`)}
        onPeriodChange={d => setEvent(`onPeriodChange fired: ${d.period}.`)} />
      <div className="w-full max-w-[1040px]">
        <DemoBar note={<>Example data — not real client results.{event && <span className="ml-1.5 text-ink-2" aria-live="polite">{event}</span>}</>}>
          <ControlGroup label="Team size">
            <Segmented<Size> ariaLabel="Team size" size="sm" value={size} onChange={setSize}
              options={[{ value: "5", label: "5 people" }, { value: "8", label: "8 people" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data", type: "TeamData", description: "{ eyebrow?, title?, team?, currency? (USD), locale? (en-US), footnote?, periods, members }." },
    { name: "data.periods.<key>", type: "{ label, range?, compare?, axis? }", description: "One entry per period (e.g. week, month). axis names the trend points, oldest first." },
    { name: "data.members[]", type: "{ id, name, role?, periods }", description: "Initials and avatar colour are made from the name and id." },
    { name: "members[].periods.<key>", type: "{ deals, revenue, calls, response, target? }", description: "Arrays oldest first: the last value is the current period, the one before it the previous period (used for the ▲▼ rank change). Response is minutes; lower is better." },
    { name: "…target", type: "{ deals, revenue, calls, response }", description: "Targets for that period. Response is a maximum." },
    { name: "metric · defaultMetric", type: `"deals" | "revenue" | "calls" | "response"`, description: "Controlled or initial ranking metric (default revenue)." },
    { name: "period · defaultPeriod", type: "string", description: "Controlled or initial period key (default: the first key of periods)." },
    { name: "className", type: "string", description: "Extra classes for the outer element (max width 1040px)." },
  ],
  usage: `import { TeamPerformance } from "./TeamPerformance";

<TeamPerformance
  data={{
    title: "Team performance",
    periods: { week: { label: "This week", compare: "last week", axis: ["W38", "W39"] } },
    members: [
      { id: "mo", name: "Maya Okafor", periods: { week: {
        deals: [6, 5], revenue: [14750, 11250], calls: [60, 68], response: [14, 16],
        target: { revenue: 12000 } } } },
    ],
  }}
  defaultMetric="revenue"
  onMemberSelect={d => console.log(d.id, d.rank, d.expanded)}
/>`,
  events: [
    { name: "onMemberSelect", description: "{ id, name, rank, metric, period, value, expanded } — a podium card or list row was opened or closed." },
    { name: "onMetricChange", description: "{ metric, period } — the Rank by switch changed." },
    { name: "onPeriodChange", description: "{ period } — the period switch changed." },
  ],
  notes: [
    "Ties are broken by revenue, then by name. rankMembers(data, metric, period) is exported if you need the same ranking elsewhere.",
    "On phones the podium becomes three stacked cards and the list shows only the ranking metric; every figure is still in the opened detail.",
  ],
};
