import type { MetadataRoute } from "next";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/features", "/pricing", "/for-contractors", "/for-customers", "/about", "/contact", "/explore", "/privacy", "/terms", "/refund-policy"]
    .map((p) => ({ url: `${env.siteUrl}${p}`, changeFrequency: "weekly" as const }));
  if (!isSupabaseConfigured) return pages;
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("slug, updated_at").eq("is_public", true).eq("is_suspended", false).limit(5000);
  return [...pages, ...(data ?? []).map((b) => ({ url: `${env.siteUrl}/contractor/${b.slug}`, lastModified: b.updated_at }))];
}
