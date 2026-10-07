/* Types, the seeded delivery simulator and demo settings for the Webhook Event Monitor. */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue | undefined };
export type StatusClass = "2xx" | "4xx" | "5xx";

/** A delivery as you pass it in (real or simulated). */
export interface WebhookEventInput {
  id?: string;
  name: string;
  method?: string;
  path?: string;
  status: number;
  /** Milliseconds. */
  latency: number;
  at?: Date | string;
  account?: string;
  /** Payload object. Wrapped in a { id, type, created_at, account, data } envelope unless it already has `type`. */
  payload?: JsonValue;
  /** Receiver's response body (derived from the status if left out). */
  response?: JsonValue;
  headers?: Record<string, string>;
  replayOf?: string | null;
  attempt?: number;
}

/** A stored delivery. */
export interface WebhookEvent {
  id: string; name: string; method: string; path: string; status: number; latency: number; at: Date;
  account: string; payload: JsonValue; response: JsonValue; headers: Record<string, string> | null;
  replayOf: string | null; attempt: number;
}

export const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found", 409: "Conflict",
  422: "Unprocessable Entity", 429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};
export const clsOf = (s: number): StatusClass => (s >= 500 ? "5xx" : s >= 400 ? "4xx" : "2xx");

/** Repeatable PRNG (same seed → same stream). */
export function mulberry(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

const FIRST = ["Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Ruby", "Owen", "Isla", "Leo"];
const LAST = ["Thompson", "Nguyen", "Patel", "Garcia", "Okafor", "Kim", "Rossi", "Murphy", "Silva", "Novak"];
const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];
const rid = (r: Rng, prefix: string, len: number) => { let s = ""; for (let i = 0; i < len; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(r() * 36)]; return prefix + s; };

export function responseFor(status: number): JsonValue {
  const bodies: Record<number, JsonValue> = {
    200: { received: true }, 201: { received: true, stored: true }, 202: { queued: true }, 204: null,
    400: { error: "bad_request", message: "Payload is missing data.id" },
    401: { error: "invalid_signature", message: "Signature header did not match the shared secret" },
    404: { error: "not_found", message: "No handler is registered for this path" },
    409: { error: "duplicate", message: "This event id was already processed" },
    422: { error: "validation_failed", field: "data.contact.email" },
    429: { error: "rate_limited", retry_after_seconds: 30 },
    500: { error: "internal_error", message: "Handler threw an exception" },
    502: { error: "bad_gateway", message: "Upstream app server returned an invalid response" },
    503: { error: "unavailable", message: "Receiver is in maintenance mode" },
    504: { error: "timeout", message: "No response within 10 seconds" },
  };
  return status in bodies ? bodies[status] : { status };
}

export function normalise(e: WebhookEventInput, r: Rng): WebhookEvent {
  const at = e.at instanceof Date ? e.at : e.at ? new Date(e.at) : new Date();
  const when = isNaN(+at) ? new Date() : at;
  const status = Math.round(+e.status) || 200;
  const id = e.id || rid(r, "evt_", 12);
  const account = e.account || "";
  const p = e.payload;
  const payload: JsonValue = p && typeof p === "object" && !Array.isArray(p) && "type" in p ? p
    : { id, type: e.name || "event", created_at: when.toISOString(), ...(account ? { account: { name: account } } : {}), data: p ?? {} };
  return {
    id, name: String(e.name || "event"), method: String(e.method || "POST").toUpperCase(), path: String(e.path || "/"),
    status, latency: Math.max(0, Math.round(+e.latency || 0)), at: when, account, payload,
    response: e.response !== undefined ? e.response : responseFor(status), headers: e.headers ?? null,
    replayOf: e.replayOf ?? null, attempt: e.attempt ?? 1,
  };
}

/** One simulated delivery. `force: "fail"` always returns a 5xx. */
export function generate(r: Rng, at: Date, accounts: string[], force?: "fail"): WebhookEvent {
  const account = pick(r, accounts.length ? accounts : ["Brightside Dental"]);
  const person = `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const email = person.toLowerCase().replace(" ", ".") + "@example.com";
  const iso = at.toISOString();
  const kinds: [string, string, string, () => JsonValue][] = [
    ["contact.created", "POST", "/hooks/crm/contacts", () => ({ contact: { id: rid(r, "con_", 8), name: person, email, source: pick(r, ["Website form", "Social lead form", "Chat widget"]), tags: ["new-lead"] } })],
    ["form.submitted", "POST", "/hooks/forms/submissions", () => ({ form: { id: rid(r, "frm_", 6), name: pick(r, ["Free consultation", "Get a quote", "Book a tour"]) }, fields: { name: person, email, consent: true }, page: "/offers/fall" })],
    ["appointment.booked", "POST", "/hooks/calendar/appointments", () => ({ appointment: { id: rid(r, "apt_", 8), type: "Discovery call", starts_at: new Date(at.getTime() + (2 + Math.floor(r() * 5)) * 864e5).toISOString().slice(0, 16) + "Z", duration_minutes: 30, contact: { name: person, email } } })],
    ["invoice.paid", "POST", "/hooks/payments/invoices", () => ({ invoice: { id: rid(r, "inv_", 8), number: `INV-${1040 + Math.floor(r() * 60)}`, amount: Math.round(450 + r() * 2400), currency: "USD", paid_at: iso } })],
    ["payment.failed", "POST", "/hooks/payments/charges", () => ({ charge: { id: rid(r, "ch_", 10), amount: Math.round(99 + r() * 900), currency: "USD", failure_code: pick(r, ["card_declined", "insufficient_funds", "expired_card"]) }, retry_scheduled: true })],
    ["message.received", "POST", "/hooks/inbox/messages", () => ({ message: { id: rid(r, "msg_", 8), channel: pick(r, ["SMS", "Email", "Web chat"]), from: person, preview: pick(r, ["Is the offer still on?", "Can I move my booking?", "Thanks, see you Tuesday!"]) } })],
    ["opportunity.updated", "PUT", "/hooks/crm/opportunities", () => { const st = ["New", "Qualified", "Proposal", "Won"], i = Math.floor(r() * 3); return { opportunity: { id: rid(r, "opp_", 8), name: `${account} · retainer`, stage: { from: st[i], to: st[i + 1] }, value: Math.round(1200 + r() * 6000) } }; }],
    ["contact.deleted", "DELETE", "/hooks/crm/contacts", () => ({ contact: { id: rid(r, "con_", 8) }, reason: "Unsubscribed" })],
  ];
  const weights = [22, 20, 14, 12, 7, 14, 8, 3];
  let roll = r() * weights.reduce((a, b) => a + b, 0), k = 0;
  while (k < weights.length - 1 && roll > weights[k]) { roll -= weights[k]; k++; }
  const [name, method, path, build] = kinds[k];
  const s = force === "fail" ? 0.93 + r() * 0.07 : r();
  const status = s < 0.82 ? pick(r, [200, 200, 200, 200, 201, 202, 204]) : s < 0.92 ? pick(r, [400, 401, 404, 409, 422, 429]) : pick(r, [500, 502, 503, 504]);
  const latency = status === 504 ? 10000 : status >= 500 ? Math.round(700 + r() * 2300) : status >= 400 ? Math.round(18 + r() * 170) : Math.round(38 + r() * r() * 420);
  return normalise({ name, method, path, status, latency, at, account, payload: build() }, r);
}

/** Starting rows: `n` deliveries spaced 6–28 s apart, newest first. */
export function seedEvents(r: Rng, n: number, accounts: string[], now = Date.now()): WebhookEvent[] {
  const out: WebhookEvent[] = [];
  let t = now - 1500;
  for (let i = 0; i < n; i++) { out.push(generate(r, new Date(t), accounts)); t -= Math.round(6000 + r() * 22000); }
  return out;
}

/** Stable fake request headers (signature derived from the id so it never changes between renders). */
export function headersFor(ev: WebhookEvent): Record<string, string> {
  if (ev.headers) return ev.headers;
  let h = 2166136261;
  for (const c of ev.id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = mulberry(h >>> 0);
  let sig = "";
  for (let i = 0; i < 40; i++) sig += "0123456789abcdef"[Math.floor(r() * 16)];
  const out: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "LofiStack-Webhooks/2.4",
    "X-Webhook-Id": ev.id,
    "X-Webhook-Event": ev.name,
    "X-Webhook-Timestamp": String(Math.floor(ev.at.getTime() / 1000)),
    "X-Webhook-Signature": `sha256=${sig}`,
    "X-Webhook-Attempt": String(ev.attempt),
  };
  if (ev.replayOf) out["X-Webhook-Replay-Of"] = ev.replayOf;
  return out;
}

/* Demo settings — simulated events, not real client traffic (kept from the original). */
export const demoWebhooks = {
  title: "Webhook events",
  environment: "Production",
  endpoint: "/hooks/lofistack",
  seed: 2041,
  initial: 18,
  max: 60,
  interval: 2400,
  accounts: ["Brightside Dental", "Harbor & Pine Realty", "Cedar Fitness Co."],
};
