/* Types + demo data for the Form Conversion Card. Example data — not real client results. */

export type FormStepType = "view" | "start" | "field" | "submit";

export interface FormStep {
  id: string;
  label: string;
  /** Only `field` steps appear as inputs in the mini form and can be the worst field. */
  type: FormStepType;
}

export interface DeviceSegment {
  label: string;
  /** One number per step: how many people reached and completed it. */
  counts: number[];
  avgSeconds?: number;
}

export interface FormConversionData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Date-range text in the footer. */
  period?: string;
  form: { title: string; button: string };
  steps: FormStep[];
  /** Keyed by device, e.g. all / desktop / mobile. */
  segments: Record<string, DeviceSegment>;
  /** Suggestion shown when that field is the worst. `{rate}`, `{lost}` and `{field}` are filled in. */
  tips?: Record<string, string>;
}

export const valuationForm: FormConversionData = {
  eyebrow: "Form analytics",
  title: "Home valuation request · Harbor & Pine Realty",
  subtitle: "Field-by-field completion, last 30 days",
  period: "1 – 30 Sep 2026",
  form: { title: "Book a free home valuation", button: "Request my valuation" },
  steps: [
    { id: "views", label: "Form views", type: "view" },
    { id: "started", label: "Started", type: "start" },
    { id: "name", label: "Full name", type: "field" },
    { id: "email", label: "Email", type: "field" },
    { id: "phone", label: "Phone", type: "field" },
    { id: "submitted", label: "Submitted", type: "submit" },
  ],
  segments: {
    all: { label: "All devices", counts: [4820, 2410, 2170, 1910, 1258, 1170], avgSeconds: 72 },
    desktop: { label: "Desktop", counts: [1980, 1090, 1032, 846, 772, 728], avgSeconds: 62 },
    mobile: { label: "Mobile", counts: [2840, 1320, 1138, 1064, 486, 442], avgSeconds: 88 },
  },
  tips: {
    name: "Use one Full name field instead of separate first and last names, and remove the Title dropdown. {rate} of people who reach it leave here.",
    email: "{rate} of people leave at Email. Check for strict validation, and suggest a fix for common typos (\"Did you mean…?\") instead of showing an error.",
    phone: "Make Phone optional, or say why you ask for it (\"So we can confirm your visit by text\"). {rate} of people who reach it leave here.",
  },
};
