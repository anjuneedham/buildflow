import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Briefcase, MapPin, MessageCircle } from "lucide-react";
import { PostMediaView } from "@/components/cards/post-card";
import { CommentForm, CommentList, type CommentRow } from "@/components/social/comments";
import { LikeButton, SaveButton, ShareButton } from "@/components/social/interactions";
import { ViewTracker } from "@/components/social/view-tracker";
import { ReportButton } from "@/components/forms/report-button";
import { DeletePostButton } from "./delete-post-button";
import { Avatar, Badge, ButtonLink, Card } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { POST_COLS, getViewerState, sortMedia } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { POST_TYPES, optionFor } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { FeedPost } from "@/lib/types";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> };

async function loadPost(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLS).eq("id", id).maybeSingle();
  return data ? sortMedia(data as unknown as FeedPost) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).id);
  if (!post) return { title: "Post not found" };
  const title = `${optionFor(POST_TYPES, post.type)?.label ?? "Work"} by ${post.business.name}`;
  return { title, description: post.caption?.slice(0, 155) ?? title, openGraph: { title, images: post.media[0] ? [post.media[0].url] : undefined } };
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { published } = await searchParams;
  const post = await loadPost(id);
  if (!post) notFound();
  const s = await getSession();
  const supabase = await createClient();
  const { data: comments } = await supabase.from("comments").select("id, body, created_at, user_id, author:profiles(full_name, avatar_url)").eq("post_id", id).order("created_at");
  const viewer = await getViewerState(s.user?.id, [id]);
  const isOwner = s.membership?.business.id === post.business_id;
  const project = post.project_id && isOwner ? (await supabase.from("projects").select("id, name").eq("id", post.project_id).maybeSingle()).data : null;

  return (
    <main className="mx-auto max-w-2xl px-0 py-0 sm:px-4 sm:py-6">
      <ViewTracker businessId={post.business_id} postId={post.id} />
      {published && <div className="p-4 sm:px-0"><FormSuccess message="Your post is live! Share it with customers." /></div>}
      <Card className="overflow-hidden rounded-none sm:rounded-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/contractor/${post.business.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={post.business.logo_url} name={post.business.name} square />
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-bold">{post.business.name}{post.business.is_verified && <BadgeCheck className="h-4 w-4 text-site-blue" />}</p>
              <p className="flex items-center gap-1 text-xs text-ink-500">{post.location_text && <><MapPin className="h-3 w-3" />{post.location_text} · </>}{formatDate(post.created_at)}</p>
            </div>
          </Link>
          {isOwner && <DeletePostButton postId={post.id} />}
        </div>
        <PostMediaView post={post} priority />
        <div className="space-y-3 p-4">
          <div className="-mx-1 flex items-center">
            <LikeButton postId={post.id} liked={viewer.liked.has(post.id)} count={post.like_count} />
            <span className="flex min-h-10 items-center gap-1.5 px-2 text-sm font-semibold text-ink-600"><MessageCircle className="h-5 w-5" />{post.comment_count}</span>
            <ShareButton path={`/post/${post.id}`} compact />
            <div className="ml-auto"><SaveButton postId={post.id} saved={viewer.saved.has(post.id)} /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="orange">{optionFor(POST_TYPES, post.type)?.label}</Badge>
            {post.service && <Link href={`/explore?service=${post.service.slug}`}><Badge>{post.service.name}</Badge></Link>}
            {project && <Link href={`/app/projects/${project.id}`}><Badge tone="blue"><Briefcase className="h-3 w-3" />{project.name}</Badge></Link>}
          </div>
          {post.caption && <p className="whitespace-pre-line text-ink-700">{post.caption}</p>}
          {!isOwner && <ButtonLink href={`/contractor/${post.business.slug}#quote`} block size="lg">Request a quote from {post.business.name}</ButtonLink>}
          {!isOwner && s.user && <div className="text-right"><ReportButton targetType="post" targetId={post.id} label="Report post" /></div>}
        </div>
      </Card>
      <section id="comments" className="scroll-mt-20 space-y-4 p-4 sm:px-0">
        <h2 className="font-bold">Comments</h2>
        <CommentList comments={(comments ?? []) as unknown as CommentRow[]} postId={post.id} viewerId={s.user?.id} canModerate={isOwner && s.membership?.role === "owner"} />
        <CommentForm postId={post.id} signedIn={Boolean(s.user)} />
      </section>
    </main>
  );
}
