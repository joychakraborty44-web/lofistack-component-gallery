import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, DemoButton, Segmented } from "../../ui";
import { AiUsageAnalytics, type AiUsageAnalyticsHandle, type UsageFilter } from "./AiUsageAnalytics";
import { demoUsage } from "./data";

type Quota = "300000000" | "400000000" | "600000000";

export function Demo({ mode }: { mode: DemoMode }) {
  const ref = useRef<AiUsageAnalyticsHandle>(null);
  const [quota, setQuota] = useState<Quota>("400000000");
  const [last, setLast] = useState<UsageFilter | null>(null);

  if (mode === "preview") return <AiUsageAnalytics {...demoUsage} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AiUsageAnalytics ref={ref} {...demoUsage} quota={+quota} onFilterChange={setLast} />
      <div className="w-full max-w-[1100px]">
        <DemoBar
          note={
            <span aria-live="polite">
              {last
                ? <><b className="font-semibold text-ink">onFilterChange</b> fired: {last.metric}, {last.range} days, {last.model ? `${last.model} only` : "all models"}. Example data, not a real bill.</>
                : <><b className="font-semibold text-ink">Example data.</b> Generic model tiers and made-up prices, not a real bill.</>}
            </span>
          }
        >
          <ControlGroup label="Monthly quota">
            <Segmented<Quota>
              ariaLabel="Monthly token quota" size="sm" value={quota} onChange={setQuota}
              options={[{ value: "300000000", label: "300M" }, { value: "400000000", label: "400M" }, { value: "600000000", label: "600M" }]}
            />
          </ControlGroup>
          <DemoButton icon="refresh" onClick={() => ref.current?.replay()}>Replay animation</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "metric · defaultMetric", type: "\"tokens\" | \"requests\" | \"cost\"", description: "Controlled or initial measure (default tokens)." },
    { name: "range · defaultRange", type: "14 | 30", description: "Controlled or initial number of days shown, ending on asOf (default 30)." },
    { name: "model · defaultModel", type: "string | null", description: "A model id to show alone; null shows all." },
    { name: "models", type: "{ id, label, pricePerMillion }[]", description: "In stack order, bottom first. Up to three." },
    { name: "series", type: "Record<id, { tokens: number[]; requests: number[] }>", description: "One number per day from start." },
    { name: "start · asOf", type: "string", description: "ISO dates of the first and last day in the series." },
    { name: "billingStart", type: "string", description: "ISO date the billing month began. Quota and cost count from here." },
    { name: "quota", type: "number", description: "Monthly token allowance." },
    { name: "budget", type: "number", description: "Optional monthly spend limit for the cost estimate." },
    { name: "currency · locale", type: "string", description: "ISO currency (default USD) and number locale (default en-US)." },
    { name: "eyebrow · title · source", type: "string", description: "Optional header and footer text." },
    { name: "labels", type: "Partial<UsageLabels>", description: "Override any built-in text." },
    { name: "ref", type: "Ref<AiUsageAnalyticsHandle>", description: "isolate(id | null) and replay()." },
  ],
  usage: `import { AiUsageAnalytics } from "./components/ai-usage-analytics/AiUsageAnalytics";

<AiUsageAnalytics
  start="2026-08-26" asOf="2026-09-24"
  billingStart="2026-09-01"
  quota={400_000_000} budget={300}
  models={[{ id: "large", label: "Large model", pricePerMillion: 6 }]}
  series={{ large: { tokens: [1003000 /* … */], requests: [932 /* … */] } }}
  defaultMetric="tokens"
  defaultRange={30}
  onFilterChange={({ metric, range, model }) => console.log(metric, range, model)}
/>`,
  events: [
    { name: "onFilterChange({ metric, range, model })", description: "Every metric, range or isolated-model change." },
  ],
  notes: [
    "Cost is tokens ÷ 1,000,000 × pricePerMillion. Month-end figures assume the daily rate so far holds for the rest of the billing month.",
    "Focus the chart and use the left/right arrow keys (Home/End) to step through days; Escape hides the tooltip. Each step is announced, and a hidden table holds the same numbers for screen readers.",
    "Legend chips are toggle buttons: select one to show that model alone, select it again to show all. Bars restack smoothly on every change.",
  ],
};
