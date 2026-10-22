"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { uploadImage, validImage } from "@/lib/storage";
import { PROJECT_STATUSES, TASK_STATUSES, optionFor, values } from "@/lib/constants";
import { parseForm, projectSchema, taskSchema, type ActionState } from "@/lib/validation";

async function ctx() {
  const s = await requireBusiness();
  return { supabase: await createClient(), businessId: s.business.id, userId: s.user.id, isOwner: s.isOwner };
}

const projectRow = (d: z.infer<typeof projectSchema>) => ({
  name: d.name, customer_id: d.customerId ?? null, description: d.description ?? null, location: d.location ?? null,
  start_date: d.startDate ?? null, expected_end_date: d.expectedEndDate ?? null, status: d.status, budget: d.budget ?? null,
});

export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const { data, error } = await supabase.from("projects")
    .insert({ ...projectRow(parsed.data), lead_id: parsed.data.leadId ?? null, business_id: businessId, created_by: userId }).select("id").single();
  if (error) return { ok: false, error: "Couldn't create the project." };
  if (parsed.data.leadId) {
    await supabase.from("leads").update({ status: "won" }).eq("id", parsed.data.leadId).eq("business_id", businessId).neq("status", "won");
  }
  const members = fd.getAll("memberIds").map(String).filter((v) => z.string().uuid().safeParse(v).success);
  if (members.length) await supabase.from("project_members").insert(members.map((user_id) => ({ project_id: data.id, business_id: businessId, user_id })));
  await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: data.id, action: "created", summary: `Created project ${parsed.data.name}` });
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${data.id}`);
}

export async function updateProject(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const { error } = await supabase.from("projects").update(projectRow(parsed.data)).eq("id", id).eq("business_id", businessId);
  if (error) return { ok: false, error: "Couldn't update the project." };
  const members = fd.getAll("memberIds").map(String).filter((v) => z.string().uuid().safeParse(v).success);
  const { data: existing } = await supabase.from("project_members").select("user_id").eq("project_id", id);
  const have = new Set((existing ?? []).map((m) => m.user_id));
  const want = new Set(members);
  const add = members.filter((m) => !have.has(m));
  const remove = [...have].filter((m) => !want.has(m));
  if (add.length) await supabase.from("project_members").insert(add.map((user_id) => ({ project_id: id, business_id: businessId, user_id })));
  if (remove.length) await supabase.from("project_members").delete().eq("project_id", id).in("user_id", remove);
  await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: id, action: "updated", summary: `Updated project details` });
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${id}`);
}

export async function setProjectStatus(id: string, status: string) {
  const { supabase, businessId, userId } = await ctx();
  const parsed = z.enum(values(PROJECT_STATUSES)).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { data, error } = await supabase.from("projects").update({ status: parsed.data }).eq("id", id).eq("business_id", businessId).select("name").single();
  if (error) return { ok: false, error: "Couldn't update status" };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: id, action: "status_changed", summary: `${data.name} is now ${optionFor(PROJECT_STATUSES, parsed.data)?.label}` });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteProject(id: string) {
  const { supabase, businessId, isOwner } = await ctx();
  if (!isOwner) return { ok: false, error: "Only the business owner can delete projects." };
  await supabase.from("projects").delete().eq("id", id).eq("business_id", businessId);
  revalidatePath("/app", "layout");
  redirect("/app/projects");
}

// ---------------- Tasks ----------------
export async function createTask(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const parsed = parseForm(taskSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const { error } = await supabase.from("tasks").insert({
    business_id: businessId, project_id: projectId, title: d.title, description: d.description ?? null, assigned_to: d.assignedTo ?? null,
    due_date: d.dueDate ?? null, priority: d.priority, status: d.status, created_by: userId,
  });
  if (error) return { ok: false, error: error.message.includes("assignee") ? "That person isn't on your team." : "Couldn't add the task." };
  await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: projectId, action: "task_added", summary: `Added task "${d.title}"` });
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
  return { ok: true, message: "Task added" };
}

export async function setTaskStatus(taskId: string, status: string) {
  const { supabase, businessId, userId } = await ctx();
  const parsed = z.enum(values(TASK_STATUSES)).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { data, error } = await supabase.from("tasks").update({ status: parsed.data }).eq("id", taskId).eq("business_id", businessId).select("title, project_id").single();
  if (error) return { ok: false, error: "Couldn't update the task" };
  if (parsed.data === "done") {
    await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: data.project_id, action: "task_done", summary: `Completed "${data.title}"` });
  }
  revalidatePath(`/app/projects/${data.project_id}`);
  revalidatePath("/app");
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const { supabase, businessId } = await ctx();
  const { data } = await supabase.from("tasks").delete().eq("id", taskId).eq("business_id", businessId).select("project_id").maybeSingle();
  if (data) revalidatePath(`/app/projects/${data.project_id}`);
  return { ok: true };
}

// ---------------- Photos ----------------
export async function uploadProjectPhotos(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, businessId, userId } = await ctx();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("business_id", businessId).maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  const files = fd.getAll("photos").filter(validImage).slice(0, 10);
  if (files.length === 0) return { ok: false, error: "Choose at least one photo." };
  const caption = String(fd.get("caption") ?? "").trim().slice(0, 300) || null;
  let uploaded = 0;
  for (const f of files) {
    const r = await uploadImage(supabase, "project-files", businessId, f);
    if ("error" in r) return { ok: false, error: r.error };
    await supabase.from("project_photos").insert({ business_id: businessId, project_id: projectId, url: r.url, caption, uploaded_by: userId });
    uploaded++;
  }
  await logActivity(supabase, { businessId, actorId: userId, entityType: "project", entityId: projectId, action: "photos_added", summary: `Added ${uploaded} photo${uploaded > 1 ? "s" : ""}` });
  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, message: `${uploaded} photo${uploaded > 1 ? "s" : ""} uploaded` };
}
