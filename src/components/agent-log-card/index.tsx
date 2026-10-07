import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { AgentLogCard } from "./AgentLogCard";
import { WEEK01 } from "./data";

type DemoStatus = "draft" | "selected" | "submitted";

export function Demo({ mode }: { mode: DemoMode }) {
  const [status, setStatus] = useState<DemoStatus>("draft");
  if (mode === "preview") return <AgentLogCard {...WEEK01} />;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AgentLogCard {...WEEK01} status={status} />
      <div className="w-full max-w-[680px]">
        <DemoBar note="Sample content: the real prompt and output from building this component with Claude Code on 25 Sep 2026.">
          <ControlGroup label="Status">
            <Segmented<DemoStatus> ariaLabel="Preview status" size="sm" value={status} onChange={setStatus}
              options={[{ value: "draft", label: "Draft" }, { value: "selected", label: "Selected" }, { value: "submitted", label: "Submitted" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "task", type: "string", description: "Task name, shown as the title." },
    { name: "agent", type: "string", description: "Agent or tool used, plus model if known." },
    { name: "type", type: "string", description: "Task category, e.g. Research, Coding, UI Component." },
    { name: "date", type: "string", description: "YYYY-MM-DD; displayed as 25 Sep 2026." },
    { name: "status", type: `"draft" | "selected" | "submitted" | string`, description: "Draft pings, Selected is blue, Submitted shows a check. Any other string becomes a neutral pill with its label capitalised." },
    { name: "week · entry", type: "number", description: "Optional. Shown in the top rail as Week 01 / Entry 01." },
    { name: "prompt", type: "string", description: "Plain text. Line breaks are kept; common indentation is trimmed. Long prompts clamp to nine lines with a Show full prompt toggle." },
    { name: "result", type: "ReactNode", description: "Rich content: paragraphs, lists, <code>, and <AgentLogChips>/<AgentLogChip> tags." },
    { name: "className", type: "string", description: "Extra classes for the outer element (max width 680px)." },
  ],
  usage: `import { AgentLogCard, AgentLogChips, AgentLogChip } from "./AgentLogCard";

<AgentLogCard
  task="Task name"
  agent="Agent · Model"
  type="Task type"
  date="2026-09-25"
  status="draft"
  week={1}
  entry={1}
  prompt={\`The exact prompt or workflow…\`}
  result={
    <>
      <p>What the agent produced…</p>
      <AgentLogChips><AgentLogChip>file.tsx</AgentLogChip></AgentLogChips>
    </>
  }
/>`,
  notes: [
    "The perforation notches are cut with a CSS mask and the outline is drawn with drop-shadows, so the card sits cleanly on any background.",
    "Copy puts the trimmed prompt on the clipboard; if the clipboard is blocked the prompt text is selected instead.",
  ],
};
