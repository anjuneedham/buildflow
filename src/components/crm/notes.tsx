"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { addNote, deleteNote } from "@/app/actions/crm";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/ui/use-form-action";
import { timeAgo } from "@/lib/utils";

import type { NoteRow } from "@/lib/types";
export type { NoteRow };

export function Notes({ entityType, entityId, notes, viewerId }: { entityType: "lead" | "customer" | "project"; entityId: string; notes: NoteRow[]; viewerId: string }) {
  const [state, action] = useFormAction(addNote);
  const ref = useRef<HTMLFormElement>(null);
  const [, run] = useServerAction();
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
                <span>{n.author_name || "Team member"} · {timeAgo(n.created_at)}</span>
                {n.author_id === viewerId && (
                  <button onClick={() => run(() => deleteNote(n.id))} aria-label="Delete note" className="flex h-8 w-8 items-center justify-center rounded hover:text-site-red"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
