"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { adjustRating } from "@/lib/data/trust";
import { recountPosts, syncBusinessToPosts } from "@/lib/data/business";
import { inc } from "@/lib/data/tenant";
import { requireAdmin } from "@/lib/session";

// Every admin action re-checks is_platform_admin from the user's Firestore
// profile (requireAdmin). The flag can only be set by an operator directly
// in Firestore or via scripts/make-admin.ts.

export async function setUserSuspended(userId: string, suspended: boolean) {
  await requireAdmin();
  if (!isId(userId)) return { ok: false };
  await db().collection("users").doc(userId).set({ is_suspended: suspended }, { merge: true });
  if (suspended) await adminAuth().revokeRefreshTokens(userId).catch(() => {});
  return { ok: true };
}

export async function setBusinessFlag(businessId: string, flag: "is_suspended" | "is_verified", value: boolean) {
  await requireAdmin();
  if (!isId(businessId)) return { ok: false };
  await db().collection("businesses").doc(businessId).update({ [flag]: value, updated_at: now() });
  await syncBusinessToPosts(businessId);
  await recountPosts(businessId);
  return { ok: true };
}

export async function resolveReport(reportId: string, action: "dismiss" | "hide") {
  const admin = await requireAdmin();
  const ref = db().collection("reports").doc(reportId);
  const report = await ref.get();
  if (!report.exists) return { ok: false, error: "Report not found" };
  const { target_type: type, target_id: id, target_path: path } = report.data()!;
  if (action === "hide") {
    if (type === "post") {
      const post = db().collection("posts").doc(id);
      const snap = await post.get();
      if (snap.exists) {
        await post.update({ is_hidden: true, visible: false });
        await recountPosts(snap.get("business_id"));
      }
    }
    if (type === "comment" && typeof path === "string" && /^posts\/[\w-]+\/comments\/[\w-]+$/.test(path)) {
      const comment = db().doc(path);
      if ((await comment.get()).exists) {
        await comment.update({ is_hidden: true });
        await comment.parent.parent!.update({ comment_count: inc(-1) });
      }
    }
    if (type === "business") await setBusinessFlag(id, "is_suspended", true);
    // Hiding a review removes it from the profile and from the rating.
    if (type === "review" && typeof path === "string" && /^businesses\/[\w-]+\/reviews\/[\w-]+$/.test(path)) {
      const review = db().doc(path);
      const businessId = path.split("/")[1];
      await db().runTransaction(async (tx) => {
        const r = await tx.get(review);
        if (!r.exists || r.get("status") === "hidden") return;
        tx.update(review, { status: "hidden" });
        adjustRating(tx, businessId, { count: -1, sum: -Number(r.get("rating")) });
      });
      await syncBusinessToPosts(businessId);
    }
  }
  await ref.update({ status: action === "hide" ? "actioned" : "dismissed", resolved_by: admin.user.id, resolved_at: now() });
  return { ok: true };
}

export async function updatePlan(planId: string, _: unknown, fd: FormData) {
  await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(1).max(80),
    basePrice: z.coerce.number().min(0).max(100000),
    includedSeats: z.coerce.number().int().min(1).max(1000),
    seatPrice: z.coerce.number().min(0).max(100000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success || !isId(planId)) return { ok: false, error: "Check the plan values." };
  const d = parsed.data;
  await db().collection("plans").doc(planId).update({
    name: d.name, base_price_cents: Math.round(d.basePrice * 100), included_seats: d.includedSeats, additional_seat_price_cents: Math.round(d.seatPrice * 100),
  });
  revalidatePath("/pricing");
  return { ok: true, message: "Plan saved" };
}

export async function toggleService(serviceId: string, active: boolean) {
  await requireAdmin();
  if (!isId(serviceId)) return { ok: false };
  await db().collection("services").doc(serviceId).update({ is_active: active });
  return { ok: true };
}
