/* Types + demo data for the Pricing Comparison Card. */

export type Billing = "monthly" | "yearly";

/** A feature line. Plain strings are "included". */
export interface PlanFeature {
  text: string;
  /** Defaults to true. `false` renders the row as "Not included". */
  included?: boolean;
}

export interface PricingTier {
  /** Plan key (used by `featured` and in `onPlanSelect`). */
  id: string;
  name: string;
  /** One-line summary of who the plan is for. */
  description?: string;
  /**
   * Per-month prices. `yearly` is the per-month price when billed yearly.
   * A single number is used for both; `null` shows `priceLabel` (quote-only plans).
   */
  price: { monthly: number | null; yearly: number | null } | number | null;
  /** Shown instead of a price when the price is null (default "Custom"). */
  priceLabel?: string;
  /** Replaces the billing line under the price. */
  priceNote?: string;
  /** Unit after the price (default "/mo"). */
  per?: string;
  /** Button text, and an optional link. Without `href` it renders a button. */
  cta?: { label: string; href?: string };
  features: (string | PlanFeature)[];
  /** Badge text on the highlighted plan (default "Most popular"). */
  badge?: string;
  /** Heading above the feature list (default "What's included"). */
  includesLabel?: string;
}

export interface PlanSelectDetail {
  id: string;
  name: string;
  billing: Billing;
  /** Per-month price for the chosen billing period (null for quote-only plans). */
  price: number | null;
  currency: string;
}

export interface PricingContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  currency?: string;
  footnote?: string;
  tiers: PricingTier[];
}

/* Demo content — example plans, not real pricing (kept verbatim from the original). */
export const demoPricing: PricingContent = {
  eyebrow: "Pricing",
  title: "Plans that grow with your client list",
  subtitle: "Start small and move up when you need more. Change or cancel your plan at any time.",
  currency: "USD",
  footnote: "Prices in USD, before tax.",
  tiers: [
    {
      id: "starter",
      name: "Starter",
      description: "For solo operators getting their first automations live.",
      price: { monthly: 29, yearly: 24 },
      cta: { label: "Start with Starter" },
      features: [
        "1 workspace",
        "Up to 2,500 contacts",
        "10 active workflows",
        "Email support",
        { text: "Custom reporting", included: false },
        { text: "API & webhooks", included: false },
      ],
    },
    {
      id: "growth",
      name: "Growth",
      description: "For small teams running campaigns for several clients.",
      price: { monthly: 79, yearly: 64 },
      cta: { label: "Choose Growth" },
      features: [
        "5 workspaces",
        "Up to 25,000 contacts",
        "Unlimited workflows",
        "Priority email & chat support",
        "Custom reporting",
        "API & webhooks",
      ],
    },
    {
      id: "scale",
      name: "Scale",
      description: "For agencies managing many client accounts at once.",
      price: { monthly: 199, yearly: 159 },
      cta: { label: "Choose Scale" },
      features: [
        "Unlimited workspaces",
        "Up to 250,000 contacts",
        "Unlimited workflows",
        "Dedicated success manager",
        "Custom reporting",
        "API & webhooks",
      ],
    },
  ],
};
