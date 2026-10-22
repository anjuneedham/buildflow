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
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

export async function generateMetadata({ searchParams }: { searchParams: Promise<ExploreParams> }): Promise<Metadata> {
  if (!isSupabaseConfigured) return { title: "Explore contractors" };
  const f = await resolveExploreFilters(await searchParams);
  const title = f.heading && (f.service || f.region) ? f.heading : "Explore contractors & construction work";
  return { title, description: `Browse ${title.toLowerCase()} on BuildFlow. See their completed projects and request a quote.`, alternates: { canonical: "/explore" } };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const sp = await searchParams;
  const f = await resolveExploreFilters(sp);
  const tab = sp.tab === "contractors" || (f.name && sp.tab !== "work") ? "contractors" : "work";
  const s = await getSession();

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, service: sp.service, area: sp.area, ...extra };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/explore?${p.toString()}`;
  };

  const [posts, businesses] = await Promise.all([
    tab === "work" ? getFeed({ serviceId: f.service?.id, regionId: f.region?.id, limit: 30 }) : Promise.resolve([]),
    searchBusinesses({ name: f.name || undefined, serviceId: f.service?.id, regionId: f.region?.id, limit: tab === "contractors" ? 30 : 6 }),
  ]);
  const viewer = await getViewerState(s.user?.id, posts.map((p) => p.id));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{f.heading ?? "Explore"}</h1>
        <p className="mb-4 text-sm text-ink-500">Find contractors through the work they&apos;ve done.</p>
        <SearchBar q={sp.q} services={f.services} regions={f.regions} serviceSlug={f.service?.slug} regionSlug={f.region?.slug} tab={tab} />
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Popular services">
          {f.services.slice(0, 10).map((svc) => (
            <Link key={svc.id} href={qs({ service: f.service?.slug === svc.slug ? undefined : svc.slug, tab })}
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
              <EmptyState icon={Compass} title="No work posted here yet" description="Try a different service or location, or browse contractors directly." action={<ButtonLink href={qs({ tab: "contractors" })} variant="outline">Browse contractors</ButtonLink>} />
            ) : posts.map((p, i) => <PostCard key={p.id} post={p} liked={viewer.liked.has(p.id)} saved={viewer.saved.has(p.id)} priority={i < 2} />)}
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
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon={Compass} title="Connect Supabase to explore" description="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README), apply the migrations and load the demo seed." />
    </main>
  );
}
