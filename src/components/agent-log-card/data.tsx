import { AgentLogChip, AgentLogChips, type AgentLogCardProps } from "./AgentLogCard";

/* Week 01 entry — the real prompt and output from building this component
   with Claude Code on 25 Sep 2026 (kept verbatim from the original page). */
export const WEEK01_PROMPT = `Build the first component for my LofiStack Component Gallery: an AI Agent Task Log Card.
Create a polished, reusable UI component that displays:

* Task name
* AI Agent used
* Prompt / Workflow
* Result
* Task type
* Date
* Status

Design it to feel modern, premium, minimal, and suitable for LofiStack's internal/product library.
Requirements:

* Make it visually impressive but practical.
* Fully responsive for mobile and desktop.
* Use clean HTML/CSS/JS and keep the component reusable.
* Give it a unique design, not a generic dashboard card.
* Add subtle hover/micro-interactions.
* Make all content easy to customize.
* Build it as a standalone component that can later have its own direct URL in the gallery.

Do not build the whole gallery yet. Only create this first component.`;

export const WEEK01: Omit<AgentLogCardProps, "status"> & { status: "draft" } = {
  task: "Build the Agent Log Card for the LofiStack Component Gallery",
  agent: "Claude Code · Opus 5.5",
  type: "UI Component",
  date: "2026-09-25",
  status: "draft",
  week: 1,
  entry: 1,
  prompt: WEEK01_PROMPT,
  result: (
    <>
      <p>A reusable <code>{"<agent-log-card>"}</code> element in plain HTML, CSS and JS, published as its own page for the gallery.</p>
      <ul>
        <li>Short fields are set as attributes; the prompt and result go in as child content.</li>
        <li>Stacks to a single column at phone width; light and dark themes.</li>
        <li>Draft, Selected and Submitted states; copy button and expandable prompt.</li>
      </ul>
      <AgentLogChips>
        <AgentLogChip>agent-log-card.html</AgentLogChip>
        <AgentLogChip>Custom element</AgentLogChip>
        <AgentLogChip>No dependencies</AgentLogChip>
      </AgentLogChips>
    </>
  ),
};
