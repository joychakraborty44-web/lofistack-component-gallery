/* Types + demo workflows (fictional workflows, contacts and numbers — not real client results). */

export type FlowNodeType = "trigger" | "condition" | "action" | "wait";
export type FlowIcon = "form" | "bolt" | "branch" | "chat" | "user" | "mail" | "list" | "sms" | "clock" | "phone" | "task" | "bell" | "flow";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  detail?: string;
  description?: string;
  icon?: FlowIcon;
  /** Settings shown in the side panel, as { Label: Value }. */
  config?: Record<string, string>;
  /** Contacts that reached the step in the stats period. */
  runs?: number;
  /** Fixed test-run time in ms (otherwise derived from the id). */
  testMs?: number;
  /** Condition only: label of the test switch that picks the branch. */
  test?: string;
  /** Condition only: starting value of that switch (default true). */
  testDefault?: boolean;
  /** Condition only: the steps on each branch. Branches join again at the next step. */
  yes?: FlowNode[];
  no?: FlowNode[];
}

export interface Workflow {
  id: string;
  eyebrow?: string;
  name: string;
  subtitle?: string;
  ref?: string;
  revision?: string;
  stats?: { period?: string; runs?: number; succeeded?: number; avgSeconds?: number; lastRun?: string };
  testContact?: { name: string; note?: string };
  flow: FlowNode[];
  /** Starting on/off state (default on). */
  enabled?: boolean;
}

export const LEAD_FOLLOW_UP: Workflow = {
  id: "lead",
  eyebrow: "Automation",
  name: "New lead follow-up",
  subtitle: "Brightside Dental · edited 2 days ago",
  ref: "WF-0217",
  revision: "Rev 4",
  stats: { period: "7 days", runs: 248, succeeded: 242, avgSeconds: 1.4, lastRun: "12 min ago" },
  testContact: { name: "Dana Reyes", note: "Test contact" },
  flow: [
    { id: "trigger", type: "trigger", icon: "form", title: "Form submitted", detail: "Book a consultation", runs: 248,
      description: "Starts when someone sends the Book a consultation form on the website.",
      config: { Form: "Book a consultation", Source: "Website", "Re-entry": "Once per contact" } },
    { id: "vip", type: "condition", title: "Has tag: VIP?", detail: "Contact tag check", runs: 248,
      test: "Has VIP tag", testDefault: true,
      description: "Sends VIP contacts to the front desk straight away. Everyone else gets the welcome email.",
      config: { Field: "Contact tags", Rule: "contains", Value: "VIP" },
      yes: [
        { id: "notify", type: "action", icon: "chat", title: "Notify team chat", detail: "#front-desk channel", runs: 61,
          description: "Posts the new request to the front-desk channel so someone calls within the hour.",
          config: { Channel: "#front-desk", Message: "New VIP consult request from {{contact.first_name}}" } },
        { id: "owner", type: "action", icon: "user", title: "Assign owner", detail: "Senior coordinator", runs: 61,
          description: "Makes the senior coordinator the contact owner.",
          config: { Owner: "Senior coordinator", "Notify owner": "Yes, by email" } },
      ],
      no: [
        { id: "welcome", type: "action", icon: "mail", title: "Send welcome email", detail: "Template · Consult welcome", runs: 187,
          description: "Sends the welcome email with what to expect at the first visit.",
          config: { Template: "Consult welcome", From: "Front desk", Subject: "Your consultation request" } },
        { id: "nurture", type: "action", icon: "list", title: "Add to nurture list", detail: "New patient nurture", runs: 187,
          description: "Adds the contact to the new-patient email series.",
          config: { List: "New patient nurture", "Double opt-in": "Not needed" } },
      ] },
    { id: "wait", type: "wait", icon: "clock", title: "Wait 1 day", detail: "Weekdays only", runs: 248,
      description: "Pauses the contact for one day. Test runs skip the wait.",
      config: { Duration: "1 day", "Resume at": "9:00 am, contact's time zone", Skip: "Saturdays and Sundays" } },
    { id: "sms", type: "action", icon: "sms", title: "Send SMS reminder", detail: "Only if not booked yet", runs: 203,
      description: "Texts a booking link to anyone who has not booked yet. 45 contacts booked during the wait and left the workflow.",
      config: { Message: "Hi {{contact.first_name}}, pick a time that suits you: {{booking_link}}", "Send window": "9 am – 7 pm" } },
  ],
};

export const MISSED_CALL: Workflow = {
  id: "call",
  eyebrow: "Automation",
  name: "Missed-call text back",
  subtitle: "Harbor & Pine Realty · edited 5 days ago",
  ref: "WF-0342",
  revision: "Rev 2",
  stats: { period: "7 days", runs: 96, succeeded: 95, avgSeconds: 0.9, lastRun: "38 min ago" },
  testContact: { name: "Sam Okafor", note: "Test contact" },
  flow: [
    { id: "call", type: "trigger", icon: "phone", title: "Missed call", detail: "Main office line", runs: 96,
      description: "Starts when a call to the main office line is not answered.",
      config: { Line: "Main office", "Counts as missed": "No answer after 25 seconds" } },
    { id: "hours", type: "condition", title: "During office hours?", detail: "Mon–Fri, 9 am – 6 pm", runs: 96,
      test: "Called in office hours", testDefault: false,
      description: "Checks when the call came in, using the office time zone.",
      config: { Schedule: "Mon–Fri, 9:00 am – 6:00 pm", "Time zone": "Office" },
      yes: [
        { id: "sorry", type: "action", icon: "sms", title: "Send SMS", detail: "Sorry we missed you", runs: 58,
          config: { Message: "Sorry we missed your call! An agent will call you back shortly." } },
        { id: "task", type: "action", icon: "task", title: "Create task", detail: "Call back within 1 hour", runs: 58,
          config: { Assign: "Agent on duty", Due: "In 1 hour" } },
      ],
      no: [
        { id: "closed", type: "action", icon: "sms", title: "Send SMS", detail: "Closed, with booking link", runs: 38,
          config: { Message: "We're closed right now. Book a call back: {{booking_link}}" } },
      ] },
    { id: "wait2", type: "wait", icon: "clock", title: "Wait 2 hours", detail: "Exit if they reply", runs: 96,
      config: { Duration: "2 hours", "Exit early": "Contact replies or books" } },
    { id: "owner", type: "action", icon: "bell", title: "Notify owner", detail: "If no reply yet", runs: 41,
      description: "Lets the office owner know about callers who have not replied. 55 contacts replied or booked during the wait.",
      config: { Notify: "Office owner", Channel: "Email and app" } },
  ],
};

export const DEMO_WORKFLOWS = { lead: LEAD_FOLLOW_UP, call: MISSED_CALL } as const;
