"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/app/actions/social";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/ui/use-form-action";
import { ReportButton } from "@/components/forms/report-button";
import { timeAgo } from "@/lib/utils";

export type CommentRow = { id: string; body: string; created_at: string; user_id: string; author: { full_name: string; avatar_url: string | null } | null };

export function CommentForm({ postId, signedIn }: { postId: string; signedIn: boolean }) {
  const [state, action] = useFormAction(addComment);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  if (!signedIn) return <p className="rounded-lg bg-concrete-100 p-3 text-sm"><Link href={`/login?next=/post/${postId}`} className="font-semibold text-safety-700 underline">Log in</Link> to comment.</p>;
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <input type="hidden" name="postId" value={postId} />
      <Textarea name="body" rows={1} placeholder="Add a comment…" aria-label="Comment" maxLength={1000} required className="min-h-11" />
      <SubmitButton>Post</SubmitButton>
    </form>
  );
}

export function CommentList({ comments, postId, viewerId, canModerate }: { comments: CommentRow[]; postId: string; viewerId?: string; canModerate: boolean }) {
  const [pending, run] = useServerAction();
  if (comments.length === 0) return <p className="text-sm text-ink-500">No comments yet. Be the first.</p>;
  return (
    <ul className="space-y-4">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-3">
          <Avatar src={c.author?.avatar_url} name={c.author?.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm"><b>{c.author?.full_name || "BuildFlow user"}</b> <span className="text-xs text-ink-500">{timeAgo(c.created_at)}</span></p>
            <p className="whitespace-pre-line break-words text-sm text-ink-700">{c.body}</p>
            <div className="-ml-2 flex">
              {(viewerId === c.user_id || canModerate) && (
                <button disabled={pending} onClick={() => run(() => deleteComment(c.id, postId))} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-500 hover:text-site-red"><Trash2 className="h-3.5 w-3.5" />Delete</button>
              )}
              {viewerId && viewerId !== c.user_id && <ReportButton targetType="comment" targetId={c.id} targetPath={`posts/${postId}/comments/${c.id}`} />}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
