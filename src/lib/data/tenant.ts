import "server-only";
import { FieldValue, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { now } from "./db";

// Tenant boundary. Every CRM/project collection lives under
// businesses/{businessId}/..., and callers get the businessId from the
// verified session (requireBusiness), never from request input. A
// document id from the client can therefore only ever address a document
// inside the caller's own business.
export type TenantCollection =
  | "customers" | "leads" | "projects" | "tasks" | "notes" | "activity" | "photos" | "media"
  | "quote_requests" | "events" | "members" | "invitations";

export function tenant(businessId: string) {
  const root = db().collection("businesses").doc(businessId);
  return {
    root,
    col: (name: TenantCollection) => root.collection(name),
    doc: (name: TenantCollection, id: string) => root.collection(name).doc(id),
  };
}

export type EventType =
  | "profile_view" | "post_view" | "like" | "comment" | "follow" | "save" | "quote_request"
  | "contact_click" | "lead_created" | "project_won" | "project_completed";

/** Queue analytics/activity/notification side effects on an existing batch. */
export function addEvent(batch: WriteBatch, businessId: string, type: EventType, extra: Record<string, unknown> = {}) {
  batch.set(tenant(businessId).col("events").doc(), { type, created_at: now(), ...extra });
}

export type ActivityEntry = {
  actorId: string | null; actorName?: string | null; entityType: string; entityId?: string | null; action: string; summary: string;
  /** Every record this entry belongs to, so each one's timeline shows it. */
  customerId?: string | null; leadId?: string | null; projectId?: string | null;
  body?: string | null; media?: { id: string; path: string; name?: string | null }[];
};

export function activityDoc(entry: ActivityEntry) {
  return {
    actor_id: entry.actorId, actor_name: entry.actorName ?? null, entity_type: entry.entityType, entity_id: entry.entityId ?? null,
    action: entry.action, summary: entry.summary, body: entry.body ?? null, media: entry.media ?? [],
    customer_id: entry.customerId ?? null, lead_id: entry.leadId ?? null, project_id: entry.projectId ?? null, created_at: now(),
  };
}

/** Appends a timeline entry; works on a batch or inside a transaction. */
export function addActivity(writer: WriteBatch | Transaction, businessId: string, entry: ActivityEntry) {
  const ref = tenant(businessId).col("activity").doc();
  (writer as WriteBatch).set(ref, activityDoc(entry));
  return ref;
}

export type NotificationType = "quote_request" | "new_lead" | "comment" | "follower" | "project_assigned" | "task_assigned" | "system";

export function addNotification(batch: WriteBatch, userId: string, n: { businessId?: string; type: NotificationType; title: string; body?: string | null; link?: string }) {
  batch.set(db().collection("users").doc(userId).collection("notifications").doc(), {
    business_id: n.businessId ?? null, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, read_at: null, created_at: now(),
  });
}

export async function ownerIds(businessId: string) {
  const snap = await tenant(businessId).col("members").where("role", "==", "owner").get();
  return snap.docs.map((d) => d.id);
}

export const inc = (n = 1) => FieldValue.increment(n);

/** Commit a side-effect batch; activity/analytics should never fail the user's action. */
export async function commitQuietly(batch: WriteBatch) {
  try { await batch.commit(); } catch (e) { console.error("side effects failed", e); }
}

export async function logActivity(businessId: string, entry: Parameters<typeof addActivity>[2]) {
  const b = db().batch();
  addActivity(b, businessId, entry);
  await commitQuietly(b);
}
