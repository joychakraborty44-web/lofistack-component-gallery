import type { AgentAction, AgentError, AgentFleetData, AgentState, AgentStatus, AspLabels } from "./data";

/* Seeded fleet simulation. Mutable on purpose: the component calls step()/act()
   from timers and event handlers, then re-renders. */

export const STATUSES: AgentStatus[] = ["running", "idle", "error", "paused"];
export const HISTORY = 14;
export const FLEET = 28;
const LOG_MAX = 5;

export interface SimAgent {
  id: string; name: string; model: string; status: AgentState; task: string;
  queue: number; processed: number; succeeded: number; load: number; failRate: number;
  error: AgentError | null; expanded: boolean; history: number[];
  /** Bumped when the row should flash (a user action changed its state). */
  flash: number;
}
export interface LogItem { id: number; time: string; text: string; tone: "" | "good" | "bad" | "warn" }
export interface ActionResult { id: string; name: string; action: AgentAction; from: AgentState; to: AgentState }

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** Small deterministic PRNG so the simulation repeats the same way for the same seed. */
const prng = (seed: number) => {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class FleetSim {
  agents: SimAgent[];
  fleet: number[] = [];
  log: LogItem[] = [];
  tick = 0;
  clock: string;
  announce = "";
  private rand: () => number;
  private logId = 0;

  constructor(readonly data: AgentFleetData, private L: AspLabels, private locale: string) {
    this.rand = prng(num(data.seed) ?? 7);
    this.clock = this.time();
    this.agents = (Array.isArray(data.agents) ? data.agents : []).map((x, i) => {
      const processed = Math.max(0, num(x.processed) ?? 0);
      const status: AgentStatus = STATUSES.includes(x.status) ? x.status : "idle";
      const load = Math.max(0, num(x.load) ?? 1);
      const a: SimAgent = {
        id: String(x.id || `agent-${i + 1}`), name: x.name || `Agent ${i + 1}`, model: x.model || "", status, task: x.task || "",
        queue: Math.max(0, Math.round(num(x.queue) ?? 0)), processed, succeeded: Math.min(processed, Math.max(0, num(x.succeeded) ?? processed)),
        load, failRate: Math.min(1, Math.max(0, num(x.failRate) ?? 0)),
        error: status === "error" ? { code: "", at: "", ...(x.error || { message: "Unknown error" }) } : null,
        expanded: false, history: [], flash: 0,
      };
      for (let h = 0; h < HISTORY; h++) a.history.push(status === "running" ? Math.round(this.rand() * load * 2) : 0);
      return a;
    });
    for (let h = 0; h < FLEET; h++) this.fleet.push(this.agents.reduce((s, a) => s + (a.history[h % HISTORY] || 0), 0));
    this.logLine(fill(L.loaded, { n: this.agents.length }), "");
  }

  setLabels(L: AspLabels) { this.L = L; }
  time() {
    try { return new Intl.DateTimeFormat(this.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }
    catch { return new Date().toTimeString().slice(0, 8); }
  }
  int(v: number) { return Math.round(v).toLocaleString(this.locale); }
  pct(v: number | null) { return v == null ? "—" : `${v.toLocaleString(this.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
  find(id: string) { return this.agents.find(a => a.id === id); }

  logLine(text: string, tone: LogItem["tone"]) {
    this.log = [...this.log, { id: ++this.logId, time: this.time(), text, tone }].slice(-LOG_MAX);
  }
  say(a: SimAgent) {
    const L = this.L;
    this.announce = fill(L.announce, { name: a.name, status: (L[a.status] || a.status).toLowerCase() });
  }

  step() {
    const r = this.rand, L = this.L;
    this.tick++;
    let done = 0, failed = 0;
    for (const a of this.agents) {
      let k = 0;
      const arrive = () => Math.floor(r() * (a.load * 2 + 0.2));
      if (a.status === "running") {
        k = Math.min(a.queue, Math.round(r() * a.load * 2));
        let f = 0;
        for (let i = 0; i < k; i++) if (r() < a.failRate) f++;
        a.processed += k; a.succeeded += k - f; a.queue -= k;
        const add = arrive();
        a.queue += add;
        done += k; failed += f;
        if (a.queue === 0 && add === 0 && r() < 0.5) { a.status = "idle"; this.logLine(fill(L.nowIdle, { name: a.name }), ""); this.say(a); }
      } else if (a.status === "idle") {
        if (r() < 0.22) { a.queue += 1 + Math.floor(r() * 3); a.status = "running"; this.logLine(fill(L.nowRunning, { name: a.name }), "good"); this.say(a); }
      } else if (a.status === "paused" || a.status === "error") {
        if (r() < 0.3) a.queue += 1;
      }
      a.history = [...a.history, k].slice(-HISTORY);
    }
    this.fleet = [...this.fleet, done].slice(-FLEET);
    const q = this.agents.reduce((s, a) => s + a.queue, 0);
    this.logLine(done ? fill(L.tickLine, { n: done, f: failed, q: this.int(q) }) : fill(L.noWork, { q: this.int(q) }), failed ? "warn" : "");
    this.clock = this.time();
  }

  /** Apply a user action. Returns what happened, or null when the action does not apply. */
  act(id: string, requested: AgentAction): ActionResult | null {
    const a = this.find(id);
    if (!a) return null;
    const L = this.L, from = a.status;
    let action = requested;
    if (action === "pause" && (from === "running" || from === "idle")) a.status = "paused";
    else if (action === "start" && from === "paused") a.status = a.queue > 0 ? "running" : "idle";
    else if ((action === "start" || action === "retry") && from === "error") { action = "retry"; this.beginRestart(a); }
    else if (action === "restart" && from !== "restarting") this.beginRestart(a);
    else return null;
    const verbs: Record<AgentAction, string> = { start: L.logStart, pause: L.logPause, restart: L.logRestart, retry: L.logRetry };
    this.logLine(fill(L.actionLine, { name: a.name, action: verbs[action] }), action === "pause" ? "warn" : "good");
    a.flash++;
    if (a.status !== "error") a.expanded = false;
    this.say(a);
    return { id: a.id, name: a.name, action, from, to: a.status };
  }

  private beginRestart(a: SimAgent) { a.status = "restarting"; a.expanded = false; }
  finishRestart(id: string, quiet = false) {
    const a = this.find(id);
    if (!a || a.status !== "restarting") return;
    a.error = null;
    a.status = a.queue > 0 ? "running" : "idle";
    if (quiet) return;
    this.logLine(fill(this.L.restarted, { name: a.name }), "good");
    a.flash++;
    this.say(a);
  }

  setStatus(id: string, status: AgentStatus, message?: string): boolean {
    const a = this.find(id);
    if (!a || !STATUSES.includes(status)) return false;
    const from = a.status;
    a.status = status;
    if (status === "error") {
      a.error = { code: "", at: this.time(), message: message || "Unknown error" };
      this.logLine(fill(this.L.failed, { name: a.name, message: a.error.message }), "bad");
    } else a.error = null;
    if (status !== "error") a.expanded = false;
    if (status === "running" && a.queue === 0) a.queue = 1;
    a.flash++;
    if (from !== status) this.say(a);
    return true;
  }

  perMin(values: number[], interval: number) {
    const recent = values.slice(-8);
    return (recent.reduce((x, y) => x + y, 0) / Math.max(1, recent.length)) * (60000 / interval);
  }
}
