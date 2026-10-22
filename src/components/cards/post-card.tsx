import Link from "next/link";
import { BadgeCheck, MapPin, MessageCircle } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { LikeButton, SaveButton, ShareButton } from "@/components/social/interactions";
import { POST_TYPES, optionFor } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import type { FeedPost } from "@/lib/types";

export function PostMediaView({ post, priority }: { post: FeedPost; priority?: boolean }) {
  const media = post.media;
  if (media.length === 0) return null;
  if (post.type === "before_after" && media.length >= 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 bg-concrete-200">
        {media.slice(0, 2).map((m) => (
          <div key={m.id} className="relative aspect-[4/5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={`${m.label ?? ""} photo`} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 rounded bg-ink/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">{m.label}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar">
      {media.map((m, i) => (
        <div key={m.id} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-concrete-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt={post.caption?.slice(0, 80) ?? "Project photo"} loading={priority && i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
          {media.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-semibold text-white">{i + 1}/{media.length}</span>}
        </div>
      ))}
    </div>
  );
}

export function PostCard({ post, liked = false, saved = false, priority, hideBusiness }: { post: FeedPost; liked?: boolean; saved?: boolean; priority?: boolean; hideBusiness?: boolean }) {
  const type = optionFor(POST_TYPES, post.type);
  return (
    <article className="overflow-hidden rounded-xl border border-concrete-200 bg-white shadow-card">
      {!hideBusiness && (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Link href={`/contractor/${post.business.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar src={post.business.logo_url} name={post.business.name} size="md" square />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-bold text-ink">
                {post.business.name}
                {post.business.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-site-blue" aria-label="Verified" />}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                {post.location_text && <><MapPin className="h-3 w-3" />{post.location_text} · </>}{timeAgo(post.created_at)}
              </p>
            </div>
          </Link>
        </div>
      )}
      <Link href={`/post/${post.id}`} aria-label="Open post"><PostMediaView post={post} priority={priority} /></Link>
      <div className="px-3 pb-3 pt-1">
        <div className="-mx-1 flex items-center">
          <LikeButton postId={post.id} liked={liked} count={post.like_count} />
          <Link href={`/post/${post.id}#comments`} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-600 hover:bg-concrete-100" aria-label="Comments">
            <MessageCircle className="h-5 w-5" />{post.comment_count > 0 && post.comment_count}
          </Link>
          <ShareButton path={`/post/${post.id}`} compact />
          <div className="ml-auto"><SaveButton postId={post.id} saved={saved} /></div>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {type && <Badge tone="orange">{type.label}</Badge>}
          {post.service && <Badge>{post.service.name}</Badge>}
        </div>
        {post.caption && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-ink-700">{post.caption}</p>}
        {!hideBusiness && (
          <Link href={`/contractor/${post.business.slug}#quote`} className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-safety-50 text-sm font-bold text-safety-700 hover:bg-safety-100">
            Get a quote from {post.business.name.split(" ").slice(0, 3).join(" ")}
          </Link>
        )}
      </div>
    </article>
  );
}
