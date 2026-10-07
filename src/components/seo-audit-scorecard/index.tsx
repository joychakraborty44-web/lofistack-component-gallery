import { useRef, useState, type ReactNode } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { SeoAuditScorecard, type SeoAuditScorecardHandle } from "./SeoAuditScorecard";
import { demoAudit } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const card = useRef<SeoAuditScorecardHandle>(null);
  const [run, setRun] = useState(0);
  const [event, setEvent] = useState<ReactNode>(null);

  if (mode === "preview") return <SeoAuditScorecard data={demoAudit} />;

  const say = (strong: string, rest: string) => setEvent(<><b className="font-semibold text-ink">{strong}</b> {rest}</>);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <SeoAuditScorecard key={run} ref={card} data={demoAudit}
        onIssueFix={d => say("onIssueFix", `fired: ${d.fixed ? "fixed" : "reopened"} “${d.issue.title}”. Overall ${d.overall}, grade ${d.grade}.`)}
        onAuditRun={d => say("onAuditRun", `fired: overall ${d.overall}, grade ${d.grade}.`)} />
      <DemoBar note={<span aria-live="polite">{event ? <>{event} · </> : null}Example data — fictional site, not a real audit.</span>}>
        <DemoButton icon="check" onClick={() => demoAudit.issues.filter(i => i.severity === "critical").forEach(i => card.current?.setFixed(i.id, true))}>Fix all critical</DemoButton>
        <DemoButton icon="refresh" onClick={() => { setRun(r => r + 1); setEvent(null); }}>Reset</DemoButton>
      </DemoBar>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.eyebrow · title · site", type: "string", description: "Header text. site is the domain that was audited." },
    { name: "data.pages · lastRun", type: "number · string", description: "Pages crawled and when the audit last ran (any text)." },
    { name: "data.categories[]", type: "{ id, label, score, weight? }", description: "Score is 0–100 with every listed issue still open. Weight defaults to 1; the overall score is the weighted average." },
    { name: "data.issues[]", type: "{ id, title, severity, category, impact, pages?, why?, fix?, urls?, fixed? }", description: "severity is critical, warning or notice; impact is the points fixing it adds back to its category (capped at 100)." },
    { name: "data.source", type: "string", description: "Optional footer note." },
    { name: "severity · defaultSeverity", type: "\"all\" | \"critical\" | \"warning\" | \"notice\" | \"fixed\"", description: "Controlled or initial issue filter." },
    { name: "category · defaultCategory", type: "string | null", description: "Controlled or initial category scope. Clicking a score card toggles it." },
    { name: "ref", type: "Ref<SeoAuditScorecardHandle>", description: "setFixed(id, fixed), rerun() and scores() from code." },
  ],
  usage: `import { SeoAuditScorecard } from "./components/seo-audit-scorecard/SeoAuditScorecard";

<SeoAuditScorecard
  data={{
    site: "harborandpine.example",
    pages: 48,
    categories: [{ id: "seo", label: "On-page SEO", score: 71 }],
    issues: [{
      id: "meta-desc", severity: "warning", category: "seo", impact: 6, pages: 14,
      title: "Meta descriptions are missing", why: "…", fix: "…",
    }],
  }}
  onIssueFix={({ id, fixed, overall, grade }) => save(id, fixed)}
  onAuditRun={({ overall, grade, verified }) => log(verified)}
/>`,
  events: [
    { name: "onIssueFix", description: "“Mark as fixed” was ticked or unticked. Receives { id, fixed, issue, category, categoryScore, overall, grade }." },
    { name: "onAuditRun", description: "A re-run finished: fixed issues are now verified. Receives { overall, grade, verified, categories }." },
    { name: "onSeverityChange · onCategoryChange", description: "The issue filter or category scope changed." },
  ],
  notes: [
    "Grades: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F. Ring colours: green ≥ 90, amber ≥ 50, red below.",
    "Escape closes an open issue and returns focus to it. If a fixed issue leaves the current filter, focus moves to the filter that now holds it.",
    "While re-running, the card is aria-busy and its controls are inert.",
  ],
};
