// Single source of truth for enum labels and badge tones used across the UI.
// Values are stored as-is in Firestore documents.

export type Tone = "neutral" | "blue" | "orange" | "green" | "red" | "yellow" | "purple";

// Five stages (UX_ARCHITECTURE_V2.md §3.5). "Won" means a job was started.
export const LEAD_STATUSES = [
  { value: "new", label: "New", tone: "orange" },
  { value: "contacted", label: "Contacted", tone: "blue" },
  { value: "quote_sent", label: "Quoted", tone: "yellow" },
  { value: "won", label: "Won", tone: "green" },
  { value: "lost", label: "Lost", tone: "red" },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "quote_sent"];

export const LOST_REASONS = ["Too expensive", "Went with someone else", "No reply", "Not a job we do", "Other"] as const;

export const LEAD_SOURCES = [
  { value: "buildflow", label: "BuildFlow" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social media" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const PROJECT_STATUSES = [
  { value: "planning", label: "Planning", tone: "neutral" },
  { value: "upcoming", label: "Upcoming", tone: "blue" },
  { value: "in_progress", label: "In progress", tone: "orange" },
  { value: "on_hold", label: "On hold", tone: "yellow" },
  { value: "completed", label: "Completed", tone: "green" },
  { value: "cancelled", label: "Cancelled", tone: "red" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["planning", "upcoming", "in_progress", "on_hold"];

export const TASK_STATUSES = [
  { value: "todo", label: "To do", tone: "neutral" },
  { value: "in_progress", label: "In progress", tone: "orange" },
  { value: "done", label: "Done", tone: "green" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["value"];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", tone: "neutral" },
  { value: "medium", label: "Medium", tone: "yellow" },
  { value: "high", label: "High", tone: "red" },
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];

// prospect → active (a job started) → past (all jobs finished). Set automatically.
export const CUSTOMER_STATUSES = [
  { value: "prospect", label: "Prospect", tone: "orange" },
  { value: "active", label: "Active", tone: "green" },
  { value: "inactive", label: "Inactive", tone: "neutral" },
  { value: "past", label: "Past client", tone: "blue" },
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]["value"];

export const POST_TYPES = [
  { value: "completed_project", label: "Completed project" },
  { value: "before_after", label: "Before / after" },
  { value: "work_in_progress", label: "Work in progress" },
  { value: "project_update", label: "Project update" },
  { value: "service_showcase", label: "Service showcase" },
  { value: "business_update", label: "Business update" },
] as const;
export type PostType = (typeof POST_TYPES)[number]["value"];

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_business", label: "Fake business" },
  { value: "other", label: "Other" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

type Option = { value: string; label: string; tone?: Tone };
export function optionFor<T extends readonly Option[]>(list: T, value: string | null | undefined): Option | undefined {
  return list.find((o) => o.value === value);
}
export const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  maxFileBytes: 20 * 1024 * 1024,
  maxImagesPerPost: 10,
  maxFilesPerUpload: 10,
  // Checked against the file's real bytes, not the browser-reported type.
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  imageAccept: "image/jpeg,image/png,image/webp",
  fileAccept: "application/pdf,image/jpeg,image/png,image/webp",
};
