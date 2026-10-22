import "server-only";
import { getRegions, getServices, interpretSearch } from "@/lib/queries";

export type ExploreParams = { q?: string; service?: string; area?: string; tab?: string };

/** Resolves explicit filters plus free-text ("tilers in st andrew") into ids. */
export async function resolveExploreFilters(sp: ExploreParams) {
  const [services, regions] = await Promise.all([getServices(), getRegions()]);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const parsed = q ? interpretSearch(q, services, regions) : { service: undefined, region: undefined, name: "" };
  const service = services.find((s) => s.slug === sp.service) ?? parsed.service;
  const region = regions.find((r) => r.slug === sp.area) ?? parsed.region;
  const heading = service || region
    ? `${service?.plural_name ?? "Contractors"}${region ? ` in ${region.name}` : ""}`
    : q ? `Results for “${q}”` : null;
  return { services, regions, q, service, region, name: parsed.name, heading };
}
