import { useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { AdSpendBudgetTracker } from "./AdSpendBudgetTracker";
import { demoData } from "./data";

const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink">{children}</b>;
const DEFAULT_NOTE: ReactNode = <><B>Example data.</B> Fictional client, not real spend.</>;
const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const STATUS = { ok: "on track", over: "overpacing", under: "underpacing" } as const;

export function Demo({ mode }: { mode: DemoMode }) {
  const [run, setRun] = useState(0);
  const [note, setNote] = useState<ReactNode>(DEFAULT_NOTE);

  if (mode === "preview") return <AdSpendBudgetTracker data={demoData} />;

  const say = (strong: string, rest: string) => setNote(<><B>{strong}</B> {rest} Example data, not real spend.</>);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AdSpendBudgetTracker
        key={run}
        data={demoData}
        onBudgetChange={d => say("onBudgetChange", `fired. ${d.label}: ${usd(d.previous)} → ${usd(d.budget)}, projected ${usd(d.projected)} (${STATUS[d.status]}).`)}
        onViewChange={v => say("onViewChange", `fired. Showing ${v} spend.`)}
        onSortChange={s => say("onSortChange", s === "used" ? "fired. Highest % used first." : "fired. Back to the original order.")}
      />
      <DemoBar note={<span aria-live="polite">{note}</span>}>
        <DemoButton icon="refresh" onClick={() => { setRun(r => r + 1); say("Budgets reset.", "Back to the starting figures."); }}>Reset budgets</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.month", type: "YYYY-MM", description: "Sets the number of days in the month." },
    { name: "data.asOf", type: "YYYY-MM-DD", description: "The day spend is counted to (default: today). Outside the month, the month counts as complete or not started." },
    { name: "data.channels[]", type: "{ id, label, budget, spent, icon }", description: "icon is search, social, video or display." },
    { name: "data.tolerance", type: "{ over, under }", description: "Fractions of budget (default 0.05 and 0.15). Projected spend outside this band is flagged as over- or underpacing." },
    { name: "data.eyebrow · title", type: "string", description: "Optional header text." },
    { name: "data.currency · locale", type: "string", description: "ISO currency (default USD) and number locale (default en-US)." },
    { name: "data.source", type: "string", description: "Optional footer note." },
    { name: "defaultView", type: '"spent" | "projected"', description: "Initial view of the bars (default spent)." },
    { name: "defaultSort", type: '"default" | "used"', description: "Data order, or highest % of budget used first." },
  ],
  usage: `import { AdSpendBudgetTracker } from "./AdSpendBudgetTracker";

<AdSpendBudgetTracker
  data={{
    month: "2026-09",
    asOf: "2026-09-18",
    channels: [
      { id: "search", label: "Search Ads", icon: "search", budget: 12000, spent: 7480 },
      { id: "social", label: "Social Ads", icon: "social", budget: 8000, spent: 5620 },
    ],
  }}
  onBudgetChange={d => saveBudget(d.id, d.budget)}
  onViewChange={view => track("view", view)}
/>`,
  events: [
    { name: "onBudgetChange", description: "A budget was saved: { id, label, budget, previous, spent, projected, status }." },
    { name: "onViewChange", description: "The Spent / Projected switch changed." },
    { name: "onSortChange", description: 'The sort toggle changed: "default" or "used".' },
  ],
  notes: [
    "Ideal pace = budget × days so far ÷ days in month. Projected = spend so far ÷ days so far × days in month, so it assumes the current daily rate holds.",
    "Click a budget to edit it: Enter saves, Esc cancels, an empty or zero value shows an error. Clicking away with an unchanged value closes the editor.",
    "All bars share one scale, so a channel that projects past its budget shows a hatched overspend segment beyond the budget line.",
  ],
};
