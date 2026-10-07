import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { ConversionRateCard } from "./ConversionRateCard";
import { demoConversion } from "./data";

type TargetChoice = "channel" | "4.5" | "5.5";

export function Demo({ mode }: { mode: DemoMode }) {
  const [target, setTarget] = useState<TargetChoice>("channel");
  const [note, setNote] = useState<ReactNode>(null);

  if (mode === "preview") return <ConversionRateCard {...demoConversion} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ConversionRateCard {...demoConversion}
        targetOverride={target === "channel" ? null : Number(target)}
        onChannelChange={d => setNote(<><b className="font-semibold text-ink">{d.label} selected.</b> onChannelChange fired.</>)}
        onWhatIfChange={d => setNote(<><b className="font-semibold text-ink">What-if: {d.conversions.toLocaleString("en-US")} conversions.</b> onWhatIfChange fired.</>)} />
      <div className="w-full max-w-[960px]">
        <DemoBar note={<span aria-live="polite">{note ? <>{note} Example data — not real client results.</> : "Example data — not real client results."}</span>}>
          <ControlGroup label="Target">
            <Segmented<TargetChoice> size="sm" ariaLabel="Target override" value={target} onChange={setTarget}
              options={[{ value: "channel", label: "Per channel" }, { value: "4.5", label: "4.5%" }, { value: "5.5", label: "5.5%" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "channels", type: "ChannelInput[]", description: "{ id, label, visitors, conversions, target?, previous? } per channel. Every rate is worked out from the counts." },
    { name: "channels[].target", type: "number", description: "Target rate in percent for this channel (falls back to target)." },
    { name: "channels[].previous", type: "{ visitors, conversions }", description: "Previous-period counts. Adds the change in points (\"▲ 0.12 pts vs Aug\")." },
    { name: "target", type: "number", description: "Target rate in percent for the combined All view and any channel without its own." },
    { name: "targetOverride", type: "number | null", description: "Overrides every channel's target (the demo's 4.5% / 5.5% switch)." },
    { name: "max", type: "number", description: "Top of the gauge scale in percent. Worked out from the data if left out." },
    { name: "channel / defaultChannel", type: "string", description: "Controlled or starting channel id; \"all\" is the combined view (default)." },
    { name: "showAll", type: "boolean", description: "Set false to hide the combined All view." },
    { name: "eyebrow · title · client · period · compareLabel", type: "string", description: "Header text, the meta line and the previous-period name." },
    { name: "labels · locale", type: "Partial<ConversionLabels> · string", description: "Override any built-in text; number locale (default en-US)." },
  ],
  usage: `import { ConversionRateCard } from "./components/conversion-rate-card/ConversionRateCard";

<ConversionRateCard
  title="Visitor to booked consultation"
  period="1–30 Sep 2026"
  target={4.8}
  channels={[
    { id: "organic", label: "Organic", visitors: 6420, conversions: 244, target: 4.0 },
    { id: "paid", label: "Paid", visitors: 4180, conversions: 196 },
  ]}
  onChannelChange={({ channel, rate }) => console.log(channel, rate)}
  onWhatIfChange={({ conversions, gap }) => console.log(conversions, gap)}
/>`,
  events: [
    { name: "onChannelChange(detail)", description: "A channel was picked (switch or row): { channel, label, rate, target, visitors, conversions }." },
    { name: "onWhatIfChange(detail)", description: "The slider was released, or Set to target / Reset used: { channel, conversions, actual, rate, target, gap }." },
  ],
  notes: [
    "The gauge panel stays charcoal in both themes; the needle and arc move on a spring, the rate counts to its new value.",
    "During a what-if the actual rate stays marked on the dial and the panel switches to a gold What-if state.",
  ],
};
