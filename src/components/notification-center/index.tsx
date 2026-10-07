import { useRef, useState, type ReactNode, type RefObject } from "react";
import type { ComponentDocs, DemoMode } from "../../gallery/registry";
import { DemoBar, DemoButton, cx } from "../../ui";
import { NC_TOKENS, NotificationCenter, type NotificationCenterHandle } from "./NotificationCenter";
import { demoNotifications, demoNow, demoSamples } from "./data";

/** A mock app window the bell lives in (decorative, hidden from assistive tech except the bell itself). */
function MockApp({ children, boundary }: { children: ReactNode; boundary: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={boundary} className={cx("@container grid min-h-[640px] w-full max-w-[960px] grid-rows-[auto_1fr] rounded-[18px] border border-line bg-surface-2 font-sans shadow-[0_30px_60px_-50px_var(--nc-shadow)] elev-2", NC_TOKENS)}>
      <div className="flex items-center gap-2.5 rounded-t-[18px] border-b border-line bg-[var(--nc-panel)] px-3 py-2.5 @xl:gap-3.5 @xl:px-4 @xl:py-3">
        <div aria-hidden className="mr-auto flex min-w-0 items-center gap-2.5 text-[14px] font-semibold leading-tight text-ink @xl:mr-0">
          <i className="size-7 shrink-0 rounded-lg bg-[linear-gradient(135deg,var(--nc-acc),color-mix(in_oklab,var(--nc-acc),#000_30%))]" />
          <span className="truncate">Agency workspace</span>
        </div>
        <div aria-hidden className="ml-auto hidden h-9 max-w-[360px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 text-[13px] text-ink-3 @xl:flex">
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
          Search clients, campaigns…
        </div>
        {children}
        <div aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--nc-acc)_14%,var(--nc-panel))] text-[12px] font-semibold text-ink">JC</div>
      </div>
      <div aria-hidden className="grid gap-5 p-4 opacity-90 @2xl:grid-cols-[180px_minmax(0,1fr)] @xl:p-[22px]">
        <div className="hidden content-start gap-2.5 @2xl:grid">
          {[70, 85, 60, 85, 72, 60, 85].map((w, i) => (
            <i key={i} className={cx("block h-2.5 rounded-md bg-line-strong", i === 0 && "h-3 bg-[color-mix(in_oklab,var(--nc-acc)_22%,var(--line))]")} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="grid content-start gap-3.5">
          <div className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">Good afternoon</div>
          <div className="-mt-2 text-[13.5px] text-ink-2">Here is what changed across your clients today.</div>
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
            {[["Open tasks", "12"], ["Booked calls", "8"], ["Unpaid invoices", "3"]].map(([k, v]) => (
              <div key={k} className="grid min-h-[92px] content-start gap-2.5 rounded-[14px] border border-line bg-[var(--nc-panel)] p-4">
                <small className="text-[12px] text-ink-2">{k}</small>
                <b className="font-display text-[22px] font-semibold leading-none text-ink">{v}</b>
                <i className="block h-2.5 w-4/5 rounded-md bg-line-strong" />
              </div>
            ))}
            <div className="col-span-full grid min-h-[170px] content-start gap-2.5 rounded-[14px] border border-line bg-[var(--nc-panel)] p-4">
              {[80, 100, 80, 100].map((w, i) => <i key={i} className="block h-2.5 rounded-md bg-line-strong" style={{ width: `${w}%` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Demo({ mode }: { mode: DemoMode }) {
  const boundary = useRef<HTMLDivElement>(null);
  const nc = useRef<NotificationCenterHandle>(null);
  const sample = useRef(0);
  const [note, setNote] = useState<ReactNode>(null);
  const page = mode === "page";

  const center = (
    <NotificationCenter ref={nc} items={demoNotifications} now={demoNow} title="Notifications" footer={{ label: "Notification settings" }}
      defaultOpen boundaryRef={boundary} maxListHeight={392}
      onRead={page ? d => setNote(<><b className="font-semibold text-ink">{d.ids.length} marked read.</b> onRead fired.</>) : undefined}
      onDismiss={page ? () => setNote(<><b className="font-semibold text-ink">Dismissed.</b> onDismiss fired.</>) : undefined}
      onAction={page ? d => setNote(<><b className="font-semibold text-ink">{d.action} clicked.</b> onAction fired.</>) : undefined}
      onFooter={page ? () => setNote(<><b className="font-semibold text-ink">Notification settings</b> — onFooter fired.</>) : undefined} />
  );
  const app = <MockApp boundary={boundary}>{center}</MockApp>;
  if (!page) return app;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {app}
      <div className="w-full max-w-[960px]">
        <DemoBar note={<span aria-live="polite">{note ? <>{note} Example data — fictional clients and teammates.</> : "Example data — fictional clients and teammates."}</span>}>
          <DemoButton icon="plus" onClick={() => { nc.current?.add(demoSamples[sample.current++ % demoSamples.length]); nc.current?.show(false); }}>Simulate new notification</DemoButton>
          <DemoButton icon="refresh" onClick={() => { nc.current?.reset(); nc.current?.show(false); sample.current = 0; setNote(<><b className="font-semibold text-ink">Demo reset.</b></>); }}>Reset demo</DemoButton>
        </DemoBar>
      </div>
    </div>
  );
}

export const docs: ComponentDocs = {
  fields: [
    { name: "items", type: "NotificationItem[]", description: "Starting notifications. The component keeps its own list after that (read, dismissed, added)." },
    { name: "items[].id · type", type: "string · \"mention\" | \"system\"", description: "Unique key, and the tab it belongs to." },
    { name: "items[].time · read", type: "ISO string | Date · boolean", description: "When it happened, and whether it has been read." },
    { name: "items[].actor · text · target", type: "string", description: "Mentions: “Maya Chen mentioned you in Q4 plan”." },
    { name: "items[].title · icon", type: "string · payment | warning | report | automation | integration", description: "System alerts: heading and icon." },
    { name: "items[].body", type: "string", description: "Optional second line or quote." },
    { name: "items[].action", type: "{ label, done? }", description: "Optional inline button (e.g. Reconnect → Reconnected). Calls onAction and marks the item read." },
    { name: "now", type: "ISO string", description: "Fixed “now” for Today / Yesterday groups and “12 min ago” (default: the real clock)." },
    { name: "title · footer", type: "string · { label, href? }", description: "Panel heading, and an optional footer link (or a button that calls onFooter)." },
    { name: "open / defaultOpen · defaultTab", type: "boolean · \"all\" | \"mention\" | \"system\"", description: "Controlled or starting open state, and the starting tab." },
    { name: "boundaryRef · panelWidth · maxListHeight", type: "RefObject · number · number", description: "Keep the panel inside an element (narrow boundaries turn it into a full-width sheet), panel width (400) and list height (430)." },
    { name: "ref", type: "NotificationCenterHandle", description: "add(item), reset(items?), show(focus?), hide(returnFocus?), toggle(), unread." },
    { name: "labels · locale", type: "Partial<NotificationLabels> · string", description: "Override any built-in text; date formatting locale." },
  ],
  usage: `import { NotificationCenter, type NotificationCenterHandle } from "./components/notification-center/NotificationCenter";

const bell = useRef<NotificationCenterHandle>(null);

<NotificationCenter
  ref={bell}
  items={[
    { id: "m1", type: "mention", read: false, time: "2026-10-02T16:18:00",
      actor: "Maya Chen", text: "mentioned you in", target: "Q4 plan" },
    { id: "s1", type: "system", icon: "payment", time: "2026-10-02T15:52:00",
      title: "Payment received", body: "Invoice #1043" },
  ]}
  onRead={({ ids, source }) => api.markRead(ids)}
  onDismiss={id => api.dismiss(id)}
/>

// from a live source:
bell.current?.add({ type: "system", icon: "report", title: "Report ready" });`,
  events: [
    { name: "onRead({ ids, source })", description: "Opening an item marks it read (source \"click\"); “Mark all as read” sends every unread id in the current tab (\"all\"); an action button sends \"action\"." },
    { name: "onDismiss(id)", description: "An item was dismissed (it collapses out of the list)." },
    { name: "onAction({ id, action })", description: "An item's inline action button was used." },
    { name: "onOpenChange(open) · onTabChange(tab) · onFooter()", description: "Panel opened/closed (bell, Esc, outside click), tab switched, footer button clicked." },
  ],
  notes: [
    "Esc or a click outside closes the panel; focus returns to the bell. Arrow keys move between tabs.",
    "After a dismiss, focus moves to the next item (or the tabs), so keyboard users never lose their place.",
    "New items slide in at the top, the bell rings and the badge bumps (skipped with reduced motion).",
  ],
};
