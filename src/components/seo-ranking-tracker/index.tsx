import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { SeoRankingTracker, type KeywordSelectDetail } from "./SeoRankingTracker";
import { brightsideData, cedarData } from "./data";

type Client = "brightside" | "cedar";

export function Demo({ mode }: { mode: DemoMode }) {
  const [client, setClient] = useState<Client>("brightside");
  const [last, setLast] = useState<KeywordSelectDetail | null>(null);

  if (mode === "preview") return <SeoRankingTracker data={brightsideData} />;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <SeoRankingTracker data={client === "cedar" ? cedarData : brightsideData} onKeywordSelect={setLast} stickyOffset={64} />
      <div className="w-full max-w-[1080px]">
        <DemoBar note={
          <span aria-live="polite">
            Example data — not real client results.
            {last && <span className="ml-1 text-ink-2">onKeywordSelect: “{last.keyword}” {last.expanded ? "opened" : "closed"}.</span>}
          </span>
        }>
          <ControlGroup label="Client">
            <Segmented size="sm" ariaLabel="Client data" value={client} onChange={v => { setClient(v); setLast(null); }}
              options={[{ value: "brightside", label: "Brightside Dental" }, { value: "cedar", label: "Cedar Fitness Co." }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data.keywords[].keyword", type: "string", description: "The search term being tracked." },
    { name: "data.keywords[].history", type: "(number | null)[]", description: "Weekly positions, oldest first. The last value is this week, the one before it last week. null = not in the top 100." },
    { name: "data.keywords[].url", type: "string", description: "The page that ranks for the keyword." },
    { name: "data.keywords[].volume", type: "number", description: "Average monthly searches." },
    { name: "data.keywords[].best", type: "number?", description: "Optional all-time best. The lowest value in history is used if it is better." },
    { name: "data.keywords[].intent", type: "string?", description: "Optional tag, e.g. Local, Commercial, Brand." },
    { name: "data.weeks", type: "string[]", description: "Labels for each history point, e.g. \"Sep 25\"." },
    { name: "data.eyebrow · title · site", type: "string?", description: "Optional header text." },
    { name: "data.period · source", type: "string?", description: "Optional date text (top right) and footer note." },
    { name: "defaultSort", type: "{ key, dir }", description: "key is keyword, position, change, best or volume; dir asc or desc. Default position ascending." },
    { name: "defaultFilter", type: '"all" | "top3" | "top10" | "improved" | "declined"', description: "Initial filter chip (default all)." },
    { name: "labels · locale", type: "Partial<SeoLabels> · string", description: "Override any built-in text; number locale (default en-US)." },
    { name: "stickyOffset", type: "number", description: "Pixels from the top of the viewport where the table header sticks (default 0)." },
  ],
  usage: `import { SeoRankingTracker } from "./components/seo-ranking-tracker/SeoRankingTracker";

<SeoRankingTracker
  data={{
    title: "Organic keyword positions",
    weeks: ["Sep 18", "Sep 25", "Oct 2"],
    keywords: [
      { keyword: "emergency dentist near me", url: "/emergency-dental",
        volume: 6600, history: [6, 5, 4] },
    ],
  }}
  defaultSort={{ key: "position", dir: "asc" }}
  onKeywordSelect={d => console.log(d.keyword, d.expanded)}
/>`,
  events: [
    { name: "onKeywordSelect", description: "A row was opened or closed: { keyword, position, change, best, url, volume, expanded }." },
    { name: "onSortChange", description: "Sorting changed (header click or the phone sort menu): { key, dir }." },
    { name: "onFilterChange", description: "A filter chip was chosen: { filter, shown }." },
  ],
  notes: [
    "Change, best position, the summary and the position spread are all worked out from history.",
    "Esc clears the search. Sort headers expose aria-sort; open a row and focus its chart to step weeks with ← → Home End.",
    "Below ~576px the table becomes stacked keyword cards with a sort menu.",
  ],
};
