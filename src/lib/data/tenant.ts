import "server-only";
import { FieldValue, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { now } from "./db";
import { localDate } from "@/lib/utils";

// Tenant boundary. Every CRM/project collection lives under
// businesses/{businessId}/..., and callers get the businessId from the
// verified session (requireBusiness), never from request input. A
// document id from the client can therefore only ever address a document
// inside the caller's own business.
export type TenantCollection =
  | "customers" | "leads" | "projects" | "tasks" | "notes" | "activity" | "photos" | "media"
  | "quote_requests" | "stats" | "members" | "invitations";

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

/**
 * Contractor insights are counters, not one document per event
 * (FIRESTORE_SCHEMA_V2.md §3.16): businesses/{id}/stats/{yyyy-mm} holds
 * totals and per-day counts in the business timezone. A month of insights
 * is one read; V1 read up to 50,000 event documents.
 */
export function statsRef(businessId: string, month: string) {
  return tenant(businessId).doc("stats", month);
}

export function addEvent(writer: WriteBatch | Transaction, businessId: string, type: EventType, at: Date = new Date()) {
  const day = localDate(at);
  (writer as WriteBatch).set(statsRef(businessId, day.slice(0, 7)), {
    month: day.slice(0, 7), totals: { [type]: inc() }, days: { [day.slice(8, 10)]: { [type]: inc() } },
  }, { merge: true });
}

export type MonthStats = { totals: Partial<Record<EventType, number>>; days: Record<string, Partial<Record<EventType, number>>> };

/** Stats for the month containing `at` (and optionally the months before it). */
export async function monthStats(businessId: string, monthsBack = 0, at: Date = new Date()): Promise<MonthStats[]> {
  const [y, m] = localDate(at).split("-").map(Number);
  const keys = Array.from({ length: monthsBack + 1 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
  const snaps = await db().getAll(...keys.map((k) => statsRef(businessId, k)));
  return snaps.map((s) => ({ totals: (s.get("totals") as MonthStats["totals"]) ?? {}, days: (s.get("days") as MonthStats["days"]) ?? {} }));
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
