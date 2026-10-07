import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, cx } from "../../ui";
import { useClipboard, usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";

/* ------------------------------------------------------------
   Agent Log Card — one AI-agent task, shaped like a ticket stub.
   The prompt (IN) sits above the perforation, the result (OUT)
   below it. The notches are real cut-outs (CSS mask), so the card
   works on any background.
   ------------------------------------------------------------ */

export type AgentLogStatus = "draft" | "selected" | "submitted" | (string & {});

export interface AgentLogCardProps {
  task: string;
  agent: string;
  type: string;
  /** YYYY-MM-DD, shown as "25 Sep 2026". */
  date: string;
  /** draft · selected · submitted. Any other string shows a neutral pill, capitalised. */
  status: AgentLogStatus;
  week?: number;
  entry?: number;
  /** Plain text. Line breaks are kept; common indentation is trimmed. */
  prompt: string;
  /** Rich content: paragraphs, lists, <code>, <AgentLogChips>. */
  result: ReactNode;
  className?: string;
}

/** Trim blank edge lines and the indentation every line shares (tabs count as two spaces). */
export function dedentPrompt(text: string): string {
  const lines = String(text).replace(/\t/g, "  ").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter(l => l.trim()).map(l => (/^ */.exec(l)?.[0].length ?? 0));
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.slice(min)).join("\n");
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const KNOWN: Record<string, string> = { draft: "Draft", selected: "Selected", submitted: "Submitted" };
const CLAMP_LINES = 9;
const NOTCH = 11;

/* Per-component palette (light + dark). Text pairs are ≥ 4.5:1 in both themes. */
const THEME = [
  "[--acc:#1E6B62] dark:[--acc:#5FC2B2]",
  "[--acc-soft:#DDEEEB] dark:[--acc-soft:#1B3632]",
  "[--on-acc:#F4FBFA] dark:[--on-acc:#0B1A18]",
  "[--paper:#FCFDFC] dark:[--paper:#161C1F]",
  "[--stub:#F7FAF9] dark:[--stub:#141A1D]",
  "[--well:#EEF3F2] dark:[--well:#1D2528]",
  "[--edge:#D9E1DF] dark:[--edge:#2A3337]",
  "[--perf:#C3CECB] dark:[--perf:#3A4549]",
  "[--glow:rgb(30_107_98/0.10)] dark:[--glow:rgb(95_194_178/0.09)]",
  "[--shade:rgb(18_42_38/0.20)] dark:[--shade:rgb(0_0_0/0.55)]",
  "[--draft:#8A5A0E] dark:[--draft:#E3B25E] [--draft-bg:#F8EDD8] dark:[--draft-bg:#33280F]",
  "[--sel:#2B57C4] dark:[--sel:#86A6F5] [--sel-bg:#E2E9FA] dark:[--sel-bg:#1A2544]",
  "[--sub:#18693B] dark:[--sub:#6BD097] [--sub-bg:#DDF1E4] dark:[--sub-bg:#13301F]",
].join(" ");

const GRAIN: CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%27.9%27 numOctaves=%272%27 stitchTiles=%27stitch%27/><feColorMatrix values=%270 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.4 -0.45%27/></filter><rect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/></svg>\")",
  backgroundSize: "160px 160px",
};
/* 1px outline: an inset ring for the straight edges + a ring just outside each notch */
const ring = (x: string) => `radial-gradient(circle ${NOTCH + 1.5}px at ${x} var(--seam, 50%), #0000 ${NOTCH}px, var(--edge) ${NOTCH + 0.4}px, var(--edge) ${NOTCH + 1}px, #0000 ${NOTCH + 1.5}px)`;
const OUTLINE: CSSProperties = { boxShadow: "inset 0 0 0 1px var(--edge)", backgroundImage: `${ring("0")}, ${ring("100%")}` };

/* ---------------- status pill ---------------- */
function StatusPill({ status }: { status: AgentLogStatus }) {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const key = String(status || "draft").trim().toLowerCase() || "draft";
  const label = KNOWN[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
  const tone =
    key === "draft" ? "text-[var(--draft)] bg-[var(--draft-bg)]"
    : key === "selected" ? "text-[var(--sel)] bg-[var(--sel-bg)]"
    : key === "submitted" ? "text-[var(--sub)] bg-[var(--sub-bg)]"
    : "text-ink-2 bg-[var(--well)]";
  return (
    <motion.span layout role="status" aria-live="polite" transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cx("inline-flex h-[26px] items-center gap-[7px] overflow-hidden rounded-full pl-[9px] pr-[11px] text-[12px] font-semibold tracking-[0.01em] transition-colors duration-300", tone)}>
      <motion.span layout="position" className="relative grid size-3 shrink-0 place-items-center" aria-hidden>
        <AnimatePresence initial={false} mode="popLayout">
          {key === "submitted" ? (
            <motion.span key="check" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              className="grid size-3 place-items-center rounded-full bg-[var(--sub)] text-[var(--sub-bg)]">
              <Icon name="check" className="size-[9px]" strokeWidth={2.6} />
            </motion.span>
          ) : (
            <motion.span key="dot" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
              className="relative size-[7px] rounded-full bg-current">
              {key === "draft" && !reduced && !preview && (
                <motion.span className="absolute -inset-1 rounded-full border-[1.5px] border-current"
                  initial={{ scale: 0.5, opacity: 0.7 }} animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 2.4, ease: "easeOut", repeat: 2, repeatDelay: 0.2 }} />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <motion.span layout="position" className="relative grid">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={label} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }} className="whitespace-nowrap">
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </motion.span>
  );
}

/* ---------------- result helpers ---------------- */
/** A row of small mono tags for the result (file names, tech, outcomes). */
export function AgentLogChips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}
export function AgentLogChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--edge)] bg-[var(--paper)] px-2.5 py-[7px] font-mono text-[12px] leading-none text-ink-2 transition-[color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[var(--acc)] hover:text-[var(--acc)] motion-reduce:hover:translate-y-0">
      {children}
    </span>
  );
}

function IOLabel({ tag, label, solid }: { tag: string; label: string; solid?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-ink">
      <span className={cx("rounded-md px-[7px] pb-1 pt-[5px] font-mono text-[10px] font-medium leading-none tracking-[0.1em]",
        solid ? "bg-[var(--acc)] text-[var(--on-acc)]" : "bg-[var(--acc-soft)] text-[var(--acc)]")}>{tag}</span>
      {label}
    </span>
  );
}

/* ---------------- card ---------------- */
export function AgentLogCard({ task, agent, type, date, status, week, entry, prompt, result, className }: AgentLogCardProps) {
  const uid = useId();
  const promptId = `${uid}-prompt`;
  const text = dedentPrompt(prompt ?? "");
  const rootRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<{ full: number; clamp: number } | null>(null);
  const { copy, copied } = useClipboard();

  /* measure the prompt: its natural height and the 9-line clamp height */
  useLayoutEffect(() => {
    const el = preRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || 21;
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const full = Math.ceil(el.scrollHeight);
      const clamp = Math.round(lh * CLAMP_LINES + pad);
      setM(p => (p && p.full === full && p.clamp === clamp ? p : { full, clamp }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  /* keep the notches on the seam between IN and OUT (no re-render: a CSS variable) */
  useLayoutEffect(() => {
    const top = topRef.current, paper = paperRef.current;
    if (!top || !paper) return;
    const set = () => paper.style.setProperty("--seam", `${top.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(top);
    return () => ro.disconnect();
  }, []);

  const over = !!m && m.full > m.clamp + 2;
  const height = !m ? undefined : open || !over ? m.full : m.clamp;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const hole = (x: string) => `radial-gradient(circle ${NOTCH + 0.5}px at ${x} var(--seam, 50%), #0000 ${NOTCH}px, #000 ${NOTCH + 0.5}px)`;
  const maskStyle: CSSProperties = {
    maskImage: `${hole("0")}, ${hole("100%")}`,
    WebkitMaskImage: `${hole("0")}, ${hole("100%")}`,
    maskSize: "51% 100%", WebkitMaskSize: "51% 100%",
    maskPosition: "0 0, 100% 0", WebkitMaskPosition: "0 0, 100% 0",
    maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
  };

  const copyLabel = copied === "copied" ? "Copied" : copied === "selected" ? "Selected — press Ctrl+C" : "Copy";
  const eyebrow = [week != null && Number.isFinite(week) ? ["Week", pad2(week)] : null, entry != null && Number.isFinite(entry) ? ["Entry", pad2(entry)] : null].filter(Boolean) as [string, string][];

  return (
    <article ref={rootRef} onPointerMove={onMove}
      className={cx("group/alc @container relative w-full max-w-[680px] text-ink", THEME, className)}>
      {/* the lift moves the whole ticket; the shadow is a separate layer behind the notched paper */}
      <div className="relative transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover/alc:-translate-y-[3px] motion-reduce:transition-none motion-reduce:group-hover/alc:translate-y-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[0_2px_6px_-3px_var(--shade),0_22px_44px_-30px_var(--shade)] transition-shadow duration-500 group-hover/alc:shadow-[0_4px_10px_-5px_var(--shade),0_34px_60px_-34px_var(--shade)] @lg:rounded-[20px]" />
        <div ref={paperRef} style={maskStyle}
          className="relative overflow-hidden rounded-[18px] bg-[var(--paper)] @lg:rounded-[20px]">
          {/* paper: faint teal wash at the top, a cooler stub below the tear */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc)_5%,var(--paper))_0%,var(--paper)_34%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--seam,50%)] bg-[var(--stub)]" />
          {/* paper grain: a cached noise tile, no blend mode (cheap to composite) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.035]" style={GRAIN} />
          {/* pointer glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/alc:opacity-100 bg-[radial-gradient(460px_circle_at_var(--mx,70%)_var(--my,-10%),var(--glow),transparent_62%)]" />

          {/* ============ IN ============ */}
          <div ref={topRef} className="relative grid gap-[18px] px-5 pb-[22px] pt-5 @lg:gap-[22px] @lg:px-[30px] @lg:pb-[26px] @lg:pt-[26px]">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.09em] text-ink-3">
                {eyebrow.length ? eyebrow.map(([k, v], i) => (
                  <span key={k} className="inline-flex items-center gap-2">
                    {i > 0 && <i className="not-italic opacity-60" aria-hidden>/</i>}
                    <span>{k} <b className="font-medium text-ink-2">{v}</b></span>
                  </span>
                )) : <span>Agent Log</span>}
              </span>
              <StatusPill status={status} />
            </header>

            <h2 className="-mt-1 font-display text-[clamp(22px,5.2cqi,30px)] font-semibold leading-[1.12] tracking-[-0.018em] text-balance text-ink">
              {task?.trim() || "Untitled task"}
            </h2>

            <dl className="m-0 grid border-y border-[var(--edge)] @lg:grid-cols-[1.25fr_1fr_0.9fr]">
              {([
                ["Agent", (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-[var(--acc)] shadow-[0_0_0_3px_var(--acc-soft)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover/alc:rotate-45 motion-reduce:transition-none" />
                    <span>{agent?.trim() || "—"}</span>
                  </span>
                )],
                ["Task type", type?.trim() || "—"],
                ["Date", <time dateTime={date} className="tabular">{date ? fmtDate(date) : "—"}</time>],
              ] as [string, ReactNode][]).map(([k, v], i) => (
                <div key={k} className={cx("flex min-w-0 items-baseline justify-between gap-4 py-[11px] @lg:block @lg:px-4 @lg:py-[13px]",
                  i > 0 && "border-t border-[var(--edge)] @lg:border-l @lg:border-t-0", i === 0 && "@lg:pl-0")}>
                  <dt className="shrink-0 font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.09em] text-ink-3 @lg:mb-2">{k}</dt>
                  <dd className="m-0 min-w-0 text-right text-[14.5px] font-medium leading-[1.35] [overflow-wrap:anywhere] @lg:text-left">{v}</dd>
                </div>
              ))}
            </dl>

            <section className="grid gap-3" aria-label="Prompt / Workflow">
              <div className="flex min-h-7 items-center justify-between gap-2.5">
                <IOLabel tag="IN" label="Prompt / Workflow" />
                <button type="button" onClick={() => copy(text, preRef.current)}
                  className={cx("inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-[7px] text-[12px] font-medium leading-none transition-colors duration-200 hover:border-[var(--edge)] hover:bg-[var(--well)] focus-visible:outline-[var(--acc)]",
                    copied ? "text-[var(--acc)]" : "text-ink-2 hover:text-ink")}>
                  <span className="relative grid size-[13px] place-items-center" aria-hidden>
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 26 }}>
                        <Icon name={copied ? "check" : "copy"} className="size-[13px]" />
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span aria-live="polite">{copyLabel}</span>
                  <span className="sr-only">{copied ? "" : " prompt"}</span>
                </button>
              </div>

              <div
                style={height === undefined ? { maxHeight: `calc(1.65em * ${CLAMP_LINES} + 28px)` } : { height }}
                className="relative overflow-hidden transition-[height] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none rounded-xl bg-[var(--well)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--edge)_55%,transparent)]">
                <pre ref={preRef} id={promptId}
                  className="relative m-0 whitespace-pre-wrap py-3.5 pl-[30px] pr-4 font-mono text-[12.5px] leading-[1.65] text-ink [overflow-wrap:anywhere] before:absolute before:left-[13px] before:top-[13px] before:font-medium before:text-[var(--acc)] before:content-['›'] @lg:pl-9 @lg:text-[13px] @lg:before:left-4">
                  {text}
                </pre>
                <div aria-hidden className={cx("pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_bottom,transparent,var(--well)_88%)] transition-opacity duration-300",
                  over && !open ? "opacity-100" : "opacity-0")} />
              </div>

              {over && (
                <button type="button" aria-expanded={open} aria-controls={promptId} onClick={() => setOpen(o => !o)}
                  className="-mt-1 inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-transparent py-[7px] pl-0 pr-2.5 text-[12px] font-medium leading-none text-ink-2 transition-[padding,background-color,color,border-color] duration-200 hover:border-[var(--edge)] hover:bg-[var(--well)] hover:pl-2.5 hover:text-ink focus-visible:outline-[var(--acc)]">
                  <Icon name="chevronDown" className={cx("size-[13px] transition-transform duration-300", open && "rotate-180")} />
                  {open ? "Collapse prompt" : "Show full prompt"}
                </button>
              )}
            </section>
          </div>

          {/* ============ tear ============ */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[22px] top-[var(--seam,50%)] h-[2px] -translate-y-1/2 bg-[linear-gradient(to_right,var(--perf)_55%,transparent_0)] bg-[length:9px_2px] transition-[background-position] duration-[1200ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover/alc:bg-[position:36px_0] motion-reduce:transition-none" />

          {/* ============ OUT ============ */}
          <section aria-label="Result" className="relative grid gap-3 px-5 pb-5 pt-[22px] @lg:px-[30px] @lg:pb-[30px] @lg:pt-[26px]">
            <div className="flex min-h-7 items-center"><IOLabel tag="OUT" label="Result" solid /></div>
            <div className={cx("max-w-[64ch] text-[15px] leading-[1.62] text-ink",
              "[&>*]:m-0 [&>*+*]:mt-3",
              "[&_ul]:grid [&_ul]:list-none [&_ul]:gap-1.5 [&_ul]:p-0",
              "[&_li]:relative [&_li]:pl-[18px] [&_li]:text-ink-2",
              "[&_li]:before:absolute [&_li]:before:left-0.5 [&_li]:before:top-[0.8em] [&_li]:before:h-[1.5px] [&_li]:before:w-2 [&_li]:before:bg-[var(--acc)] [&_li]:before:content-['']",
              "[&_code]:rounded-[5px] [&_code]:bg-[var(--well)] [&_code]:px-[5px] [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.88em]",
              "[&_a]:text-[var(--acc)] [&_a]:underline [&_a]:underline-offset-2")}>
              {result}
            </div>
          </section>
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={OUTLINE} />
        </div>
      </div>
    </article>
  );
}
