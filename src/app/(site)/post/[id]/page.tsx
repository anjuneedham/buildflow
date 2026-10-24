import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Briefcase, MapPin, MessageCircle } from "lucide-react";
import { PostMediaView, similarJobHref } from "@/components/cards/post-card";
import { TrustStrip, VerifiedJobBadge } from "@/components/cards/trust";
import { SaveButton, ShareButton } from "@/components/social/interactions";
import { ViewTracker } from "@/components/social/view-tracker";
import { ReportButton } from "@/components/forms/report-button";
import { DeletePostButton } from "./delete-post-button";
import { Avatar, Badge, ButtonLink, Card } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { fromDoc } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { trustFacts } from "@/lib/data/trust";
import { getFeed, getPost, getViewerState } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { POST_TYPES, optionFor } from "@/lib/constants";
import { formatDate, whatsappLink } from "@/lib/utils";
import type { Business } from "@/lib/types";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post) return { title: "Post not found" };
  const title = `${post.service?.name ?? optionFor(POST_TYPES, post.type)?.label ?? "Work"} by ${post.business.name}${post.location_text ? ` in ${post.location_text}` : ""}`;
  return { title, description: post.caption?.slice(0, 155) ?? title, openGraph: { title, images: post.media[0] ? [post.media[0].url] : undefined } };
}

/**
 * A piece of work as proof (UX_ARCHITECTURE_V2.md §3.19): the photos, whether
 * it's a verified job, who did it and why to trust them, and "Request a
 * similar job". No likes or comments.
 */
export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { published } = await searchParams;
  const post = await getPost(id);
  if (!post) notFound();
  const s = await getSession();
  const [viewer, biz, more] = await Promise.all([
    getViewerState(s.user?.id, [id]),
    tenant(post.business_id).root.get().then((d) => fromDoc<Business>(d)),
    getFeed({ businessId: post.business_id, limit: 7 }),
  ]);
  const isOwner = s.membership?.business.id === post.business_id;
  const project = post.project_id && isOwner ? await tenant(post.business_id).doc("projects", post.project_id).get() : null;
  const otherWork = more.filter((p) => p.id !== post.id).slice(0, 6);
  const wa = biz && whatsappLink(biz.phone, `Hi ${biz.name}, I saw your work on BuildFlow and I'd like something similar.`);

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-0 py-0 sm:px-4 sm:py-6">
      <ViewTracker businessId={post.business_id} postId={post.id} />
      {published && <div className="p-4 sm:px-0"><FormSuccess message="Your post is live on your profile and in Explore. Share it with customers." /></div>}
      <Card className="overflow-hidden rounded-none sm:rounded-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/contractor/${post.business.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={post.business.logo_url} name={post.business.name} square />
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-bold">{post.business.name}{post.business.is_verified && <BadgeCheck className="h-4 w-4 text-site-blue" aria-label="Verified" />}</p>
              <p className="flex items-center gap-1 text-xs text-ink-500">{post.location_text && <><MapPin className="h-3 w-3" />{post.location_text} · </>}{formatDate(post.created_at)}</p>
            </div>
          </Link>
          {isOwner && <DeletePostButton postId={post.id} />}
        </div>
        <PostMediaView post={post} priority />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {post.verified_job && <VerifiedJobBadge completedOn={post.completed_on} />}
            <Badge tone="orange">{optionFor(POST_TYPES, post.type)?.label}</Badge>
            {post.service && <Link href={`/explore?service=${post.service.slug}&tab=contractors`}><Badge>{post.service.name}</Badge></Link>}
            {project?.exists && <Link href={`/app/jobs/${project.id}`}><Badge tone="blue"><Briefcase className="h-3 w-3" />{project.get("name")}</Badge></Link>}
            <span className="ml-auto flex items-center"><ShareButton path={`/post/${post.id}`} compact /><SaveButton postId={post.id} saved={viewer.saved.has(post.id)} /></span>
          </div>
          {post.caption && <p className="whitespace-pre-line text-ink-700">{post.caption}</p>}
          {post.verified_job && <p className="text-xs text-ink-500">This work is linked to a job {post.business.name} managed in BuildFlow.</p>}
          {!isOwner && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <ButtonLink href={similarJobHref(post)} size="lg">Request a similar job</ButtonLink>
              {wa && <ButtonLink href={wa} target="_blank" variant="outline" size="lg"><MessageCircle className="h-5 w-5" />WhatsApp</ButtonLink>}
            </div>
          )}
        </div>
      </Card>

      {biz && (
        <section aria-labelledby="who" className="space-y-3 p-4 sm:px-0">
          <h2 id="who" className="font-bold">About {biz.name}</h2>
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold text-action">{biz.primary_service?.name ?? "Construction services"}{biz.region?.name ? ` · ${biz.region.name}` : ""}</p>
            <TrustStrip facts={trustFacts(biz)} />
            <ButtonLink href={`/contractor/${biz.slug}`} variant="outline" block>See profile and reviews</ButtonLink>
          </Card>
          {otherWork.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-ink-500">More work by {biz.name}</h3>
              <ul className="grid grid-cols-3 gap-1.5">
                {otherWork.map((p) => (
                  <li key={p.id}>
                    <Link href={`/post/${p.id}`} className="relative block aspect-square overflow-hidden rounded-lg bg-concrete-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.media[p.media.length - 1] && <img src={p.media[p.media.length - 1].url} alt={p.caption?.slice(0, 60) ?? "Project"} loading="lazy" className="h-full w-full object-cover" />}
                      {p.verified_job && <span className="absolute bottom-1 left-1 rounded bg-white/95 px-1 text-[10px] font-bold text-site-green">Verified</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {!isOwner && s.user && <div className="px-4 pb-6 text-right sm:px-0"><ReportButton targetType="post" targetId={post.id} label="Report post" /></div>}
    </main>
  );
}
