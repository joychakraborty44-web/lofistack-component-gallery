import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, DemoButton, Segmented } from "../../ui";
import { LeadSourceBreakdown, type LeadSourceBreakdownHandle } from "./LeadSourceBreakdown";
import { q2, q3 } from "./data";

type Quarter = "q2" | "q3";

export function Demo({ mode }: { mode: DemoMode }) {
  const [quarter, setQuarter] = useState<Quarter>("q3");
  const [event, setEvent] = useState("");
  const ref = useRef<LeadSourceBreakdownHandle>(null);
  const d = quarter === "q2" ? q2 : q3;
  const props = { sources: d.sources, eyebrow: d.eyebrow, title: d.title, period: d.period, currency: d.currency, footnote: d.source };

  if (mode === "preview") return <LeadSourceBreakdown {...props} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <LeadSourceBreakdown ref={ref} {...props}
        onSourceToggle={e => setEvent(`onSourceToggle · ${e.label} is now ${e.visible ? "shown" : "hidden"}; ${e.visibleIds.length} sources visible`)}
        onMetricChange={m => setEvent(`onMetricChange · showing ${m === "cpl" ? "cost per lead" : m}`)} />
      <div className="grid w-full max-w-[960px] gap-2">
        <DemoBar note="Example data — not real client results.">
          <ControlGroup label="Quarter">
            <Segmented<Quarter> size="sm" ariaLabel="Quarter" value={quarter} onChange={setQuarter}
              options={[{ value: "q2", label: "Q2" }, { value: "q3", label: "Q3" }]} />
          </ControlGroup>
          <DemoButton icon="refresh" onClick={() => ref.current?.replay()}>Replay animation</DemoButton>
        </DemoBar>
        <p aria-live="polite" className="min-h-[1.2em] font-mono text-[11.5px] text-ink-3">{event}</p>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "sources", type: "LeadSource[]", description: "{ id, label, leads, revenue, spend, hidden? }. Up to six; any more are folded into \"Other\". hidden starts that source hidden." },
    { name: "metric / defaultMetric", type: "\"leads\" | \"revenue\" | \"cpl\"", description: "Controlled or starting measure (default leads). In Cost per lead the ring shows each source's share of spend and the centre shows the blended cost per lead (total spend ÷ total leads)." },
    { name: "eyebrow · title · period", type: "string", description: "Optional header text." },
    { name: "currency · locale", type: "string", description: "ISO currency (default USD) and number locale (default en-US)." },
    { name: "footnote", type: "string", description: "Optional footer note, e.g. where the data comes from." },
    { name: "labels", type: "Partial<LeadSourceLabels>", description: "Override any built-in text, e.g. { leads: \"Enquiries\" }." },
    { name: "ref", type: "Ref<LeadSourceBreakdownHandle>", description: "toggleSource(id, visible?), showAll(), replay(), visibleSources()." },
  ],
  usage: `import { LeadSourceBreakdown } from "./components/lead-source-breakdown/LeadSourceBreakdown";

<LeadSourceBreakdown
  title="Where leads came from"
  period="Q3 2026"
  sources={[
    { id: "search", label: "Paid search", leads: 412, revenue: 58400, spend: 14420 },
    { id: "email", label: "Email", leads: 118, revenue: 17300, spend: 590 },
  ]}
  onSourceToggle={({ id, visible }) => console.log(id, visible)}
/>`,
  events: [
    { name: "onSourceToggle", description: "A source was hidden or shown: { id, label, visible, visibleIds }. Show all fires once per source it brings back." },
    { name: "onMetricChange", description: "The Leads / Revenue / Cost per lead switch changed." },
  ],
  notes: [
    "Colour follows the source, not its rank. The six slots are a colour-blind-checked order, with separate light and dark values.",
    "Hidden sources drop out of the ring and the totals; the visible shares are re-rounded to add up to exactly 100.0%. At least one source always stays visible.",
    "Arrow keys / Home / End step through ring segments, Escape clears the highlight; the legend is a real table.",
  ],
};
