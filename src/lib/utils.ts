import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge lets a caller's className override a component's defaults
// (e.g. <Card className="bg-ink"> beats Card's bg-white).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * All BuildFlow businesses are in Jamaica for now. Calendar dates
 * (due dates, follow-ups, "today") are computed in this zone, never in the
 * server's zone or UTC, so a task due today is not "overdue" at 8 pm.
 * Becomes a per-business setting (private/config.timezone) with multi-country.
 */
export const BUSINESS_TZ = "America/Jamaica";

const isDateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  // Date-only strings are calendar dates: render them as-is (UTC midnight, UTC formatting).
  if (typeof value === "string" && isDateOnly(value)) return new Date(value + "T00:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { ...opts, timeZone: BUSINESS_TZ });
}

/** "Today", "Tomorrow", "Yesterday", weekday within a week, else a short date. */
export function relativeDay(date: string, today: string) {
  const diff = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return formatDate(date, { weekday: "long" });
  return formatDate(date, { month: "short", day: "numeric" });
}

export function timeAgo(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d, { month: "short", day: "numeric" });
}

// Contract values are entered in the contractor's local currency; we don't
// convert, we just format consistently.
export function formatAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function compactAmount(n: number) {
  return "$" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function safeNext(next: string | null | undefined, fallback = "/app") {
  // Only allow same-site relative paths.
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Whole days from now until an ISO date (0 if past). */
export function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
}

/** YYYY-MM-DD in the business timezone for an instant. */
export function localDate(at: Date = new Date(), tz = BUSINESS_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** YYYY-MM-DD (business timezone) for today + n days. */
export function dateInDays(n: number, tz = BUSINESS_TZ) {
  const today = localDate(new Date(), tz);
  return new Date(Date.parse(today + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
}

/** First instant of the current month in the business timezone, as ISO. */
export function startOfMonthISO(tz = BUSINESS_TZ) {
  const [y, m] = localDate(new Date(), tz).split("-").map(Number);
  // Jamaica has no DST: a fixed offset is exact. Derive it rather than hard-code.
  const probe = new Date(Date.UTC(y, m - 1, 1, 12));
  const local = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = probe.getTime() - local.getTime() - probe.getTimezoneOffset() * 6e4;
  return new Date(Date.UTC(y, m - 1, 1) + offsetMs).toISOString();
}

/** Digits only, for matching phone numbers typed in different formats. */
export function phoneDigits(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return null;
  // Jamaican numbers are often typed without the country code: 876-555-1234.
  return d.length === 10 && d.startsWith("876") ? "1" + d : d;
}

export function whatsappLink(phone: string | null | undefined, text?: string) {
  const d = phoneDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
