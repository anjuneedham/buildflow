import type { ReactNode } from "react";
import { BadgeCheck, MapPin, ShieldQuestion } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import type { Business } from "@/lib/types";

/** Cover + identity block: answers "who is this, what do they do, where". */
export function ProfileHeader({ business, primaryService, actions, meta }: { business: Business; primaryService?: string | null; actions?: ReactNode; meta?: ReactNode }) {
  const where = [business.city, business.region?.name].filter(Boolean).join(", ");
  return (
    <section className="bg-white">
      <div className="relative h-36 bg-ink sm:h-56">
        {business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.cover_url} alt="" className="h-full w-full object-cover" />
        ) : <div className="h-full w-full bg-blueprint" />}
        {business.is_demo && <span className="absolute left-3 top-3 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-ink">DEMO PROFILE</span>}
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-5">
        <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
          <Avatar src={business.logo_url} name={business.name} size="xl" square className="ring-4 ring-white shadow" />
        </div>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
              {business.name}
              {business.is_verified
                ? <Badge tone="blue"><BadgeCheck className="h-3.5 w-3.5" />Verified</Badge>
                : <Badge tone="neutral"><ShieldQuestion className="h-3.5 w-3.5" />Not yet verified</Badge>}
            </h1>
            <p className="mt-1 text-base font-semibold text-safety-700">{primaryService ?? "Construction services"}</p>
            {where && <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-4 w-4" />{where}{business.service_area ? ` · Serves ${business.service_area}` : ""}</p>}
            {business.tagline && <p className="mt-2 max-w-xl text-ink-600">{business.tagline}</p>}
            {meta}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
