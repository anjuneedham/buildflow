"use server";

import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { addActivity, addEvent, addNotification, tenant } from "@/lib/data/tenant";
import { findOrCreateCustomer } from "@/lib/data/workflow";
import { recordFirstResponse } from "@/lib/data/trust";
import { requireBusiness, requirePermission } from "@/lib/session";
import { canAccessProject } from "@/server/policy";
import { LEAD_STATUSES, LOST_REASONS, OPEN_LEAD_STATUSES, optionFor, values } from "@/lib/constants";
import { customerSchema, leadSchema, noteSchema, parseForm, type ActionState } from "@/lib/validation";
import { phoneDigits } from "@/lib/utils";

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
  // A closed lead has nothing to follow up.
  next_follow_up: OPEN_LEAD_STATUSES.includes(d.status) ? d.nextFollowUp ?? null : null,
});

/** Removes the notes that belong to a deleted record (history entries stay on the other records). */
async function deleteNotesFor(businessId: string, field: "lead_id" | "customer_id", id: string) {
  const snap = await tenant(businessId).col("activity").where(field, "==", id).where("action", "==", "note").limit(400).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------------- Leads ----------------
export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  if (!(await isMember(businessId, d.assignedTo))) return { ok: false, error: "That person isn't on your team." };
  const ref = t.col("leads").doc();
  const batch = db().batch();
  const ts = now();
  // Every lead belongs to a customer from the start: no separate "convert" step.
  const customer = await findOrCreateCustomer(t, batch, { name: d.name, phone: d.phone, email: d.email, address: d.location }, userId);
  batch.set(ref, {
    ...(await leadFields(d)), phone_digits: phoneDigits(d.phone), customer_id: customer.id, customer_name: customer.name, project_id: null,
    quote_request_id: null, created_by: userId, status_changed_at: ts, created_at: ts, updated_at: ts,
  });
  addEvent(batch, businessId, "lead_created");
  addActivity(batch, businessId, {
    actorId: userId, actorName: userName, entityType: "lead", entityId: ref.id, leadId: ref.id, customerId: customer.id, action: "created",
    summary: customer.created ? `Added lead ${d.name}` : `Added a new lead for ${customer.name}`,
  });
  if (d.assignedTo && d.assignedTo !== userId) {
    addNotification(batch, d.assignedTo, { businessId, type: "new_lead", title: `A lead was assigned to you: ${d.name}`, link: `/app/leads/${ref.id}` });
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
  batch.update(ref, { ...fields, phone_digits: phoneDigits(fields.phone), updated_at: now(), ...(fields.status !== prev.get("status") ? { status_changed_at: now() } : {}) });
  if (fields.status === "won" && prev.get("status") !== "won") addEvent(batch, businessId, "project_won");
  if (fields.assigned_to && fields.assigned_to !== prev.get("assigned_to") && fields.assigned_to !== userId) {
    addNotification(batch, fields.assigned_to, { businessId, type: "new_lead", title: `A lead was assigned to you: ${fields.name}`, link: `/app/leads/${id}` });
  }
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "lead", entityId: id, leadId: id, customerId: prev.get("customer_id"), action: "updated", summary: "Updated lead details" });
  await batch.commit();
  return { ok: true, redirectTo: `/app/leads/${id}` };
}

export async function setLeadStatus(id: string, status: string, lostReason?: string) {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = z.enum(values(LEAD_STATUSES)).safeParse(status);
  if (!parsed.success || !isId(id)) return { ok: false, error: "Invalid status" };
  const reason = parsed.data === "lost" && lostReason && (LOST_REASONS as readonly string[]).includes(lostReason) ? lostReason : null;
  const ref = t.doc("leads", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Lead not found" };
  if (prev.get("status") === parsed.data && !reason) return { ok: true };
  const open = OPEN_LEAD_STATUSES.includes(parsed.data);
  const batch = db().batch();
  recordFirstResponse(batch, businessId, prev);
  batch.update(ref, { status: parsed.data, status_changed_at: now(), updated_at: now(), lost_reason: reason, ...(open ? {} : { next_follow_up: null }) });
  if (parsed.data === "won") addEvent(batch, businessId, "project_won");
  addActivity(batch, businessId, {
    actorId: userId, actorName: userName, entityType: "lead", entityId: id, leadId: id, customerId: prev.get("customer_id"), action: "status_changed",
    summary: `Moved to ${optionFor(LEAD_STATUSES, parsed.data)?.label}${reason ? ` (${reason})` : ""}`,
  });
  await batch.commit();
  return { ok: true };
}

/** Sets or clears the date to chase this lead. Shows on Today when due. */
export async function setFollowUp(id: string, date: string | null) {
  const { t, businessId, userId, userName } = await ctx();
  if (!isId(id) || (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return { ok: false, error: "Invalid date" };
  const ref = t.doc("leads", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Lead not found" };
  if (date && !OPEN_LEAD_STATUSES.includes(prev.get("status"))) return { ok: false, error: "This lead is closed. Reopen it to set a follow-up." };
  const batch = db().batch();
  batch.update(ref, { next_follow_up: date, updated_at: now() });
  addActivity(batch, businessId, {
    actorId: userId, actorName: userName, entityType: "lead", entityId: id, leadId: id, customerId: prev.get("customer_id"), action: "follow_up",
    summary: date ? `Follow-up set for ${date}` : "Follow-up cleared",
  });
  await batch.commit();
  return { ok: true };
}

export async function deleteLead(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete leads." };
  if (!isId(id)) return { ok: false, error: "Lead not found." };
  const lead = await t.doc("leads", id).get();
  if (!lead.exists) return { ok: true, redirectTo: "/app/leads" };
  if (lead.get("project_id")) return { ok: false, error: "This lead has a job. Delete the job first, or keep the lead as its history." };
  await t.doc("leads", id).delete();
  await deleteNotesFor(businessId, "lead_id", id);
  return { ok: true, redirectTo: "/app/leads" };
}

/** For older leads saved before every lead had a customer: links or creates one. */
export async function linkLeadCustomer(id: string) {
  const { t, businessId, userId, userName } = await ctx();
  if (!isId(id)) return { ok: false, error: "Lead not found." };
  const ref = t.doc("leads", id);
  const lead = await ref.get();
  if (!lead.exists) return { ok: false, error: "Lead not found." };
  if (lead.get("customer_id")) return { ok: true, redirectTo: `/app/customers/${lead.get("customer_id")}` };
  const batch = db().batch();
  const customer = await findOrCreateCustomer(t, batch, { name: lead.get("name"), phone: lead.get("phone"), email: lead.get("email"), address: lead.get("location") }, userId);
  batch.update(ref, { customer_id: customer.id, customer_name: customer.name, updated_at: now() });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "customer", entityId: customer.id, customerId: customer.id, leadId: id, action: "linked", summary: `Saved ${customer.name} as a customer` });
  await batch.commit();
  return { ok: true };
}

// ---------------- Customers ----------------
const customerFields = (d: z.infer<typeof customerSchema>) => ({
  name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, phone_digits: phoneDigits(d.phone), email: d.email ?? null,
  email_lower: d.email?.toLowerCase() ?? null, address: d.address ?? null, city: d.city ?? null, notes: d.notes ?? null, status: d.status,
});

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName } = await ctx();
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.data) return parsed.state;
  const digits = phoneDigits(parsed.data.phone);
  if (digits) {
    const dupe = await t.col("customers").where("phone_digits", "==", digits).limit(1).get();
    if (!dupe.empty) return { ok: false, error: `${dupe.docs[0].get("name")} already has this phone number.` };
  }
  const ref = t.col("customers").doc();
  const batch = db().batch();
  batch.set(ref, { ...customerFields(parsed.data), source_lead_id: null, created_by: userId, created_at: now(), updated_at: now() });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "customer", entityId: ref.id, customerId: ref.id, action: "created", summary: `Added customer ${parsed.data.name}` });
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
  // Keep the customer name copied onto their jobs and leads in sync (FIRESTORE_SCHEMA_V2.md §4).
  const [projects, leads] = await Promise.all([
    t.col("projects").where("customer_id", "==", id).limit(200).get(),
    t.col("leads").where("customer_id", "==", id).limit(200).get(),
  ]);
  if (!projects.empty || !leads.empty) {
    const batch = db().batch();
    projects.docs.forEach((p) => batch.update(p.ref, { customer_name: parsed.data!.name }));
    leads.docs.forEach((l) => batch.update(l.ref, { customer_name: parsed.data!.name }));
    await batch.commit();
  }
  return { ok: true, redirectTo: `/app/customers/${id}` };
}

export async function deleteCustomer(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete customers." };
  if (!isId(id)) return { ok: false, error: "Customer not found." };
  const [projects, leads] = await Promise.all([t.col("projects").where("customer_id", "==", id).limit(200).get(), t.col("leads").where("customer_id", "==", id).limit(200).get()]);
  const batch = db().batch();
  batch.delete(t.doc("customers", id));
  projects.docs.forEach((p) => batch.update(p.ref, { customer_id: null, customer_name: null }));
  leads.docs.forEach((l) => batch.update(l.ref, { customer_id: null, customer_name: null }));
  await batch.commit();
  await deleteNotesFor(businessId, "customer_id", id);
  return { ok: true, redirectTo: "/app/customers" };
}

// ---------------- Notes (timeline entries) ----------------
const NOTE_PARENT = { lead: "leads", customer: "customers", project: "projects" } as const;

// Notes on jobs are open to crew assigned to that job; notes on leads and
// customers need CRM access. A note is filed on its record and on the
// customer, so the customer's timeline tells the whole story.
async function noteCtx(entityType: keyof typeof NOTE_PARENT, entityId: string) {
  const s = await requireBusiness();
  const t = tenant(s.business.id);
  const parent = await t.doc(NOTE_PARENT[entityType], entityId).get();
  const allowed = parent.exists && (entityType === "project"
    ? canAccessProject(s.role, s.user.id, { member_ids: parent.get("member_ids") })
    : s.can("crm"));
  if (!allowed) return null;
  const refs = entityType === "customer" ? { customerId: entityId }
    : entityType === "lead" ? { leadId: entityId, customerId: parent.get("customer_id") as string | null }
    : { projectId: entityId, customerId: parent.get("customer_id") as string | null };
  return { businessId: s.business.id, userId: s.user.id, userName: s.profile?.full_name ?? null, canDelete: s.can("records.delete"), refs };
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.data) return parsed.state;
  const { entityType, entityId, body } = parsed.data;
  const c = await noteCtx(entityType, entityId);
  if (!c) return { ok: false, error: "Record not found." };
  const batch = db().batch();
  addActivity(batch, c.businessId, { actorId: c.userId, actorName: c.userName, entityType, entityId, action: "note", summary: "Added a note", body, ...c.refs });
  await batch.commit();
  return { ok: true, message: "Note added" };
}

export async function deleteNote(id: string) {
  const s = await requireBusiness();
  if (!isId(id)) return { ok: false };
  const ref = tenant(s.business.id).doc("activity", id);
  const note = await ref.get();
  // Notes, and text-only site updates (updates with photos are removed photo by photo).
  const removable = note.get("action") === "note" || (note.get("action") === "update" && !(note.get("media") ?? []).length);
  if (note.exists && removable && (note.get("actor_id") === s.user.id || s.can("records.delete"))) await ref.delete();
  return { ok: true };
}
