import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { FieldValue, type DocumentSnapshot, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { fromQuery, now } from "./db";
import { tenant } from "./tenant";
import type { Business } from "@/lib/types";

// Trust signals for the public profile (PRODUCT_STRATEGY_V2.md §9, §11):
// verified reviews tied to completed jobs, how quickly the business replies,
// and how much finished work it has shown. Everything here is earned from
// real activity in BuildFlow; nothing is self-reported.

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");

export type Review = {
  id: string; project_id: string; rating: number; body: string | null; reviewer_name: string; service_name: string | null;
  job_completed_on: string | null; status: "published" | "hidden"; reply: { body: string; at: string } | null; created_at: string; updated_at?: string;
};

/** Public reviews, newest first. One per completed job (doc id = job id). */
export async function getReviews(businessId: string, limit = 20) {
  return fromQuery<Review>(await tenant(businessId).col("reviews").where("status", "==", "published").orderBy("created_at", "desc").limit(limit).get());
}

/** Average rating and count, or null when there are no reviews yet. */
export function ratingOf(b: Pick<Business, "review_count" | "rating_sum">) {
  const n = b.review_count ?? 0;
  return n > 0 ? { avg: Math.round(((b.rating_sum ?? 0) / n) * 10) / 10, count: n } : null;
}

/** "Marcia Thompson" → "Marcia T." (reviews show a first name and initial). */
export function displayName(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Applies a review's change to the business's rating totals inside a transaction or batch. */
export function adjustRating(writer: Transaction | WriteBatch, businessId: string, delta: { count: number; sum: number }) {
  (writer as WriteBatch).update(tenant(businessId).root, { review_count: FieldValue.increment(delta.count), rating_sum: FieldValue.increment(delta.sum) });
}

/**
 * Typical reply time: the first time a team member moves a new enquiry on
 * (contacted, quoted, won, lost, or a job started). Recorded once per lead.
 */
export function recordFirstResponse(batch: WriteBatch | Transaction, businessId: string, lead: DocumentSnapshot) {
  if (lead.get("status") !== "new" || lead.get("first_response_at")) return;
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(lead.get("created_at"))) / 60000));
  (batch as WriteBatch).update(lead.ref, { first_response_at: now() });
  (batch as WriteBatch).update(tenant(businessId).root, { "response.count": FieldValue.increment(1), "response.total_minutes": FieldValue.increment(minutes) });
}

/** "Usually replies within an hour", once there are enough replies to say so. */
export function responseLabel(b: Pick<Business, "response">) {
  const r = b.response;
  if (!r || r.count < 2) return null;
  const hours = r.total_minutes / r.count / 60;
  if (hours <= 1) return "Usually replies within an hour";
  if (hours <= 24) return `Usually replies within ${Math.ceil(hours)} hours`;
  const days = Math.ceil(hours / 24);
  return days <= 7 ? `Usually replies within ${days} day${days === 1 ? "" : "s"}` : null;
}

/** Review requests: capability links, so customers need no account. */
export function reviewRequestRef(token: string) {
  return db().collection("review_requests").doc(hashToken(token));
}

/** Everything TrustStrip needs, from the business document alone (no extra reads). */
export function trustFacts(b: Business) {
  return { rating: ratingOf(b), jobs: b.completed_project_count ?? 0, response: responseLabel(b), years: b.years_in_business ?? null, verified: Boolean(b.is_verified) };
}
