import "server-only";
import type { WriteBatch } from "firebase-admin/firestore";
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
 * queues a new "prospect" customer on `batch`. A person who asks twice, or
 * calls after a web request, stays one customer with one history.
 */
export async function findOrCreateCustomer(t: Tenant, batch: WriteBatch, input: ContactInput, createdBy: string | null) {
  const digits = phoneDigits(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const match = digits
    ? await t.col("customers").where("phone_digits", "==", digits).limit(1).get()
    : email ? await t.col("customers").where("email_lower", "==", email).limit(1).get() : null;
  if (match && !match.empty) {
    const doc = match.docs[0];
    return { id: doc.id, name: doc.get("name") as string, created: false };
  }
  const ref = t.col("customers").doc();
  const ts = now();
  batch.set(ref, {
    name: input.name, name_lower: input.name.toLowerCase(), phone: input.phone ?? null, phone_digits: digits, email: input.email ?? null, email_lower: email,
    address: input.address ?? null, city: null, notes: null, status: "prospect", source_lead_id: null, created_by: createdBy, created_at: ts, updated_at: ts,
  });
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
