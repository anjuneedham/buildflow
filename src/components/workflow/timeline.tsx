"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Briefcase, CheckCircle2, ClipboardList, FileText, MessageSquare, Trash2 } from "lucide-react";
import { addNote, deleteNote } from "@/app/actions/crm";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { useFormAction, useServerAction } from "@/components/ui/use-form-action";
import { cn, timeAgo } from "@/lib/utils";
import type { ActivityRow } from "@/lib/types";

/**
 * One history for a lead, customer or job ("What has already happened?").
 * Notes, site updates (with photos), files and system events share a
 * collection, so this is a single query per record. On a customer's
 * timeline, entries link to the lead or job they happened on.
 */
export function Timeline({ entityType, entityId, items, viewerId, canDeleteAny, labels = {}, placeholder, composer = true }: {
  entityType: "lead" | "customer" | "project"; entityId: string; items: ActivityRow[]; viewerId: string; canDeleteAny: boolean;
  /** Names for linking entries to their job/lead, keyed by id. */
  labels?: Record<string, string>; placeholder?: string;
  /** Jobs use the site-update box instead of a separate note box. */
  composer?: boolean;
}) {
  const [state, action] = useFormAction(addNote);
  const ref = useRef<HTMLFormElement>(null);
  const [, run] = useServerAction();
  useActionToast(state);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <div className="space-y-4">
      {composer && <form ref={ref} action={action} className="space-y-2">
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <Textarea name="body" rows={2} placeholder={placeholder ?? "Add a note: call outcome, site visit, measurements…"} aria-label="New note" required />
        <div className="flex justify-end"><SubmitButton size="sm">Add note</SubmitButton></div>
      </form>}
      {items.length === 0 ? <p className="text-sm text-ink-500">Nothing has happened here yet.</p> : (
        <ol className="space-y-3" aria-label="History">
          {items.map((a) => {
            const deletableUpdate = a.action === "update" && !a.media?.length && (a.actor_id === viewerId || canDeleteAny);
            const context = entityType === "customer" ? contextLink(a, labels) : null;
            const canDelete = (a.action === "note" && (a.actor_id === viewerId || canDeleteAny)) || deletableUpdate;
            const meta = <span>{a.actor_name || "BuildFlow"} · {timeAgo(a.created_at)}{context}</span>;
            if (a.action === "note" || a.action === "update") {
              return (
                <li key={a.id} className={cn("rounded-lg p-3", a.action === "update" ? "border border-concrete-200 bg-white" : "bg-concrete-50")}>
                  {a.action === "update" && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">Site update</p>}
                  {a.body && <p className="whitespace-pre-line text-sm text-ink-700">{a.body}</p>}
                  {a.media && a.media.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {a.media.map((m) => (
                        <a key={m.id} href={`/media/${m.path}`} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-md bg-concrete-100">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route; not optimisable */}
                          <img src={`/media/${m.path}`} alt="Site photo" loading="lazy" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
                    {meta}
                    {canDelete && <button onClick={() => run(() => deleteNote(a.id))} aria-label="Delete note" className="flex h-8 w-8 items-center justify-center rounded hover:text-site-red"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </li>
              );
            }
            const Icon = iconFor(a.action);
            return (
              <li key={a.id} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-concrete-100 text-ink-500"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-ink-700">{a.summary}</p>
                  {a.action === "files_added" && a.media && a.media.length > 0 && (
                    <p className="truncate text-xs text-ink-500">{a.media.map((m) => m.name).filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-xs text-ink-500">{meta}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function iconFor(action: string) {
  if (action.startsWith("task_done") || action === "completed") return CheckCircle2;
  if (action.startsWith("task")) return ClipboardList;
  if (action === "files_added") return FileText;
  if (action === "follow_up" || action === "status_changed") return MessageSquare;
  return Briefcase;
}

function contextLink(a: ActivityRow, labels: Record<string, string>) {
  const target = a.project_id ? { href: `/app/jobs/${a.project_id}`, label: labels[a.project_id] ?? "job" }
    : a.lead_id ? { href: `/app/leads/${a.lead_id}`, label: labels[a.lead_id] ?? "lead" } : null;
  if (!target) return null;
  return <> · on <Link href={target.href} className="font-semibold text-ink-600 underline">{target.label}</Link></>;
}
