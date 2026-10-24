import "server-only";
import { createHash } from "node:crypto";
import { now } from "./db";
import type { tenant } from "./tenant";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/constants";
import { phoneDigits } from "@/lib/utils";

// The connective tissue of the contractor workflow (UX_ARCHITECTURE_V2.md §3.5–3.11):
// every lead belongs to a customer, a customer's status follows their jobs,
// and each job knows its next task. These helpers keep those links and
// copies correct; the owners of each copy are listed in FIRESTORE_SCHEMA_V2.md §4.

type Tenant = ReturnType<typeof tenant>;

export type ContactInput = { name: string; phone?: string | null; email?: string | null; address?: string | null };

/**
 * Finds the customer with the same phone number (any format) or email, or
 * creates a new "prospect" customer. A person who asks twice, or calls after a
 * web request, stays one customer with one history.
 *
 * Customers made here get an id derived from the phone or email, and are
 * created with create(), which fails if the id exists. Two requests for the
 * same person arriving together (a double tap, two tabs, a retry) therefore
 * cannot both create one: the loser reads the winner's record.
 */
export async function findOrCreateCustomer(t: Tenant, input: ContactInput, createdBy: string | null) {
  const digits = phoneDigits(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const match = digits
    ? await t.col("customers").where("phone_digits", "==", digits).limit(1).get()
    : email ? await t.col("customers").where("email_lower", "==", email).limit(1).get() : null;
  if (match && !match.empty) {
    const doc = match.docs[0];
    return { id: doc.id, name: doc.get("name") as string, created: false };
  }
  const key = digits ? `ph-${digits}` : email ? `em-${createHash("sha1").update(email).digest("hex").slice(0, 24)}` : null;
  const ref = key ? t.doc("customers", key) : t.col("customers").doc();
  const ts = now();
  try {
    await ref.create({
      name: input.name, name_lower: input.name.toLowerCase(), phone: input.phone ?? null, phone_digits: digits, email: input.email ?? null, email_lower: email,
      address: input.address ?? null, city: null, notes: null, status: "prospect", source_lead_id: null, created_by: createdBy, created_at: ts, updated_at: ts,
    });
  } catch (e) {
    if ((e as { code?: number }).code !== 6) throw e; // ALREADY_EXISTS: someone just created this person
    const existing = await ref.get();
    return { id: ref.id, name: existing.get("name") as string, created: false };
  }
  return { id: ref.id, name: input.name, created: true };
}

/**
 * prospect → active (has a job underway) → past (all jobs finished).
 * A customer marked "inactive" by hand is left alone.
 */
export async function refreshCustomerStatus(t: Tenant, customerId: string | null | undefined) {
  if (!customerId) return;
  const ref = t.doc("customers", customerId);
  const [customer, jobs] = await Promise.all([ref.get(), t.col("projects").where("customer_id", "==", customerId).select("status").limit(100).get()]);
  if (!customer.exists || customer.get("status") === "inactive") return;
  const statuses = jobs.docs.map((d) => d.get("status") as string);
  const next = statuses.some((s) => (ACTIVE_PROJECT_STATUSES as string[]).includes(s)) ? "active"
    : statuses.includes("completed") ? "past" : customer.get("status");
  if (next !== customer.get("status")) await ref.update({ status: next, updated_at: now() });
}

export type NextTask = { id: string; title: string; due_date: string | null; assigned_to: string | null } | null;

/** Recomputes projects/{id}.next_task: the open task due soonest (undated last). */
export async function refreshNextTask(t: Tenant, projectId: string) {
  const open = await t.col("tasks").where("project_id", "==", projectId).where("status", "in", ["todo", "in_progress"]).limit(200).get();
  const next = open.docs
    .map((d) => ({ id: d.id, title: d.get("title") as string, due_date: (d.get("due_date") as string | null) ?? null, assigned_to: (d.get("assigned_to") as string | null) ?? null, created_at: d.get("created_at") as string }))
    .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") || a.created_at.localeCompare(b.created_at))[0];
  const value: NextTask = next ? { id: next.id, title: next.title, due_date: next.due_date, assigned_to: next.assigned_to } : null;
  const ref = t.doc("projects", projectId);
  if ((await ref.get()).exists) await ref.update({ next_task: value });
  return value;
}
