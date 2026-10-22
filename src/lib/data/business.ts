import "server-only";
import { db } from "@/lib/firebase/admin";
import type { Business, Location } from "@/lib/types";

/** Resolves service ids → denormalised {id,name,slug} for the business doc. */
export async function resolveServices(ids: string[]) {
  if (!ids.length) return [];
  const snaps = await db().getAll(...ids.map((id) => db().collection("services").doc(id)));
  return snaps.filter((s) => s.exists).map((s) => ({ id: s.id, name: s.get("name") as string, slug: s.get("slug") as string }));
}

export async function resolveRegion(id: string | null | undefined): Promise<Business["region"]> {
  if (!id) return null;
  const snap = await db().collection("locations").doc(id).get();
  return snap.exists ? { id: snap.id, name: (snap.data() as Location).name } : null;
}

export const isVisible = (b: Pick<Business, "is_public" | "is_suspended">) => b.is_public && !b.is_suspended;

/**
 * Keeps the denormalised business snapshot and visibility flag on posts in
 * sync after a profile/visibility change.
 */
export async function syncBusinessToPosts(businessId: string) {
  const biz = await db().collection("businesses").doc(businessId).get();
  if (!biz.exists) return;
  const b = biz.data() as Business;
  const posts = await db().collection("posts").where("business_id", "==", businessId).get();
  for (let i = 0; i < posts.docs.length; i += 400) {
    const batch = db().batch();
    for (const p of posts.docs.slice(i, i + 400)) {
      batch.update(p.ref, {
        business: { id: businessId, name: b.name, slug: b.slug, logo_url: b.logo_url ?? null, is_verified: b.is_verified, city: b.city ?? null, region_id: b.region_id ?? null },
        visible: isVisible(b) && p.get("is_public") && !p.get("is_hidden"),
      });
    }
    await batch.commit();
  }
}

export async function recountPosts(businessId: string) {
  const n = (await db().collection("posts").where("business_id", "==", businessId).where("visible", "==", true).count().get()).data().count;
  await db().collection("businesses").doc(businessId).update({ post_count: n });
}

