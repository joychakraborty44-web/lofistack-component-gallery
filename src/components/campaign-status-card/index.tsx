import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, DemoButton, Segmented } from "../../ui";
import { CampaignStatusCard } from "./CampaignStatusCard";
import { demoDraft, demoLive } from "./data";

type Start = "live" | "draft";
const DEFAULT_NOTE: ReactNode = <><b className="font-semibold text-ink">Example data.</b> Not real client results.</>;

export function Demo({ mode }: { mode: DemoMode }) {
  const [start, setStart] = useState<Start>("live");
  const [run, setRun] = useState(0);
  const [note, setNote] = useState<ReactNode>(DEFAULT_NOTE);

  if (mode === "preview") return <CampaignStatusCard data={demoLive} />;

  const load = (s: Start) => { setStart(s); setRun(r => r + 1); setNote(DEFAULT_NOTE); };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <CampaignStatusCard
        key={`${start}-${run}`}
        data={start === "draft" ? demoDraft : demoLive}
        onStatusChange={d => setNote(<><b className="font-semibold text-ink">{d.from} → {d.to}.</b> The card sent onStatusChange. Example data, not real client results.</>)}
      />
      <DemoBar note={<span aria-live="polite">{note}</span>}>
        <ControlGroup label="Start from">
          <Segmented<Start> size="sm" ariaLabel="Starting state" value={start} onChange={load}
            options={[{ value: "live", label: "Live" }, { value: "draft", label: "Draft" }]} />
        </ControlGroup>
        <DemoButton icon="refresh" onClick={() => load(start)}>Reset demo</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.status", type: '"draft" | "scheduled" | "live" | "paused" | "completed"', description: "Starting state (default: the state implied by the last log entry)." },
    { name: "data.name · client · id", type: "string", description: "Campaign name, client and reference." },
    { name: "data.objective · owner", type: "string", description: "Optional details under the title." },
    { name: "data.today", type: "YYYY-MM-DD", description: "Date used for flight and pacing maths (default: the real date)." },
    { name: "data.flight", type: "{ start, end }", description: "Flight dates, both days included." },
    { name: "data.budget · spent", type: "number", description: "Total budget and spend so far. Pacing compares spend with the budget share expected by today." },
    { name: "data.currency · locale", type: "string", description: "Money format (default USD, en-US)." },
    { name: "data.channels[]", type: "{ name, type, spent, leads }", description: "type picks the glyph: search, social, video, display, email." },
    { name: "data.log[]", type: "{ action, by, at }", description: "Past changes, oldest first. Actions: created, scheduled, launched, paused, resumed, ended." },
    { name: "data.user", type: "string", description: 'Name recorded for changes made in the card (default "you").' },
  ],
  usage: `import { CampaignStatusCard } from "./CampaignStatusCard";

<CampaignStatusCard
  data={{
    name: "Fall Smile Makeover",
    client: "Brightside Dental",
    status: "live",
    today: "2026-10-02",
    flight: { start: "2026-09-22", end: "2026-10-21" },
    budget: 12000, spent: 4520,
    channels: [{ name: "Search Ads", type: "search", spent: 2080, leads: 61 }],
    log: [{ action: "launched", by: "Scheduler", at: "2026-09-22T09:00" }],
  }}
  onStatusChange={({ from, to, action, by, at }) => save({ from, to, action, by, at })}
/>`,
  events: [
    { name: "onStatusChange", description: "Fires after every move with { from, to, action, by, at } (at is an ISO timestamp)." },
  ],
  notes: [
    "Allowed moves: Draft → Scheduled or Live; Scheduled → Live; Live ⇄ Paused; any started state → Completed (asks to confirm first).",
    "Launching before the planned start moves the flight start to today. Ending records the day it ended.",
    "The End dialog is a native modal: focus is trapped, Esc keeps the campaign running and focus returns to the button.",
  ],
};
