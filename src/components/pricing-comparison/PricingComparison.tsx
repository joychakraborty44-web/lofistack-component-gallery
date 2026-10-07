import { AnimatePresence, LayoutGroup, motion, type Variants } from "motion/react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Segmented, cx, stagger } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { useElementWidth } from "./useElementWidth";
import type { Billing, PlanFeature, PlanSelectDetail, PricingTier } from "./data";

export interface PricingLabels {
  toggle: string; monthly: string; yearly: string; per: string;
  billedMonthly: string; billedYearly: string; save: string;
  saveBadge: string; saveBadgeUpTo: string; badge: string;
  includes: string; excluded: string; announce: string; perMonth: string;
}

const LABELS: PricingLabels = {
  toggle: "Billing period", monthly: "Monthly", yearly: "Yearly", per: "/mo",
  billedMonthly: "Billed monthly", billedYearly: "{total} billed yearly", save: "save {amount}",
  saveBadge: "Save {pct}%", saveBadgeUpTo: "Save up to {pct}%",
  badge: "Most popular", includes: "What's included", excluded: "Not included",
  announce: "Showing {period} prices", perMonth: "per month",
};

export interface PricingComparisonProps {
  tiers: PricingTier[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Line under the plans. */
  footnote?: string;
  /** ISO currency code (default USD). */
  currency?: string;
  /** Number locale (default en-US). */
  locale?: string;
  /** Id of the plan to highlight. */
  featured?: string;
  /** Controlled billing period. */
  billing?: Billing;
  /** Starting billing period when uncontrolled (default "monthly"). */
  defaultBilling?: Billing;
  onBillingChange?: (billing: Billing) => void;
  /** Fired by a plan's button with the plan, billing period and price. */
  onPlanSelect?: (detail: PlanSelectDetail) => void;
  /** Override any built-in text. */
  labels?: Partial<PricingLabels>;
  className?: string;
}

/* ---------- helpers ---------- */
const staggerItem: Variants = { hide: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function pricesOf(t: PricingTier): { m: number | null; y: number | null } {
  const p = t.price;
  if (p !== null && typeof p === "object") return { m: num(p.monthly), y: num(p.yearly) };
  const n = num(p);
  return { m: n, y: n };
}

function formatParts(v: number, currency: string, locale: string): Intl.NumberFormatPart[] {
  const digits = Number.isInteger(v) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).formatToParts(v);
  } catch {
    return [{ type: "currency", value: `${currency} ` }, { type: "integer", value: v.toFixed(digits) }];
  }
}
const money = (v: number, currency: string, locale: string) => formatParts(v, currency, locale).map(p => p.value).join("");

const toFeature = (f: string | PlanFeature): Required<PlanFeature> =>
  typeof f === "string" ? { text: f, included: true } : { text: f.text, included: f.included !== false };

/* ---------- rolling price ---------- */
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ROW = 1.1; // em — height of one digit cell

function Digit({ d, delay }: { d: number; delay: number }) {
  return (
    <span className="relative inline-block">
      <span className="invisible">0</span>
      <motion.span className="absolute left-0 top-0 flex flex-col" initial={false}
        animate={{ y: `${-d * ROW}em` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}>
        {DIGITS.map(n => <span key={n} className="block h-[1.1em] text-center">{n}</span>)}
      </motion.span>
    </span>
  );
}

function RollingPrice({ parts, delay }: { parts: Intl.NumberFormatPart[]; delay: number }) {
  const curIdx = parts.findIndex(p => p.type === "currency");
  const intIdx = parts.findIndex(p => p.type === "integer");
  const cur = curIdx >= 0 ? parts[curIdx].value.trim() : "";
  const chars = [...parts.filter(p => p.type !== "currency" && p.type !== "literal").map(p => p.value).join("")];
  const symbol = cur && <span className="mt-[0.24em] text-[0.44em] leading-none tracking-normal text-[var(--pc-muted)]">{cur}</span>;
  return (
    <span aria-hidden className="inline-flex items-start">
      {curIdx < intIdx && symbol && <span className="mr-[0.06em] inline-flex">{symbol}</span>}
      <span className="inline-flex h-[1.1em] overflow-hidden leading-[1.1] [mask-image:linear-gradient(to_bottom,transparent,#000_9%,#000_91%,transparent)]">
        {chars.map((ch, i) => {
          const k = chars.length - i; // key by place value so columns line up when the digit count changes
          return /\d/.test(ch)
            ? <Digit key={`d${k}`} d={+ch} delay={delay + i * 0.035} />
            : <span key={`s${k}`}>{ch}</span>;
        })}
      </span>
      {curIdx > intIdx && symbol && <span className="ml-[0.1em] inline-flex">{symbol}</span>}
    </span>
  );
}

/* ---------- icons ---------- */
const Check = () => <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2.5 6.3 5 8.6 9.6 3.6" /></svg>;
const Dash = () => <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden><path d="M3.5 6h5" /></svg>;
const Spark = ({ className }: { className?: string }) => <svg viewBox="0 0 12 12" className={className} fill="currentColor" aria-hidden><path d="M6 .8 7.3 4.7 11.2 6 7.3 7.3 6 11.2 4.7 7.3.8 6l3.9-1.3z" /></svg>;
const Arrow = () => <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-300 ease-out group-hover/cta:translate-x-[3px] motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" /></svg>;

/* ---------- palette (light + dark) ---------- */
const TOKENS = [
  "[--pc-card:#FBF8F3] [--pc-raise:#FFFFFF] [--pc-ink:#1C1815] [--pc-muted:#625A51] [--pc-faint:#736A60]",
  "[--pc-line:#E6DFD4] [--pc-tint:#F3EDE4] [--pc-acc:#C2470F] [--pc-acc-deep:#A13A0B] [--pc-on-acc:#FFF8F3]",
  "[--pc-soft:#FBE6D8] [--pc-shadow:rgba(48,30,14,0.24)] [--pc-glow:rgba(214,98,36,0.08)]",
  "dark:[--pc-card:#1B1815] dark:[--pc-raise:#25201B] dark:[--pc-ink:#F2ECE4] dark:[--pc-muted:#B3A99E] dark:[--pc-faint:#9A9085]",
  "dark:[--pc-line:#352E28] dark:[--pc-tint:#221E1A] dark:[--pc-acc:#FF8F54] dark:[--pc-acc-deep:#FFA875] dark:[--pc-on-acc:#2A1206]",
  "dark:[--pc-soft:rgba(255,143,84,0.15)] dark:[--pc-shadow:rgba(0,0,0,0.6)] dark:[--pc-glow:rgba(255,143,84,0.06)]",
].join(" ");

/* ---------- one plan ---------- */
interface TierProps {
  tier: PricingTier; index: number; uid: string; featured: boolean; billing: Billing;
  stacked: boolean; compact: boolean; labels: PricingLabels; currency: string; locale: string;
  onSelect?: (d: PlanSelectDetail) => void;
}

function Tier({ tier, index, uid, featured, billing, stacked, compact, labels: L, currency, locale, onSelect }: TierProps) {
  const preview = usePreviewMode();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(featured);
  const { m, y } = pricesOf(tier);
  const v = billing === "yearly" ? (y ?? m) : (m ?? y);
  const feats = tier.features.map(toFeature);
  const listId = `${uid}-${tier.id}-features`;
  const nameId = `${uid}-${tier.id}-name`;
  const showList = !compact || open;

  let bill: ReactNode = "";
  if (tier.priceNote != null) bill = tier.priceNote;
  else if (v === null) bill = "";
  else if (billing === "yearly" && y !== null) {
    const saved = m !== null ? (m - y) * 12 : 0;
    bill = <>{fill(L.billedYearly, { total: money(y * 12, currency, locale) })}{saved > 0 && <> · <b className="font-semibold text-[var(--pc-acc-deep)]">{fill(L.save, { amount: money(saved, currency, locale) })}</b></>}</>;
  } else bill = L.billedMonthly;

  const ctaLabel = tier.cta?.label || "Choose plan";
  const select = () => onSelect?.({ id: tier.id, name: tier.name, billing, price: v, currency });
  const ctaClass = cx(
    "group/cta relative mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border px-[18px] text-[14px] font-semibold transition-[background-color,color,border-color,box-shadow,scale] duration-200 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--pc-acc)] motion-reduce:transition-none",
    featured
      ? "border-[var(--pc-acc)] bg-[var(--pc-acc)] text-[var(--pc-on-acc)] shadow-[0_12px_22px_-14px_var(--pc-acc)] hover:border-[var(--pc-acc-deep)] hover:bg-[var(--pc-acc-deep)]"
      : "border-[var(--pc-line)] bg-[var(--pc-card)] text-[var(--pc-ink)] hover:border-[var(--pc-ink)] hover:bg-[var(--pc-ink)] hover:text-[var(--pc-card)]",
  );

  return (
    <motion.article
      layout={stacked ? "position" : false}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      aria-labelledby={nameId}
      className={cx(
        "group relative grid rounded-2xl border p-5 @lg:grid-cols-2 @lg:p-[22px] @3xl:row-span-6 @3xl:grid-cols-1 @3xl:grid-rows-subgrid @3xl:rounded-none @3xl:border-0 @3xl:px-6 @3xl:pb-6 @3xl:pt-[22px]",
        "@3xl:[article+&]:border-l @3xl:[article+&]:border-solid",
        "transition-[translate] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        featured ? "z-10 border-transparent @3xl:[article+&]:border-transparent" : "border-[var(--pc-line)] @3xl:[article+&]:border-[var(--pc-line)]",
      )}>
      {/* hover tint (non-featured) and the raised highlight (featured) — the highlight slides between plans */}
      {!featured && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-[var(--pc-tint)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 @3xl:-inset-x-px" />}
      {featured && (
        <motion.span layoutId={`${uid}-featured`} aria-hidden transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="pointer-events-none absolute inset-0 rounded-2xl border-[1.5px] border-[var(--pc-acc)] bg-[var(--pc-raise)] shadow-[0_0_0_5px_var(--pc-soft),0_28px_50px_-34px_var(--pc-shadow)] transition-shadow duration-500 group-hover:shadow-[0_0_0_5px_var(--pc-soft),0_38px_64px_-36px_var(--pc-shadow)] @3xl:-inset-x-px @3xl:-inset-y-4" />
      )}

      <div className="relative flex min-w-0 flex-col @lg:pr-6 @3xl:contents">
        <header className="relative flex min-h-7 flex-wrap items-center justify-between gap-x-2.5 gap-y-2">
          <h3 id={nameId} className="font-serif text-[23px] font-medium leading-[1.15] tracking-[-0.01em]">{tier.name}</h3>
            {featured && (
              <motion.span key="badge" initial={preview ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pc-acc)] py-1.5 pl-2 pr-2.5 font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-[var(--pc-on-acc)]">
                <Spark className="size-[11px] transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:rotate-[72deg] motion-reduce:transition-none" />
                {tier.badge || L.badge}
              </motion.span>
            )}
        </header>
        <p className="relative mt-2 max-w-[34ch] text-[14px] leading-normal text-[var(--pc-muted)]">{tier.description}</p>

        <div className="relative mt-[22px] flex flex-wrap items-end gap-x-1.5 font-serif text-[44px] font-medium leading-none tracking-[-0.03em] [font-variant-numeric:lining-nums_tabular-nums] @3xl:text-[50px]">
          {v === null
            ? <span>{tier.priceLabel || "Custom"}</span>
            : <>
                <RollingPrice parts={formatParts(v, currency, locale)} delay={preview ? 0 : index * 0.05} />
                <span className="sr-only">{money(v, currency, locale)} {L.perMonth}</span>
                <span aria-hidden className="mb-[0.32em] font-sans text-[13px] font-medium tracking-normal text-[var(--pc-muted)]">{tier.per || L.per}</span>
              </>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={billing} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, delay: preview ? 0 : index * 0.04 }}
            className="relative mt-2 min-h-[1.4em] text-[12.5px] leading-[1.4] tabular text-[var(--pc-muted)]">
            {bill}
          </motion.p>
        </AnimatePresence>

        {tier.cta?.href
          ? <a href={tier.cta.href} onClick={select} className={ctaClass}><span>{ctaLabel}</span><Arrow /></a>
          : <button type="button" onClick={select} className={ctaClass}><span>{ctaLabel}</span><Arrow /></button>}
      </div>

      <div className={cx("relative mt-6 border-t border-dashed border-[var(--pc-line)] pt-5",
        "@lg:mt-0 @lg:border-l @lg:border-t-0 @lg:pl-6 @lg:pt-1 @3xl:mt-6 @3xl:border-l-0 @3xl:border-t @3xl:pl-0 @3xl:pt-5")}>
        {compact ? (
          <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(o => !o)}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--pc-acc)]">
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.09em] text-[var(--pc-faint)]">{tier.includesLabel || L.includes}</span>
            <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--pc-muted)]">
              {feats.filter(f => f.included).length} of {feats.length}
              <svg viewBox="0 0 16 16" className={cx("size-3.5 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6l4 4 4-4" /></svg>
            </span>
          </button>
        ) : (
          <p className="font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.09em] text-[var(--pc-faint)]">{tier.includesLabel || L.includes}</p>
        )}
        <AnimatePresence initial={false}>
          {showList && (
            <motion.div key="list" id={listId} className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}>
              <motion.ul className="grid gap-2.5 pt-3" variants={stagger.list} initial={preview ? false : "hide"} whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                {feats.map((f, n) => (
                  <motion.li key={f.text + n} variants={staggerItem}
                    className={cx("grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2.5 text-[14px] leading-[1.45]", !f.included && "text-[var(--pc-faint)]")}>
                    <span style={{ transitionDelay: `${n * 35}ms` }}
                      className={cx("mt-px grid size-[18px] place-items-center rounded-full transition-colors duration-200 motion-reduce:transition-none",
                        f.included
                          ? "bg-[var(--pc-soft)] text-[var(--pc-acc-deep)] group-hover:bg-[var(--pc-acc)] group-hover:text-[var(--pc-on-acc)]"
                          : "text-[var(--pc-faint)] shadow-[inset_0_0_0_1px_var(--pc-line)]")}>
                      {f.included ? <Check /> : <Dash />}
                    </span>
                    <span>{!f.included && <span className="sr-only">{L.excluded}: </span>}{f.text}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/* ---------- the card ---------- */
export function PricingComparison({
  tiers, eyebrow, title, subtitle, footnote, currency = "USD", locale = "en-US", featured,
  billing: billingProp, defaultBilling = "monthly", onBillingChange, onPlanSelect, labels, className,
}: PricingComparisonProps) {
  const L = useMemo(() => ({ ...LABELS, ...labels }), [labels]);
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLElement>(null);
  const width = useElementWidth(rootRef);
  const [inner, setInner] = useState<Billing>(defaultBilling);
  const [announce, setAnnounce] = useState("");
  const billing = billingProp ?? inner;
  const cur = currency.toUpperCase();

  const stacked = width < 768;  // matches the @3xl container breakpoint
  const compact = width < 512;  // matches @lg — phones get collapsible feature lists

  // biggest yearly saving across plans, rounded down so it never overstates
  const save = useMemo(() => {
    const pcts = tiers.map(pricesOf).filter(p => p.m !== null && p.m > 0 && p.y !== null && p.y < p.m).map(p => Math.floor((1 - (p.y as number) / (p.m as number)) * 100));
    const top = pcts.length ? Math.max(...pcts) : 0;
    return top > 0 ? fill(pcts.every(x => x === top) ? L.saveBadge : L.saveBadgeUpTo, { pct: top }) : "";
  }, [tiers, L]);

  const setBilling = (b: Billing) => {
    if (b === billing) return;
    if (billingProp === undefined) setInner(b);
    setAnnounce(fill(L.announce, { period: (b === "yearly" ? L.yearly : L.monthly).toLowerCase() }));
    onBillingChange?.(b);
  };

  const featuredId = featured ?? undefined;
  const ordered = stacked && featuredId ? [...tiers].sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId)) : tiers;
  const titleId = `${uid}-title`;

  return (
    <section ref={rootRef} aria-labelledby={title ? titleId : undefined} className={cx("@container w-full max-w-[980px] font-sans", TOKENS, className)}>
      <div className={cx(
        "grain relative rounded-[20px] border border-[var(--pc-line)] px-3.5 pb-4 pt-5 text-[var(--pc-ink)] @lg:px-5 @lg:pb-5 @lg:pt-6 @3xl:rounded-[22px] @3xl:px-[30px] @3xl:pb-6 @3xl:pt-[30px]",
        "[background:radial-gradient(110%_55%_at_50%_0%,var(--pc-glow),transparent_62%),var(--pc-card)]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_30px_60px_-44px_var(--pc-shadow),0_2px_6px_-4px_var(--pc-shadow)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_30px_60px_-40px_var(--pc-shadow)]",
      )}>
        <header className="relative flex flex-wrap items-end justify-between gap-x-7 gap-y-[18px]">
          <div className="grid max-w-[46ch] gap-2">
            {eyebrow && <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--pc-acc-deep)]">{eyebrow}</span>}
            {title && <h2 id={titleId} className="text-balance font-serif text-[26px] font-medium leading-[1.08] tracking-[-0.015em] @3xl:text-[34px]">{title}</h2>}
            {subtitle && <p className="text-[14.5px] leading-[1.55] text-[var(--pc-muted)]">{subtitle}</p>}
          </div>
          <Segmented<Billing>
            ariaLabel={L.toggle} value={billing} onChange={setBilling}
            className="w-full shrink-0 rounded-full! border-[var(--pc-line)]! bg-[var(--pc-tint)]! @lg:w-auto"
            buttonClassName="flex-1 rounded-full! px-4! py-2.5! text-[13px]! font-semibold! @lg:flex-none focus-visible:outline-[var(--pc-acc)]"
            activeClassName="text-[var(--pc-ink)]!"
            indicatorClassName="rounded-full! bg-[var(--pc-raise)]! shadow-[0_1px_2px_var(--pc-shadow),0_0_0_1px_var(--pc-line)]!"
            options={[
              { value: "monthly", label: L.monthly },
              {
                value: "yearly", label: L.yearly,
                badge: save ? (
                  <span className={cx("ml-0.5 rounded-full px-[7px] py-1 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.06em] transition-colors duration-300",
                    billing === "yearly" ? "bg-[var(--pc-acc)] text-[var(--pc-on-acc)]" : "bg-[var(--pc-soft)] text-[var(--pc-acc-deep)]")}>{save}</span>
                ) : undefined,
              },
            ]}
          />
        </header>

        <LayoutGroup id={uid}>
          <div className="relative mt-6 grid gap-3 @3xl:mt-[34px] @3xl:grid-cols-3 @3xl:gap-0 @3xl:py-4">
            {ordered.map(t => (
              <Tier key={t.id} tier={t} index={tiers.indexOf(t)} uid={uid} featured={t.id === featuredId} billing={billing}
                stacked={stacked} compact={compact} labels={L} currency={cur} locale={locale} onSelect={onPlanSelect} />
            ))}
          </div>
        </LayoutGroup>

        {footnote && <p className="relative mt-3.5 text-center text-[12.5px] text-[var(--pc-faint)]">{footnote}</p>}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </section>
  );
}
