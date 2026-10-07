import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { AppointmentPipeline } from "./AppointmentPipeline";
import { demoPipeline } from "./data";

const STATUS_NAME: Record<string, string> = { booked: "booked", confirmed: "confirmed", showed: "showed", noshow: "no-show" };

export function Demo({ mode }: { mode: DemoMode }) {
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState<{ strong: string; rest: string } | null>(null);
  const pipeline = (
    <AppointmentPipeline key={version} eyebrow={demoPipeline.eyebrow} title={demoPipeline.title} subtitle={demoPipeline.subtitle}
      today={demoPipeline.today} days={demoPipeline.days} source={demoPipeline.source}
      onDayChange={mode === "page" ? d => setNote({ strong: "onDayChange", rest: `fired: ${d}.` }) : undefined}
      onAppointmentUpdate={mode === "page" ? d => setNote(d.action === "status"
        ? { strong: "onAppointmentUpdate", rest: `fired: ${d.appointment.name} moved from ${STATUS_NAME[d.from!]} to ${STATUS_NAME[d.to!]}.` }
        : { strong: "onAppointmentUpdate", rest: `fired: reminder sent to ${d.appointment.name}.` }) : undefined} />
  );
  if (mode === "preview") return pipeline;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      {pipeline}
      <DemoBar note="Example data — not real client results.">
        <span aria-live="polite" className="max-w-[48ch] font-mono text-[11.5px] text-ink-3">
          {note ? <><b className="font-semibold text-ink">{note.strong}</b> {note.rest}</> : "Open an appointment to move it or send a reminder."}
        </span>
        <DemoButton icon="refresh" onClick={() => { setVersion(v => v + 1); setNote(null); }}>Reset demo</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "days", type: "AppointmentDay[]", description: "{ date: 'YYYY-MM-DD', appointments: Appointment[] }. Weekday and date labels are worked out from the date; appointments are sorted by time inside each lane." },
    { name: "days[].appointments[]", type: "Appointment", description: "{ id, time ('HH:MM', 24-hour), duration (minutes), name, service, staff, status, reminded?, source?, phone?, note? }. status is 'booked' | 'confirmed' | 'showed' | 'noshow'." },
    { name: "today", type: "string", description: "YYYY-MM-DD. Marks that day with a Today tag and opens it first." },
    { name: "day · defaultDay", type: "string", description: "The day to show. Pass day to control it, or defaultDay to start somewhere else (defaults to today, then the first day)." },
    { name: "eyebrow · title · subtitle · source", type: "string", description: "Optional header text and footer note." },
    { name: "labels · locale", type: "Partial<AppointmentPipelineLabels> · string", description: "Override built-in text, and the locale for dates (default en-US)." },
    { name: "ref", type: "Ref<AppointmentPipelineHandle>", description: "Imperative handle: setStatus(id, status) and remind(id)." },
  ],
  usage: `import { AppointmentPipeline } from "./AppointmentPipeline";

<AppointmentPipeline
  title="Downtown studio"
  today="2026-09-30"
  days={[
    { date: "2026-09-30", appointments: [
      { id: "c06", time: "17:30", duration: 45, name: "Mia Thompson",
        service: "Intro session", staff: "Omar Baker", status: "booked" },
    ] },
  ]}
  onAppointmentUpdate={d => save(d.id, d.appointment)}
  onDayChange={day => setUrlDay(day)}
/>`,
  events: [
    { name: "onAppointmentUpdate(detail)", description: "An appointment moved lane or got a reminder. detail = { action: 'status' | 'reminder', id, day, appointment, from?, to?, reminded? }. Bulk reminders fire once per appointment." },
    { name: "onDayChange(day)", description: "A different day was picked (click or arrow keys)." },
  ],
  notes: [
    "Show rate = showed ÷ (showed + no-shows), for the whole week and for the selected day.",
    "Day picker: arrow keys / Home / End. Open an appointment for its details; Esc closes it and returns focus.",
  ],
};
