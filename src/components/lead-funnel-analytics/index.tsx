import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, DemoButton, Segmented } from "../../ui";
import { LeadFunnel, type LeadFunnelHandle } from "./LeadFunnel";
import { demoFunnel, type FunnelScale } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const [scale, setScale] = useState<FunnelScale>("sqrt");
  const ref = useRef<LeadFunnelHandle>(null);

  if (mode === "preview") return <LeadFunnel {...demoFunnel} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <LeadFunnel ref={ref} {...demoFunnel} scale={scale} />
      <div className="w-full max-w-[960px]">
        <DemoBar note="Example data — not real client results.">
          <ControlGroup label="Bar scale">
            <Segmented
              ariaLabel="Bar scale" size="sm" value={scale} onChange={setScale}
              options={[{ value: "sqrt", label: "Square root" }, { value: "linear", label: "Linear" }]}
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
    { name: "stages", type: "{ label: string; count: number }[]", description: "Stages in funnel order. Two or more; four is typical. Every rate is worked out from these counts." },
    { name: "eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "period", type: "string", description: "Optional date-range text, shown top right." },
    { name: "compare", type: "{ label: string; stages: number[] }", description: "Optional earlier period (same length as stages). Adds a change in points to the overall rate, e.g. “▲ 0.4 pts vs last quarter”." },
    { name: "source", type: "string", description: "Optional footer note, e.g. where the data comes from." },
    { name: "scale", type: "\"sqrt\" | \"linear\"", description: "sqrt (default) keeps small stages readable; linear draws bars exactly to scale. Bars and flows morph when it changes." },
    { name: "labels", type: "Partial<LeadFunnelLabels>", description: "Override any built-in text, e.g. { overall: \"Win rate\" }." },
    { name: "locale", type: "string", description: "Number formatting locale (default en-US)." },
    { name: "ref", type: "Ref<LeadFunnelHandle>", description: "Imperative handle: replay() re-runs the entrance animation." },
  ],
  usage: `import { LeadFunnel, type LeadFunnelHandle } from "./components/lead-funnel-analytics/LeadFunnel";

const funnel = useRef<LeadFunnelHandle>(null);

<LeadFunnel
  ref={funnel}
  title="Inbound pipeline"
  period="1 Jul – 30 Sep 2026"
  scale="sqrt"
  stages={[
    { label: "Visitors", count: 8640 },
    { label: "Leads", count: 1296 },
    { label: "Booked", count: 544 },
    { label: "Converted", count: 196 },
  ]}
  compare={{ label: "last quarter", stages: [7910, 1107, 432, 147] }}
  onActiveStageChange={(i, stage) => console.log(i, stage)}
/>

funnel.current?.replay(); // re-run the entry animation`,
  events: [
    { name: "onActiveStageChange(index, stage)", description: "A stage was hovered or focused (null when the pointer/focus leaves the funnel)." },
  ],
  notes: [
    "Each stage is compared with the one before it (step rate), with the first stage (share) and overall. The summary picks out the biggest drop-off and the strongest step automatically.",
    "Hover or focus a stage to highlight it: the others dim and its rate chip expands to show how many moved on and how many dropped.",
    "Every stage is a focusable list item with a full sentence for screen readers; the visual bars are hidden from assistive tech.",
  ],
};
