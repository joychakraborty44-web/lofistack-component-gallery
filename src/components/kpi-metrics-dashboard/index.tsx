import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { KpiMetricsDashboard } from "./KpiMetricsDashboard";
import { demoData } from "./data";

const INITIAL_HERO = "revenue";
const DEFAULT_NOTE: ReactNode = <><b className="font-semibold text-ink">Example data.</b> Not real client results.</>;

export function Demo({ mode }: { mode: DemoMode }) {
  const [hero, setHero] = useState(INITIAL_HERO);
  const [note, setNote] = useState<ReactNode>(DEFAULT_NOTE);

  if (mode === "preview") return <KpiMetricsDashboard data={demoData} defaultPeriod="30d" defaultHero={INITIAL_HERO} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <KpiMetricsDashboard
        data={demoData}
        defaultPeriod="30d"
        hero={hero}
        onSelect={d => {
          setHero(d.id);
          setNote(<><b className="font-semibold text-ink">{d.label} · {d.period.toUpperCase()}</b> pinned. The dashboard sent onSelect. Example data, not real client results.</>);
        }}
      />
      <DemoBar note={<span aria-live="polite">{note}</span>}>
        <DemoButton icon="refresh" onClick={() => { setHero(INITIAL_HERO); setNote(DEFAULT_NOTE); }}>Reset layout</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data", type: "KpiData", description: "Header text, end date, periods and metrics (see below)." },
    { name: "period / defaultPeriod", type: "string", description: "Controlled or initial period id (default: the first period)." },
    { name: "hero / defaultHero", type: "string", description: "Controlled or initial id of the metric in the large slot (default: the first visible metric)." },
    { name: "data.eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "data.end", type: "YYYY-MM-DD", description: "Last day of the data. Used for the date range and point labels." },
    { name: "data.periods[]", type: "{ id, label, days, bucket }", description: "bucket is the number of days in each sparkline point (1 = daily)." },
    { name: "data.metrics[].format", type: '"int" | "currency" | "currency2" | "percent"', description: "How values are formatted (currency2 = two decimals)." },
    { name: "data.metrics[].series", type: "Record<period, number[]>", description: "Per period, the value of each point. The tile value is their sum." },
    { name: "data.metrics[].previous", type: "Record<period, number>", description: "Per period, the total for the period before. Drives the change badge and the hero's previous-average line." },
    { name: "data.metrics[].ratio", type: "{ of, per }", description: "Two other metric ids. The value is of ÷ per for every point and for the total." },
    { name: "data.metrics[].better", type: '"up" | "down"', description: "Whether a rise is shown as good (default) or bad." },
    { name: "data.metrics[].hidden", type: "boolean", description: "Keeps a metric out of the grid (e.g. spend, only used by a ratio)." },
    { name: "data.currency · locale · source", type: "string", description: "Number formatting and an optional footer note." },
  ],
  usage: `import { KpiMetricsDashboard } from "./KpiMetricsDashboard";

<KpiMetricsDashboard
  data={{
    end: "2026-09-30",
    periods: [{ id: "7d", label: "7D", days: 7, bucket: 1 }],
    metrics: [
      { id: "leads", label: "Leads", format: "int",
        series: { "7d": [27, 25, 18, 19, 27, 28, 29] }, previous: { "7d": 167 } },
      { id: "spend", label: "Ad spend", format: "currency", hidden: true,
        series: { "7d": [604, 710, 632, 675, 633, 650, 638] }, previous: { "7d": 4546 } },
      { id: "cpl", label: "Cost per lead", format: "currency2",
        better: "down", ratio: { of: "spend", per: "leads" } },
    ],
  }}
  defaultHero="leads"
  onSelect={d => console.log(d.id, d.value, d.previous)}
  onPeriodChange={p => console.log(p)}
/>`,
  events: [
    { name: "onSelect", description: "A tile was pinned into the large slot: { id, label, period, value, previous }." },
    { name: "onPeriodChange", description: "The period switch changed: receives the period id." },
  ],
  notes: [
    "Focus a sparkline and use the arrow keys, Home and End to read each point; Enter on a small tile's chart pins it.",
    "Switching period tweens every number and morphs each sparkline; pinning animates tiles into their new slots. Both are instant with reduced motion.",
    "The hero tile adds gridlines, a previous-period average line, high / low points and axis labels.",
  ],
};
