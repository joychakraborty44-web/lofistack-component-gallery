import { useRef, useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { RevenueGrowthChart, type RevenueGrowthChartHandle } from "./RevenueGrowthChart";
import { demoRevenue } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const chart = useRef<RevenueGrowthChartHandle>(null);
  const [event, setEvent] = useState<ReactNode>(null);

  if (mode === "preview") return <RevenueGrowthChart data={demoRevenue} defaultRange="12m" defaultCompare />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <RevenueGrowthChart ref={chart} data={demoRevenue} defaultRange="12m" defaultCompare
        onRangeChange={d => setEvent(<><b className="font-semibold text-ink">Range: {d.range.toUpperCase()}</b> · onRangeChange fired (growth {d.growth == null ? "n/a" : `${(d.growth * 100).toFixed(1)}%`}).</>)}
        onViewChange={d => setEvent(<><b className="font-semibold text-ink">Compare {d.compare ? "on" : "off"} · cumulative {d.cumulative ? "on" : "off"}</b> · onViewChange fired.</>)} />
      <DemoBar note={<span aria-live="polite">{event ? <>{event} </> : null}Example data — not real client results.</span>}>
        <DemoButton icon="refresh" onClick={() => chart.current?.replay()}>Replay animation</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.series[]", type: "{ month: \"YYYY-MM\", revenue, lastYear? }", description: "Monthly revenue, oldest first. lastYear is the same month a year earlier — used for growth figures and the dashed line." },
    { name: "data.eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "data.currency · locale", type: "string", description: "ISO currency (default USD) and number/date locale (default en-US)." },
    { name: "data.source", type: "string", description: "Optional footer note." },
    { name: "range · defaultRange", type: "\"6m\" | \"12m\"", description: "Controlled or initial range (default 12m). Switching pans the chart to the new window." },
    { name: "compare · defaultCompare", type: "boolean", description: "Show last year as a dashed line with a legend entry." },
    { name: "cumulative · defaultCumulative", type: "boolean", description: "Draw a running total instead of monthly values." },
    { name: "ref", type: "Ref<RevenueGrowthChartHandle>", description: "ref.current.replay() re-runs the line-draw animation." },
  ],
  usage: `import { RevenueGrowthChart } from "./components/revenue-growth-chart/RevenueGrowthChart";

<RevenueGrowthChart
  data={{
    title: "Membership revenue",
    currency: "USD",
    series: [
      { month: "2026-08", revenue: 47900, lastYear: 36200 },
      { month: "2026-09", revenue: 52400, lastYear: 38900 },
    ],
  }}
  defaultRange="12m"
  defaultCompare
  onRangeChange={({ range, total, growth }) => track(range, growth)}
/>`,
  events: [
    { name: "onRangeChange", description: "The range changed. Receives { range, total, growth } for the new window." },
    { name: "onViewChange", description: "A toggle changed. Receives { compare, cumulative }." },
  ],
  notes: [
    "The total, growth, latest month and averages are worked out from the series.",
    "Focus the chart and use ← → (Home / End) to read each month; values are announced. Escape hides the crosshair. A hidden table carries every value for screen readers.",
    "On narrow containers the tooltip becomes a readout bar pinned above the chart.",
  ],
};
