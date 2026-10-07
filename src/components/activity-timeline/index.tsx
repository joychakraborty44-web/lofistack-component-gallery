import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { ActivityTimeline, type ActivityTimelineHandle } from "./ActivityTimeline";
import { demoTimeline } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const ref = useRef<ActivityTimelineHandle>(null);
  const [opened, setOpened] = useState<string | null>(null);

  if (mode === "preview") return <ActivityTimeline {...demoTimeline} pageSize={7} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ActivityTimeline ref={ref} {...demoTimeline} pageSize={7} defaultSort="newest" onActivityOpen={d => setOpened(d.title)} />
      <div className="w-full max-w-[980px]">
        <DemoBar
          note={
            <span aria-live="polite">
              {opened
                ? <><b className="font-semibold text-ink">{opened}</b> opened — onActivityOpen fired. Example data, fictional client.</>
                : "Example data — not real client results."}
            </span>
          }
        >
          <DemoButton icon="minus" onClick={() => ref.current?.collapseAll()}>Collapse all</DemoButton>
          <DemoButton icon="arrowDown" onClick={() => ref.current?.expand("a04")}>Open oldest call</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "events", type: "ActivityEvent[]", description: "{ id, type, time, actor?, title?, summary?, details?, note? }. type is call · email · form · deal · note and sets the icon, colour and filter; time is an ISO date-time, events are grouped by day and sorted by it." },
    { name: "events[].details", type: "[label, value][]", description: "Optional pairs shown when the event is opened." },
    { name: "events[].note", type: "string", description: "Optional longer text, shown as a quote when opened." },
    { name: "eyebrow · title · subtitle", type: "string", description: "Optional header text." },
    { name: "now", type: "string", description: "Optional ISO date-time used for “Today”, “Yesterday” and “min ago”, so demos stay stable. Defaults to the current time." },
    { name: "sort · defaultSort", type: "\"newest\" | \"oldest\"", description: "Controlled or initial sort order (default newest). The switch in the header changes it." },
    { name: "filter · defaultFilter", type: "ActivityType[]", description: "Controlled or initial type filter. Empty shows all activity." },
    { name: "pageSize", type: "number", description: "How many events show before “Show more” (default 8)." },
    { name: "typeLabels", type: "Partial<Record<ActivityType, string>>", description: "Rename a type, e.g. { form: \"Form fill\" }." },
    { name: "labels · locale", type: "Partial<ActivityLabels> · string", description: "Override built-in text; date/time locale (default en-US)." },
    { name: "ref", type: "Ref<ActivityTimelineHandle>", description: "expand(id) opens an event (revealing it if filtered out or paged away); collapseAll() closes them all." },
  ],
  usage: `import { ActivityTimeline } from "./components/activity-timeline/ActivityTimeline";

<ActivityTimeline
  title="Brightside Dental"
  now="2026-10-02T16:30:00"
  pageSize={8}
  events={[
    { id: "a19", type: "call", time: "2026-10-02T14:05:00",
      actor: "Luis Ortega", title: "Discovery call",
      summary: "Goals for new-patient bookings.",
      details: [["Duration", "24 min"]] },
  ]}
  onActivityOpen={e => console.log(e.id, e.type, e.title)}
  onFilterChange={types => console.log(types)}
  onSortChange={sort => console.log(sort)}
/>`,
  events: [
    { name: "onActivityOpen({ id, type, title, time, actor })", description: "An event was opened." },
    { name: "onFilterChange(types)", description: "The type filter changed (empty array = all)." },
    { name: "onSortChange(sort)", description: "The newest/oldest switch changed." },
  ],
  notes: [
    "Type chips are multi-select toggle buttons with counts; “All activity” clears the filter. On narrow cards the chips scroll inside their own row.",
    "“Show more” loads the next page and moves focus to the first new event; changes are announced in a polite live region.",
    "Each event is a disclosure button (aria-expanded / aria-controls); the details panel animates its height and is inert while closed.",
  ],
};
