import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Clock, Globe, Hammer, Mail, Phone, Star, Users, Pencil, Plus, AtSign } from "lucide-react";
import { ProfileHeader } from "@/components/cards/profile-header";
import { PostCard } from "@/components/cards/post-card";
import { ContactActions } from "@/components/forms/contact-actions";
import { QuoteForm } from "@/components/forms/quote-form";
import { ReportButton } from "@/components/forms/report-button";
import { FollowButton, ShareButton } from "@/components/social/interactions";
import { ViewTracker } from "@/components/social/view-tracker";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { getFeed, getPublicBusiness, getViewerState } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { env } from "@/lib/env";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const b = await getPublicBusiness(username);
  if (!b) return { title: "Contractor not found" };
  const where = [b.city, b.region?.name].filter(Boolean).join(", ");
  const title = `${b.name}${b.primary_service ? ` · ${b.primary_service.name}` : ""}${where ? ` in ${where}` : ""}`;
  const description = b.tagline ?? b.description?.slice(0, 155) ?? `See ${b.name}'s work and request a quote on BuildFlow.`;
  return {
    title, description,
    alternates: { canonical: `/contractor/${b.slug}` },
    robots: b.is_public && !b.is_suspended ? undefined : { index: false },
    openGraph: { title, description, type: "profile", url: `/contractor/${b.slug}`, images: b.cover_url ? [b.cover_url] : b.logo_url ? [b.logo_url] : undefined },
  };
}

export default async function ContractorProfilePage({ params }: Props) {
  const { username } = await params;
  const b = await getPublicBusiness(username);
  if (!b) notFound();
  const s = await getSession();
  const isOwnBusiness = s.membership?.business.id === b.id;
  const posts = await getFeed({ businessId: b.id, limit: 30 });
  const viewer = await getViewerState(s.user?.id, posts.map((p) => p.id), [b.id]);
  const services = b.services ?? [];
  const showcase = posts.filter((p) => p.type === "completed_project" || p.type === "before_after");
  const social = b.social_links ?? {};
  const contactDefaults = { name: s.profile?.full_name, email: s.user?.email ?? undefined };

  const jsonLd = {
    "@context": "https://schema.org", "@type": "HomeAndConstructionBusiness", name: b.name, description: b.description ?? b.tagline,
    url: `${env.siteUrl}/contractor/${b.slug}`, image: b.logo_url ?? b.cover_url ?? undefined, telephone: b.phone ?? undefined, email: b.email ?? undefined,
    address: { "@type": "PostalAddress", addressLocality: b.city ?? undefined, addressRegion: b.region?.name ?? undefined, addressCountry: b.country_code },
    areaServed: b.service_area ?? undefined, sameAs: Object.values(social).filter(Boolean),
  };

  return (
    <main id="main" tabIndex={-1} className="pb-24 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ViewTracker businessId={b.id} />
      {!b.is_public && isOwnBusiness && (
        <p className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">Your profile is private. Only your team can see it. <Link href="/app/profile" className="underline">Make it public</Link></p>
      )}
      <ProfileHeader
        business={b}
        primaryService={b.primary_service?.name}
        actions={isOwnBusiness ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/app/posts/new" size="lg"><Plus className="h-5 w-5" />Post work</ButtonLink>
            <ButtonLink href="/app/profile" size="lg" variant="outline"><Pencil className="h-4 w-4" />Edit profile</ButtonLink>
          </div>
        ) : (
          <ContactActions businessId={b.id} businessName={b.name} services={services} defaults={contactDefaults} />
        )}
        meta={
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isOwnBusiness && <FollowButton businessId={b.id} following={viewer.following.has(b.id)} />}
            <ShareButton path={`/contractor/${b.slug}`} label="Share" />
          </div>
        }
      />

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Hammer, label: "Jobs completed", value: b.completed_project_count },
              { icon: Camera, label: "Posts", value: b.post_count },
              { icon: Users, label: "Followers", value: b.follower_count },
              { icon: Clock, label: "Years in business", value: b.years_in_business ?? "—" },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border border-concrete-200 bg-white p-3">
                <x.icon className="h-4 w-4 text-safety-500" aria-hidden />
                <dd className="mt-1 text-xl font-extrabold">{x.value}</dd>
                <dt className="text-xs text-ink-500">{x.label}</dt>
              </div>
            ))}
          </dl>

          <section aria-labelledby="work-h">
            <h2 id="work-h" className="mb-3 text-lg font-extrabold">Portfolio</h2>
            {showcase.length === 0 ? (
              <EmptyState icon={Camera} title="No completed projects posted yet" description={isOwnBusiness ? "Post your best finished jobs. It's the #1 thing customers look at." : "Check back soon, or ask for photos of past work when you request a quote."}
                action={isOwnBusiness ? <ButtonLink href="/app/posts/new">Post your first project</ButtonLink> : undefined} />
            ) : (
              <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
                {showcase.slice(0, 9).map((p) => (
                  <Link key={p.id} href={`/post/${p.id}`} className="relative aspect-square bg-concrete-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.media[p.media.length - 1] && <img src={p.media[p.media.length - 1].url} alt={p.caption?.slice(0, 60) ?? "Project"} loading="lazy" className="h-full w-full object-cover" />}
                    {p.type === "before_after" && <span className="absolute bottom-1 left-1 rounded bg-ink/80 px-1.5 text-[10px] font-bold uppercase text-white">Before/after</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="posts-h">
            <h2 id="posts-h" className="mb-3 text-lg font-extrabold">Posts</h2>
            {posts.length === 0 ? <p className="text-sm text-ink-500">No posts yet.</p> : (
              <div className="space-y-5">{posts.map((p) => <PostCard key={p.id} post={p} liked={viewer.liked.has(p.id)} saved={viewer.saved.has(p.id)} hideBusiness />)}</div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="font-bold">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{b.description ?? "This business hasn't added a description yet."}</p>
            {services.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-bold">Services</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{services.map((sv) => <Link key={sv.id} href={`/explore?service=${sv.slug}`}><Badge tone={sv.id === b.primary_service?.id ? "orange" : "neutral"}>{sv.name}</Badge></Link>)}</div>
              </>
            )}
            {b.service_area && <><h3 className="mt-4 text-sm font-bold">Service area</h3><p className="mt-1 text-sm text-ink-600">{b.service_area}</p></>}
          </Card>

          <Card className="p-4">
            <h2 className="font-bold">Contact</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {b.phone && <li><a href={`tel:${b.phone}`} className="flex min-h-10 items-center gap-2 font-semibold hover:text-safety-700"><Phone className="h-4 w-4 text-ink-500" />{b.phone}</a></li>}
              {b.email && <li><a href={`mailto:${b.email}`} className="flex min-h-10 items-center gap-2 break-all font-semibold hover:text-safety-700"><Mail className="h-4 w-4 shrink-0 text-ink-500" />{b.email}</a></li>}
              {b.website && <li><a href={b.website} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold hover:text-safety-700"><Globe className="h-4 w-4 text-ink-500" />Website</a></li>}
              {social.instagram && <li><a href={social.instagram} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold hover:text-safety-700"><AtSign className="h-4 w-4 text-ink-500" />Instagram</a></li>}
              {social.facebook && <li><a href={social.facebook} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold hover:text-safety-700"><AtSign className="h-4 w-4 text-ink-500" />Facebook</a></li>}
              {social.tiktok && <li><a href={social.tiktok} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold hover:text-safety-700"><Globe className="h-4 w-4 text-ink-500" />TikTok</a></li>}
              {!b.phone && !b.email && !b.website && <li className="text-ink-500">Use the quote form to reach this business.</li>}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="flex items-center gap-2 font-bold"><Star className="h-4 w-4 text-safety-500" />Reviews</h2>
            <p className="mt-1 text-sm text-ink-500">Customer reviews are coming soon to BuildFlow.</p>
          </Card>

          {!isOwnBusiness && (
            <Card id="quote" className="scroll-mt-20 p-4">
              <h2 className="mb-3 text-lg font-extrabold">Request a quote</h2>
              <QuoteForm businessId={b.id} businessName={b.name} services={services} defaults={contactDefaults} />
            </Card>
          )}
          {!isOwnBusiness && <div className="text-right"><ReportButton targetType="business" targetId={b.id} label="Report this profile" /></div>}
        </aside>
      </div>

      {!isOwnBusiness && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-concrete-200 bg-white/95 p-2 backdrop-blur md:hidden">
          <ContactActions variant="sticky" businessId={b.id} businessName={b.name} services={services} defaults={contactDefaults} />
        </div>
      )}
    </main>
  );
}
