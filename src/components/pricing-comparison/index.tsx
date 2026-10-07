import { useState } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { ControlGroup, DemoBar, Segmented } from "../../ui";
import { PricingComparison } from "./PricingComparison";
import { demoPricing, type Billing, type PlanSelectDetail } from "./data";

type PlanId = "starter" | "growth" | "scale";

export function Demo({ mode }: { mode: DemoMode }) {
  const [featured, setFeatured] = useState<PlanId>("growth");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [picked, setPicked] = useState<PlanSelectDetail | null>(null);

  const card = (
    <PricingComparison {...demoPricing} featured={featured} billing={billing} onBillingChange={setBilling}
      onPlanSelect={mode === "page" ? setPicked : undefined} />
  );
  if (mode === "preview") return card;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {card}
      <div className="w-full max-w-[980px]">
        <DemoBar note={
          <span aria-live="polite">
            {picked
              ? <><b className="font-semibold text-ink">{picked.name} · {picked.billing}</b> selected — onPlanSelect fired. Example plans, not real pricing.</>
              : <><b className="font-semibold text-ink">Example plans</b> — not real pricing.</>}
          </span>
        }>
          <ControlGroup label="Popular plan">
            <Segmented<PlanId> size="sm" ariaLabel="Highlighted plan" value={featured} onChange={setFeatured}
              options={[{ value: "starter", label: "Starter" }, { value: "growth", label: "Growth" }, { value: "scale", label: "Scale" }]} />
          </ControlGroup>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "tiers", type: "PricingTier[]", description: "The plans, in display order." },
    { name: "tiers[].id · name", type: "string", description: "Plan key and display name." },
    { name: "tiers[].description", type: "string", description: "One-line summary of who the plan is for." },
    { name: "tiers[].price", type: "{ monthly, yearly } | number | null", description: "Both are per-month prices; yearly is the per-month price when billed yearly. Use null with priceLabel (e.g. \"Custom\") for quote-only plans." },
    { name: "tiers[].priceNote", type: "string", description: "Replaces the billing line under the price." },
    { name: "tiers[].cta", type: "{ label, href? }", description: "Plan button. Without href it renders a <button>." },
    { name: "tiers[].features", type: "(string | { text, included })[]", description: "Strings are included; { included: false } shows as not included." },
    { name: "tiers[].badge", type: "string", description: "Label on the highlighted plan (default \"Most popular\")." },
    { name: "featured", type: "string", description: "Id of the plan to raise and badge. The highlight slides between plans when it changes." },
    { name: "billing / defaultBilling", type: "\"monthly\" | \"yearly\"", description: "Controlled or starting billing period. The yearly \"Save\" badge is worked out from the plan prices." },
    { name: "currency · locale", type: "string", description: "ISO currency code (default USD) and number locale (default en-US)." },
    { name: "eyebrow · title · subtitle · footnote", type: "string", description: "Optional header text and the line under the plans." },
    { name: "labels", type: "Partial<PricingLabels>", description: "Override any built-in text (Monthly, Yearly, /mo, Most popular…)." },
  ],
  usage: `import { PricingComparison } from "./components/pricing-comparison/PricingComparison";

<PricingComparison
  title="Plans that grow with you"
  currency="USD"
  featured="growth"
  defaultBilling="monthly"
  tiers={[
    {
      id: "growth", name: "Growth",
      description: "For small teams.",
      price: { monthly: 79, yearly: 64 },
      cta: { label: "Choose Growth", href: "/signup" },
      features: ["5 workspaces", { text: "SSO", included: false }],
    },
  ]}
  onPlanSelect={({ id, billing, price }) => track("plan_select", { id, billing, price })}
  onBillingChange={billing => console.log(billing)}
/>`,
  events: [
    { name: "onPlanSelect(detail)", description: "A plan's button was clicked: { id, name, billing, price, currency }." },
    { name: "onBillingChange(billing)", description: "The monthly / yearly switch changed." },
  ],
  notes: [
    "Prices roll digit by digit when the billing period changes; the billing line and savings update with them.",
    "Plan rows (name, blurb, price, billing, button, features) line up across plans with CSS subgrid.",
    "Below ~768px the plans stack with the featured plan first; on phones each feature list collapses behind a disclosure button.",
  ],
};
