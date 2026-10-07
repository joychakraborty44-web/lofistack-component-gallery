import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { WeeklyMarketingReport, type WeeklyMarketingReportHandle } from "./WeeklyMarketingReport";
import { cedarFitness } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const ref = useRef<WeeklyMarketingReportHandle>(null);
  const [event, setEvent] = useState("");
  if (mode === "preview") return <WeeklyMarketingReport data={cedarFitness} defaultWeek={38} />;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <WeeklyMarketingReport ref={ref} data={cedarFitness} defaultWeek={38}
        onWeekChange={d => setEvent(`onWeekChange · Week ${d.week} (${d.range})`)}
        onChecklistToggle={d => setEvent(`onChecklistToggle · ${d.done ? "ticked" : "unticked"} “${d.text}”`)}
        onSummaryCopy={d => setEvent(`onSummaryCopy · Week ${d.week}, ${d.text.length} characters`)} />
      <div className="grid w-full max-w-[960px] gap-2">
        <DemoBar note="Example data — not real client results.">
          <DemoButton icon="refresh" onClick={() => { ref.current?.resetChecklists(); setEvent("Checklists reset"); }}>Reset checklists</DemoButton>
        </DemoBar>
        <p aria-live="polite" className="min-h-[1.2em] font-mono text-[11.5px] text-ink-3">{event}</p>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.publication · client", type: "string", description: "Masthead title (last word set in red) and the client name." },
    { name: "data.desk · preparedBy", type: "string", description: "Optional text for the top line and the footer." },
    { name: "data.currency · locale", type: "string", description: "Money format (default USD, en-US)." },
    { name: "data.weeks[]", type: "ReportWeek[]", description: "{ week, range, issue?, headline, lead, prior?, channels, highlights, lowlights, next }." },
    { name: "weeks[].channels[]", type: "ReportChannel[]", description: "{ name, spend, leads, booked }. The four key figures, cost per lead and booking rate are all worked out from these rows." },
    { name: "weeks[].prior", type: "ReportPrior", description: "Optional { label, spend, leads, booked } to compare the first week against. Later weeks compare with the week before." },
    { name: "weeks[].next[]", type: "ReportChecklistItem[]", description: "{ text, done? } checklist for the following week. Ticks are kept per week while switching." },
    { name: "week / defaultWeek", type: "number", description: "Controlled or starting week number (default: the last week)." },
    { name: "labels", type: "Partial<ReportLabels>", description: "Override any built-in text." },
    { name: "ref", type: "Ref<WeeklyMarketingReportHandle>", description: "resetChecklists(), copySummary(), summaryText()." },
  ],
  usage: `import { WeeklyMarketingReport } from "./components/weekly-marketing-report/WeeklyMarketingReport";

<WeeklyMarketingReport
  data={{
    publication: "Weekly Marketing Report",
    client: "Cedar Fitness Co.",
    weeks: [{
      week: 38, range: "14–20 Sep 2026",
      headline: "Newsletter lifts leads",
      lead: "Leads reached 200…",
      channels: [{ name: "Search Ads", spend: 1310, leads: 58, booked: 17 }],
      highlights: ["…"], lowlights: ["…"],
      next: [{ text: "Launch the new form" }],
    }],
  }}
  onWeekChange={({ week }) => console.log(week)}
/>`,
  events: [
    { name: "onWeekChange", description: "{ week, range, index } — from the week buttons, the arrows or ←/→ on the week switcher." },
    { name: "onChecklistToggle", description: "{ week, index, text, done } when a checklist item is ticked or unticked." },
    { name: "onSummaryCopy", description: "{ week, text } after the plain-text summary reaches the clipboard. If the browser blocks it, the text is shown selected in a box instead." },
  ],
  notes: [
    "Print uses a print stylesheet scoped to the report: only the sheet prints, in black on white, without the toolbar.",
    "On narrow containers the channel table becomes labelled rows.",
  ],
};
