"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addNote, deleteNote } from "@/app/actions/crm";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

export type NoteRow = { id: string; body: string; created_at: string; author_id: string | null; author: { full_name: string } | null };

export function Notes({ entityType, entityId, notes, viewerId, path }: { entityType: "lead" | "customer" | "project"; entityId: string; notes: NoteRow[]; viewerId: string; path: string }) {
  const [state, action] = useActionState(addNote, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  useActionToast(state);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <div className="space-y-4">
      <form ref={ref} action={action} className="space-y-2">
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <Textarea name="body" rows={2} placeholder="Add a note: call outcome, site visit, measurements…" aria-label="New note" required />
        <div className="flex justify-end"><SubmitButton size="sm">Add note</SubmitButton></div>
      </form>
      {notes.length === 0 ? <p className="text-sm text-ink-500">No notes yet.</p> : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-concrete-50 p-3">
              <p className="whitespace-pre-line text-sm text-ink-700">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
                <span>{n.author?.full_name || "Team member"} · {timeAgo(n.created_at)}</span>
                {n.author_id === viewerId && (
                  <button onClick={() => start(async () => { await deleteNote(n.id, path); })} aria-label="Delete note" className="flex h-8 w-8 items-center justify-center rounded hover:text-site-red"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
