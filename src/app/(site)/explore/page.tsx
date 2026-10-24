import type { Metadata } from "next";
import Link from "next/link";
import { Compass, SearchX } from "lucide-react";
import { ContractorCard } from "@/components/cards/contractor-card";
import { PostCard } from "@/components/cards/post-card";
import { SearchBar } from "@/components/forms/search-bar";
import { EmptyState, Tabs, ButtonLink } from "@/components/ui";
import { getFeed, getViewerState, searchBusinesses } from "@/lib/queries";
import { resolveExploreFilters, type ExploreParams } from "@/lib/explore";
import { getSession } from "@/lib/session";
import { isFirebaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

export async function generateMetadata({ searchParams }: { searchParams: Promise<ExploreParams> }): Promise<Metadata> {
  if (!isFirebaseConfigured) return { title: "Explore contractors" };
  const f = await resolveExploreFilters(await searchParams);
  const title = f.heading && (f.service || f.region) ? f.heading : "Explore contractors & construction work";
  return { title, description: `Browse ${title.toLowerCase()} on BuildFlow. See their completed projects and request a quote.`, alternates: { canonical: "/explore" } };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  if (!isFirebaseConfigured) return <NotConfigured />;
  const sp = await searchParams;
  const f = await resolveExploreFilters(sp);
  // A customer who searched for a service, place or name wants people to
  // contact first; with no filters, browsing finished work leads.
  const filtered = Boolean(f.name || f.service || f.region);
  const tab = sp.tab === "contractors" || sp.tab === "work" ? sp.tab : filtered ? "contractors" : "work";
  const s = await getSession();

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, service: sp.service, area: sp.area, ...extra };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/explore?${p.toString()}`;
  };

  const [posts, businesses] = await Promise.all([
    tab === "work" ? getFeed({ serviceId: f.service?.id, regionId: f.region?.id, limit: 30, perBusiness: 2 }) : Promise.resolve([]),
    searchBusinesses({ name: f.name || undefined, serviceId: f.service?.id, regionId: f.region?.id, limit: tab === "contractors" ? 30 : 6 }),
  ]);
  const viewer = await getViewerState(s.user?.id, posts.map((p) => p.id));

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{f.heading ?? "Explore"}</h1>
        <p className="mb-4 text-sm text-ink-500">See real finished jobs, check reviews, and request a quote from the contractor who did the work.</p>
        <SearchBar q={sp.q} services={f.services} regions={f.regions} serviceSlug={f.service?.slug} regionSlug={f.region?.slug} tab={sp.tab} />
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Popular services">
          {f.services.slice(0, 10).map((svc) => (
            <Link key={svc.id} href={qs({ service: f.service?.slug === svc.slug ? undefined : svc.slug, tab: sp.tab })}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", f.service?.id === svc.id ? "border-ink bg-ink text-white" : "border-concrete-300 bg-white text-ink-600 hover:border-ink-500")}>
              {svc.plural_name}
            </Link>
          ))}
        </div>
        <Tabs className="mt-3" active={tab} tabs={[{ key: "work", label: "Work", href: qs({ tab: "work" }) }, { key: "contractors", label: "Contractors", href: qs({ tab: "contractors" }) }]} />
      </div>

      {tab === "work" ? (
        <div className="mx-auto mt-5 grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
          <div className="mx-auto w-full max-w-xl space-y-5">
            {posts.length === 0 ? (
              <EmptyState icon={Compass} title="No finished work posted here yet" description="Try a different service or parish, or browse contractors directly." action={<ButtonLink href={qs({ tab: "contractors" })} variant="outline">Browse contractors</ButtonLink>} />
            ) : posts.map((p, i) => <PostCard key={p.id} post={p} saved={viewer.saved.has(p.id)} priority={i < 2} />)}
          </div>
          <aside className="hidden space-y-3 lg:block">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">Contractors {f.heading ? "matching" : "to know"}</h2>
            {businesses.map((b) => <ContractorCard key={b.id} business={b} />)}
          </aside>
        </div>
      ) : (
        <div className="mt-5">
          {businesses.length === 0 ? (
            <EmptyState icon={SearchX} title="No contractors found" description="Try a broader search, like just the service or just the parish." action={<ButtonLink href="/explore?tab=contractors" variant="outline">Clear filters</ButtonLink>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((b) => <ContractorCard key={b.id} business={b} />)}</div>
          )}
        </div>
      )}
    </main>
  );
}

function NotConfigured() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon={Compass} title="Connect Firebase to explore" description="Set the NEXT_PUBLIC_FIREBASE_* variables (see README), start the emulators and run npm run seed." />
    </main>
  );
}
