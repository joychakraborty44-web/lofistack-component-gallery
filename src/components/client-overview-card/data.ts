/* Types + demo data for the Client Overview Card. */

export type HealthStatus = "healthy" | "at-risk" | "critical";
export type ClientTab = "overview" | "contacts" | "notes";

export interface ClientOpportunity {
  name: string;
  /** One of `stages` (default Discovery → Proposal → Negotiation → Closing). */
  stage: string;
  value: number;
  /** ISO date the deal is expected to close. */
  close?: string;
}

export interface ClientContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  primary?: boolean;
}

export interface ClientNote {
  author: string;
  /** ISO date, optionally with time ("2026-09-30T15:40"). */
  date: string;
  text: string;
}

export interface ClientData {
  company: string;
  /** Worked out from the company name when left out. */
  initials?: string;
  industry?: string;
  location?: string;
  website?: string;
  plan?: string;
  billing?: string;
  /** ISO date. */
  renewal?: string;
  owner?: { name: string; role?: string };
  health: { status: HealthStatus; score?: number; note?: string };
  /** ISO currency code (default USD). */
  currency?: string;
  /** Number / date locale (default en-GB). */
  locale?: string;
  mrr?: number;
  mrrPrevious?: number;
  /** Names the earlier MRR figure, e.g. "last quarter". */
  mrrCompareLabel?: string;
  /** ISO date the client signed. */
  clientSince?: string;
  /** ISO date tenure and "days ago" are counted to (default: today). */
  asOf?: string;
  lastActivity?: { date: string; summary?: string };
  services?: string[];
  opportunities?: ClientOpportunity[];
  /** Pipeline stage order. */
  stages?: string[];
  contacts?: ClientContact[];
  /** Newest first. */
  notes?: ClientNote[];
  /** Who new notes are attributed to (default "You"). */
  noteAuthor?: string;
}

export const DEFAULT_STAGES = ["Discovery", "Proposal", "Negotiation", "Closing"];

export const demoClient: ClientData = {
  company: "Harbor & Pine Realty",
  initials: "HP",
  industry: "Residential real estate",
  location: "Portland, Maine",
  website: "harborandpine.example",
  plan: "Growth retainer",
  owner: { name: "Maya Okafor", role: "Account owner" },
  health: { status: "healthy", score: 82, note: "Lead volume is up and invoices are paid on time. Renewal talk is due in early March." },
  currency: "USD",
  mrr: 4800,
  mrrPrevious: 4200,
  mrrCompareLabel: "last quarter",
  clientSince: "2024-03-11",
  renewal: "2027-03-11",
  billing: "Monthly, paid by card",
  asOf: "2026-10-02",
  lastActivity: { date: "2026-09-30T15:20", summary: "Call with Dana Whitfield" },
  services: ["Paid social", "Search ads", "Email nurture", "Landing pages"],
  opportunities: [
    { name: "Second office launch", stage: "Discovery", value: 9200, close: "2026-12-15" },
    { name: "Spring listings campaign", stage: "Proposal", value: 6500, close: "2026-10-20" },
    { name: "Video tour add-on", stage: "Negotiation", value: 1800, close: "2026-10-09" },
  ],
  contacts: [
    { name: "Dana Whitfield", role: "Managing broker", email: "dana@harborandpine.example", phone: "(207) 555-0142", primary: true },
    { name: "Luis Moreno", role: "Marketing coordinator", email: "luis@harborandpine.example", phone: "(207) 555-0187" },
    { name: "Priya Raman", role: "Office manager", email: "priya@harborandpine.example", phone: "(207) 555-0119" },
    { name: "Tom Becker", role: "Lead agent, Falmouth", email: "tom@harborandpine.example", phone: "(207) 555-0163" },
  ],
  notes: [
    { author: "Maya Okafor", date: "2026-09-30T15:40", text: "Dana wants the spring listings plan by 14 Oct. She asked for a short video tour test first." },
    { author: "Jon Ellis", date: "2026-09-22T10:05", text: "Swapped the seller-lead form to two steps. Form completions up from 3.1% to 4.4% in the first week." },
  ],
};
