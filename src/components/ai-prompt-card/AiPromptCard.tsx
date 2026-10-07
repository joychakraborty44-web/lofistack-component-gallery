import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type FocusEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Icon, Segmented, Tabs, cx, tabPanelProps } from "../../ui";
import { usePreviewMode, useReducedMotion } from "../../lib/hooks";
import { fmtDate } from "../../lib/format";
import type { PromptData, PromptVariable, PromptVersion } from "./data";

/* ------------------------------------------------------------
   AI Prompt Card — a saved prompt shown like a file in a code
   editor. The editor surface stays dark in both themes.
   ------------------------------------------------------------ */

export const PROMPT_LABELS = {
  versions: "Prompt versions", view: "View", template: "Template", preview: "Preview",
  variables: "Variables", filled: "{n} of {total} filled", uses: "{n}×", unused: "Not used in {version}",
  reset: "Reset variables", copy: "Copy prompt", copied: "Copied", selected: "Selected · press Ctrl+C",
  chars: "chars", tokens: "tokens", lines: "{n} lines", edited: "Edited {date}",
  changed: "New since {prev}", changedCount: "{n} new", latest: "latest",
  codeLabel: "Prompt {version}, {mode} view", announceVersion: "Showing {version}", announceReset: "Variables reset to their defaults",
  announceCopy: "Prompt copied, {chars} characters", announceSelect: "Clipboard unavailable. Prompt text selected.",
  undefinedNote: "{list} appear in the text but have no input.", empty: "This version has no text yet.",
  suggestions: "{label} suggestions",
};
export type PromptLabels = typeof PROMPT_LABELS;
export type PromptMode = "template" | "preview";

export interface PromptCopyDetail {
  version: string;
  text: string;
  chars: number;
  /** Rough guide: characters ÷ 4. */
  tokens: number;
  values: Record<string, string>;
  method: "clipboard" | "selection";
}

export interface AiPromptCardHandle {
  setVariable: (key: string, value: string) => void;
  resetVariables: () => void;
  /** Copies the filled-in prompt. Resolves false when the text had to be selected instead. */
  copy: () => Promise<boolean>;
  filledText: () => string;
}

export interface AiPromptCardProps {
  prompt: PromptData;
  /** Controlled version id. */
  version?: string;
  /** Uncontrolled starting version (falls back to `prompt.activeVersion`, then the last version). */
  defaultVersion?: string;
  onVersionChange?: (version: string) => void;
  /** Controlled view mode. */
  mode?: PromptMode;
  defaultMode?: PromptMode;
  onModeChange?: (mode: PromptMode) => void;
  onVariableChange?: (key: string, value: string) => void;
  onCopy?: (detail: PromptCopyDetail) => void;
  /** Override any built-in text. */
  labels?: Partial<PromptLabels>;
  className?: string;
  ref?: Ref<AiPromptCardHandle>;
}

/* ---------------- text helpers ---------------- */
const VAR_SRC = String.raw`\{\{\s*([A-Za-z_]\w*)\s*\}\}`;
const KEY_RE = /^[A-Za-z_]\w*$/;
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

type Tok =
  | { kind: "text" | "num" | "hash" | "bullet"; text: string }
  | { kind: "var"; key: string };
interface Line { text: string; heading: boolean; toks: Tok[]; isNew: boolean }

function plain(s: string, heading: boolean, out: Tok[]) {
  if (heading) { out.push({ kind: "text", text: s }); return; }
  s.split(/(\b\d+\b)/).forEach((part, i) => { if (part) out.push({ kind: i % 2 ? "num" : "text", text: part }); });
}

function tokenize(line: string): { heading: boolean; toks: Tok[] } {
  const toks: Tok[] = [];
  let rest = line;
  const h = /^(#{1,6})(\s.*)?$/.exec(line);
  const b = !h ? /^(\s*)([-*•]|\d+[.)])(\s+)/.exec(line) : null;
  if (h) { toks.push({ kind: "hash", text: h[1] }); rest = h[2] || ""; }
  else if (b) {
    if (b[1]) toks.push({ kind: "text", text: b[1] });
    toks.push({ kind: "bullet", text: b[2] }, { kind: "text", text: b[3] });
    rest = line.slice(b[0].length);
  }
  const re = new RegExp(VAR_SRC, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    if (m.index > last) plain(rest.slice(last, m.index), !!h, toks);
    toks.push({ kind: "var", key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < rest.length) plain(rest.slice(last), !!h, toks);
  return { heading: !!h, toks };
}

/* ---------------- small inline icons ---------------- */
const FileIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[17px]">
    <path d="M11.5 2.5H6A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5z" /><path d="M11.5 2.5v4h4M7.5 10.5l-1.5 1.5 1.5 1.5M12.5 10.5l1.5 1.5-1.5 1.5" />
  </svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden className="size-3 text-[var(--violet)]"><path d="M6 .6 7.4 4.6 11.4 6 7.4 7.4 6 11.4 4.6 7.4.6 6l4-1.4z" /></svg>
);
const BracesIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="size-[13px]">
    <path d="M5.5 2.5c-1.5 0-2 .6-2 2v1.6c0 .9-.5 1.4-1.5 1.9 1 .5 1.5 1 1.5 1.9v1.6c0 1.4.5 2 2 2M10.5 2.5c1.5 0 2 .6 2 2v1.6c0 .9.5 1.4 1.5 1.9-1 .5-1.5 1-1.5 1.9v1.6c0 1.4-.5 2-2 2" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-[13px]">
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" />
  </svg>
);

/* Editor palette. The surface stays dark in both themes; the gallery's
   neutral tokens are re-pointed inside it so the shared primitives match. */
const PALETTE = [
  "[--bg:#0F1024] [--bar:#0A0B1B] [--panel:#131430] [--raise:#1B1C3C] [--edge:#262850] [--edge-soft:#1A1B39]",
  "[--text:#E4E5F7] [--muted:#A6A8CF] [--faint:#8A8DBA] [--violet:#A78BFA] [--violet-strong:#7C3AED]",
  "[--amber:#FCD34D] [--amber-bg:rgb(251_191_36/0.13)] [--amber-line:rgb(251_191_36/0.4)] [--green:#6EE7B7] [--red:#FDA4AF] [--red-bg:rgb(251_113_133/0.14)] [--num:#7DD3FC]",
  "[--glow:rgb(23_16_60/0.45)]",
  "dark:[--bg:#0C0D1E] dark:[--bar:#08091A] dark:[--panel:#10112A] dark:[--glow:rgb(0_0_0/0.7)]",
  /* re-pointed gallery tokens for primitives inside the editor */
  "[--ink:var(--text)] [--ink-2:var(--muted)] [--ink-3:var(--muted)] [--line:var(--edge)] [--line-strong:#3A3D74] [--surface:var(--raise)] [--sunken:var(--bar)] [--ring:var(--violet)]",
].join(" ");

export function AiPromptCard({
  prompt, version: versionProp, defaultVersion, onVersionChange, mode: modeProp, defaultMode = "template", onModeChange,
  onVariableChange, onCopy, labels, className, ref,
}: AiPromptCardProps) {
  const L = useMemo(() => ({ ...PROMPT_LABELS, ...labels }), [labels]);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const preview = usePreviewMode();
  const reduced = useReducedMotion();

  const versions = useMemo<PromptVersion[]>(
    () => (prompt.versions ?? []).filter(Boolean).map((v, i) => ({ ...v, id: String(v.id || `v${i + 1}`) })),
    [prompt.versions]);
  const defs = useMemo<PromptVariable[]>(() => (prompt.variables ?? []).filter(v => v && KEY_RE.test(v.key || "")), [prompt.variables]);
  const defKeys = useMemo(() => new Set(defs.map(d => d.key)), [defs]);
  const defaultsOf = useCallback(() => Object.fromEntries(defs.map(d => [d.key, d.default == null ? "" : String(d.default)])), [defs]);
  const resolve = useCallback((want?: string) => versions.find(v => v.id === want)?.id ?? versions[versions.length - 1]?.id ?? "", [versions]);

  const [values, setValues] = useState<Record<string, string>>(defaultsOf);
  const [innerVersion, setInnerVersion] = useState(() => resolve(defaultVersion ?? prompt.activeVersion));
  const [innerMode, setInnerMode] = useState<PromptMode>(defaultMode);

  // A new prompt resets the variables and the version (like swapping files in an editor).
  const [seen, setSeen] = useState(prompt);
  if (seen !== prompt) {
    setSeen(prompt);
    setValues(defaultsOf());
    setInnerVersion(resolve(defaultVersion ?? prompt.activeVersion));
  }

  const versionId = resolve(versionProp ?? innerVersion);
  const mode: PromptMode = (modeProp ?? innerMode) === "preview" ? "preview" : "template";
  const idx = versions.findIndex(v => v.id === versionId);
  const current = idx > -1 ? versions[idx] : null;
  const prevVersion = idx > 0 ? versions[idx - 1] : null;

  /* live region */
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((t: string) => { setAnnouncement(""); requestAnimationFrame(() => setAnnouncement(t)); }, []);

  /* ---------- derived ---------- */
  const text = current?.text ?? "";
  const lines = useMemo<Line[]>(() => {
    const prevSet = prevVersion ? new Set(prevVersion.text.split(/\r?\n/).map(s => s.trim())) : null;
    return (text ? text.split(/\r?\n/) : []).map(t => ({ text: t, ...tokenize(t), isNew: !!(prevSet && t.trim() && !prevSet.has(t.trim())) }));
  }, [text, prevVersion]);
  const changedCount = lines.filter(l => l.isNew).length;

  const used = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of text.matchAll(new RegExp(VAR_SRC, "g"))) out[m[1]] = (out[m[1]] || 0) + 1;
    return out;
  }, [text]);
  const undefinedKeys = Object.keys(used).filter(k => !defKeys.has(k));

  const filled = useMemo(
    () => text.replace(new RegExp(VAR_SRC, "g"), (m, k: string) => (defKeys.has(k) && (values[k] ?? "").trim() ? values[k] : m)),
    [text, defKeys, values]);
  const chars = filled.length;
  const tokens = Math.ceil(chars / 4);
  const filledN = defs.filter(d => (values[d.key] ?? "").trim()).length;

  /* ---------- actions ---------- */
  const selectVersion = (id: string) => {
    if (id === versionId) return;
    if (versionProp === undefined) setInnerVersion(id);
    onVersionChange?.(id);
    announce(fill(L.announceVersion, { version: id }));
  };
  const setMode = useCallback((m: PromptMode) => {
    if (modeProp === undefined) setInnerMode(m);
    onModeChange?.(m);
  }, [modeProp, onModeChange]);

  const setVariable = useCallback((key: string, value: string) => {
    if (!defKeys.has(key)) return;
    setValues(v => ({ ...v, [key]: value }));
    onVariableChange?.(key, value);
  }, [defKeys, onVariableChange]);

  const resetVariables = useCallback(() => { setValues(defaultsOf()); announce(L.announceReset); }, [defaultsOf, announce, L.announceReset]);

  /* copy: clipboard first, otherwise switch to Preview and select the text */
  const codeRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<null | "copied" | "selected">(null);
  const [selectPending, setSelectPending] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  const flash = (s: "copied" | "selected") => {
    setCopyState(s);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState(null), 1800);
  };
  useEffect(() => {
    if (!selectPending || !codeRef.current) return;
    const r = document.createRange(); r.selectNodeContents(codeRef.current);
    const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
    setSelectPending(false);
  }, [selectPending, mode]);

  const copy = useCallback(async () => {
    const detail = { version: versionId, text: filled, chars: filled.length, tokens: Math.ceil(filled.length / 4), values: { ...values } };
    try {
      await navigator.clipboard.writeText(filled);
      flash("copied");
      announce(fill(L.announceCopy, { chars: filled.length.toLocaleString("en-US") }));
      onCopy?.({ ...detail, method: "clipboard" });
      return true;
    } catch {
      if (mode !== "preview") setMode("preview");
      setSelectPending(true);
      flash("selected");
      announce(L.announceSelect);
      onCopy?.({ ...detail, method: "selection" });
      return false;
    }
  }, [versionId, filled, values, mode, setMode, announce, onCopy, L.announceCopy, L.announceSelect]);

  useImperativeHandle(ref, () => ({ setVariable, resetVariables, copy, filledText: () => filled }), [setVariable, resetVariables, copy, filled]);

  /* ---------- linking: hovering or focusing a variable lights up its pills and its field ---------- */
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const linkKey = hoverKey ?? focusKey;

  /* caret blinks only while the editor itself has focus */
  const [codeFocused, setCodeFocused] = useState(false);

  const tabsId = `apc-${uid}`;
  const showTabs = versions.length > 1;
  const codeLabel = fill(L.codeLabel, { version: versionId, mode: (mode === "preview" ? L.preview : L.template).toLowerCase() });
  const panelProps = showTabs ? tabPanelProps(tabsId, versionId) : { role: "region" as const, tabIndex: 0 };
  const meta = current ? [current.updated ? fill(L.edited, { date: fmtDate(current.updated, { year: false }) }) : "", current.note ?? ""].filter(Boolean).join(" · ") : "";

  return (
    <div className={cx("@container w-full max-w-[1000px] text-[var(--text)] [color-scheme:dark]", PALETTE, className)}>
      <article
        data-mode={mode}
        className="relative overflow-hidden rounded-2xl bg-[var(--bg)] shadow-[0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.05),0_40px_70px_-44px_var(--glow),0_4px_12px_-6px_var(--glow)] dark:shadow-[0_0_0_1px_rgb(167_139_250/0.16),inset_0_1px_0_rgb(255_255_255/0.05),0_40px_80px_-40px_var(--glow)]">
        {/* top hairline glow */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--violet)] to-transparent opacity-60" />
        <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[60%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_58_237/0.18),transparent)]" />

        {/* ---------- title bar ---------- */}
        <header className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-[var(--edge)] bg-[var(--bar)] px-3.5 py-3 @lg:px-[18px] @lg:py-3.5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-x-3 gap-y-2 @lg:flex-nowrap">
            <span className="grid size-[34px] flex-none place-items-center rounded-[9px] bg-[rgb(139_92_246/0.18)] text-[var(--violet)] shadow-[inset_0_0_0_1px_rgb(167_139_250/0.32)]">
              <FileIcon />
            </span>
            <div className="grid min-w-0 flex-[1_1_calc(100%-46px)] gap-[3px] @lg:flex-initial">
              <h2 className="m-0 font-display text-[15.5px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">{prompt.name || "Untitled prompt"}</h2>
              {prompt.description && <span className="text-[12.5px] leading-snug text-[var(--muted)]">{prompt.description}</span>}
            </div>
            {prompt.model && (
              <span className="ml-[46px] inline-flex flex-none items-center gap-1.5 rounded-full bg-[var(--raise)] px-2.5 py-1.5 font-mono text-[11.5px] leading-none shadow-[inset_0_0_0_1px_var(--edge)] @lg:ml-0">
                <SparkIcon />{prompt.model}
                {prompt.temperature != null && Number.isFinite(+prompt.temperature) && <i className="not-italic text-[var(--muted)]">· temp {(+prompt.temperature).toFixed(1)}</i>}
              </span>
            )}
          </div>
          {showTabs && (
            <Tabs id={tabsId} variant="pill" ariaLabel={L.versions} value={versionId} onChange={selectVersion}
              items={versions.map((v, i) => ({
                value: v.id,
                label: (
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {v.id}
                    {i === versions.length - 1 && <><span aria-hidden title={L.latest} className="size-[5px] rounded-full bg-[var(--green)] shadow-[0_0_6px_var(--green)]" /><span className="sr-only">({L.latest})</span></>}
                  </span>
                ),
              }))}
              className="isolate w-full gap-0.5 rounded-[10px] bg-[var(--bg)] p-[3px] shadow-[inset_0_0_0_1px_var(--edge)] @lg:w-auto [--ink:#fff] [--sunken:var(--violet-strong)]"
              tabClassName="flex-1 justify-center rounded-[7px] px-3 py-[7px] font-mono text-[12.5px] font-semibold @lg:flex-none"
              indicatorClassName="shadow-[0_6px_16px_-8px_var(--violet-strong)]" />
          )}
        </header>

        {/* ---------- body ---------- */}
        <div className="grid @3xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid min-w-0 grid-rows-[auto_1fr]">
            <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 border-b border-[var(--edge-soft)] px-3 py-2.5 @lg:pl-[18px] @lg:pr-3.5">
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px] leading-snug text-[var(--faint)] [overflow-wrap:anywhere]">
                <Icon name="chevronRight" className="size-3 opacity-70" />
                <span>{prompt.path ? prompt.path.replace(/\/?$/, "/") : ""}<b className="font-medium text-[var(--text)]">{versionId}.md</b></span>
              </span>
              <Segmented<PromptMode> size="sm" ariaLabel={L.view} value={mode} onChange={setMode}
                className="w-full rounded-[9px] p-0.5 @lg:w-auto" buttonClassName="flex-1 @lg:flex-none rounded-[7px]" indicatorClassName="rounded-[7px] shadow-[inset_0_0_0_1px_var(--edge)]"
                options={[
                  { value: "template", label: <><BracesIcon />{L.template}</> },
                  { value: "preview", label: <><EyeIcon />{L.preview}</> },
                ]} />
            </div>

            <div
              ref={codeRef}
              {...panelProps}
              aria-label={codeLabel}
              onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)}
              className="relative max-h-[380px] overflow-auto py-2.5 font-mono text-[12px] leading-[1.75] [scrollbar-color:var(--edge)_transparent] [scrollbar-width:thin] focus-visible:outline-offset-[-2px] @lg:max-h-[430px] @lg:pt-3.5 @lg:pb-[18px] @lg:text-[13px]"
              onPointerOver={e => { const k = (e.target as HTMLElement).closest<HTMLElement>("[data-var]")?.dataset.var ?? null; setHoverKey(k); }}
              onPointerLeave={() => setHoverKey(null)}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={`${prompt.name}-${versionId}`}
                  initial={preview ? false : { opacity: 0, y: 5, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>
                  {lines.length === 0 && <p className="m-0 px-[18px] py-6 font-sans text-[13px] text-[var(--muted)]">{L.empty}</p>}
                  {lines.map((line, i) => (
                    <div key={i} className="grid min-h-[1.75em] grid-cols-[34px_minmax(0,1fr)] transition-colors duration-200 hover:bg-white/[0.025] @lg:grid-cols-[52px_minmax(0,1fr)]">
                      <span aria-hidden className={cx("relative select-none pr-2.5 text-right tabular @lg:pr-4", line.isNew ? "text-[var(--muted)]" : "text-[var(--faint)]")}>
                        {line.isNew && (
                          <motion.span className="absolute left-0 top-[3px] bottom-[3px] w-[3px] origin-top rounded-r-[3px] bg-[var(--violet)] shadow-[0_0_8px_rgb(167_139_250/0.6)]"
                            initial={preview ? false : { scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }}
                            transition={{ delay: 0.08 + i * 0.018, duration: 0.3, ease: "easeOut" }} />
                        )}
                        {i + 1}
                      </span>
                      <span className={cx("whitespace-pre-wrap pr-3 [overflow-wrap:anywhere] @lg:pr-[18px]", line.heading && "font-semibold text-[var(--violet)]")}>
                        {line.toks.map((t, j) => {
                          if (t.kind === "hash") return <span key={j} className="mr-[0.1em] font-normal text-[var(--faint)]">{t.text}</span>;
                          if (t.kind === "bullet") return <span key={j} className="text-[var(--violet)]">{t.text}</span>;
                          if (t.kind === "num") return <span key={j} className="text-[var(--num)]">{t.text}</span>;
                          if (t.kind !== "var") return <span key={j}>{t.text}</span>;
                          const defined = defKeys.has(t.key);
                          const val = values[t.key] ?? "";
                          const empty = defined && !val.trim();
                          const showVal = mode === "preview" && defined && !empty;
                          const bad = !defined || (mode === "preview" && empty);
                          const linked = linkKey === t.key;
                          return (
                            <span key={j} data-var={t.key}
                              className={cx(
                                "mx-px rounded-[5px] px-[5px] py-px [box-decoration-break:clone] [-webkit-box-decoration-break:clone] transition-[background-color,box-shadow,color] duration-200",
                                bad
                                  ? "bg-[var(--red-bg)] text-[var(--red)] shadow-[inset_0_0_0_1px_rgb(253_164_175/0.45)]"
                                  : linked
                                    ? "bg-[rgb(251_191_36/0.28)] text-[var(--amber)] shadow-[inset_0_0_0_1px_var(--amber),0_0_0_3px_rgb(251_191_36/0.12)]"
                                    : "bg-[var(--amber-bg)] text-[var(--amber)] shadow-[inset_0_0_0_1px_var(--amber-line)]",
                                !defined && "underline decoration-[rgb(253_164_175/0.7)] decoration-wavy underline-offset-[3px]",
                                showVal ? "font-sans text-[0.97em] font-medium" : "font-medium")}>
                              {showVal ? val : <><span className="opacity-55">{"{{"}</span>{t.key}<span className="opacity-55">{"}}"}</span></>}
                            </span>
                          );
                        })}
                        {i === lines.length - 1 && (
                          <motion.span aria-hidden
                            className="ml-0.5 inline-block h-[1.15em] w-0.5 align-[-0.2em] bg-[var(--violet)]"
                            animate={codeFocused && !reduced && !preview ? { opacity: [1, 1, 0, 0] } : { opacity: 0.85 }}
                            transition={codeFocused && !reduced ? { duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: "linear" } : { duration: 0.15 }} />
                        )}
                      </span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ---------- variables ---------- */}
          <aside className="grid min-w-0 content-start gap-3.5 border-t border-[var(--edge)] bg-[var(--panel)] px-3 py-3.5 @lg:px-[18px] @lg:pt-4 @lg:pb-[18px] @3xl:border-t-0 @3xl:border-l"
            aria-labelledby={`${tabsId}-vars`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id={`${tabsId}-vars`} className="m-0 font-mono text-[11px] leading-none font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">{L.variables}</h3>
              {defs.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] leading-none text-[var(--muted)] tabular">
                  <motion.span aria-hidden className="size-[7px] rounded-full" animate={{ backgroundColor: filledN < defs.length ? "#FDA4AF" : "#6EE7B7" }} transition={{ duration: 0.25 }} />
                  {fill(L.filled, { n: filledN, total: defs.length })}
                </span>
              )}
            </div>
            <div className="grid gap-3 @xl:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] @3xl:grid-cols-1">
              {defs.map(def => {
                const id = `${tabsId}-var-${def.key}`;
                const n = used[def.key] || 0;
                const linked = linkKey === def.key;
                const val = values[def.key] ?? "";
                return (
                  <div key={def.key}
                    onPointerEnter={() => setHoverKey(def.key)} onPointerLeave={() => setHoverKey(null)}
                    onFocus={() => setFocusKey(def.key)}
                    onBlur={(e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusKey(k => (k === def.key ? null : k)); }}
                    className={cx("grid content-start gap-[7px] rounded-[11px] bg-[var(--bg)] px-3 pt-[11px] pb-3 transition-[box-shadow,opacity] duration-250",
                      linked ? "shadow-[inset_0_0_0_1px_var(--amber-line),0_0_0_3px_rgb(251_191_36/0.08)]" : "shadow-[inset_0_0_0_1px_var(--edge-soft)]",
                      !n && "opacity-60")}>
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={id} className="font-mono text-[12px] leading-none font-medium text-[var(--amber)] [overflow-wrap:anywhere]">{`{{${def.key}}}`}</label>
                      <span className="flex-none rounded-[5px] bg-[var(--edge-soft)] px-1.5 py-[3px] font-mono text-[10.5px] leading-none font-medium text-[var(--faint)]">
                        {n ? fill(L.uses, { n }) : fill(L.unused, { version: versionId })}
                      </span>
                    </div>
                    {def.label && <span id={`${id}-l`} className="text-[12.5px] text-[var(--muted)]">{def.label}</span>}
                    <input id={id} type="text" autoComplete="off" spellCheck={false} value={val}
                      placeholder={def.placeholder || def.label || def.key}
                      aria-describedby={def.label ? `${id}-l` : undefined}
                      onChange={e => setVariable(def.key, e.target.value)}
                      className="box-border min-h-9 w-full rounded-lg border border-[var(--edge)] bg-[var(--raise)] px-2.5 py-[7px] text-[13.5px] leading-snug text-[var(--text)] transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--faint)] hover:border-[#34376A] focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_rgb(139_92_246/0.22)] focus:outline-none" />
                    {!!def.suggestions?.length && (
                      <div role="group" aria-label={fill(L.suggestions, { label: def.label || def.key })} className="flex flex-wrap gap-[5px]">
                        {def.suggestions.slice(0, 6).map(s => {
                          const on = val === s;
                          return (
                            <button key={s} type="button" aria-pressed={on} onClick={() => setVariable(def.key, s)}
                              className={cx("rounded-full px-2 py-[5px] text-[11.5px] leading-none font-medium transition-[background-color,color,box-shadow] duration-200 active:scale-[0.97]",
                                on ? "bg-[var(--amber-bg)] text-[var(--amber)] shadow-[inset_0_0_0_1px_var(--amber-line)]" : "bg-[var(--edge-soft)] text-[var(--muted)] hover:bg-[var(--edge)] hover:text-[var(--text)]")}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {undefinedKeys.length > 0 && (
              <p className="m-0 flex gap-2 text-[12px] leading-[1.45] text-[var(--red)]">
                <Icon name="info" className="mt-px size-3.5" />
                {fill(L.undefinedNote, { list: undefinedKeys.map(k => `{{${k}}}`).join(", ") })}
              </p>
            )}
            {defs.length > 0 && (
              <button type="button" onClick={resetVariables}
                className="inline-flex min-h-[34px] items-center justify-center gap-[7px] justify-self-start rounded-lg border border-[var(--edge)] bg-transparent px-[13px] text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:border-[#3A3D74] hover:text-[var(--text)] active:scale-[0.98]">
                <Icon name="refresh" className="size-3.5" />{L.reset}
              </button>
            )}
          </aside>
        </div>

        {/* ---------- status bar ---------- */}
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-[var(--edge)] bg-[var(--bar)] p-3 @lg:py-2.5 @lg:pr-3.5 @lg:pl-[18px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11.5px] leading-snug text-[var(--muted)] tabular">
            <span><CountUp value={chars} duration={350} className="font-semibold text-[var(--text)]" /> {L.chars}</span>
            <span>≈ <CountUp value={tokens} duration={350} className="font-semibold text-[var(--text)]" /> {L.tokens}</span>
            <span aria-hidden className="hidden h-3 w-px bg-[var(--edge)] @lg:block" />
            <span>{fill(L.lines, { n: lines.length })}</span>
            {meta && <span className="text-[var(--faint)]">{meta}</span>}
            {changedCount > 0 && prevVersion && (
              <span className="inline-flex items-center gap-1.5 text-[var(--faint)]">
                <span aria-hidden className="h-[11px] w-[3px] rounded-sm bg-[var(--violet)]" />
                {fill(L.changed, { prev: prevVersion.id })} · {fill(L.changedCount, { n: changedCount })}
              </span>
            )}
          </div>
          <button type="button" onClick={() => void copy()}
            className={cx("relative inline-flex min-h-[34px] w-full items-center @lg:ml-auto justify-center gap-[7px] overflow-hidden rounded-lg border px-[13px] text-[12.5px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 active:scale-[0.98] @lg:w-auto",
              copyState
                ? "border-[#1E6A52] bg-[#0F3B2E] text-[var(--green)]"
                : "border-[var(--violet-strong)] bg-[var(--violet-strong)] text-white shadow-[0_10px_22px_-12px_var(--violet-strong)] hover:border-[#6D28D9] hover:bg-[#6D28D9]")}>
            <span className="relative grid size-3.5 place-items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={copyState ? "done" : "copy"} initial={{ scale: 0.4, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }} className="grid place-items-center">
                  <Icon name={copyState ? "check" : "copy"} className="size-3.5" strokeWidth={copyState ? 2 : 1.6} />
                </motion.span>
              </AnimatePresence>
            </span>
            <span>{copyState === "copied" ? L.copied : copyState === "selected" ? L.selected : L.copy}</span>
          </button>
        </footer>
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </article>
    </div>
  );
}
