import type { MetadataRoute } from "next";
import { env, isFirebaseConfigured } from "@/lib/env";
import { db } from "@/lib/firebase/admin";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/features", "/pricing", "/for-contractors", "/for-customers", "/about", "/contact", "/explore", "/privacy", "/terms", "/refund-policy"]
    .map((p) => ({ url: `${env.siteUrl}${p}`, changeFrequency: "weekly" as const }));
  if (!isFirebaseConfigured) return pages;
  try {
    const snap = await db().collection("businesses").where("is_public", "==", true).where("is_suspended", "==", false).select("slug", "updated_at").limit(5000).get();
    return [...pages, ...snap.docs.map((d) => ({ url: `${env.siteUrl}/contractor/${d.get("slug")}`, lastModified: d.get("updated_at") }))];
  } catch {
    return pages;
  }
}
