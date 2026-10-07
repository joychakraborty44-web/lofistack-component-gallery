import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { CATEGORIES, COMPONENTS, type ComponentMeta } from "./registry";
import { Link, useRouter } from "../lib/router";
import { CopyButton, Icon, cx } from "../ui";
import { ErrorBoundary, prefetch, useModule } from "./load";

const pad = (n: number) => String(n).padStart(2, "0");
const catLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label ?? id;

function StageSkeleton() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4" aria-busy="true" aria-label="Loading component">
      <span className="skeleton h-6 w-1/3 rounded-lg" />
      <span className="skeleton h-72 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-4"><span className="skeleton h-20 rounded-xl" /><span className="skeleton h-20 rounded-xl" /><span className="skeleton h-20 rounded-xl" /></div>
    </div>
  );
}

function Pager({ meta }: { meta: ComponentMeta }) {
  const i = COMPONENTS.findIndex(c => c.slug === meta.slug);
  const prev = COMPONENTS[i - 1], next = COMPONENTS[i + 1];
  const card = "group flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong elev-1";
  return (
    <nav aria-label="Component pages" className="grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={`/components/${prev.slug}`} onMouseEnter={() => prefetch(prev.slug)} className={card}>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3"><Icon name="arrowLeft" className="size-3 transition-transform group-hover:-translate-x-0.5" />Previous · {pad(prev.num)}</span>
          <span className="font-display text-[16px] font-semibold text-ink">{prev.title}</span>
        </Link>
      ) : (
        <Link href="/" className={card}>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3"><Icon name="arrowLeft" className="size-3" />Back to</span>
          <span className="font-display text-[16px] font-semibold text-ink">All components</span>
        </Link>
      )}
      {next ? (
        <Link href={`/components/${next.slug}`} onMouseEnter={() => prefetch(next.slug)} className={cx(card, "sm:items-end sm:text-right")}>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Next · {pad(next.num)}<Icon name="arrowRight" className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
          <span className="font-display text-[16px] font-semibold text-ink">{next.title}</span>
        </Link>
      ) : (
        <Link href="/" className={cx(card, "sm:items-end sm:text-right")}>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Back to<Icon name="arrowRight" className="size-3" /></span>
          <span className="font-display text-[16px] font-semibold text-ink">All components</span>
        </Link>
      )}
    </nav>
  );
}

export function ComponentPage({ meta }: { meta: ComponentMeta }) {
  const { mod, error } = useModule(meta.slug);
  const { navigate } = useRouter();
  const usageRef = useRef<HTMLPreElement>(null);
  const i = COMPONENTS.findIndex(c => c.slug === meta.slug);

  useEffect(() => { document.title = `${meta.title} · LofiStack Components`; }, [meta.title]);
  // "[" / "]" step through components
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/input|textarea|select/i.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[" && COMPONENTS[i - 1]) navigate(`/components/${COMPONENTS[i - 1].slug}`);
      if (e.key === "]" && COMPONENTS[i + 1]) navigate(`/components/${COMPONENTS[i + 1].slug}`);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [i, navigate]);

  const Demo = mod?.Demo;
  const docs = mod?.docs;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      {/* intro */}
      <header className="max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          <Link href="/" className="hover:text-ink">Gallery</Link><Icon name="chevronRight" className="size-3" />
          <span>{catLabel(meta.category)}</span><Icon name="chevronRight" className="size-3" />
          <span className="text-brand">Component {pad(meta.num)} / {COMPONENTS.length}</span>
        </nav>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 font-display text-[clamp(2rem,4.6vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink text-balance">{meta.title}</motion.h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{meta.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {meta.tags.map(t => <span key={t} className="rounded-md bg-sunken px-2 py-1 text-[12px] text-ink-3">{t}</span>)}
          <CopyButton text={typeof location !== "undefined" ? location.href : ""} label="Copy link" className="ml-1" />
        </div>
      </header>

      {/* stage */}
      <section aria-label={`${meta.title} live demo`} className="relative mt-10 overflow-hidden rounded-[28px] border border-line bg-surface-2 elev-2">
        <div aria-hidden className="absolute inset-0 dot-grid opacity-70 [mask-image:radial-gradient(90%_80%_at_50%_30%,#000,transparent)]" />
        <div className="relative flex justify-center px-3 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          {error ? (
            <p className="py-20 text-ink-3">This component failed to load. <button type="button" className="underline" onClick={() => location.reload()}>Reload</button></p>
          ) : Demo ? (
            <ErrorBoundary resetKey={meta.slug} fallback={(e, reset) => (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="font-medium text-ink">Something went wrong in this demo.</p>
                <p className="max-w-md text-[13px] text-ink-3">{e.message}</p>
                <button type="button" onClick={reset} className="rounded-lg border border-line px-3 py-1.5 text-[13px]">Try again</button>
              </div>
            )}>
              <div className="w-full min-w-0"><Demo mode="page" /></div>
            </ErrorBoundary>
          ) : <StageSkeleton />}
        </div>
      </section>

      {/* docs */}
      {docs && (docs.fields.length > 0 || docs.usage) && (
        <section aria-label="Documentation" className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0 rounded-2xl border border-line bg-surface p-6 elev-1">
            <h2 className="font-display text-[18px] font-semibold text-ink">Props &amp; data</h2>
            <dl className="mt-4 divide-y divide-line">
              {docs.fields.map(f => (
                <div key={f.name} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
                  <dt className="min-w-0 break-words font-mono text-[12.5px] text-brand">{f.name}{f.type && <span className="block text-[11px] text-ink-3">{f.type}</span>}</dt>
                  <dd className="text-[13.5px] leading-relaxed text-ink-2">{f.description}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {docs.usage && (
              <div className="rounded-2xl border border-line bg-surface p-6 elev-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-[18px] font-semibold text-ink">Usage</h2>
                  <CopyButton text={docs.usage} fallbackEl={() => usageRef.current} />
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl bg-sunken">
                  <pre ref={usageRef} className="p-4 font-mono text-[12.5px] leading-relaxed text-ink"><code>{docs.usage}</code></pre>
                </div>
              </div>
            )}
            {docs.events && docs.events.length > 0 && (
              <div className="rounded-2xl border border-line bg-surface p-6 elev-1">
                <h2 className="font-display text-[18px] font-semibold text-ink">Callbacks</h2>
                <ul className="mt-3 space-y-2.5">
                  {docs.events.map(e => <li key={e.name} className="text-[13.5px] text-ink-2"><code className="font-mono text-[12.5px] text-brand">{e.name}</code> — {e.description}</li>)}
                </ul>
              </div>
            )}
            {docs.notes && docs.notes.length > 0 && (
              <ul className="space-y-2 px-1 text-[13px] text-ink-3">{docs.notes.map(n => <li key={n} className="flex gap-2"><Icon name="info" className="mt-0.5 size-3.5" />{n}</li>)}</ul>
            )}
          </div>
        </section>
      )}

      <div className="mt-12"><Pager meta={meta} /></div>
      <p className="mt-6 text-center font-mono text-[11px] text-ink-3">Tip: press <kbd>[</kbd> / <kbd>]</kbd> for the previous / next component</p>
    </div>
  );
}

/** Bare render of a component's preview mode at thumbnail width — used for QA. */
export function PreviewOnly({ meta }: { meta: ComponentMeta }) {
  const { mod } = useModule(meta.slug);
  const Demo = mod?.Demo;
  return (
    <div className="flex min-h-screen items-start justify-center bg-canvas p-10">
      <div style={{ width: 1100 }} className="flex justify-center">{Demo ? <Demo mode="preview" /> : null}</div>
    </div>
  );
}
