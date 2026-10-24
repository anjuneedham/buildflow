"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { syncBusinessToPosts } from "@/lib/data/business";
import { activityDoc, addEvent, addNotification, ownerIds, tenant } from "@/lib/data/tenant";
import { adjustRating, displayName, newToken, reviewRequestRef } from "@/lib/data/trust";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getSession, requireBusiness } from "@/lib/session";
import { whatsappLink } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

const REQUEST_DAYS = 60;
const EDIT_DAYS = 14;

/**
 * Creates (or re-shares) the review link for a completed job. Only a person
 * holding this link can review, so every review is tied to real finished work.
 */
export async function requestReview(projectId: string) {
  const s = await requireBusiness();
  if (!s.can("projects.manage")) return { ok: false as const, error: "You don't have permission to do that." };
  if (!isId(projectId)) return { ok: false as const, error: "Job not found." };
  const t = tenant(s.business.id);
  const project = await t.doc("projects", projectId).get();
  if (!project.exists) return { ok: false as const, error: "Job not found." };
  if (project.get("status") !== "completed") return { ok: false as const, error: "Complete the job first, then ask for a review." };

  let token = project.get("review_token") as string | null;
  const existing = token ? await reviewRequestRef(token).get() : null;
  if (!token || !existing?.exists || Date.parse(existing.get("expires_at")) < Date.now()) {
    token = newToken();
    const customer = project.get("customer_id") ? await t.doc("customers", project.get("customer_id")).get() : null;
    const batch = db().batch();
    batch.set(reviewRequestRef(token), {
      business_id: s.business.id, project_id: projectId, customer_id: project.get("customer_id") ?? null,
      customer_name: (customer?.get("name") as string | undefined) ?? project.get("customer_name") ?? null,
      customer_phone: (customer?.get("phone") as string | undefined) ?? null,
      service_name: s.business.primary_service?.name ?? null, created_by: s.user.id, created_at: now(),
      expires_at: new Date(Date.now() + REQUEST_DAYS * 864e5).toISOString(), used_at: null,
    });
    batch.update(project.ref, { review_token: token, review_requested_at: now() });
    batch.set(t.col("activity").doc(), activityDoc({
      actorId: s.user.id, actorName: s.profile?.full_name, entityType: "project", entityId: projectId, projectId,
      customerId: project.get("customer_id") ?? null, action: "review_requested", summary: "Asked the customer for a review",
    }));
    await batch.commit();
  }
  const req = await reviewRequestRef(token).get();
  const url = `${env.siteUrl}/review/${token}`;
  const first = String(req.get("customer_name") ?? "").split(" ")[0];
  const text = `Hi${first ? ` ${first}` : ""}, thanks for choosing ${s.business.name}! Could you leave a quick review of the job? It takes a minute: ${url}`;
  return { ok: true as const, url, whatsapp: whatsappLink(req.get("customer_phone"), text), text };
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5),
  body: z.string().trim().max(2000).optional().transform((v) => v || null),
  name: z.string().trim().min(1, "Add your name").max(60),
  website: z.string().max(0).optional(), // honeypot
});

/** Public: the customer submits (or, within 14 days, edits) their review. */
export async function submitReview(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`review:${ip}`, 10, 60 * 60_000).ok) return { ok: false, error: "Too many attempts. Please try again later." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "Please check the form.", fieldErrors: fe };
  }
  const d = parsed.data;
  const s = await getSession();
  const reqRef = reviewRequestRef(token);
  let businessId = "";
  let projectId = "";
  try {
    await db().runTransaction(async (tx) => {
      const req = await tx.get(reqRef);
      if (!req.exists || Date.parse(req.get("expires_at")) < Date.now()) throw new Error("This review link has expired. Ask the contractor for a new one.");
      businessId = req.get("business_id");
      projectId = req.get("project_id");
      const t = tenant(businessId);
      const [reviewSnap, project, biz] = await Promise.all([tx.get(t.doc("reviews", projectId)), tx.get(t.doc("projects", projectId)), tx.get(t.root)]);
      if (!project.exists || !biz.exists) throw new Error("This job no longer exists.");
      if (reviewSnap.exists && Date.parse(reviewSnap.get("created_at")) < Date.now() - EDIT_DAYS * 864e5) throw new Error("This review can no longer be changed.");
      if (reviewSnap.exists && reviewSnap.get("status") === "hidden") throw new Error("This review can no longer be changed.");
      const ts = now();
      tx.set(t.doc("reviews", projectId), {
        project_id: projectId, rating: d.rating, body: d.body, reviewer_name: displayName(d.name), reviewer_uid: s.user?.id ?? null,
        service_name: req.get("service_name") ?? null, job_completed_on: (project.get("completed_at") as string | null)?.slice(0, 10) ?? null,
        status: "published", reply: reviewSnap.exists ? reviewSnap.get("reply") ?? null : null,
        created_at: reviewSnap.exists ? reviewSnap.get("created_at") : ts, updated_at: ts,
      });
      adjustRating(tx, businessId, reviewSnap.exists ? { count: 0, sum: d.rating - Number(reviewSnap.get("rating")) } : { count: 1, sum: d.rating });
      tx.update(reqRef, { used_at: ts });
      tx.set(t.col("activity").doc(), activityDoc({
        actorId: s.user?.id ?? null, actorName: displayName(d.name), entityType: "project", entityId: projectId, projectId,
        customerId: project.get("customer_id") ?? null, action: "review", summary: `${reviewSnap.exists ? "Updated their review" : "Left a review"}: ${"★".repeat(d.rating)}${"☆".repeat(5 - d.rating)}`,
        body: d.body,
      }));
      if (!reviewSnap.exists) addEvent(tx, businessId, "review");
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save your review." };
  }
  // Notify the team and refresh the rating shown on the business's posts.
  const batch = db().batch();
  for (const o of await ownerIds(businessId)) addNotification(batch, o, { businessId, type: "system", title: `New ${d.rating}-star review`, body: d.body?.slice(0, 140) ?? null, link: `/app/jobs/${projectId}` });
  await batch.commit();
  await syncBusinessToPosts(businessId);
  return { ok: true, message: "Thank you! Your review is live on their profile." };
}

/** The business replies publicly to a review (once; editable). */
export async function replyToReview(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.can("profile.edit")) return { ok: false, error: "You don't have permission to reply." };
  const body = z.string().trim().min(1, "Write a reply").max(1000).safeParse(fd.get("body"));
  if (!body.success) return { ok: false, error: body.error.issues[0].message };
  if (!isId(projectId)) return { ok: false, error: "Review not found." };
  const ref = tenant(s.business.id).doc("reviews", projectId);
  if (!(await ref.get()).exists) return { ok: false, error: "Review not found." };
  await ref.update({ reply: { body: body.data, at: now() } });
  return { ok: true, message: "Reply posted" };
}
