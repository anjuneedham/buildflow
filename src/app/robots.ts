import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/onboarding", "/account", "/saved", "/auth", "/invite", "/review", "/media", "/account-deleted"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
