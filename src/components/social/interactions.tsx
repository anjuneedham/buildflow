"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, Link2, UserPlus, UserCheck } from "lucide-react";
import { toggleFollow, toggleLike, toggleSave } from "@/app/actions/social";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function useAuthRedirect() {
  const router = useRouter();
  return () => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
}

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [state, set] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  const toAuth = useAuthRedirect();
  const toast = useToast();
  return (
    <button aria-pressed={state.liked} aria-label={`${state.liked ? "Unlike" : "Like"}${state.count > 0 ? ` ${state.count}` : ""}`}
      onClick={() => start(async () => {
        set({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
        const r = await toggleLike(postId);
        if (r.needsAuth) toAuth(); else if (!r.ok) toast(r.error ?? "Error", "error");
      })}
      className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-600 hover:bg-concrete-100">
      <Heart className={cn("h-5 w-5", state.liked && "fill-safety-500 text-safety-500")} />
      {state.count > 0 && state.count}
    </button>
  );
}

export function SaveButton({ postId, saved }: { postId: string; saved: boolean }) {
  const [on, set] = useOptimistic(saved);
  const [, start] = useTransition();
  const toAuth = useAuthRedirect();
  const toast = useToast();
  return (
    <button aria-pressed={on} aria-label={on ? "Remove from saved" : "Save"}
      onClick={() => start(async () => {
        set(!on);
        const r = await toggleSave(postId);
        if (r.needsAuth) toAuth(); else if (r.ok) toast(r.on ? "Saved" : "Removed from saved"); else toast(r.error ?? "Error", "error");
      })}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-600 hover:bg-concrete-100">
      <Bookmark className={cn("h-5 w-5", on && "fill-ink text-ink")} />
    </button>
  );
}

export function ShareButton({ path, label = "Copy link", compact }: { path: string; label?: string; compact?: boolean }) {
  const toast = useToast();
  return (
    <button aria-label={label}
      onClick={async () => {
        const url = window.location.origin + path;
        try {
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ url });
          else { await navigator.clipboard.writeText(url); toast("Link copied"); }
        } catch { /* user cancelled share sheet */ }
      }}
      className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-ink-600 hover:bg-concrete-100", compact ? "w-10" : "px-3")}>
      <Link2 className="h-5 w-5" />{!compact && label}
    </button>
  );
}

export function FollowButton({ businessId, following, className }: { businessId: string; following: boolean; className?: string }) {
  const [on, set] = useOptimistic(following);
  const [, start] = useTransition();
  const toAuth = useAuthRedirect();
  const toast = useToast();
  return (
    <button aria-pressed={on}
      onClick={() => start(async () => {
        set(!on);
        const r = await toggleFollow(businessId);
        if (r.needsAuth) toAuth(); else if (!r.ok) toast(r.error ?? "Error", "error");
      })}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors",
        on ? "border-concrete-300 bg-concrete-100 text-ink" : "border-ink bg-white text-ink hover:bg-concrete-50", className)}>
      {on ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {on ? "Following" : "Follow"}
    </button>
  );
}
