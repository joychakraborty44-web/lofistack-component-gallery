import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { AiPromptCard } from "./AiPromptCard";
import { adPrompt, emailPrompt } from "./data";

type Which = "email" | "ad";

export function Demo({ mode }: { mode: DemoMode }) {
  const [which, setWhich] = useState<Which>("email");
  const [event, setEvent] = useState("");

  if (mode === "preview") return <AiPromptCard prompt={emailPrompt} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AiPromptCard
        prompt={which === "email" ? emailPrompt : adPrompt}
        onVersionChange={v => setEvent(`onVersionChange · ${v}`)}
        onModeChange={m => setEvent(`onModeChange · ${m}`)}
        onCopy={d => setEvent(`onCopy · ${d.version} ${d.method === "clipboard" ? "copied" : "selected"} · ${d.chars.toLocaleString("en-US")} chars, ≈${d.tokens} tokens`)}
      />
      <div className="grid w-full max-w-[1000px] gap-2">
        <DemoBar note="Example data — not real client results.">
          <ControlGroup label="Load prompt">
            <Segmented<Which> size="sm" ariaLabel="Example prompt" value={which} onChange={v => { setWhich(v); setEvent(""); }}
              options={[{ value: "email", label: "Follow-up email" }, { value: "ad", label: "Social ad copy" }]} />
          </ControlGroup>
        </DemoBar>
        <p aria-live="polite" className="min-h-[1.2em] font-mono text-[11.5px] text-ink-3">{event}</p>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "prompt", type: "PromptData", description: "{ name, description?, path?, model?, temperature?, activeVersion?, variables, versions }. Passing a different prompt resets the variables and version." },
    { name: "prompt.variables[]", type: "PromptVariable[]", description: "{ key, label?, default?, placeholder?, suggestions? }. key matches {{key}} in the text (letters, numbers, underscore)." },
    { name: "prompt.versions[]", type: "PromptVersion[]", description: "{ id, text, updated?, note? } in order. updated is YYYY-MM-DD. Lines new since the previous version get a gutter mark." },
    { name: "version / defaultVersion", type: "string", description: "Controlled or starting version id (default: activeVersion, then the last version)." },
    { name: "mode / defaultMode", type: "\"template\" | \"preview\"", description: "Template shows {{variables}}; Preview fills them in." },
    { name: "labels", type: "Partial<PromptLabels>", description: "Override any built-in text, e.g. { copy: \"Copy\" }." },
    { name: "ref", type: "Ref<AiPromptCardHandle>", description: "setVariable(key, value), resetVariables(), copy(), filledText()." },
  ],
  usage: `import { AiPromptCard } from "./components/ai-prompt-card/AiPromptCard";

<AiPromptCard
  prompt={{
    name: "Lead follow-up email",
    model: "Large model",
    variables: [{ key: "client_name", default: "Brightside Dental" }],
    versions: [{ id: "v1", text: "Write for {{client_name}}." }],
  }}
  defaultMode="preview"
  onCopy={({ text, tokens }) => console.log(tokens, text)}
/>`,
  events: [
    { name: "onCopy", description: "Fires with { version, text, chars, tokens, values, method }. method is \"selection\" when the clipboard is blocked and the text was selected instead." },
    { name: "onVersionChange", description: "A version tab was chosen (click or arrow keys)." },
    { name: "onModeChange", description: "Template / Preview was switched." },
    { name: "onVariableChange", description: "A variable input or suggestion chip changed a value: (key, value)." },
  ],
  notes: [
    "The token count is a rough guide (characters ÷ 4).",
    "Hover or focus a variable to light up every place it is used. Empty values and {{variables}} with no input show in red.",
    "The editor stays dark in both themes, like a real code editor.",
  ],
};
