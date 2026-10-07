/* Number, money and date formatting shared by all components. */

export function fmtMoney(v: number, currency = "USD", digits?: number, locale = "en-US"): string {
  const d = digits ?? (Math.abs(v) >= 1000 || Number.isInteger(v) ? 0 : 2);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  } catch {
    return `${currency} ${v.toFixed(d)}`;
  }
}

export const fmtNumber = (v: number, digits = 0, locale = "en-US") =>
  v.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmtCompact(v: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: v < 10_000 ? 1 : 1 }).format(v);
}

/** 0.1534 → "15.3%" (pass a ratio). */
export const fmtPct = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;

/** A signed change, e.g. +4.2% / −1.3% (uses a real minus sign). */
export function fmtDelta(v: number, digits = 1, suffix = "%"): string {
  const s = Math.abs(v).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s}${suffix}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-25" → "25 Sep 2026" (UTC, no timezone drift). */
export function fmtDate(iso: string, { year = true }: { year?: boolean } = {}): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${+m[3]} ${MONTHS[+m[2] - 1]}${year ? ` ${m[1]}` : ""}`;
}
export const monthName = (i: number) => MONTHS[i];

/** Relative time from a fixed "now" so demos are stable. */
export function fmtAgo(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
