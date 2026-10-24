import { Search } from "lucide-react";
import type { Location, Service } from "@/lib/types";

/** Plain GET form so search works without JS and results are shareable URLs. */
export function SearchBar({ action = "/explore", q, services, regions, serviceSlug, regionSlug, tab, autoFocus }: {
  action?: string; q?: string; services: Service[]; regions: Location[]; serviceSlug?: string; regionSlug?: string; tab?: string; autoFocus?: boolean;
}) {
  return (
    <form action={action} role="search" className="space-y-2">
      {tab && <input type="hidden" name="tab" value={tab} />}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input name="q" defaultValue={q} autoFocus={autoFocus} placeholder='Try "electricians in Kingston"' aria-label="Search contractors, services or places"
          className="block min-h-12 w-full rounded-xl border border-concrete-300 bg-white pl-11 pr-24 text-base shadow-sm placeholder:text-ink-500/70 focus:border-safety-500 focus:outline-none focus:ring-2 focus:ring-safety-500/25" />
        <button className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-action px-4 text-sm font-bold text-white hover:bg-action-hover">Search</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="service" defaultValue={serviceSlug ?? ""} aria-label="Service" className="min-h-11 rounded-lg border border-concrete-300 bg-white px-3 text-sm">
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.slug}>{s.plural_name}</option>)}
        </select>
        <select name="area" defaultValue={regionSlug ?? ""} aria-label="Location" className="min-h-11 rounded-lg border border-concrete-300 bg-white px-3 text-sm">
          <option value="">All locations</option>
          {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
      </div>
    </form>
  );
}
