import { useRef, useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { AgentStatusPanel, type AgentStatusPanelHandle } from "./AgentStatusPanel";
import { demoFleet } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const panel = useRef<AgentStatusPanelHandle>(null);
  const [run, setRun] = useState(0);
  const [msg, setMsg] = useState<{ strong: string; rest: string } | null>(null);

  if (mode === "preview") return <AgentStatusPanel data={demoFleet} />;

  const simulateError = () => {
    const agents = panel.current?.getAgents() ?? [];
    const pick = agents.find(a => a.status === "running") ?? agents[0];
    if (!pick) return;
    panel.current?.setStatus(pick.id, "error", "Request to the CRM timed out after 30 s. The item was put back in the queue.");
    setMsg({ strong: `${pick.name} set to Error.`, rest: "Open it with “Show error” and press Retry now." });
  };
  const reset = () => { setRun(r => r + 1); setMsg({ strong: "Demo reset.", rest: "" }); };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AgentStatusPanel key={run} ref={panel} data={demoFleet}
        onAgentAction={d => setMsg({ strong: `${d.name}: ${d.action}.`, rest: `onAgentAction (${d.from} → ${d.to}).` })} />
      <div className="w-full max-w-[1040px]">
        <DemoBar note={
          <span aria-live="polite">
            {msg && <><b className="font-semibold text-ink">{msg.strong}</b>{msg.rest && ` ${msg.rest}`} </>}
            Example data — not real client results. Simulated agents.
          </span>
        }>
          <DemoButton icon="spark" onClick={simulateError}>Simulate an error</DemoButton>
          <DemoButton icon="refresh" onClick={reset}>Reset demo</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.path · title · subtitle", type: "string?", description: "Optional header text." },
    { name: "data.seed", type: "number", description: "Makes the simulated updates repeat the same way each time." },
    { name: "data.agents[].id · name · model", type: "string", description: "Agent key, display name and model label." },
    { name: "data.agents[].status", type: '"running" | "idle" | "error" | "paused"', description: "Starting status." },
    { name: "data.agents[].task", type: "string", description: "What the agent is working on." },
    { name: "data.agents[].queue", type: "number", description: "Items waiting." },
    { name: "data.agents[].processed · succeeded", type: "number", description: "Item counts. Success rate is succeeded ÷ processed." },
    { name: "data.agents[].load · failRate", type: "number", description: "Simulation only: average items per update, and the share that fail." },
    { name: "data.agents[].error", type: "{ code?, at?, message }", description: "Shown when an error row is opened." },
    { name: "interval", type: "number", description: "Milliseconds between live updates (default 2000, minimum 500)." },
    { name: "defaultPaused · defaultFilter", type: "boolean · AgentFilter", description: "Start paused; initial status filter (all, running, idle, error, paused)." },
    { name: "labels · locale", type: "Partial<AspLabels> · string", description: "Override any built-in text; number and time locale (default en-GB)." },
    { name: "ref", type: "Ref<AgentStatusPanelHandle>", description: "setStatus(id, status, message?) changes an agent from code; getAgents() returns a snapshot." },
  ],
  usage: `import { useRef } from "react";
import { AgentStatusPanel, type AgentStatusPanelHandle } from "./components/ai-agent-status-panel/AgentStatusPanel";

const panel = useRef<AgentStatusPanelHandle>(null);

<AgentStatusPanel
  ref={panel}
  interval={2000}
  data={{
    title: "Agent fleet",
    agents: [
      { id: "agt-01", name: "Lead Qualifier", status: "running", task: "Scoring leads",
        queue: 14, processed: 1286, succeeded: 1262, load: 3 },
    ],
  }}
  onAgentAction={d => console.log(d.name, d.action, d.from, "→", d.to)}
/>

panel.current?.setStatus("agt-01", "error", "Timed out");`,
  events: [
    { name: "onAgentAction", description: "Start, Pause, Restart and Retry: { id, name, action, from, to }." },
    { name: "onPausedChange", description: "Live updates paused or resumed." },
    { name: "onFilterChange", description: "A status filter was chosen." },
  ],
  notes: [
    "Live updates stop while the tab is hidden, in gallery thumbnails, and when you press Pause.",
    "Restart and Retry pass through a short Restarting state before the agent returns to running (or idle with an empty queue).",
    "LEDs pulse only for running agents while live; reduced motion turns pulses and number ticks off.",
  ],
};
