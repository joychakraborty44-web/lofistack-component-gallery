import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { IntegrationStatusGrid, type IntegrationGridHandle } from "./IntegrationStatusGrid";
import { demoIntegrations } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const grid = useRef<IntegrationGridHandle>(null);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const el = (
    <IntegrationStatusGrid key={version} ref={grid} eyebrow={demoIntegrations.eyebrow} title={demoIntegrations.title}
      subtitle={demoIntegrations.subtitle} footnote={demoIntegrations.footnote} integrations={demoIntegrations.integrations}
      onSync={mode === "page" ? d => setNote(d.action === "reconnect" ? `${d.name} reconnected.` : `${d.name} synced, ${d.eventsAdded} new events.`) : undefined} />
  );
  if (mode === "preview") return el;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      {el}
      <DemoBar note="Example data — not real client results.">
        <span aria-live="polite" className="max-w-[44ch] font-mono text-[11.5px] text-ink-3">
          {note ? <><b className="font-semibold text-ink">{note}</b> onSync fired · syncs are simulated</> : "Generic tools and a fictional client. Syncs are simulated."}
        </span>
        <DemoButton icon="x" onClick={() => grid.current?.setStatus("payments", "disconnected", "The payment provider rejected the saved key.")}>Simulate a payments outage</DemoButton>
        <DemoButton icon="refresh" onClick={() => { setVersion(v => v + 1); setNote(null); }}>Reset demo</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "integrations[].id · name", type: "string", description: "Key and display name." },
    { name: "integrations[].icon", type: "IntegrationIcon", description: "Built-in glyph: crm, card, calendar, mail, sms, chat, sheet, hub (or plug)." },
    { name: "integrations[].status", type: "'connected' | 'warning' | 'disconnected'", description: "Drives the status light, the health meter and the filters." },
    { name: "integrations[].issue · fix", type: "string · 'sync' | 'reconnect'", description: "What is wrong, and whether a sync or a reconnect clears it." },
    { name: "integrations[].lastSyncMinutes", type: "number", description: "Minutes since the last good sync. Shown as relative time and refreshed every 30 s." },
    { name: "integrations[].eventsToday", type: "number", description: "Events handled since midnight." },
    { name: "integrations[].activity", type: "number[]", description: "Optional. Events per hour for the last 12 hours, oldest first (hover a bar for its value)." },
    { name: "integrations[].account · connectedSince · interval · scopes[]", type: "string · string[]", description: "Optional. Shown in the details drawer." },
    { name: "integrations[].history[]", type: "SyncHistoryEntry[]", description: "Optional. { minutesAgo, result: 'ok' | 'fail', events?, note? }." },
    { name: "eyebrow · title · subtitle · footnote", type: "string", description: "Optional header and footer text." },
    { name: "filter · defaultFilter", type: "'all' | IntegrationStatus", description: "Status filter. Pass filter to control it." },
    { name: "ref", type: "Ref<IntegrationGridHandle>", description: "sync(id), reconnect(id), syncAll(), setStatus(id, status, issue?)." },
  ],
  usage: `import { IntegrationStatusGrid, type IntegrationGridHandle } from "./IntegrationStatusGrid";

const grid = useRef<IntegrationGridHandle>(null);

<IntegrationStatusGrid
  ref={grid}
  title="Connected tools"
  integrations={[
    { id: "crm", name: "CRM", icon: "crm", status: "connected",
      lastSyncMinutes: 4, eventsToday: 1284 },
    { id: "sms", name: "SMS gateway", icon: "sms", status: "disconnected",
      fix: "reconnect", issue: "Sign-in expired." },
  ]}
  onSync={d => log(d.id, d.eventsAdded)}
/>

grid.current?.setStatus("payments", "warning", "Webhook failing");`,
  events: [
    { name: "onSync(detail)", description: "A sync or reconnect finished: { id, name, action: 'sync' | 'reconnect', status, eventsAdded, eventsToday }." },
    { name: "onOpen(detail)", description: "The details drawer opened: { id, name, status }." },
    { name: "onFilterChange(detail)", description: "The status filter changed: { filter, shown }." },
    { name: "onDisconnect(detail)", description: "Disconnect was pressed in the drawer: { id, name }." },
  ],
  notes: [
    "Sync now and Reconnect are simulated with a short delay; Sync all runs them one after another.",
    "The details drawer is a modal dialog (focus trapped, Esc or the scrim closes it, focus returns to Details). On narrow screens it opens as a bottom sheet.",
  ],
};
