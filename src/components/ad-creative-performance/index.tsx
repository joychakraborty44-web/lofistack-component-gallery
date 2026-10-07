import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton } from "../../ui";
import { AdCreativePerformance, rankCreatives, type CreativeCompareDetail } from "./AdCreativePerformance";
import { DEMO_SET, type CreativeSort, type FormatFilter } from "./data";

export function Demo({ mode }: { mode: DemoMode }) {
  const [sort, setSort] = useState<CreativeSort>("ctr");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [ids, setIds] = useState<string[]>([]);
  const [event, setEvent] = useState("");

  if (mode === "preview") return <AdCreativePerformance data={DEMO_SET} />;

  const onCompare = (d: CreativeCompareDetail) => {
    setIds(d.ids);
    if (!d.ids.length) return setEvent("");
    if (d.ids.length === 1) return setEvent(`${d.creatives[0].name} picked. Choose one more to compare.`);
    const w = d.creatives.find(c => c.id === d.winner);
    setEvent(`onCompare fired. ${w ? `${w.name} leads` : "It's even"}.`);
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AdCreativePerformance data={DEMO_SET} sort={sort} format={format} compareIds={ids}
        onSortChange={d => { setSort(d.sort); setFormat(d.format); setEvent(`onSortChange fired: ${d.sort} · ${d.format}.`); }}
        onCompare={onCompare} />
      <div className="w-full max-w-[1040px]">
        <DemoBar note={<>Example data — not real client results.{event && <span className="ml-1.5 text-ink-2" aria-live="polite">{event}</span>}</>}>
          <DemoButton icon="grid" onClick={() => {
            const top = rankCreatives(DEMO_SET.creatives, sort, format).slice(0, 2);
            setIds(top.map(d => d.c.id));
            setEvent(`Comparing the top two by ${sort === "conversions" ? "conversions" : sort.toUpperCase()}: ${top.map(d => d.c.name).join(" vs ")}.`);
          }}>Compare top two</DemoButton>
          <DemoButton icon="refresh" onClick={() => { setIds([]); setSort("ctr"); setFormat("all"); setEvent(""); }}>Reset</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "data", type: "CreativeSet", description: "{ eyebrow?, title?, subtitle?, period?, currency? (USD), locale? (en-US), creatives, source? }." },
    { name: "data.creatives[]", type: "Creative", description: "{ id, name, format: image | video | carousel, duration? (video), slides? (carousel), copy?, impressions, clicks, spend, conversions, art? }. CTR, cost per click, conversion rate and cost per conversion are worked out from the raw counts." },
    { name: "creatives[].art", type: "{ pattern, invert?, text? }", description: "Stand-in artwork: sun, stripes, dots, arch, blocks, wave or type (with text). Seeded per id, so it is stable." },
    { name: "sort · defaultSort", type: `"ctr" | "cpa" | "spend" | "conversions"`, description: "Controlled or initial sort (default ctr). CPA sorts low → high, the rest high → low." },
    { name: "format · defaultFormat", type: `"all" | "image" | "video" | "carousel"`, description: "Controlled or initial format filter (default all). Chips with zero creatives are hidden." },
    { name: "compareIds · defaultCompareIds", type: "string[]", description: "Controlled or initial comparison, up to two creative ids." },
    { name: "className", type: "string", description: "Extra classes for the outer element (max width 1040px)." },
  ],
  usage: `import { AdCreativePerformance } from "./AdCreativePerformance";

<AdCreativePerformance
  data={{
    title: "New-patient offer",
    currency: "USD",
    creatives: [
      { id: "smile-30", name: "Smile in 30 days", format: "video", duration: "0:15",
        impressions: 182400, clicks: 3612, spend: 2140, conversions: 96,
        art: { pattern: "sun" } },
    ],
  }}
  defaultSort="ctr"
  onSortChange={({ sort, format }) => console.log(sort, format)}
  onCompare={({ ids, winner }) => console.log(ids, winner)}
/>`,
  events: [
    { name: "onSortChange", description: "{ sort, format } — when the sort or the format filter changes." },
    { name: "onCompare", description: "{ ids, creatives (each with impressions, clicks, spend, conversions, ctr, cpc, cvr, cpa), winner, wins } — whenever the picked creatives change." },
  ],
  notes: [
    "The comparison scores five metrics (spend has no winner): higher CTR, conversion rate and conversions win; lower cost per click and cost per conversion win.",
    "In narrow containers (under 480px) the comparison opens as a bottom sheet you can minimise.",
    "rankCreatives(creatives, sort, format) is exported so you can reproduce the gallery order (the demo uses it for Compare top two).",
  ],
};
