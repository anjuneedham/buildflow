import "server-only";
import { adminAuth, bucket, db } from "@/lib/firebase/admin";
import { syncClaims } from "@/server/claims";
import { forgetRevocationCheck } from "@/server/revocation-cache";

// Account deletion (Google Play's account-deletion policy, and the privacy
// policy's promise). Ordered so that a failure part-way can simply be retried:
// everything here is idempotent, and the sign-in itself is removed last.
//
// What goes:
//   - the person's profile, saved work and contractors, notifications, request history, reports they filed
//   - for an owner: the whole business (customers, leads, jobs, files, posts, reviews, stats, team links)
//   - for a team member: their membership and job assignments
// What stays, deliberately:
//   - a business's own records that mention a deleted team member's name (history is the business's data)
//   - reviews a deleted customer wrote: kept for the contractor, but anonymised

async function deletePrefix(prefix: string) {
  try {
    await bucket().deleteFiles({ prefix, force: true });
  } catch (e) {
    console.error("storage delete failed", prefix, e);
  }
}

/** Deletes a business and everything that belongs to it. Other team members are released, not deleted. */
export async function deleteBusinessCompletely(businessId: string, ownerId: string) {
  const bizRef = db().collection("businesses").doc(businessId);
  const biz = await bizRef.get();
  if (!biz.exists) return;
  // Go dark first so nothing public points at data that is about to disappear.
  const posts = await db().collection("posts").where("business_id", "==", businessId).get();
  for (let i = 0; i < posts.docs.length; i += 400) {
    const batch = db().batch();
    posts.docs.slice(i, i + 400).forEach((p) => batch.update(p.ref, { visible: false, is_hidden: true }));
    await batch.commit();
  }
  await bizRef.update({ is_public: false, is_suspended: true, updated_at: new Date().toISOString() });

  // Release the rest of the team so they can sign in and start or join another business.
  const members = await bizRef.collection("members").get();
  const others = members.docs.map((m) => m.id).filter((id) => id !== ownerId);
  for (const uid of others) {
    await db().collection("users").doc(uid).set({ business_id: null, business_role: null }, { merge: true });
    await syncClaims(uid, { revoke: true }).catch((e) => console.error("claims sync failed", uid, e));
  }

  // Public and private files, then the documents (recursiveDelete walks every subcollection).
  await Promise.all([deletePrefix(`public-media/${businessId}/`), deletePrefix(`project-files/${businessId}/`)]);
  await Promise.all(posts.docs.map((p) => p.ref.delete()));
  const [tokens, invites] = await Promise.all([
    db().collection("review_requests").where("business_id", "==", businessId).get(),
    db().collection("invitations").where("business_id", "==", businessId).get(),
  ]);
  await Promise.all([...tokens.docs, ...invites.docs].map((d) => d.ref.delete()));
  const slug = biz.get("slug") as string | undefined;
  if (slug) {
    const pointer = db().collection("slugs").doc(slug);
    if ((await pointer.get()).get("business_id") === businessId) await pointer.delete();
  }
  await db().collection("subscriptions").doc(businessId).delete();
  await db().recursiveDelete(bizRef);
}

/** Removes a team member's links to a business without touching the business. */
async function leaveBusiness(businessId: string, uid: string, ownerId: string | null) {
  const bizRef = db().collection("businesses").doc(businessId);
  const jobs = await bizRef.collection("projects").where("member_ids", "array-contains", uid).get();
  for (let i = 0; i < jobs.docs.length; i += 400) {
    const batch = db().batch();
    for (const j of jobs.docs.slice(i, i + 400)) {
      batch.update(j.ref, {
        member_ids: (j.get("member_ids") as string[]).filter((m) => m !== uid),
        ...(j.get("responsible_id") === uid && ownerId ? { responsible_id: ownerId } : {}),
      });
    }
    await batch.commit();
  }
  await bizRef.collection("members").doc(uid).delete();
  const count = (await bizRef.collection("members").count().get()).data().count;
  await db().collection("subscriptions").doc(businessId).set({ seats: Math.max(1, count) }, { merge: true });
}

/** Deletes the person's own data and their sign-in. Returns what was removed, for the confirmation message. */
export async function deleteAccountCompletely(uid: string) {
  const userRef = db().collection("users").doc(uid);
  const user = await userRef.get();
  const businessId = (user.get("business_id") as string | null) ?? null;
  const role = (user.get("business_role") as string | null) ?? null;
  let deletedBusiness = false;

  if (businessId) {
    if (role === "owner") {
      await deleteBusinessCompletely(businessId, uid);
      deletedBusiness = true;
    } else {
      const owner = (await db().collection("businesses").doc(businessId).get()).get("owner_id") as string | undefined;
      await leaveBusiness(businessId, uid, owner ?? null);
    }
  }

  // Requests this person sent: the contractor keeps the lead, minus the link to this account.
  const requests = await userRef.collection("quote_requests").get();
  for (const r of requests.docs) {
    const bid = r.get("business_id") as string | undefined;
    if (bid) await db().collection("businesses").doc(bid).collection("quote_requests").doc(r.id).update({ requester_id: null }).catch(() => {});
  }
  // Reviews they wrote stay with the contractor, anonymised.
  const reviews = await db().collectionGroup("reviews").where("reviewer_uid", "==", uid).get().catch(() => null);
  for (const rv of reviews?.docs ?? []) await rv.ref.update({ reviewer_uid: null, reviewer_name: "Former customer" });
  // Reports they filed.
  const reports = await db().collection("reports").where("reporter_id", "==", uid).get();
  await Promise.all(reports.docs.map((d) => d.ref.delete()));
  // Their profile and every subcollection (saves, following, notifications, request history).
  await db().recursiveDelete(userRef);
  // Public avatar
  await deletePrefix(`public-media/users/${uid}/`);

  // The sign-in goes last: until it does, a failed attempt can be repeated.
  forgetRevocationCheck(uid);
  try {
    await adminAuth().deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
  return { deletedBusiness };
}

