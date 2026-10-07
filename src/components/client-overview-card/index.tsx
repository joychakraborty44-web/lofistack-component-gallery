import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, DemoButton, Segmented } from "../../ui";
import { ClientOverviewCard } from "./ClientOverviewCard";
import { demoClient, type HealthStatus } from "./data";

const HEALTH_OPTIONS: { value: HealthStatus; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "at-risk", label: "At risk" },
  { value: "critical", label: "Critical" },
];

export function Demo({ mode }: { mode: DemoMode }) {
  const [health, setHealth] = useState<HealthStatus>("healthy");
  const [run, setRun] = useState(0);
  const [event, setEvent] = useState<ReactNode>(null);

  if (mode === "preview") return <ClientOverviewCard data={demoClient} />;

  const say = (strong: string, rest: string) => setEvent(<><b className="font-semibold text-ink">{strong}</b> {rest}</>);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ClientOverviewCard key={run} data={demoClient} health={health}
        onNoteAdd={d => say("onNoteAdd", `fired. The client now has ${d.count} notes.`)}
        onFavouriteChange={f => say("onFavouriteChange", f ? "fired. Marked as a favourite." : "fired. Removed from favourites.")}
        onEmailCopy={c => say("onEmailCopy", `fired for ${c.name}.`)} />
      <DemoBar note={<span aria-live="polite">{event ? <>{event} · </> : null}Example data — not real client results.</span>}>
        <ControlGroup label="Health">
          <Segmented size="sm" ariaLabel="Health status" value={health} onChange={setHealth} options={HEALTH_OPTIONS} />
        </ControlGroup>
        <DemoButton icon="refresh" onClick={() => {
          setHealth("healthy");
          setRun(r => r + 1);
          say("Demo reset.", "Notes and favourite are back to the start.");
        }}>Reset demo</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data", type: "ClientData", description: "The client profile: company, initials, industry, location, website, plan, billing, renewal, owner, health, MRR, tenure, last activity, services, opportunities, contacts and notes." },
    { name: "data.health", type: "{ status, score?, note? }", description: "Status is healthy, at-risk or critical. Score is 0–100; the note and a score bar show in Overview." },
    { name: "data.mrr · mrrPrevious · mrrCompareLabel", type: "number · number · string", description: "Monthly recurring revenue and the earlier figure; the change is worked out and labelled “vs {label}”." },
    { name: "data.clientSince · asOf", type: "ISO date", description: "Tenure and “days ago” are counted to asOf (default: today)." },
    { name: "data.opportunities[]", type: "{ name, stage, value, close? }", description: "Open deals with stage ticks. data.stages sets the stage order (default Discovery → Closing)." },
    { name: "data.contacts[]", type: "{ name, role?, email?, phone?, primary? }", description: "People at the client. Each email has a copy button." },
    { name: "data.notes[]", type: "{ author, date, text }", description: "Newest first. data.noteAuthor names who adds new notes (default “You”)." },
    { name: "data.currency · locale", type: "string", description: "ISO currency (default USD) and number/date locale (default en-GB)." },
    { name: "tab · defaultTab", type: "\"overview\" | \"contacts\" | \"notes\"", description: "Controlled or initial tab." },
    { name: "favourite · defaultFavourite", type: "boolean", description: "Controlled or initial favourite star." },
    { name: "health", type: "HealthStatus", description: "Overrides data.health.status." },
  ],
  usage: `import { ClientOverviewCard } from "./components/client-overview-card/ClientOverviewCard";

<ClientOverviewCard
  data={{
    company: "Harbor & Pine Realty",
    plan: "Growth retainer",
    owner: { name: "Maya Okafor" },
    health: { status: "healthy", score: 82 },
    mrr: 4800, mrrPrevious: 4200,
    clientSince: "2024-03-11",
    contacts: [{ name: "Dana Whitfield", email: "dana@harborandpine.example" }],
    notes: [],
  }}
  onNoteAdd={({ note, count }) => saveNote(note)}
  onFavouriteChange={fav => setFavourite(fav)}
/>`,
  events: [
    { name: "onNoteAdd", description: "A note was added (button or Ctrl/⌘ + Enter). Receives { note, count, company }. Notes live in memory — save them here." },
    { name: "onFavouriteChange", description: "The star was toggled. Receives (favourite, company)." },
    { name: "onTabChange", description: "The tab changed. Receives the tab id." },
    { name: "onEmailCopy", description: "A contact’s email was copied. Receives { name, email }." },
  ],
  notes: [
    "Tabs follow the WAI-ARIA pattern: arrow keys, Home and End move between them.",
    "If the clipboard is blocked, the email text is selected instead and the button says “Press Ctrl+C”.",
  ],
};
