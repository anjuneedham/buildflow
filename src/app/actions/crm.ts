"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { LEAD_STATUSES, optionFor, values } from "@/lib/constants";
import { customerSchema, leadSchema, noteSchema, parseForm, type ActionState } from "@/lib/validation";

async function ctx() {
  const s = await requireBusiness();
  return { supabase: await createClient(), businessId: s.business.id, userId: s.user.id, isOwner: s.isOwner };
}

const leadRow = (d: z.infer<typeof leadSchema>) => ({
  name: d.name, phone: d.phone ?? null, email: d.email ?? null, location: d.location ?? null, description: d.description ?? null,
  service_id: d.serviceId ?? null, status: d.status, source: d.source, estimated_value: d.estimatedValue ?? null, assigned_to: d.assignedTo ?? null,
});

// ---------------- Leads ----------------
export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.data) return parsed.state;
  const { data, error } = await supabase.from("leads").insert({ ...leadRow(parsed.data), business_id: businessId, created_by: userId }).select("id").single();
  if (error) return { ok: false, error: "Couldn't save the lead." };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "lead", entityId: data.id, action: "created", summary: `Added lead ${parsed.data.name}` });
  revalidatePath("/app", "layout");
  redirect(`/app/leads/${data.id}`);
}

export async function updateLead(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.data) return parsed.state;
  const { error } = await supabase.from("leads").update(leadRow(parsed.data)).eq("id", id).eq("business_id", businessId);
  if (error) return { ok: false, error: error.message.includes("assignee") ? "That person isn't on your team." : "Couldn't update the lead." };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "lead", entityId: id, action: "updated", summary: `Updated lead ${parsed.data.name}` });
  revalidatePath("/app", "layout");
  redirect(`/app/leads/${id}`);
}

export async function setLeadStatus(id: string, status: string) {
  const { supabase, businessId, userId } = await ctx();
  const parsed = z.enum(values(LEAD_STATUSES)).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { data, error } = await supabase.from("leads").update({ status: parsed.data }).eq("id", id).eq("business_id", businessId).select("name").single();
  if (error) return { ok: false, error: "Couldn't update status" };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "lead", entityId: id, action: "status_changed", summary: `Moved ${data.name} to ${optionFor(LEAD_STATUSES, parsed.data)?.label}` });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteLead(id: string) {
  const { supabase, businessId, isOwner } = await ctx();
  if (!isOwner) return { ok: false, error: "Only the business owner can delete leads." };
  await supabase.from("leads").delete().eq("id", id).eq("business_id", businessId);
  revalidatePath("/app", "layout");
  redirect("/app/leads");
}

export async function convertLead(id: string) {
  const { supabase } = await ctx();
  const { data: customerId, error } = await supabase.rpc("convert_lead_to_customer", { p_lead_id: id });
  if (error || !customerId) return { ok: false, error: "Couldn't convert this lead." };
  revalidatePath("/app", "layout");
  redirect(`/app/customers/${customerId}?converted=1`);
}

// ---------------- Customers ----------------
const customerRow = (d: z.infer<typeof customerSchema>) => ({
  name: d.name, phone: d.phone ?? null, email: d.email ?? null, address: d.address ?? null, city: d.city ?? null, notes: d.notes ?? null, status: d.status,
});

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.data) return parsed.state;
  const { data, error } = await supabase.from("customers").insert({ ...customerRow(parsed.data), business_id: businessId, created_by: userId }).select("id").single();
  if (error) return { ok: false, error: "Couldn't save the customer." };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "customer", entityId: data.id, action: "created", summary: `Added customer ${parsed.data.name}` });
  revalidatePath("/app", "layout");
  redirect(`/app/customers/${data.id}`);
}

export async function updateCustomer(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId } = await ctx();
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.data) return parsed.state;
  const { error } = await supabase.from("customers").update(customerRow(parsed.data)).eq("id", id).eq("business_id", businessId);
  if (error) return { ok: false, error: "Couldn't update the customer." };
  revalidatePath("/app", "layout");
  redirect(`/app/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const { supabase, businessId, isOwner } = await ctx();
  if (!isOwner) return { ok: false, error: "Only the business owner can delete customers." };
  await supabase.from("customers").delete().eq("id", id).eq("business_id", businessId);
  revalidatePath("/app", "layout");
  redirect("/app/customers");
}

// ---------------- Notes ----------------
export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.data) return parsed.state;
  const { entityType, entityId, body } = parsed.data;
  // Confirm the parent belongs to this business before attaching a note.
  const table = entityType === "lead" ? "leads" : entityType === "customer" ? "customers" : "projects";
  const { data: parent } = await supabase.from(table).select("id").eq("id", entityId).eq("business_id", businessId).maybeSingle();
  if (!parent) return { ok: false, error: "Record not found." };
  const { error } = await supabase.from("notes").insert({ business_id: businessId, entity_type: entityType, entity_id: entityId, body, author_id: userId });
  if (error) return { ok: false, error: "Couldn't save the note." };
  await logActivity(supabase, { businessId, actorId: userId, entityType, entityId, action: "note_added", summary: `Added a note` });
  revalidatePath(`/app/${table}/${entityId}`);
  return { ok: true, message: "Note added" };
}

export async function deleteNote(id: string, path: string) {
  const { supabase, businessId } = await ctx();
  await supabase.from("notes").delete().eq("id", id).eq("business_id", businessId);
  revalidatePath(path.startsWith("/app/") ? path : "/app");
  return { ok: true };
}
