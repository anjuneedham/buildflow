import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, BadgeCheck, Camera, Globe, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Star, Wrench } from "lucide-react";
import { ProfileHeader } from "@/components/cards/profile-header";
import { Stars, TrustStrip } from "@/components/cards/trust";
import { ContactActions } from "@/components/forms/contact-actions";
import { QuoteForm } from "@/components/forms/quote-form";
import { ReportButton } from "@/components/forms/report-button";
import { SaveContractorButton, ShareButton } from "@/components/social/interactions";
import { ViewTracker } from "@/components/social/view-tracker";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { getReviews, ratingOf, trustFacts } from "@/lib/data/trust";
import { getFeed, getPost, getPublicBusiness, getViewerState } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { env } from "@/lib/env";
import { excerpt, formatDate, whatsappLink } from "@/lib/utils";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ request?: string; post?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const b = await getPublicBusiness(username);
  if (!b) return { title: "Contractor not found" };
  const where = [b.city, b.region?.name].filter(Boolean).join(", ");
  const rating = ratingOf(b);
  const title = `${b.name}${b.primary_service ? ` · ${b.primary_service.name}` : ""}${where ? ` in ${where}` : ""}`;
  const description = [rating && `★ ${rating.avg} from ${rating.count} verified review${rating.count === 1 ? "" : "s"}.`, b.tagline ?? b.description?.slice(0, 140) ?? `See ${b.name}'s work and request a quote on BuildFlow.`].filter(Boolean).join(" ");
  return {
    title, description,
    alternates: { canonical: `/contractor/${b.slug}` },
    robots: b.is_public && !b.is_suspended ? undefined : { index: false },
    openGraph: { title, description, type: "profile", url: `/contractor/${b.slug}`, images: b.cover_url ? [b.cover_url] : b.logo_url ? [b.logo_url] : undefined },
  };
}

/**
 * The contractor's living business profile (PRODUCT_STRATEGY_V2.md §9):
 * who they are, the proof (verified jobs, reviews), what they do and where,
 * and one clear way to ask for work. No follower counts or likes.
 */
export default async function ContractorProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const sp = await searchParams;
  const b = await getPublicBusiness(username);
  if (!b) notFound();
  const s = await getSession();
  const isOwnBusiness = s.membership?.business.id === b.id;
  const [posts, reviews, refPost] = await Promise.all([
    getFeed({ businessId: b.id, limit: 30 }),
    getReviews(b.id, 20),
    sp.post ? getPost(sp.post) : null,
  ]);
  const viewer = await getViewerState(s.user?.id, posts.map((p) => p.id), [b.id]);
  const services = b.services ?? [];
  const facts = trustFacts(b);
  const verifiedJobs = posts.filter((p) => p.verified_job).length;
  const social = b.social_links ?? {};
  const contactDefaults = { name: s.profile?.full_name, email: s.user?.email ?? undefined };
  const reference = refPost && refPost.business_id === b.id ? { id: refPost.id, caption: excerpt(refPost.caption), serviceId: refPost.service_id } : null;
  const wa = whatsappLink(b.phone, `Hi ${b.name}, I found you on BuildFlow.`);
  const contact = { businessId: b.id, businessName: b.name, services, defaults: contactDefaults, phone: b.phone, reference };

  const jsonLd = {
    "@context": "https://schema.org", "@type": "HomeAndConstructionBusiness", name: b.name, description: b.description ?? b.tagline,
    url: `${env.siteUrl}/contractor/${b.slug}`, image: b.logo_url ?? b.cover_url ?? undefined, telephone: b.phone ?? undefined, email: b.email ?? undefined,
    address: { "@type": "PostalAddress", addressLocality: b.city ?? undefined, addressRegion: b.region?.name ?? undefined, addressCountry: b.country_code },
    areaServed: b.service_area ?? undefined, sameAs: Object.values(social).filter(Boolean),
    ...(facts.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: facts.rating.avg, reviewCount: facts.rating.count, bestRating: 5 } } : {}),
  };

  return (
    <main id="main" tabIndex={-1} className="pb-28 md:pb-0">
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
        ) : <ContactActions {...contact} defaultOpen={sp.request === "1"} />}
        meta={
          <>
            <TrustStrip facts={facts} className="mt-3" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isOwnBusiness && <SaveContractorButton businessId={b.id} saved={viewer.savedContractors.has(b.id)} />}
              <ShareButton path={`/contractor/${b.slug}`} label="Share" />
            </div>
          </>
        }
      />

      <nav aria-label="Profile sections" className="sticky top-14 z-20 border-y border-concrete-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 no-scrollbar">
          {[["#work", `Work (${posts.length})`], ["#reviews", `Reviews (${facts.rating?.count ?? 0})`], ["#about", "About"]].map(([href, label]) => (
            <a key={href} href={href} className="flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold text-ink-600 hover:text-ink">{label}</a>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-8">
          <section id="work" aria-labelledby="work-h" className="scroll-mt-28">
            <div className="mb-3 flex items-end justify-between gap-2">
              <h2 id="work-h" className="text-lg font-extrabold">Work</h2>
              {verifiedJobs > 0 && <p className="flex items-center gap-1 text-sm font-semibold text-site-green"><BadgeCheck className="h-4 w-4" aria-hidden />{verifiedJobs} verified job{verifiedJobs === 1 ? "" : "s"}</p>}
            </div>
            {posts.length === 0 ? (
              <EmptyState icon={Camera} title="No work posted yet" description={isOwnBusiness ? "Post photos of finished jobs. It's the first thing customers look at." : "Ask for photos of past work when you request a quote."}
                action={isOwnBusiness ? <ButtonLink href="/app/posts/new">Post your first job</ButtonLink> : undefined} />
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {posts.map((p) => {
                  const cover = p.media[p.media.length - 1];
                  return (
                    <li key={p.id}>
                      <Link href={`/post/${p.id}`} className="group block overflow-hidden rounded-lg border border-concrete-200 bg-white">
                        <span className="relative block aspect-square bg-concrete-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {cover && <img src={cover.url} alt={p.caption?.slice(0, 80) ?? "Project photo"} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />}
                          {p.type === "before_after" && <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 text-[10px] font-bold uppercase text-white">Before/after</span>}
                          {p.verified_job && <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-site-green"><BadgeCheck className="h-3 w-3" aria-hidden />Verified job</span>}
                        </span>
                        <span className="block px-2 py-1.5">
                          <span className="block truncate text-xs font-semibold text-ink">{p.caption?.split("\n")[0] ?? p.service?.name ?? "Project"}</span>
                          <span className="block truncate text-[11px] text-ink-500">{[p.service?.name, p.location_text].filter(Boolean).join(" · ") || formatDate(p.created_at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-28">
            <h2 id="reviews-h" className="mb-1 flex items-center gap-2 text-lg font-extrabold"><Star className="h-5 w-5 text-safety-500" aria-hidden />Reviews</h2>
            <p className="mb-3 text-sm text-ink-500">Only customers of completed jobs can review on BuildFlow.</p>
            {facts.rating && <div className="mb-3"><Stars avg={facts.rating.avg} count={facts.rating.count} size="md" /></div>}
            {reviews.length === 0 ? (
              <Card className="p-4 text-sm text-ink-500">{isOwnBusiness ? "When you complete a job, ask the customer for a review from the job page." : "No reviews yet."}</Card>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Stars avg={r.rating} count={1} showCount={false} />
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-site-green"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Verified customer</span>
                      </div>
                      {r.body && <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{r.body}</p>}
                      <p className="mt-2 text-xs text-ink-500">{r.reviewer_name}{r.service_name ? ` · ${r.service_name}` : ""} · {formatDate(r.created_at, { month: "long", year: "numeric" })}</p>
                      {r.reply && <p className="mt-3 border-l-2 border-concrete-300 pl-3 text-sm text-ink-600"><span className="font-semibold text-ink">Reply from {b.name}:</span> {r.reply.body}</p>}
                      {!isOwnBusiness && s.user && <div className="mt-1 text-right"><ReportButton targetType="review" targetId={r.id} targetPath={`businesses/${b.id}/reviews/${r.id}`} label="Report" /></div>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside id="about" className="scroll-mt-28 space-y-4">
          <Card className="p-4">
            <h2 className="font-bold">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{b.description ?? "This business hasn't added a description yet."}</p>
            {services.length > 0 && (
              <>
                <h3 className="mt-4 flex items-center gap-1.5 text-sm font-bold"><Wrench className="h-4 w-4 text-ink-500" aria-hidden />Services</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{services.map((sv) => <Link key={sv.id} href={`/explore?service=${sv.slug}&tab=contractors`}><Badge tone={sv.id === b.primary_service?.id ? "orange" : "neutral"}>{sv.name}</Badge></Link>)}</div>
              </>
            )}
            {(b.service_area || b.region) && (
              <>
                <h3 className="mt-4 flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-ink-500" aria-hidden />Service area</h3>
                <p className="mt-1 text-sm text-ink-600">{b.service_area ?? b.region?.name}</p>
              </>
            )}
            <p className="mt-4 text-xs text-ink-500">On BuildFlow since {formatDate(b.created_at, { month: "long", year: "numeric" })}</p>
          </Card>

          <Card className="p-4">
            <h2 className="font-bold">Contact</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {wa && <li><a href={wa} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2 font-semibold hover:text-action"><MessageCircle className="h-4 w-4 text-ink-500" />WhatsApp</a></li>}
              {b.phone && <li><a href={`tel:${b.phone}`} className="flex min-h-10 items-center gap-2 font-semibold hover:text-action"><Phone className="h-4 w-4 text-ink-500" />{b.phone}</a></li>}
              {b.email && <li><a href={`mailto:${b.email}`} className="flex min-h-10 items-center gap-2 break-all font-semibold hover:text-action"><Mail className="h-4 w-4 shrink-0 text-ink-500" />{b.email}</a></li>}
              {b.website && <li><a href={b.website} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold hover:text-action"><Globe className="h-4 w-4 text-ink-500" />Website</a></li>}
              {(["instagram", "facebook", "tiktok"] as const).filter((k) => social[k]).map((k) => (
                <li key={k}><a href={social[k]} target="_blank" rel="noopener nofollow ugc" className="flex min-h-10 items-center gap-2 font-semibold capitalize hover:text-action"><AtSign className="h-4 w-4 text-ink-500" />{k}</a></li>
              ))}
              {!b.phone && !b.email && !b.website && <li className="text-ink-500">Use the request form to reach this business.</li>}
            </ul>
          </Card>

          {!isOwnBusiness && (
            <Card id="quote" className="hidden scroll-mt-28 p-4 lg:block">
              <h2 className="mb-3 text-lg font-extrabold">Request a quote</h2>
              <QuoteForm businessId={b.id} businessName={b.name} services={services} defaults={contactDefaults} reference={reference} />
            </Card>
          )}
          {!isOwnBusiness && s.user && <div className="text-right"><ReportButton targetType="business" targetId={b.id} label="Report this profile" /></div>}
        </aside>
      </div>

      {!isOwnBusiness && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-concrete-200 bg-white/95 p-2 backdrop-blur md:hidden">
          <ContactActions variant="sticky" {...contact} />
        </div>
      )}
    </main>
  );
}
