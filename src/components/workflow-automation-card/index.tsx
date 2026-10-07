import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { WorkflowAutomationCard } from "./WorkflowAutomationCard";
import { DEMO_WORKFLOWS } from "./data";

type Which = keyof typeof DEMO_WORKFLOWS;

export function Demo({ mode }: { mode: DemoMode }) {
  const [which, setWhich] = useState<Which>("lead");
  const [enabled, setEnabled] = useState(true);
  const [event, setEvent] = useState("");
  if (mode === "preview") return <WorkflowAutomationCard workflow={DEMO_WORKFLOWS.lead} />;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <WorkflowAutomationCard workflow={DEMO_WORKFLOWS[which]} enabled={enabled}
        onEnabledChange={v => { setEnabled(v); setEvent(`onEnabledChange fired: ${v ? "on" : "off"}.`); }}
        onRun={d => {
          if (d.status === "completed") setEvent(`Test run completed in ${d.totalMs.toLocaleString("en-US")} ms. The card fired onRun.`);
          else if (d.status === "stopped") setEvent(`Test run stopped after ${d.step} steps. The card fired onRun.`);
        }} />
      <div className="w-full max-w-[1040px]">
        <DemoBar note={<>Example data — not real client results.{event && <span className="ml-1.5 text-ink-2" aria-live="polite">{event}</span>}</>}>
          <ControlGroup label="Workflow">
            <Segmented<Which> ariaLabel="Workflow shown" size="sm" value={which} onChange={v => { setWhich(v); setEvent(""); }}
              options={[{ value: "lead", label: "New lead follow-up" }, { value: "call", label: "Missed-call text back" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "workflow", type: "Workflow", description: "{ id, name, eyebrow?, subtitle?, ref?, revision?, stats?, testContact?, flow, enabled? }. A new id resets the card." },
    { name: "workflow.stats", type: "{ period, runs, succeeded, avgSeconds, lastRun }", description: "Header figures. Success rate is worked out from runs and succeeded." },
    { name: "workflow.testContact", type: "{ name, note? }", description: "The contact shown in the test-run bar (initials are made from the name)." },
    { name: "workflow.flow[]", type: "FlowNode", description: "Steps in order: { id, type: trigger | condition | action | wait, title, detail?, description?, icon?, config?, runs?, testMs? }." },
    { name: "flow[].yes · no", type: "FlowNode[]", description: "Condition only. The steps on each branch; branches join again at the next step." },
    { name: "flow[].test · testDefault", type: "string · boolean", description: "Condition only. Label and starting value of the test switch that picks the branch." },
    { name: "flow[].config", type: "Record<string, string>", description: "Settings shown in the Step panel." },
    { name: "flow[].runs", type: "number", description: "Contacts that reached the step in the stats period (drives the Reached this step bar)." },
    { name: "flow[].icon", type: "FlowIcon", description: "form, chat, user, mail, list, sms, clock, phone, task, bell (defaults by type)." },
    { name: "enabled · defaultEnabled", type: "boolean", description: "Controlled or initial on/off state of the switch." },
  ],
  usage: `import { WorkflowAutomationCard } from "./WorkflowAutomationCard";

<WorkflowAutomationCard
  workflow={{
    id: "lead",
    name: "New lead follow-up",
    flow: [
      { id: "t", type: "trigger", title: "Form submitted" },
      { id: "c", type: "condition", title: "Has tag: VIP?", test: "Has VIP tag",
        yes: [{ id: "a", type: "action", title: "Notify team chat" }],
        no:  [{ id: "b", type: "action", title: "Send welcome email" }] },
      { id: "w", type: "wait", title: "Wait 1 day" },
    ],
  }}
  onRun={d => console.log(d.status, d.totalMs)}
  onNodeSelect={n => console.log(n.id)}
/>`,
  events: [
    { name: "onEnabledChange", description: "(enabled) — the on/off switch was flipped." },
    { name: "onRun", description: "{ status: started | paused | resumed | stopped | completed, workflow, step, steps, totalMs, branches, path }." },
    { name: "onNodeSelect", description: "{ id, type, title, config } — a step was opened." },
  ],
  notes: [
    "The test run follows the branch set by each test switch, logs every step with its time and skips waits. Test runs still work while the workflow is off.",
    "Arrow Up / Down moves between steps on the canvas; the connectors are re-measured whenever the layout changes.",
  ],
};
