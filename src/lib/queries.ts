import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Business, FeedPost, Location, Service } from "@/lib/types";
export { interpretSearch } from "@/lib/search";

export const BUSINESS_CARD_COLS = "id, name, slug, tagline, logo_url, cover_url, city, service_area, is_verified, follower_count, post_count, completed_project_count, years_in_business, region:locations(name), primary_service:services!businesses_primary_service_id_fkey(name, slug)";
export const POST_COLS = "id, business_id, type, caption, location_text, created_at, like_count, comment_count, save_count, project_id, business:businesses!inner(id, name, slug, logo_url, is_verified, city, region_id), service:services(name, slug), media:post_media(id, url, label, position)";

export const getServices = cache(async (): Promise<Service[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, slug, name, plural_name").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getRegions = cache(async (countryCode = "JM"): Promise<Location[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, name, slug, level, country_code, parent_id")
    .eq("country_code", countryCode).eq("level", "region").order("name");
  return data ?? [];
});

export function sortMedia<T extends { media: { position: number }[] }>(post: T): T {
  return { ...post, media: [...post.media].sort((a, b) => a.position - b.position) };
}

export async function searchBusinesses(opts: { name?: string; serviceId?: string; regionId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase.from("businesses").select(BUSINESS_CARD_COLS + (opts.serviceId ? ", business_services!inner(service_id)" : ""))
    .eq("is_public", true).eq("is_suspended", false);
  if (opts.serviceId) query = query.eq("business_services.service_id", opts.serviceId);
  if (opts.regionId) query = query.eq("region_id", opts.regionId);
  if (opts.name) {
    const term = opts.name.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,tagline.ilike.%${term}%,city.ilike.%${term}%,service_area.ilike.%${term}%`);
  }
  const { data } = await query.order("is_verified", { ascending: false }).order("completed_project_count", { ascending: false }).limit(opts.limit ?? 30);
  return (data ?? []) as unknown as BusinessCardData[];
}

export type BusinessCardData = Pick<Business, "id" | "name" | "slug" | "tagline" | "logo_url" | "cover_url" | "city" | "service_area" | "is_verified" | "follower_count" | "post_count" | "completed_project_count" | "years_in_business"> & {
  region: { name: string } | null; primary_service: { name: string; slug: string } | null;
};

export async function getFeed(opts: { serviceId?: string; regionId?: string; businessId?: string; limit?: number; postIds?: string[] } = {}) {
  const supabase = await createClient();
  let query = supabase.from("posts").select(POST_COLS).eq("is_public", true).eq("is_hidden", false);
  if (opts.serviceId) query = query.eq("service_id", opts.serviceId);
  if (opts.businessId) query = query.eq("business_id", opts.businessId);
  if (opts.regionId) query = query.eq("business.region_id", opts.regionId);
  if (opts.postIds) query = query.in("id", opts.postIds);
  const { data } = await query.order("created_at", { ascending: false }).limit(opts.limit ?? 24);
  return ((data ?? []) as unknown as FeedPost[]).map(sortMedia);
}

/** Which of these posts/businesses has the current user liked, saved or followed. */
export async function getViewerState(userId: string | null | undefined, postIds: string[], businessIds: string[] = []) {
  const empty = { liked: new Set<string>(), saved: new Set<string>(), following: new Set<string>() };
  if (!userId) return empty;
  const supabase = await createClient();
  const [likes, saves, follows] = await Promise.all([
    postIds.length ? supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds) : Promise.resolve({ data: [] }),
    postIds.length ? supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds) : Promise.resolve({ data: [] }),
    businessIds.length ? supabase.from("follows").select("business_id").eq("user_id", userId).in("business_id", businessIds) : Promise.resolve({ data: [] }),
  ]);
  return {
    liked: new Set((likes.data ?? []).map((r: { post_id: string }) => r.post_id)),
    saved: new Set((saves.data ?? []).map((r: { post_id: string }) => r.post_id)),
    following: new Set((follows.data ?? []).map((r: { business_id: string }) => r.business_id)),
  };
}

export const getPublicBusiness = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("businesses")
    .select("*, region:locations(name), primary_service:services!businesses_primary_service_id_fkey(id, name, slug), services:business_services(service:services(id, name, slug))")
    .eq("slug", slug).maybeSingle();
  return data as (Business & { primary_service: Service | null; services: { service: Service }[] }) | null;
});
