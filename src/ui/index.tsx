import { Children, cloneElement, isValidElement, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { motion } from "motion/react";
import { useClipboard, useCountUp, usePreviewMode, useReducedMotion } from "../lib/hooks";

/* ------------------------------------------------------------
   Shared, accessible primitives. They carry behaviour and a
   neutral default look; every component themes them through
   className / indicatorClassName so each keeps its own identity.
   ------------------------------------------------------------ */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------------- icons ---------------- */
const paths: Record<string, ReactNode> = {
  check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="2" /><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" /></>,
  arrowRight: <path d="M3 8h10M9 4l4 4-4 4" />,
  arrowLeft: <path d="M13 8H3M7 4 3 8l4 4" />,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDown: <path d="M8 3v10M4 9l4 4 4-4" />,
  chevronDown: <path d="M4 6l4 4 4-4" />,
  chevronRight: <path d="M6 4l4 4-4 4" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></>,
  sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>,
  moon: <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" />,
  external: <path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5" />,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.2V11M8 5v.2" /></>,
  refresh: <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" />,
  play: <path d="M5 3.5v9l7-4.5-7-4.5Z" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  dot: <circle cx="8" cy="8" r="3" />,
  spark: <path d="M8 1.5 9.3 6.7 14.5 8 9.3 9.3 8 14.5 6.7 9.3 1.5 8l5.2-1.3Z" />,
  grid: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  command: <path d="M5.5 5.5h5v5h-5zM5.5 5.5V4A1.5 1.5 0 1 0 4 5.5h1.5M10.5 5.5V4A1.5 1.5 0 1 1 12 5.5h-1.5M5.5 10.5V12A1.5 1.5 0 1 1 4 10.5h1.5M10.5 10.5V12a1.5 1.5 0 1 0 1.5-1.5h-1.5" />,
};
export type IconName = keyof typeof paths;
export function Icon({ name, className = "size-4", strokeWidth = 1.6, title }: { name: IconName; className?: string; strokeWidth?: number; title?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}

/* ---------------- segmented control (radio group) ---------------- */
export type SegOption<T extends string> = { value: T; label: ReactNode; badge?: ReactNode; disabled?: boolean };

export function Segmented<T extends string>({
  value, onChange, options, ariaLabel, size = "md", className, buttonClassName, activeClassName, indicatorClassName,
}: {
  value: T; onChange: (v: T) => void; options: SegOption<T>[]; ariaLabel: string; size?: "sm" | "md";
  className?: string; buttonClassName?: string; activeClassName?: string; indicatorClassName?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let n = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : idx;
    for (let i = 0; i < options.length; i++) { if (dir) n = (n + dir + options.length) % options.length; if (!options[n].disabled) break; }
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKey}
      className={cx("relative inline-flex max-w-full items-center gap-0.5 rounded-xl border border-line bg-sunken/70 p-1", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            disabled={o.disabled} onClick={() => onChange(o.value)}
            className={cx("relative z-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-colors duration-200 disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
              on ? cx("text-ink", activeClassName) : "text-ink-3 hover:text-ink", buttonClassName)}>
            {on && <motion.span layoutId={`seg-${id}`} className={cx("absolute inset-0 -z-10 rounded-[9px] bg-surface elev-1", indicatorClassName)} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            {o.label}{o.badge}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- tabs ---------------- */
export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number };
/** Tab buttons only. Render the panel yourself with `tabPanelProps(id, value)`. */
export function Tabs<T extends string>({
  id, value, onChange, items, ariaLabel, className, tabClassName, activeClassName, indicatorClassName, variant = "underline",
}: {
  id: string; value: T; onChange: (v: T) => void; items: TabItem<T>[]; ariaLabel: string; className?: string;
  tabClassName?: string; activeClassName?: string; indicatorClassName?: string; variant?: "underline" | "pill";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, items.findIndex(t => t.value === value));
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };
    let n = e.key in map ? (idx + map[e.key] + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault(); onChange(items[n].value); refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKey} className={cx("relative flex gap-1", variant === "underline" && "border-b border-line", className)}>
      {items.map((t, i) => {
        const on = t.value === value;
        return (
          <button key={t.value} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`${id}-tab-${t.value}`} aria-selected={on} aria-controls={`${id}-panel`} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx("relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors", on ? cx("text-ink", activeClassName) : "text-ink-3 hover:text-ink", tabClassName)}>
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-sunken px-1.5 text-[11px] tabular text-ink-3">{t.count}</span>}
            {on && (variant === "underline"
              ? <motion.span layoutId={`${id}-ind`} className={cx("absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink", indicatorClassName)} transition={{ type: "spring", stiffness: 420, damping: 36 }} />
              : <motion.span layoutId={`${id}-ind`} className={cx("absolute inset-0 -z-10 rounded-lg bg-sunken", indicatorClassName)} transition={{ type: "spring", stiffness: 420, damping: 36 }} />)}
          </button>
        );
      })}
    </div>
  );
}
export const tabPanelProps = (id: string, value: string) => ({ role: "tabpanel" as const, id: `${id}-panel`, "aria-labelledby": `${id}-tab-${value}`, tabIndex: 0 });

/* ---------------- tooltip ---------------- */
/** Hover / focus tooltip. The child must be a focusable element or carry tabIndex. */
export function Tooltip({ content, children, side = "top", className }: { content: ReactNode; children: ReactElement<Record<string, unknown>>; side?: "top" | "bottom"; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const child = Children.only(children);
  if (!isValidElement(child)) return child;
  const trigger = cloneElement(child, {
    "aria-describedby": open ? id : undefined,
    onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true), onBlur: () => setOpen(false),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); },
  });
  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <motion.span role="tooltip" id={id}
          initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16 }}
          className={cx("pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-canvas shadow-lg",
            side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]", className)}>
          {content}
        </motion.span>
      )}
    </span>
  );
}

/* ---------------- animated number ---------------- */
export function CountUp({ value, format = v => Math.round(v).toLocaleString("en-US"), duration, start = true, className }: { value: number; format?: (v: number) => string; duration?: number; start?: boolean; className?: string }) {
  const v = useCountUp(value, { duration, start });
  return <span className={cx("tabular", className)}>{format(v)}</span>;
}

/* ---------------- copy button ---------------- */
export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className, fallbackEl, onCopied }: { text: string; label?: string; copiedLabel?: string; className?: string; fallbackEl?: () => HTMLElement | null; onCopied?: () => void }) {
  const { copy, copied } = useClipboard();
  return (
    <button type="button" onClick={async () => { await copy(text, fallbackEl?.()); onCopied?.(); }}
      className={cx("inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-all hover:border-line-strong hover:text-ink active:scale-[0.97]", className)}>
      <span className="relative grid size-3.5 place-items-center">
        <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
          <Icon name={copied ? "check" : "copy"} className="size-3.5" />
        </motion.span>
      </span>
      <span aria-live="polite">{copied === "copied" ? copiedLabel : copied === "selected" ? "Selected — press Ctrl+C" : label}</span>
    </button>
  );
}

/* ---------------- skeleton ---------------- */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cx("skeleton block rounded-md", className)} style={style} />;
}

/* ---------------- entrance reveal + stagger ---------------- */
export function Reveal({ children, delay = 0, y = 14, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" | "span" }) {
  const reduced = useReducedMotion();
  const preview = usePreviewMode();
  const M = motion[as];
  if (preview) { const Tag = as; return <Tag className={className}>{children}</Tag>; }
  return (
    <M className={className} initial={reduced ? { opacity: 0 } : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduced ? 0.2 : 0.6, ease: [0.16, 1, 0.3, 1], delay }}>
      {children}
    </M>
  );
}

/** Variants for staggered lists: <motion.ul variants={stagger.list} initial="hide" animate="show"> + <motion.li variants={stagger.item}>. */
export const stagger = {
  list: { hide: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } },
  item: { hide: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } },
};

/* ---------------- demo bar (page mode) ---------------- */
/** Sits under a component on its gallery page: the example-data note + demo controls. */
export function DemoBar({ note, children }: { note: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12.5px]">
      <p className="flex items-center gap-2 text-ink-3"><Icon name="info" className="size-3.5" />{note}</p>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Small labelled group for demo controls inside a DemoBar. */
export function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

export function DemoButton({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: IconName }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-all hover:border-line-strong hover:text-ink active:scale-[0.97]">
      {icon && <Icon name={icon} className="size-3.5" />}{children}
    </button>
  );
}
