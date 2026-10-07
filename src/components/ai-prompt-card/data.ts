/* Types + demo data for the AI Prompt Card. Example prompts for fictional clients. */

export interface PromptVariable {
  /** Matches `{{key}}` in the version text (letters, numbers, underscore). */
  key: string;
  label?: string;
  default?: string;
  placeholder?: string;
  /** Up to six one-click values. */
  suggestions?: string[];
}

export interface PromptVersion {
  id: string;
  text: string;
  /** YYYY-MM-DD */
  updated?: string;
  note?: string;
}

export interface PromptData {
  name: string;
  description?: string;
  /** Optional folder path shown above the editor. */
  path?: string;
  model?: string;
  temperature?: number;
  /** Version shown first (default: the last one). */
  activeVersion?: string;
  variables: PromptVariable[];
  versions: PromptVersion[];
}

export const emailPrompt: PromptData = {
  name: "Lead follow-up email",
  description: "Nudges new form leads to book a discovery call",
  path: "prompts/sales/lead-follow-up",
  model: "Large model",
  temperature: 0.7,
  activeVersion: "v3",
  variables: [
    { key: "client_name", label: "Client name", default: "Brightside Dental" },
    { key: "tone", label: "Tone of voice", default: "warm and reassuring", suggestions: ["warm and reassuring", "direct", "upbeat"] },
    { key: "offer", label: "Current offer", default: "a free whitening consultation this month" },
  ],
  versions: [
    {
      id: "v1", updated: "2026-09-12", note: "First draft",
      text: "You are writing a follow-up email for {{client_name}}.\n\nThe lead filled in our contact form but has not booked a call.\nWrite a short email in a {{tone}} tone that mentions {{offer}} and asks them to book.",
    },
    {
      id: "v2", updated: "2026-09-19", note: "Split into role, task and guidelines",
      text: "# Role\nYou are an account manager writing on behalf of {{client_name}}.\n\n# Task\nWrite a follow-up email to a lead who filled in the contact form but has not booked a call yet.\n\n# Guidelines\n- Keep the tone {{tone}}.\n- Mention the current offer: {{offer}}.\n- Sign off as \"The {{client_name}} team\".",
    },
    {
      id: "v3", updated: "2026-09-28", note: "Word limit and a closing question",
      text: "# Role\nYou are an account manager writing on behalf of {{client_name}}.\n\n# Task\nWrite a follow-up email to a lead who filled in the contact form but has not booked a call yet.\n\n# Guidelines\n- Keep the tone {{tone}}.\n- Mention the current offer: {{offer}}.\n- Stay under 120 words and use short paragraphs.\n- End with one clear question that invites them to book a call.\n- Sign off as \"The {{client_name}} team\".\n\n# Output\nReturn a subject line on the first line, then the email body.",
    },
  ],
};

export const adPrompt: PromptData = {
  name: "Social ad copy",
  description: "Three short ad variations for a local offer",
  path: "prompts/ads/social-variations",
  model: "Fast model",
  temperature: 0.9,
  variables: [
    { key: "client_name", label: "Client name", default: "Cedar Fitness Co." },
    { key: "offer", label: "Offer", default: "your first week free" },
    { key: "audience", label: "Audience", default: "busy parents within 5 miles", suggestions: ["busy parents within 5 miles", "students", "new movers"] },
    { key: "tone", label: "Tone of voice", default: "upbeat", suggestions: ["upbeat", "calm", "bold"] },
  ],
  versions: [
    { id: "v1", updated: "2026-09-21", note: "First draft", text: "Write 3 social ad captions for {{client_name}} promoting {{offer}}.\nThe audience is {{audience}}." },
    {
      id: "v2", updated: "2026-09-30", note: "Added format rules",
      text: "# Task\nWrite 3 social ad captions for {{client_name}} promoting {{offer}}.\n\n# Audience\n{{audience}}\n\n# Rules\n- Keep the tone {{tone}}.\n- Each caption is under 90 characters.\n- Open with a question or a number.\n- End with one call to action.\n\n# Output\nA numbered list, one caption per line.",
    },
  ],
};
