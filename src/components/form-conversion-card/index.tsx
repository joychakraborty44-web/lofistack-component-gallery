import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar } from "../../ui";
import { FormConversionCard } from "./FormConversionCard";
import { valuationForm } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const [event, setEvent] = useState("");
  if (mode === "preview") return <FormConversionCard data={valuationForm} />;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <FormConversionCard data={valuationForm}
        onDeviceChange={d => setEvent(`onDeviceChange · ${d}`)}
        onFieldSelect={d => setEvent(d ? `onFieldSelect · ${d.label} · ${d.device}${d.dropRate != null ? ` (${(d.dropRate * 100).toFixed(1)}% left here)` : ""}` : "onFieldSelect · cleared")} />
      <div className="grid w-full max-w-[980px] gap-2">
        <DemoBar note="Example data — not real client results." />
        <p aria-live="polite" className="min-h-[1.2em] font-mono text-[11.5px] text-ink-3">{event}</p>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.steps[]", type: "FormStep[]", description: "{ id, label, type } in order. type is view, start, field or submit. Only field steps appear as inputs and can be the worst field." },
    { name: "data.segments.<key>", type: "DeviceSegment", description: "{ label, counts, avgSeconds? }. counts has one number per step: how many people reached and completed it. Every rate is worked out from these." },
    { name: "data.form", type: "{ title, button }", description: "Text for the mini form." },
    { name: "data.tips.<stepId>", type: "string", description: "Suggestion shown when that field is the worst. {rate}, {lost} and {field} are filled in." },
    { name: "data.eyebrow · title · subtitle · period", type: "string", description: "Optional header text and the footer date range." },
    { name: "device / defaultDevice", type: "string", description: "Controlled or starting segment key (all, desktop, mobile)." },
    { name: "defaultSuggestionsOpen", type: "boolean", description: "Start with the suggestions panel open." },
    { name: "labels · locale", type: "Partial<FormConversionLabels> · string", description: "Override built-in text, and the number locale (default en-US)." },
  ],
  usage: `import { FormConversionCard } from "./components/form-conversion-card/FormConversionCard";

<FormConversionCard
  data={{
    title: "Home valuation request",
    form: { title: "Book a valuation", button: "Send" },
    steps: [
      { id: "views", label: "Form views", type: "view" },
      { id: "email", label: "Email", type: "field" },
      { id: "submitted", label: "Submitted", type: "submit" },
    ],
    segments: { all: { label: "All devices", counts: [900, 410, 380] } },
    tips: { email: "{rate} leave at Email." },
  }}
  onFieldSelect={d => d && console.log(d.label, d.dropRate)}
/>`,
  events: [
    { name: "onFieldSelect", description: "A bar or a mini-form field was selected: { id, label, type, device, count, reached, lost, dropRate, worst }. Clicking it again clears the selection (null)." },
    { name: "onDeviceChange", description: "The device switch changed." },
  ],
  notes: [
    "Hovering or focusing a bar lights up the matching field in the mini form, and the other way round.",
    "The suggested gain is an estimate: the worst field at the average pass rate of the other fields, the rest of the form unchanged.",
  ],
};
