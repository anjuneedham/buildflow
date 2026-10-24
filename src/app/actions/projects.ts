"use server";

import { z } from "zod";
import { db, bucket } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { addActivity, addEvent, addNotification, inc, tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { canAccessProject } from "@/server/policy";
import { uploadImage, validImage } from "@/lib/storage";
import { PROJECT_STATUSES, TASK_STATUSES, optionFor, values } from "@/lib/constants";
import { docId, parseForm, projectSchema, taskSchema, type ActionState } from "@/lib/validation";

async function ctx() {
  const s = await requireBusiness();
  return {
    t: tenant(s.business.id), businessId: s.business.id, userId: s.user.id, userName: s.profile?.full_name ?? null,
    role: s.role, canManage: s.can("projects.manage"), canDelete: s.can("records.delete"),
  };
}

const FORBIDDEN = { ok: false, error: "You don't have permission to do that." } as const;

/** Loads a job the caller may work on (crew: only jobs they're assigned to). */
async function accessibleProject(c: Awaited<ReturnType<typeof ctx>>, projectId: string) {
  if (!isId(projectId)) return null;
  const snap = await c.t.doc("projects", projectId).get();
  if (!snap.exists || !canAccessProject(c.role, c.userId, { member_ids: snap.get("member_ids") })) return null;
  return snap;
}

/** Only ids of real members survive; prevents assigning outsiders. */
async function memberIds(businessId: string, ids: string[]) {
  const clean = Array.from(new Set(ids.filter((v) => docId.safeParse(v).success))).slice(0, 50);
  if (!clean.length) return [];
  const snaps = await db().getAll(...clean.map((id) => tenant(businessId).doc("members", id)));
  return snaps.filter((s) => s.exists).map((s) => s.id);
}

async function customerName(businessId: string, id: string | undefined) {
  if (!id) return { ok: true as const, name: null };
  const snap = await tenant(businessId).doc("customers", id).get();
  return snap.exists ? { ok: true as const, name: snap.get("name") as string } : { ok: false as const };
}

async function refreshCompletedCount(businessId: string) {
  const t = tenant(businessId);
  const n = (await t.col("projects").where("status", "==", "completed").count().get()).data().count;
  await t.root.update({ completed_project_count: n });
}

const projectFields = (d: z.infer<typeof projectSchema>) => ({
  name: d.name, customer_id: d.customerId ?? null, description: d.description ?? null, location: d.location ?? null,
  start_date: d.startDate ?? null, expected_end_date: d.expectedEndDate ?? null, status: d.status, budget: d.budget ?? null,
});

export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const customer = await customerName(businessId, d.customerId);
  if (!customer.ok) return { ok: false, error: "Customer not found." };
  const members = await memberIds(businessId, fd.getAll("memberIds").map(String));
  const ref = t.col("projects").doc();
  const ts = now();
  const batch = db().batch();
  batch.set(ref, {
    ...projectFields(d), customer_name: customer.name, lead_id: d.leadId ?? null, member_ids: members, task_total: 0, task_done: 0,
    completed_at: d.status === "completed" ? ts : null, created_by: userId, created_at: ts, updated_at: ts,
  });
  if (d.leadId) {
    const lead = await t.doc("leads", d.leadId).get();
    if (lead.exists && lead.get("status") !== "won") {
      batch.update(lead.ref, { status: "won", status_changed_at: ts, updated_at: ts });
      addEvent(batch, businessId, "project_won");
    }
  }
  if (d.status === "completed") addEvent(batch, businessId, "project_completed");
  members.filter((m) => m !== userId).forEach((m) => addNotification(batch, m, { businessId, type: "project_assigned", title: `You were added to ${d.name}`, link: `/app/jobs/${ref.id}` }));
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: ref.id, action: "created", summary: `Created project ${d.name}` });
  await batch.commit();
  if (d.status === "completed") await refreshCompletedCount(businessId);
  return { ok: true, redirectTo: `/app/jobs/${ref.id}` };
}

export async function updateProject(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  if (!isId(id)) return { ok: false, error: "Project not found." };
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const ref = t.doc("projects", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Project not found." };
  const customer = await customerName(businessId, d.customerId);
  if (!customer.ok) return { ok: false, error: "Customer not found." };
  const members = await memberIds(businessId, fd.getAll("memberIds").map(String));
  const before: string[] = prev.get("member_ids") ?? [];
  const batch = db().batch();
  const wasCompleted = prev.get("status") === "completed";
  batch.update(ref, {
    ...projectFields(d), customer_name: customer.name, member_ids: members, updated_at: now(),
    completed_at: d.status === "completed" ? prev.get("completed_at") ?? now() : null,
  });
  if (d.status === "completed" && !wasCompleted) addEvent(batch, businessId, "project_completed");
  members.filter((m) => !before.includes(m) && m !== userId).forEach((m) => addNotification(batch, m, { businessId, type: "project_assigned", title: `You were added to ${d.name}`, link: `/app/jobs/${id}` }));
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: id, action: "updated", summary: "Updated project details" });
  await batch.commit();
  if (wasCompleted !== (d.status === "completed")) await refreshCompletedCount(businessId);
  return { ok: true, redirectTo: `/app/jobs/${id}` };
}

export async function setProjectStatus(id: string, status: string) {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  const parsed = z.enum(values(PROJECT_STATUSES)).safeParse(status);
  if (!parsed.success || !isId(id)) return { ok: false, error: "Invalid status" };
  const ref = t.doc("projects", id);
  const prev = await ref.get();
  if (!prev.exists) return { ok: false, error: "Project not found" };
  if (prev.get("status") === parsed.data) return { ok: true };
  const batch = db().batch();
  const completing = parsed.data === "completed";
  batch.update(ref, { status: parsed.data, completed_at: completing ? now() : null, updated_at: now() });
  if (completing) addEvent(batch, businessId, "project_completed");
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: id, action: "status_changed", summary: `${prev.get("name")} is now ${optionFor(PROJECT_STATUSES, parsed.data)?.label}` });
  await batch.commit();
  if (completing || prev.get("status") === "completed") await refreshCompletedCount(businessId);
  return { ok: true };
}

export async function deleteProject(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete jobs." };
  if (!isId(id)) return { ok: false, error: "Project not found." };
  const [tasks, photos, notes, posts] = await Promise.all([
    t.col("tasks").where("project_id", "==", id).get(),
    t.col("photos").where("project_id", "==", id).get(),
    t.col("notes").where("entity_id", "==", id).get(),
    db().collection("posts").where("business_id", "==", businessId).where("project_id", "==", id).get(),
  ]);
  const batch = db().batch();
  batch.delete(t.doc("projects", id));
  [...tasks.docs, ...photos.docs, ...notes.docs].forEach((d) => batch.delete(d.ref));
  posts.docs.forEach((p) => batch.update(p.ref, { project_id: null }));
  await batch.commit();
  await Promise.all(photos.docs.map((p) => bucket().file(p.get("path")).delete().catch(() => {})));
  await refreshCompletedCount(businessId);
  return { ok: true, redirectTo: "/app/jobs" };
}

// ---------------- Tasks ----------------
export async function createTask(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  const parsed = parseForm(taskSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const project = await accessibleProject(c, projectId);
  if (!project) return { ok: false, error: "Project not found." };
  if (d.assignedTo && !(await memberIds(businessId, [d.assignedTo])).length) return { ok: false, error: "That person isn't on your team." };
  const ts = now();
  const ref = t.col("tasks").doc();
  const batch = db().batch();
  batch.set(ref, {
    project_id: projectId, project_name: project.get("name"), title: d.title, description: d.description ?? null, assigned_to: d.assignedTo ?? null,
    due_date: d.dueDate ?? null, priority: d.priority, status: d.status, completed_at: d.status === "done" ? ts : null, created_by: userId, created_at: ts, updated_at: ts,
  });
  batch.update(project.ref, { task_total: inc(), ...(d.status === "done" ? { task_done: inc() } : {}) });
  if (d.assignedTo && d.assignedTo !== userId) addNotification(batch, d.assignedTo, { businessId, type: "task_assigned", title: `New task: ${d.title}`, link: `/app/jobs/${projectId}` });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: projectId, action: "task_added", summary: `Added task "${d.title}"` });
  await batch.commit();
  return { ok: true, message: "Task added" };
}

export async function setTaskStatus(taskId: string, status: string) {
  const c = await ctx();
  const { t, userId, userName } = c;
  const parsed = z.enum(values(TASK_STATUSES)).safeParse(status);
  if (!parsed.success || !isId(taskId)) return { ok: false, error: "Invalid status" };
  const ref = t.doc("tasks", taskId);
  let projectId = "";
  try {
    await db().runTransaction(async (tx) => {
      const task = await tx.get(ref);
      if (!task.exists) throw new Error("nf");
      projectId = task.get("project_id");
      const project = await tx.get(t.doc("projects", projectId));
      if (!project.exists || !canAccessProject(c.role, c.userId, { member_ids: project.get("member_ids") })) throw new Error("nf");
      const was = task.get("status");
      if (was === parsed.data) return;
      tx.update(ref, { status: parsed.data, completed_at: parsed.data === "done" ? now() : null, updated_at: now() });
      const delta = (parsed.data === "done" ? 1 : 0) - (was === "done" ? 1 : 0);
      if (delta) tx.update(t.doc("projects", projectId), { task_done: inc(delta) });
      if (parsed.data === "done") {
        tx.set(t.col("activity").doc(), { actor_id: userId, actor_name: userName, entity_type: "project", entity_id: projectId, action: "task_done", summary: `Completed "${task.get("title")}"`, created_at: now() });
      }
    });
  } catch {
    return { ok: false, error: "Couldn't update the task" };
  }
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const { t, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  if (!isId(taskId)) return { ok: false };
  const ref = t.doc("tasks", taskId);
  let projectId = "";
  await db().runTransaction(async (tx) => {
    const task = await tx.get(ref);
    if (!task.exists) return;
    projectId = task.get("project_id");
    tx.delete(ref);
    tx.update(t.doc("projects", projectId), { task_total: inc(-1), ...(task.get("status") === "done" ? { task_done: inc(-1) } : {}) });
  });
  return { ok: true };
}

// ---------------- Photos ----------------
export async function uploadProjectPhotos(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  if (!(await accessibleProject(c, projectId))) return { ok: false, error: "Project not found." };
  const files = fd.getAll("photos").filter(validImage).slice(0, 10);
  if (files.length === 0) return { ok: false, error: "Choose at least one photo." };
  const caption = String(fd.get("caption") ?? "").trim().slice(0, 300) || null;
  let uploaded = 0;
  for (const f of files) {
    const r = await uploadImage("private", businessId, f);
    if ("error" in r) return { ok: false, error: r.error };
    await t.col("photos").add({ project_id: projectId, path: r.url, caption, uploaded_by: userId, created_at: now() });
    uploaded++;
  }
  const batch = db().batch();
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: projectId, action: "photos_added", summary: `Added ${uploaded} photo${uploaded > 1 ? "s" : ""}` });
  await batch.commit();
  return { ok: true, message: `${uploaded} photo${uploaded > 1 ? "s" : ""} uploaded` };
}
