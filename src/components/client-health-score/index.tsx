import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { ClientHealthScore, type HealthScoreDetail } from "./ClientHealthScore";
import { brightside, harbor } from "./data";

const BAND_NAME = { healthy: "Healthy", risk: "At risk", critical: "Critical" } as const;

export function Demo({ mode }: { mode: DemoMode }) {
  const [client, setClient] = useState<"brightside" | "harbor">("brightside");
  const [last, setLast] = useState<HealthScoreDetail | null>(null);

  if (mode === "preview") return <ClientHealthScore {...brightside} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ClientHealthScore {...(client === "harbor" ? harbor : brightside)} onScoreChange={setLast} />
      <div className="w-full max-w-[1000px]">
        <DemoBar
          note={
            <span aria-live="polite">
              {last
                ? <><b className="font-semibold text-ink">Score {last.score} · {BAND_NAME[last.band]}.</b> onScoreChange fired. Example data, not real client results.</>
                : <><b className="font-semibold text-ink">Example data.</b> Not real client results.</>}
            </span>
          }
        >
          <ControlGroup label="Client">
            <Segmented
              ariaLabel="Example client" size="sm" value={client} onChange={v => { setClient(v); setLast(null); }}
              options={[{ value: "brightside", label: "Brightside Dental" }, { value: "harbor", label: "Harbor & Pine Realty" }]}
            />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "client · segment", type: "string", description: "Account name and a short line under it." },
    { name: "asOf · compareDate", type: "string", description: "Dates for the two periods, YYYY-MM-DD. Shown under the period switch." },
    { name: "compareLabel", type: "string", description: "Switch label for the earlier period (default “90 days ago”)." },
    { name: "factors", type: "HealthFactor[]", description: "{ key, name, weight, score, previous?, about?, note?, previousNote? }. Four to six factors work best." },
    { name: "factors[].score · previous", type: "number", description: "0–100 scores now and for the earlier period." },
    { name: "factors[].weight", type: "number", description: "Starting weight, 0–10. Weights are shared as whole-number percentages of their total (always 100%)." },
    { name: "factors[].about · note · previousNote", type: "string", description: "What the factor measures, and the evidence behind each period's score. Shown when the factor is hovered or focused." },
    { name: "bands", type: "{ healthy?: number; risk?: number }", description: "Band thresholds (default 70 and 40). Below risk is Critical." },
    { name: "period · defaultPeriod", type: "\"current\" | \"previous\"", description: "Controlled or initial period. The switch in the header changes it." },
    { name: "labels", type: "Partial<HealthLabels>", description: "Override any built-in text." },
    { name: "ref", type: "Ref<ClientHealthScoreHandle>", description: "setWeight(key, 0–10), resetWeights(), getScore() → { current, previous }, getWeights()." },
  ],
  usage: `import { ClientHealthScore } from "./components/client-health-score/ClientHealthScore";

<ClientHealthScore
  client="Brightside Dental"
  segment="Growth plan · client since Mar 2025"
  asOf="2026-10-02"
  compareDate="2026-07-04"
  factors={[
    { key: "engagement", name: "Engagement", weight: 5,
      score: 82, previous: 61, about: "Meetings, replies and logins." },
    { key: "payments", name: "Payments", weight: 3,
      score: 95, previous: 90 },
  ]}
  onScoreChange={({ score, band, period, weights }) => console.log(score, band, period, weights)}
/>`,
  events: [
    { name: "onScoreChange({ score, band, period, current, previous, weights, reason })", description: "A weight was committed (slider released or key pressed), weights were reset, or the period changed. weights holds each factor's % share." },
    { name: "onPeriodChange(period)", description: "The Current / 90 days ago switch changed." },
  ],
  notes: [
    "The score is the weighted average of the factor scores, so each factor's share of the weights is exactly how much of the score it can move.",
    "The dashed marker on the dial and on each factor bar shows the other period's value.",
    "The dial is announced as one image (“Health score 72 out of 100, Healthy. ▲ 13 vs 90 days ago.”) and score changes are announced politely after you stop dragging.",
    "Changing the factors (e.g. switching client) resets the weights.",
  ],
};
