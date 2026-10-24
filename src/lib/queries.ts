import "server-only";
import { cache } from "react";
import { db } from "@/lib/firebase/admin";
import { fromDoc, fromQuery, isId } from "@/lib/data/db";
import { getSession } from "@/lib/session";
import type { Business, FeedPost, Location, Service } from "@/lib/types";
export { interpretSearch } from "@/lib/search";

// Public reads. Posts carry a denormalised `visible` flag
// (post public && not hidden && business public && not suspended) so the
// feed never needs to look at business docs to decide visibility.

export const getServices = cache(async (): Promise<Service[]> => {
  const all = fromQuery<Service & { is_active: boolean; sort_order: number }>(await db().collection("services").orderBy("sort_order").get());
  return all.filter((s) => s.is_active);
});

export const getRegions = cache(async (countryCode = "JM"): Promise<Location[]> => {
  const rows = fromQuery<Location>(await db().collection("locations").where("country_code", "==", countryCode).where("level", "==", "region").get());
  return rows.sort((a, b) => a.name.localeCompare(b.name));
});

export function sortMedia<T extends { media: { position: number }[] }>(post: T): T {
  return { ...post, media: [...(post.media ?? [])].sort((a, b) => a.position - b.position) };
}

export type BusinessCardData = Business;

export async function searchBusinesses(opts: { name?: string; serviceId?: string; regionId?: string; limit?: number }) {
  let q = db().collection("businesses").where("is_public", "==", true).where("is_suspended", "==", false);
  if (opts.serviceId) q = q.where("service_ids", "array-contains", opts.serviceId);
  if (opts.regionId) q = q.where("region_id", "==", opts.regionId);
  // Firestore has no substring search; V1 filters a bounded candidate set in
  // memory. Swap for Algolia/Typesense when the directory grows.
  let rows = fromQuery<Business>(await q.limit(500).get());
  const term = opts.name?.toLowerCase().trim();
  if (term) rows = rows.filter((b) => [b.name_lower, b.tagline, b.city, b.service_area, b.region?.name].some((v) => v?.toLowerCase().includes(term)));
  // Earned trust first: verified, then rating (weighted by how many reviews), then finished jobs.
  const score = (b: Business) => {
    const n = b.review_count ?? 0;
    return n ? ((b.rating_sum ?? 0) / n) * Math.min(n, 5) / 5 : 0;
  };
  rows.sort((a, b) => Number(b.is_verified) - Number(a.is_verified) || score(b) - score(a) || b.completed_project_count - a.completed_project_count || a.name.localeCompare(b.name));
  return rows.slice(0, opts.limit ?? 30);
}

export async function getFeed(opts: { serviceId?: string; regionId?: string; businessId?: string; limit?: number; postIds?: string[]; perBusiness?: number } = {}) {
  if (opts.postIds) {
    const ids = opts.postIds.filter(isId);
    if (!ids.length) return [];
    const snaps = await db().getAll(...ids.map((id) => db().collection("posts").doc(id)));
    return snaps.map((s) => fromDoc<FeedPost & { visible: boolean }>(s)).filter((p): p is FeedPost & { visible: boolean } => Boolean(p?.visible)).map(sortMedia);
  }
  let q = db().collection("posts").where("visible", "==", true);
  if (opts.serviceId) q = q.where("service_id", "==", opts.serviceId);
  if (opts.businessId) q = q.where("business_id", "==", opts.businessId);
  if (opts.regionId) q = q.where("region_id", "==", opts.regionId);
  const limit = opts.limit ?? 24;
  const rows = fromQuery<FeedPost>(await q.orderBy("created_at", "desc").limit(opts.businessId ? limit : Math.ceil(limit * 1.5)).get()).map(sortMedia);
  if (opts.businessId || !opts.perBusiness) return rows.slice(0, limit);
  // Explore: at most `perBusiness` posts per contractor so one busy business can't fill the page.
  const seen = new Map<string, number>();
  return rows.filter((p) => { const n = (seen.get(p.business_id) ?? 0) + 1; seen.set(p.business_id, n); return n <= opts.perBusiness!; }).slice(0, limit);
}

/** Which of these posts and contractors the current user has saved to their shortlist. */
export async function getViewerState(userId: string | null | undefined, postIds: string[], businessIds: string[] = []) {
  const empty = { saved: new Set<string>(), savedContractors: new Set<string>() };
  if (!userId || (postIds.length === 0 && businessIds.length === 0)) return empty;
  const user = db().collection("users").doc(userId);
  const refs = [...postIds.map((id) => user.collection("saves").doc(id)), ...businessIds.map((id) => user.collection("following").doc(id))];
  const snaps = await db().getAll(...refs);
  const exists = (sub: string) => new Set(snaps.filter((s) => s.exists && s.ref.parent.id === sub).map((s) => s.id));
  return { saved: exists("saves"), savedContractors: exists("following") };
}

export const getBusinessBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const pointer = await db().collection("slugs").doc(slug).get();
  if (!pointer.exists) return null;
  return fromDoc<Business>(await db().collection("businesses").doc(pointer.get("business_id")).get());
});

/** Public profile: visible to everyone if public, otherwise only to its team and admins. */
export const getPublicBusiness = cache(async (slug: string) => {
  const b = await getBusinessBySlug(slug);
  if (!b) return null;
  if (b.is_public && !b.is_suspended) return b;
  const s = await getSession();
  return s.membership?.business.id === b.id || s.isAdmin ? b : null;
});

export async function getPost(id: string) {
  if (!isId(id)) return null;
  const p = fromDoc<FeedPost & { visible: boolean }>(await db().collection("posts").doc(id).get());
  if (!p) return null;
  if (!p.visible) {
    const s = await getSession();
    if (s.membership?.business.id !== p.business_id && !s.isAdmin) return null;
  }
  return sortMedia(p);
}
