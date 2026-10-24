import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui";
import { trustFacts } from "@/lib/data/trust";
import type { BusinessCardData } from "@/lib/queries";
import { TrustStrip } from "./trust";

/** A contractor in search results: who, what, where, and why to trust them. */
export function ContractorCard({ business }: { business: BusinessCardData }) {
  const where = [business.city, business.region?.name].filter(Boolean).join(", ");
  return (
    <Link href={`/contractor/${business.slug}`} className="group block overflow-hidden rounded-xl border border-concrete-200 bg-white shadow-card transition-shadow hover:shadow-md">
      <div className="relative h-24 bg-ink">
        {business.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.cover_url} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="relative z-10 -mt-7 mb-2"><Avatar src={business.logo_url} name={business.name} size="lg" square className="ring-4 ring-white" /></div>
        <h3 className="flex items-center gap-1 font-bold text-ink group-hover:text-action">
          <span className="truncate">{business.name}</span>
          {business.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-site-blue" aria-label="Verified" />}
        </h3>
        <p className="mt-0.5 text-sm font-semibold text-action">{business.primary_service?.name ?? "Construction services"}</p>
        {where && <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" aria-hidden />{where}</p>}
        {business.tagline && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{business.tagline}</p>}
        <TrustStrip facts={trustFacts(business)} compact className="mt-3 border-t border-concrete-200 pt-3" />
      </div>
    </Link>
  );
}
