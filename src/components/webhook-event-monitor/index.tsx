import { useRef, useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { WebhookMonitor, type WebhookMonitorHandle } from "./WebhookMonitor";
import { demoWebhooks } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const mon = useRef<WebhookMonitorHandle>(null);
  const [note, setNote] = useState<ReactNode>(null);

  if (mode === "preview") return <WebhookMonitor {...demoWebhooks} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <WebhookMonitor ref={mon} {...demoWebhooks}
        onReplay={d => setNote(<><b className="font-semibold text-ink">Replayed {d.name}: {d.original.status} → {d.replay.status}.</b> onReplay fired.</>)} />
      <div className="w-full max-w-[980px]">
        <DemoBar note={<span aria-live="polite">{note ? <>{note} Simulated events — not real client traffic.</> : "Simulated events — not real client traffic."}</span>}>
          <DemoButton icon="plus" onClick={() => {
            const m = mon.current;
            if (!m) return;
            const ev = m.simulateFailure();
            m.select(ev.id);
            setNote(<><b className="font-semibold text-ink">{ev.name} returned {ev.status}.</b> Select Replay in the inspector to re-send it.</>);
          }}>Send a failing event</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "title · environment · endpoint", type: "string", description: "Header text, the environment badge and the base path." },
    { name: "seed · initial · max", type: "number", description: "Seed for the repeatable simulation (2041), deliveries to start with (18) and rows to keep (60)." },
    { name: "interval", type: "number", description: "Average milliseconds between simulated deliveries (2400, jittered ±40%)." },
    { name: "accounts", type: "string[]", description: "Account names used in simulated payloads." },
    { name: "simulate", type: "boolean", description: "Set false to show only events you pass in or add." },
    { name: "events", type: "WebhookEventInput[]", description: "Optional starting deliveries: { id, name, method, path, status, latency, at, payload, response, headers }." },
    { name: "defaultPaused", type: "boolean", description: "Start with the live stream paused." },
    { name: "ref", type: "WebhookMonitorHandle", description: "addEvent(e), simulateFailure(), select(id), replay(id), pause(), resume(), events." },
  ],
  usage: `import { WebhookMonitor, type WebhookMonitorHandle } from "./components/webhook-event-monitor/WebhookMonitor";

const monitor = useRef<WebhookMonitorHandle>(null);

<WebhookMonitor
  ref={monitor}
  title="Webhook events"
  environment="Production"
  endpoint="/hooks/lofistack"
  simulate={false}
  onReplay={({ original, replay }) => console.log(original.status, "→", replay.status)}
/>

// feed it real deliveries:
monitor.current?.addEvent({
  name: "invoice.paid", method: "POST", path: "/hooks/payments",
  status: 200, latency: 84, payload: { invoice: { id: "inv_1042" } },
});`,
  events: [
    { name: "onReplay(detail)", description: "Replay re-sent the selected delivery as a new row marked “replay”: { name, original: { id, status }, replay: { id, status, latency } }. 5xx and 429 succeed on replay; other 4xx fail again." },
    { name: "onSelect(detail)", description: "A delivery was selected (click, arrow keys, or the Replay-of link): { id, name, status }." },
    { name: "onStreamChange({ paused })", description: "Pause / Resume was used." },
  ],
  notes: [
    "Status chips (with counts that respect the search) and the event-name/id search combine; Esc clears the search.",
    "↑ / ↓ / Home / End move through deliveries and update the inspector. The stream skips ticks while the tab is hidden.",
    "On phones the rows become cards and the inspector opens as a bottom sheet (Esc or × closes, focus returns to the card).",
  ],
};
