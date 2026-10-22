"use client";

import { Trash2 } from "lucide-react";
import { deletePost } from "@/app/actions/social";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function DeletePostButton({ postId }: { postId: string }) {
  return (
    <ConfirmationDialog
      title="Delete this post?"
      description="It will be removed from your profile and the Explore feed. This can't be undone."
      confirmLabel="Delete post"
      onConfirm={() => deletePost(postId)}
      trigger={(open) => <button onClick={open} aria-label="Delete post" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-concrete-100 hover:text-site-red"><Trash2 className="h-5 w-5" /></button>}
    />
  );
}
