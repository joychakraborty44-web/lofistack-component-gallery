import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar } from "../../ui";
import { CustomerJourneyMap } from "./CustomerJourneyMap";
import { demoData } from "./data";

const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink">{children}</b>;
const DEFAULT_NOTE: ReactNode = <><B>Example data.</B> Fictional personas, not real client research.</>;

export function Demo({ mode }: { mode: DemoMode }) {
  const [note, setNote] = useState<ReactNode>(DEFAULT_NOTE);

  if (mode === "preview") return <CustomerJourneyMap data={demoData} defaultPersona="sam" />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <CustomerJourneyMap
        data={demoData}
        defaultPersona="sam"
        onStageSelect={d => setNote(d.stage
          ? <><B>{d.label} · {d.mood}</B> · onStageSelect fired. Fictional personas, not real client research.</>
          : <><B>Stage focus cleared.</B> Fictional personas, not real client research.</>)}
        onPersonaChange={d => setNote(<><B>Persona: {d.name}</B> · onPersonaChange fired. Fictional personas, not real client research.</>)}
      />
      <DemoBar note={<span aria-live="polite">{note}</span>} />
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "data.stages[]", type: "{ id, label, tone }", description: "In order. tone is peach, butter, mint, sky or lilac." },
    { name: "data.personas[]", type: "{ id, name, role, summary, stages }", description: "Initials are worked out from the name; color optionally sets the avatar." },
    { name: "…stages.<id>.goal", type: "string", description: "What the customer is trying to do at that stage." },
    { name: "…touchpoints[]", type: "{ label, kind }", description: "kind picks the icon: search, social, review, web, chat, phone, email, sms, visit." },
    { name: "…pains[]", type: "string[]", description: "Short pain-point strings." },
    { name: "…emotion · mood", type: "number · string", description: "A score from −2 (very unhappy) to 2 (very happy), and a one-word feeling." },
    { name: "…opportunity · metric · quote", type: "string · { value, label } · string", description: "Shown in the stage detail card." },
    { name: "defaultPersona · defaultStage", type: "string", description: "Initial persona (default: the first) and focused stage (default: none)." },
  ],
  usage: `import { CustomerJourneyMap } from "./CustomerJourneyMap";

<CustomerJourneyMap
  data={{
    title: "New patient journey",
    stages: [{ id: "awareness", label: "Awareness", tone: "peach" }],
    personas: [{
      id: "sam", name: "Sam Ortiz", role: "First-timer", summary: "Wants clear prices.",
      stages: {
        awareness: {
          goal: "Find a dentist nearby",
          touchpoints: [{ label: "Search ad", kind: "search" }],
          pains: ["Prices are hard to find"],
          emotion: 0, mood: "Curious",
          opportunity: "Show prices in ads.",
          metric: { value: "3.1%", label: "Click-through rate" },
          quote: "What does a check-up cost?",
        },
      },
    }],
  }}
  onStageSelect={d => console.log(d.stage, d.mood)}
/>`,
  events: [
    { name: "onStageSelect", description: "A stage was focused or cleared: { stage, label, index, persona, emotion, mood }." },
    { name: "onPersonaChange", description: "The persona switch changed: { persona, name }." },
  ],
  notes: [
    "Click a stage (or use ← → / Home / End on the stage buttons) to focus it; Esc clears the focus.",
    "Switching persona morphs the emotion curve and the faces' expressions; instant with reduced motion.",
    "Below 768px the stages stack into a vertical sequence with a sentiment meter on each, and the details open inside the focused stage.",
  ],
};
