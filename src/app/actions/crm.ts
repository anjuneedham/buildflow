"use server";

import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { addActivity, addEvent, addNotification, logActivity, tenant } from "@/lib/data/tenant";
import { requireBusiness, requirePermission } from "@/lib/session";
import { canAccessProject } from "@/server/policy";
import { LEAD_STATUSES, optionFor, values } from "@/lib/constants";
import { customerSchema, leadSchema, noteSchema, parseForm, type ActionState } from "@/lib/validation";

// Leads, customers and their notes: owner and admin only (crew are redirected).
async function ctx() {
  const s = await requirePermission("crm");
  return { t: tenant(s.business.id), businessId: s.business.id, userId: s.user.id, userName: s.profile?.full_name ?? null, canDelete: s.can("records.delete") };
}

async function isMember(businessId: string, userId: string | undefined) {
  return !userId || (await tenant(businessId).doc("members", userId).get()).exists;
}

async function serviceName(id: string | undefined) {
  if (!id) return null;
  const snap = await db().collection("services").doc(id).get();
  return snap.exists ? (snap.get("name") as string) : null;
}

const leadFields = async (d: z.infer<typeof leadSchema>) => ({
  name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, location: d.location ?? null,
  description: d.description ?? null, service_id: d.serviceId ?? null, service_name: await serviceName(d.serviceId), status: d.status,
  source: d.source, estimated_value: d.estimatedValue ?? null, assigned_to: d.assignedTo ?? null,
});

/** Deletes notes attached to a deleted lead/customer/project. */
async function deleteNotesFor(businessId: string, entityId: string) {
  const snap = await tenant(businessId).col("notes").where("entity_id", "==", entityId).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------------- Leads ----------------
export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.data) return parsed.state;
  if (!(await isMember(businessId, parsed.data.assignedTo))) return { ok: false, error: "That person isn't on your team." };
  const ref = t.col("leads").doc();
  const batch = db().batch();
  const ts = now();
  batch.set(ref, { ...(await leadFields(parsed.data)), customer_id: null, quote_request_id: null, created_by: userId, status_changed_at: ts, created_at: ts, updated_at: ts });
  addEvent(batch, businessId, "lead_created", { source: parsed.data.source });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "lead", entityId: ref.id, action: "created", summary: `Added lead ${parsed.data.name}` });
  if (parsed.data.assignedTo && parsed.data.assignedTo !== userId) {
    addNotification(batch, parsed.data.assignedTo, { businessId, type: "new_lead", title: `A lead was assigned to you: ${parsed.data.name}`, link: `/app/leads/${ref.id}` });
  }
  await batch.commit();
  return { ok: true, redirectTo: `/app/leads/${ref.id}` };
}

export async function updateLead(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName } = await ctx();
  if (!isId(id)) return { ok: false, error: "Lead not found." };
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.data) return parsed.state;
  if (!(await isMember(businessId, parsed.data.assignedTo))) return { ok: false, error: "That person isn't on your team." };
  const ref = t.doc("leads", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Lead not found." };
  const batch = db().batch();
  const fields = await leadFields(parsed.data);
  batch.update(ref, { ...fields, updated_at: now(), ...(fields.status !== prev.get("status") ? { status_changed_at: now() } : {}) });
  if (fields.status === "won" && prev.get("status") !== "won") addEvent(batch, businessId, "project_won", { lead_id: id });
  if (fields.assigned_to && fields.assigned_to !== prev.get("assigned_to") && fields.assigned_to !== userId) {
    addNotification(batch, fields.assigned_to, { businessId, type: "new_lead", title: `A lead was assigned to you: ${fields.name}`, link: `/app/leads/${id}` });
  }
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "lead", entityId: id, action: "updated", summary: `Updated lead ${fields.name}` });
  await batch.commit();
  return { ok: true, redirectTo: `/app/leads/${id}` };
}

export async function setLeadStatus(id: string, status: string) {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = z.enum(values(LEAD_STATUSES)).safeParse(status);
  if (!parsed.success || !isId(id)) return { ok: false, error: "Invalid status" };
  const ref = t.doc("leads", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Lead not found" };
  if (prev.get("status") === parsed.data) return { ok: true };
  const batch = db().batch();
  batch.update(ref, { status: parsed.data, status_changed_at: now(), updated_at: now() });
  if (parsed.data === "won") addEvent(batch, businessId, "project_won", { lead_id: id });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "lead", entityId: id, action: "status_changed", summary: `Moved ${prev.get("name")} to ${optionFor(LEAD_STATUSES, parsed.data)?.label}` });
  await batch.commit();
  return { ok: true };
}

export async function deleteLead(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete leads." };
  if (!isId(id)) return { ok: false, error: "Lead not found." };
  await t.doc("leads", id).delete();
  await deleteNotesFor(businessId, id);
  return { ok: true, redirectTo: "/app/leads" };
}

export async function convertLead(id: string) {
  const { t, userId, userName } = await ctx();
  if (!isId(id)) return { ok: false, error: "Lead not found." };
  const leadRef = t.doc("leads", id);
  let customerId: string;
  try {
    customerId = await db().runTransaction(async (tx) => {
      const lead = await tx.get(leadRef);
      if (!lead.exists) throw new Error("not-found");
      if (lead.get("customer_id")) return lead.get("customer_id") as string;
      const customerRef = t.col("customers").doc();
      const ts = now();
      const l = lead.data()!;
      tx.set(customerRef, {
        name: l.name, name_lower: l.name_lower ?? l.name.toLowerCase(), phone: l.phone ?? null, email: l.email ?? null, address: l.location ?? null, city: null,
        notes: l.description ?? null, status: "active", source_lead_id: id, created_by: userId, created_at: ts, updated_at: ts,
      });
      const becomesWon = !["won", "lost"].includes(l.status);
      tx.update(leadRef, { customer_id: customerRef.id, customer_name: l.name, updated_at: ts, ...(becomesWon ? { status: "won", status_changed_at: ts } : {}) });
      if (becomesWon) tx.set(t.col("events").doc(), { type: "project_won", lead_id: id, created_at: ts });
      tx.set(t.col("activity").doc(), { actor_id: userId, actor_name: userName, entity_type: "customer", entity_id: customerRef.id, action: "created", summary: `Converted lead ${l.name} into a customer`, created_at: ts });
      return customerRef.id;
    });
  } catch {
    return { ok: false, error: "Couldn't convert this lead." };
  }
  return { ok: true, redirectTo: `/app/customers/${customerId}?converted=1` };
}

// ---------------- Customers ----------------
const customerFields = (d: z.infer<typeof customerSchema>) => ({
  name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, address: d.address ?? null,
  city: d.city ?? null, notes: d.notes ?? null, status: d.status,
});

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.data) return parsed.state;
  const ref = t.col("customers").doc();
  const batch = db().batch();
  batch.set(ref, { ...customerFields(parsed.data), source_lead_id: null, created_by: userId, created_at: now(), updated_at: now() });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "customer", entityId: ref.id, action: "created", summary: `Added customer ${parsed.data.name}` });
  await batch.commit();
  return { ok: true, redirectTo: `/app/customers/${ref.id}` };
}

export async function updateCustomer(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await ctx();
  if (!isId(id)) return { ok: false, error: "Customer not found." };
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.data) return parsed.state;
  const ref = t.doc("customers", id);
  if (!(await ref.get()).exists) return { ok: false, error: "Customer not found." };
  await ref.update({ ...customerFields(parsed.data), updated_at: now() });
  // Keep the denormalised customer name on projects in sync.
  const projects = await t.col("projects").where("customer_id", "==", id).get();
  if (!projects.empty) {
    const batch = db().batch();
    projects.docs.forEach((p) => batch.update(p.ref, { customer_name: parsed.data!.name }));
    await batch.commit();
  }
  return { ok: true, redirectTo: `/app/customers/${id}` };
}

export async function deleteCustomer(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete customers." };
  if (!isId(id)) return { ok: false, error: "Customer not found." };
  const [projects, leads] = await Promise.all([t.col("projects").where("customer_id", "==", id).get(), t.col("leads").where("customer_id", "==", id).get()]);
  const batch = db().batch();
  batch.delete(t.doc("customers", id));
  projects.docs.forEach((p) => batch.update(p.ref, { customer_id: null, customer_name: null }));
  leads.docs.forEach((l) => batch.update(l.ref, { customer_id: null, customer_name: null }));
  await batch.commit();
  await deleteNotesFor(businessId, id);
  return { ok: true, redirectTo: "/app/customers" };
}

// ---------------- Notes ----------------
const NOTE_PARENT = { lead: "leads", customer: "customers", project: "projects" } as const;

// Notes on jobs are open to crew assigned to that job; notes on leads and
// customers need CRM access.
async function noteCtx(entityType: keyof typeof NOTE_PARENT, entityId: string) {
  const s = await requireBusiness();
  const t = tenant(s.business.id);
  const parent = await t.doc(NOTE_PARENT[entityType], entityId).get();
  const allowed = parent.exists && (entityType === "project"
    ? canAccessProject(s.role, s.user.id, { member_ids: parent.get("member_ids") })
    : s.can("crm"));
  return allowed ? { t, businessId: s.business.id, userId: s.user.id, userName: s.profile?.full_name ?? null, canDelete: s.can("records.delete") } : null;
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.data) return parsed.state;
  const { entityType, entityId, body } = parsed.data;
  const c = await noteCtx(entityType, entityId);
  if (!c) return { ok: false, error: "Record not found." };
  const { t, businessId, userId, userName } = c;
  await t.col("notes").add({ entity_type: entityType, entity_id: entityId, body, author_id: userId, author_name: userName, created_at: now() });
  await logActivity(businessId, { actorId: userId, actorName: userName, entityType, entityId, action: "note_added", summary: "Added a note" });
  return { ok: true, message: "Note added" };
}

export async function deleteNote(id: string) {
  const s = await requireBusiness();
  if (!isId(id)) return { ok: false };
  const ref = tenant(s.business.id).doc("notes", id);
  const note = await ref.get();
  if (note.exists && (note.get("author_id") === s.user.id || s.can("records.delete"))) await ref.delete();
  return { ok: true };
}

