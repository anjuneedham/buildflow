"use server";

import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { addActivity, addEvent, addNotification, inc, tenant } from "@/lib/data/tenant";
import { findOrCreateCustomer, refreshCustomerStatus, refreshNextTask } from "@/lib/data/workflow";
import { recordFirstResponse } from "@/lib/data/trust";
import { requireBusiness } from "@/lib/session";
import { canAccessProject } from "@/server/policy";
import { deleteObjects, uploadImage, uploadPrivateFile, validImage } from "@/lib/storage";
import { PROJECT_STATUSES, TASK_STATUSES, UPLOAD, optionFor, values } from "@/lib/constants";
import { docId, parseForm, projectSchema, taskSchema, updateSchema, type ActionState } from "@/lib/validation";
import type { MediaRef } from "@/lib/types";

async function ctx() {
  const s = await requireBusiness();
  return {
    t: tenant(s.business.id), businessId: s.business.id, userId: s.user.id, userName: s.profile?.full_name ?? null,
    role: s.role, canManage: s.can("projects.manage"), canDelete: s.can("records.delete"),
  };
}
type Ctx = Awaited<ReturnType<typeof ctx>>;

const FORBIDDEN = { ok: false, error: "You don't have permission to do that." } as const;
const NOT_FOUND = { ok: false, error: "Job not found." } as const;

/** Loads a job the caller may work on (crew: only jobs they're assigned to). */
async function accessibleProject(c: Ctx, projectId: string) {
  if (!isId(projectId)) return null;
  const snap = await c.t.doc("projects", projectId).get();
  if (!snap.exists || !canAccessProject(c.role, c.userId, { member_ids: snap.get("member_ids") })) return null;
  return snap;
}

/** Timeline links for anything that happens on a job. */
const jobRefs = (projectId: string, project: FirebaseFirestore.DocumentSnapshot) => ({
  entityType: "project", entityId: projectId, projectId, customerId: (project.get("customer_id") as string | null) ?? null, leadId: (project.get("lead_id") as string | null) ?? null,
});

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

// ---------------- Jobs ----------------

/**
 * Creates a job. From a lead ("Start job"), the job inherits the lead's
 * customer (creating one for older leads that had none) and the lead is
 * marked won and linked to the job.
 */
export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  if (!c.canManage) return FORBIDDEN;
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const batch = db().batch();
  const ts = now();
  // One job per enquiry, enforced by the id: two simultaneous "Start job" calls for the same lead
  // can't both create it (batch.create fails for the second).
  const ref = d.leadId ? t.col("projects").doc(`from-${d.leadId}`) : t.col("projects").doc();

  const lead = d.leadId ? await t.doc("leads", d.leadId).get() : null;
  if (d.leadId && !lead?.exists) return { ok: false, error: "Lead not found." };
  // A second tap, a second tab or a retry after a slow connection must not create a second job for the same enquiry.
  const existingJob = lead?.get("project_id") ? await t.doc("projects", lead.get("project_id")).get() : null;
  if (existingJob?.exists) return { ok: true, redirectTo: `/app/jobs/${existingJob.id}`, message: "This lead already has a job." };
  let customerId = d.customerId ?? (lead?.get("customer_id") as string | null) ?? null;
  let custName: string | null = null;
  if (!customerId && lead?.exists) {
    const found = await findOrCreateCustomer(t, { name: lead.get("name"), phone: lead.get("phone"), email: lead.get("email"), address: lead.get("location") }, userId);
    customerId = found.id; custName = found.name;
    batch.update(lead.ref, { customer_id: found.id, customer_name: found.name });
  } else {
    const cn = await customerName(businessId, customerId ?? undefined);
    if (!cn.ok) return { ok: false, error: "Customer not found." };
    custName = cn.name;
  }

  const responsible = d.responsibleId && (await memberIds(businessId, [d.responsibleId]))[0] || userId;
  const members = Array.from(new Set([responsible, ...(await memberIds(businessId, fd.getAll("memberIds").map(String)))]));
  batch.create(ref, {
    ...projectFields(d), customer_id: customerId, customer_name: custName, lead_id: d.leadId ?? null, responsible_id: responsible, member_ids: members,
    task_total: 0, task_done: 0, next_task: null, last_update_at: null,
    completed_at: d.status === "completed" ? ts : null, created_by: userId, created_at: ts, updated_at: ts,
  });
  if (lead?.exists) recordFirstResponse(batch, businessId, lead);
  if (lead?.exists && lead.get("status") !== "won") {
    batch.update(lead.ref, { status: "won", status_changed_at: ts, updated_at: ts, next_follow_up: null, project_id: ref.id });
    addEvent(batch, businessId, "project_won");
  } else if (lead?.exists) {
    batch.update(lead.ref, { project_id: ref.id });
  }
  if (d.status === "completed") addEvent(batch, businessId, "project_completed");
  members.filter((m) => m !== userId).forEach((m) => addNotification(batch, m, { businessId, type: "project_assigned", title: `You were added to ${d.name}`, link: `/app/jobs/${ref.id}` }));
  addActivity(batch, businessId, {
    actorId: userId, actorName: userName, entityType: "project", entityId: ref.id, projectId: ref.id, customerId, leadId: d.leadId ?? null, action: "created",
    summary: lead?.exists ? `Started job ${d.name} from the lead` : `Created job ${d.name}`,
  });
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: number }).code === 6) return { ok: true, redirectTo: `/app/jobs/${ref.id}`, message: "This lead already has a job." }; // ALREADY_EXISTS
    throw e;
  }
  await refreshCustomerStatus(t, customerId);
  if (d.status === "completed") await refreshCompletedCount(businessId);
  return { ok: true, redirectTo: `/app/jobs/${ref.id}` };
}

export async function updateProject(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  if (!isId(id)) return NOT_FOUND;
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const ref = t.doc("projects", id);
  const prev = await ref.get();
  if (!prev.exists) return NOT_FOUND;
  const customer = await customerName(businessId, d.customerId);
  if (!customer.ok) return { ok: false, error: "Customer not found." };
  const responsible = d.responsibleId && (await memberIds(businessId, [d.responsibleId]))[0] || prev.get("responsible_id") || userId;
  const members = Array.from(new Set([responsible, ...(await memberIds(businessId, fd.getAll("memberIds").map(String)))]));
  const before: string[] = prev.get("member_ids") ?? [];
  const batch = db().batch();
  const wasCompleted = prev.get("status") === "completed";
  batch.update(ref, {
    ...projectFields(d), customer_name: customer.name, member_ids: members, responsible_id: responsible, updated_at: now(),
    completed_at: d.status === "completed" ? prev.get("completed_at") ?? now() : null,
  });
  if (d.status === "completed" && !wasCompleted) addEvent(batch, businessId, "project_completed");
  members.filter((m) => !before.includes(m) && m !== userId).forEach((m) => addNotification(batch, m, { businessId, type: "project_assigned", title: `You were added to ${d.name}`, link: `/app/jobs/${id}` }));
  addActivity(batch, businessId, { actorId: userId, actorName: userName, entityType: "project", entityId: id, projectId: id, customerId: d.customerId ?? null, leadId: prev.get("lead_id") ?? null, action: "updated", summary: "Updated job details" });
  await batch.commit();
  await Promise.all([refreshCustomerStatus(t, prev.get("customer_id")), d.customerId !== prev.get("customer_id") ? refreshCustomerStatus(t, d.customerId) : null]);
  if (wasCompleted !== (d.status === "completed")) await refreshCompletedCount(businessId);
  return { ok: true, redirectTo: `/app/jobs/${id}` };
}

export async function setProjectStatus(id: string, status: string) {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  const parsed = z.enum(values(PROJECT_STATUSES)).safeParse(status);
  if (!parsed.success || !isId(id)) return { ok: false, error: "Invalid status" };
  // Completing goes through completeProject, which deals with open tasks.
  if (parsed.data === "completed") return completeProject(id, false);
  const ref = t.doc("projects", id);
  const prev = await ref.get();
  if (!prev.exists) return NOT_FOUND;
  if (prev.get("status") === parsed.data) return { ok: true };
  const batch = db().batch();
  batch.update(ref, { status: parsed.data, completed_at: null, updated_at: now() });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, ...jobRefs(id, prev), action: "status_changed", summary: `Job is now ${optionFor(PROJECT_STATUSES, parsed.data)?.label}` });
  await batch.commit();
  await refreshCustomerStatus(t, prev.get("customer_id"));
  if (prev.get("status") === "completed") await refreshCompletedCount(businessId);
  return { ok: true };
}

/**
 * Marks a job complete. `closeOpenTasks` ticks off any tasks still open
 * (the contractor confirms this in the dialog); otherwise they stay open.
 */
export async function completeProject(id: string, closeOpenTasks: boolean) {
  const { t, businessId, userId, userName, canManage } = await ctx();
  if (!canManage) return FORBIDDEN;
  if (!isId(id)) return NOT_FOUND;
  const ref = t.doc("projects", id);
  const open = await t.col("tasks").where("project_id", "==", id).where("status", "in", ["todo", "in_progress"]).limit(200).get();
  const ts = now();
  // In a transaction so a double tap (or two tabs) completes the job once: one history entry, one counted completion.
  let customerId: string | null = null;
  const outcome = await db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) return "missing" as const;
    if (prev.get("status") === "completed") return "already" as const;
    customerId = (prev.get("customer_id") as string | null) ?? null;
    if (closeOpenTasks) open.docs.forEach((d) => tx.update(d.ref, { status: "done", completed_at: ts, completed_by: userId, updated_at: ts }));
    tx.update(ref, {
      status: "completed", completed_at: ts, updated_at: ts,
      ...(closeOpenTasks ? { task_done: prev.get("task_total") ?? 0, next_task: null } : {}),
    });
    addEvent(tx, businessId, "project_completed");
    addActivity(tx, businessId, {
      actorId: userId, actorName: userName, ...jobRefs(id, prev), action: "completed",
      summary: `Job completed${closeOpenTasks && open.size ? ` (${open.size} open task${open.size === 1 ? "" : "s"} closed)` : ""}`,
    });
    return "done" as const;
  });
  if (outcome === "missing") return NOT_FOUND;
  if (outcome === "done") await Promise.all([refreshCustomerStatus(t, customerId), refreshCompletedCount(businessId)]);
  return { ok: true };
}

export async function deleteProject(id: string) {
  const { t, businessId, canDelete } = await ctx();
  if (!canDelete) return { ok: false, error: "You don't have permission to delete jobs." };
  if (!isId(id)) return NOT_FOUND;
  const project = await t.doc("projects", id).get();
  if (!project.exists) return { ok: true, redirectTo: "/app/jobs" };
  const [posts, leads] = await Promise.all([
    db().collection("posts").where("business_id", "==", businessId).where("project_id", "==", id).limit(50).get(),
    t.col("leads").where("project_id", "==", id).limit(10).get(),
  ]);
  // A job can hold hundreds of tasks, photos and history entries; a write batch holds 500 operations.
  // Children go first (in pages), the job itself last, so a failure part-way leaves a job that can be deleted again.
  const mediaPaths: string[] = [];
  for (const name of ["tasks", "media", "activity"] as const) {
    for (;;) {
      const page = await t.col(name).where("project_id", "==", id).limit(400).get();
      if (page.empty) break;
      const batch = db().batch();
      page.docs.forEach((d) => { batch.delete(d.ref); if (name === "media" && d.get("path")) mediaPaths.push(d.get("path")); });
      await batch.commit();
    }
  }
  const batch = db().batch();
  batch.delete(t.doc("projects", id));
  posts.docs.forEach((p) => batch.update(p.ref, { project_id: null }));
  leads.docs.forEach((l) => batch.update(l.ref, { project_id: null }));
  await batch.commit();
  await deleteObjects(mediaPaths);
  await Promise.all([refreshCompletedCount(businessId), refreshCustomerStatus(t, project.get("customer_id"))]);
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
  if (!project) return NOT_FOUND;
  if (d.assignedTo && !(await memberIds(businessId, [d.assignedTo])).length) return { ok: false, error: "That person isn't on your team." };
  const ts = now();
  const ref = t.col("tasks").doc();
  const batch = db().batch();
  batch.set(ref, {
    project_id: projectId, project_name: project.get("name"), title: d.title, description: d.description ?? null, assigned_to: d.assignedTo ?? null,
    due_date: d.dueDate ?? null, priority: d.priority, status: d.status, completed_at: d.status === "done" ? ts : null, created_by: userId, created_at: ts, updated_at: ts,
  });
  batch.update(project.ref, { task_total: inc(), ...(d.status === "done" ? { task_done: inc() } : {}) });
  // Assigning someone to a task puts them on the job's crew so they can see it.
  if (d.assignedTo && !(project.get("member_ids") ?? []).includes(d.assignedTo)) batch.update(project.ref, { member_ids: [...(project.get("member_ids") ?? []), d.assignedTo] });
  if (d.assignedTo && d.assignedTo !== userId) addNotification(batch, d.assignedTo, { businessId, type: "task_assigned", title: `New task: ${d.title}`, body: project.get("name"), link: `/app/jobs/${projectId}` });
  addActivity(batch, businessId, { actorId: userId, actorName: userName, ...jobRefs(projectId, project), action: "task_added", summary: `Added task "${d.title}"${d.dueDate ? ` due ${d.dueDate}` : ""}` });
  await batch.commit();
  await refreshNextTask(t, projectId);
  return { ok: true, message: "Task added" };
}

/** Edits a task's title, deadline, owner or priority. */
export async function updateTask(taskId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  if (!isId(taskId)) return { ok: false, error: "Task not found." };
  const task = await t.doc("tasks", taskId).get();
  if (!task.exists) return { ok: false, error: "Task not found." };
  const project = await accessibleProject(c, task.get("project_id"));
  if (!project) return { ok: false, error: "Task not found." };
  const parsed = parseForm(taskSchema.omit({ status: true }), fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  if (d.assignedTo && !(await memberIds(businessId, [d.assignedTo])).length) return { ok: false, error: "That person isn't on your team." };
  const batch = db().batch();
  batch.update(task.ref, { title: d.title, description: d.description ?? null, assigned_to: d.assignedTo ?? null, due_date: d.dueDate ?? null, priority: d.priority, updated_at: now() });
  if (d.assignedTo && !(project.get("member_ids") ?? []).includes(d.assignedTo)) batch.update(project.ref, { member_ids: [...(project.get("member_ids") ?? []), d.assignedTo] });
  if (d.assignedTo && d.assignedTo !== task.get("assigned_to") && d.assignedTo !== userId) {
    addNotification(batch, d.assignedTo, { businessId, type: "task_assigned", title: `Task assigned to you: ${d.title}`, body: project.get("name"), link: `/app/jobs/${project.id}` });
  }
  const changes = [
    task.get("due_date") !== (d.dueDate ?? null) && (d.dueDate ? `due ${d.dueDate}` : "no due date"),
    task.get("assigned_to") !== (d.assignedTo ?? null) && "reassigned",
  ].filter(Boolean);
  addActivity(batch, businessId, { actorId: userId, actorName: userName, ...jobRefs(project.id, project), action: "task_updated", summary: `Updated task "${d.title}"${changes.length ? ` (${changes.join(", ")})` : ""}` });
  await batch.commit();
  await refreshNextTask(t, project.id);
  return { ok: true, message: "Task updated" };
}

export async function setTaskStatus(taskId: string, status: string) {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
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
      tx.update(ref, { status: parsed.data, completed_at: parsed.data === "done" ? now() : null, completed_by: parsed.data === "done" ? userId : null, updated_at: now() });
      const delta = (parsed.data === "done" ? 1 : 0) - (was === "done" ? 1 : 0);
      if (delta) tx.update(project.ref, { task_done: inc(delta) });
      const label = parsed.data === "done" ? "Completed" : parsed.data === "in_progress" ? "Started" : "Reopened";
      addActivity(tx, businessId, { actorId: userId, actorName: userName, ...jobRefs(projectId, project), action: `task_${parsed.data}`, summary: `${label} "${task.get("title")}"` });
    });
  } catch {
    return { ok: false, error: "Couldn't update the task" };
  }
  await refreshNextTask(t, projectId);
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
  if (projectId) await refreshNextTask(t, projectId);
  return { ok: true };
}

// ---------------- Updates, photos and files ----------------

/**
 * A site update: a short note and/or photos from the job. Goes on the job's
 * timeline and the customer's, and the photos join the job's gallery.
 */
export async function postUpdate(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  const project = await accessibleProject(c, projectId);
  if (!project) return NOT_FOUND;
  const parsed = parseForm(updateSchema, fd);
  if (!parsed.data) return parsed.state;
  const files = fd.getAll("photos").filter(validImage).slice(0, UPLOAD.maxImagesPerPost);
  const body = parsed.data.body ?? null;
  if (!body && files.length === 0) return { ok: false, error: "Write a note or add at least one photo." };

  const activityRef = t.col("activity").doc();
  const media: MediaRef[] = [];
  const ts = now();
  const batch = db().batch();
  for (const f of files) {
    const r = await uploadImage("private", businessId, f);
    if ("error" in r) {
      await deleteObjects(media.map((m) => m.path)); // all or nothing
      return { ok: false, error: r.error };
    }
    const mref = t.col("media").doc();
    batch.set(mref, { project_id: projectId, kind: "image", path: r.path, name: null, content_type: "image/webp", bytes: r.bytes, update_id: activityRef.id, uploaded_by: userId, created_at: ts });
    media.push({ id: mref.id, path: r.path });
  }
  const summary = files.length ? `Posted an update with ${files.length} photo${files.length > 1 ? "s" : ""}` : "Posted an update";
  batch.set(activityRef, {
    actor_id: userId, actor_name: userName, entity_type: "project", entity_id: projectId, action: "update", summary, body, media,
    project_id: projectId, customer_id: project.get("customer_id") ?? null, lead_id: project.get("lead_id") ?? null, created_at: ts,
  });
  batch.update(project.ref, { last_update_at: ts });
  await batch.commit();
  return { ok: true, message: "Update posted" };
}

/** Job documents: PDFs (quotes, permits, drawings) and photos kept as files. */
export async function uploadProjectFiles(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const c = await ctx();
  const { t, businessId, userId, userName } = c;
  const project = await accessibleProject(c, projectId);
  if (!project) return NOT_FOUND;
  const files = fd.getAll("files").filter(validImage).slice(0, UPLOAD.maxFilesPerUpload);
  if (files.length === 0) return { ok: false, error: "Choose at least one file." };
  const saved: MediaRef[] = [];
  const ts = now();
  const batch = db().batch();
  for (const f of files) {
    const r = await uploadPrivateFile(businessId, f);
    if ("error" in r) {
      await deleteObjects(saved.map((m) => m.path));
      return { ok: false, error: `${f.name}: ${r.error}` };
    }
    const mref = t.col("media").doc();
    batch.set(mref, { project_id: projectId, kind: "file", path: r.path, name: r.name, content_type: r.contentType, bytes: r.bytes, update_id: null, uploaded_by: userId, created_at: ts });
    saved.push({ id: mref.id, path: r.path, name: r.name });
  }
  addActivity(batch, businessId, {
    actorId: userId, actorName: userName, ...jobRefs(projectId, project), action: "files_added",
    summary: saved.length === 1 ? `Added file ${saved[0].name}` : `Added ${saved.length} files`,
  });
  await batch.commit();
  return { ok: true, message: saved.length === 1 ? "File added" : `${saved.length} files added` };
}

/** Deletes a photo or file (managers, or whoever uploaded it). */
export async function deleteMedia(mediaId: string) {
  const c = await ctx();
  if (!isId(mediaId)) return { ok: false, error: "Not found." };
  const ref = c.t.doc("media", mediaId);
  const m = await ref.get();
  if (!m.exists || !(await accessibleProject(c, m.get("project_id")))) return { ok: false, error: "Not found." };
  if (!c.canManage && m.get("uploaded_by") !== c.userId) return FORBIDDEN;
  const batch = db().batch();
  batch.delete(ref);
  // Drop the thumbnail from the update it was posted with.
  const updateId = m.get("update_id") as string | null;
  if (updateId) {
    const update = await c.t.doc("activity", updateId).get();
    if (update.exists) batch.update(update.ref, { media: ((update.get("media") ?? []) as MediaRef[]).filter((x) => x.id !== mediaId) });
  }
  await batch.commit();
  await deleteObjects([m.get("path")]);
  return { ok: true };
}
