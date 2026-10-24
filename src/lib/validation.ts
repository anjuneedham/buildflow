import { z } from "zod";
import {
  CUSTOMER_STATUSES, LEAD_SOURCES, LEAD_STATUSES, POST_TYPES, PROJECT_STATUSES,
  REPORT_REASONS, TASK_PRIORITIES, TASK_STATUSES, values,
} from "@/lib/constants";

// Empty form strings become undefined so optional fields stay optional.
const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max).optional());
const reqText = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ required_error: `${label} is required` }).min(1, `${label} is required`).max(max));
const optEmail = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().email("Enter a valid email").max(200).optional());
// Firestore document ids (auto-ids or readable demo ids).
export const docId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");
const optUuid = z.preprocess((v) => (v === "" || v === null ? undefined : v), docId.optional());
const optMoney = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return Number(v.replace(/[,$\s]/g, ""));
}, z.number({ invalid_type_error: "Enter a number" }).nonnegative("Must be positive").max(1e11).optional());
const optDate = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").optional());
const optUrl = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const t = v.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}, z.string().url("Enter a valid link").max(300).optional());

export const signUpSchema = z.object({
  fullName: reqText(120, "Name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  accountType: z.enum(["contractor", "customer"]),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const businessSchema = z.object({
  name: reqText(120, "Business name").pipe(z.string().min(2, "Business name is too short")),
  ownerName: optText(120),
  phone: optText(40),
  email: optEmail,
  countryCode: z.string().length(2).default("JM"),
  regionId: optUuid,
  city: optText(120),
});

export const businessProfileSchema = z.object({
  name: reqText(120, "Business name"),
  tagline: optText(140),
  description: optText(3000),
  phone: optText(40),
  email: optEmail,
  website: optUrl,
  instagram: optUrl,
  facebook: optUrl,
  tiktok: optUrl,
  yearsInBusiness: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0).max(200).optional()),
  regionId: optUuid,
  city: optText(120),
  serviceArea: optText(300),
  isPublic: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const leadSchema = z.object({
  name: reqText(160, "Name"),
  phone: optText(40),
  email: optEmail,
  location: optText(200),
  description: optText(4000),
  serviceId: optUuid,
  status: z.enum(values(LEAD_STATUSES)).default("new"),
  source: z.enum(values(LEAD_SOURCES)).default("other"),
  estimatedValue: optMoney,
  assignedTo: optUuid,
});

export const customerSchema = z.object({
  name: reqText(160, "Name"),
  phone: optText(40),
  email: optEmail,
  address: optText(300),
  city: optText(120),
  notes: optText(4000),
  status: z.enum(values(CUSTOMER_STATUSES)).default("active"),
});

export const projectSchema = z.object({
  name: reqText(160, "Project name"),
  customerId: optUuid,
  leadId: optUuid,
  description: optText(4000),
  location: optText(200),
  startDate: optDate,
  expectedEndDate: optDate,
  status: z.enum(values(PROJECT_STATUSES)).default("planning"),
  budget: optMoney,
}).refine((d) => !d.startDate || !d.expectedEndDate || d.expectedEndDate >= d.startDate, {
  message: "Completion date must be after the start date",
  path: ["expectedEndDate"],
});

export const taskSchema = z.object({
  title: reqText(200, "Task name"),
  description: optText(2000),
  assignedTo: optUuid,
  dueDate: optDate,
  priority: z.enum(values(TASK_PRIORITIES)).default("medium"),
  status: z.enum(values(TASK_STATUSES)).default("todo"),
});

export const noteSchema = z.object({
  entityType: z.enum(["lead", "customer", "project"]),
  entityId: docId,
  body: reqText(5000, "Note"),
});

export const postSchema = z.object({
  type: z.enum(values(POST_TYPES)),
  caption: optText(2200),
  projectId: optUuid,
  serviceId: optUuid,
  locationText: optText(200),
});

export const commentSchema = z.object({ postId: docId, body: reqText(1000, "Comment") });

export const quoteRequestSchema = z.object({
  businessId: docId,
  kind: z.enum(["quote", "contact"]).default("quote"),
  name: reqText(160, "Your name"),
  email: optEmail,
  phone: optText(40),
  serviceId: optUuid,
  location: optText(200),
  description: reqText(4000, "Project details"),
  budgetRange: optText(100),
  timeline: optText(100),
  website: z.string().max(0, "Spam detected").optional(), // honeypot
}).refine((d) => d.email || d.phone, { message: "Add an email or phone number so they can reach you", path: ["email"] });

export const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "business"]),
  targetId: docId,
  reason: z.enum(values(REPORT_REASONS)),
  details: optText(1000),
});

export const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["admin", "field"]).default("field"),
});

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Set by actions that finished and want the client to navigate. */
  redirectTo?: string;
};

export function formToObject(fd: FormData) {
  const out: Record<string, FormDataEntryValue> = {};
  fd.forEach((v, k) => {
    if (!k.startsWith("$ACTION")) out[k] = v;
  });
  return out;
}

export function parseForm<T extends z.ZodTypeAny>(schema: T, fd: FormData):
  | { data: z.infer<T>; state?: undefined }
  | { data?: undefined; state: ActionState } {
  const result = schema.safeParse(formToObject(fd));
  if (!result.success) {
    const flat = result.error.flatten();
    return { state: { ok: false, error: flat.formErrors[0] ?? "Please fix the highlighted fields.", fieldErrors: flat.fieldErrors } };
  }
  return { data: result.data };
}
