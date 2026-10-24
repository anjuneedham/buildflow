"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileText, ImagePlus, Paperclip, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  completeProject, createTask, deleteMedia, deleteProject, deleteTask, postUpdate, setProjectStatus, setTaskStatus, updateTask, uploadProjectFiles,
} from "@/app/actions/projects";
import { replyToReview, requestReview } from "@/app/actions/reviews";
import { StatusChanger } from "@/components/crm/status-changer";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast, useToast } from "@/components/ui/toast";
import { useFormAction, useServerAction } from "@/components/ui/use-form-action";
import { PROJECT_STATUSES, TASK_PRIORITIES, UPLOAD } from "@/lib/constants";
import { cn, relativeDay } from "@/lib/utils";
import type { Media, Task, TeamMember } from "@/lib/types";

// ---------------- Status & completion ----------------

/** Job status. "Completed" opens the completion dialog instead of saving directly. */
export function ProjectStatus({ id, status, openTasks }: { id: string; status: string; openTasks: number }) {
  const [completing, setCompleting] = useState(false);
  return (
    <>
      <StatusChanger label="Job status" value={status} options={PROJECT_STATUSES} onChange={(v) => setProjectStatus(id, v)}
        intercept={{ values: ["completed"], onSelect: () => setCompleting(true) }} />
      <CompleteDialog id={id} openTasks={openTasks} open={completing} onClose={() => setCompleting(false)} />
    </>
  );
}

export function CompleteJobButton({ id, openTasks }: { id: string; openTasks: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} block><Check className="h-4 w-4" />Complete job</Button>
      <CompleteDialog id={id} openTasks={openTasks} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CompleteDialog({ id, openTasks, open, onClose }: { id: string; openTasks: number; open: boolean; onClose: () => void }) {
  const [pending, run] = useServerAction();
  const toast = useToast();
  const finish = (close: boolean) => run(() => completeProject(id, close), (r) => {
    onClose();
    if (r && r.ok === false) toast(r.error ?? "Couldn't complete the job", "error"); else toast("Job completed");
  });
  return (
    <Modal open={open} onClose={onClose} title="Complete this job?">
      {openTasks > 0 ? (
        <>
          <p className="text-sm text-ink-600">{openTasks} task{openTasks === 1 ? " is" : "s are"} still open.</p>
          <div className="mt-4 grid gap-2">
            <Button disabled={pending} onClick={() => finish(true)}>Mark {openTasks === 1 ? "it" : "them"} done and complete</Button>
            <Button variant="outline" disabled={pending} onClick={() => finish(false)}>Complete, leave tasks open</Button>
            <Button variant="ghost" onClick={onClose}>Not yet</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-600">The customer moves to past clients once all their jobs are done. You can then show this job on your profile.</p>
          <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
            <Button variant="outline" onClick={onClose}>Not yet</Button>
            <Button disabled={pending} onClick={() => finish(false)}>{pending ? "Completing…" : "Complete job"}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function DeleteProject({ id }: { id: string }) {
  return (
    <ConfirmationDialog title="Delete this job?" description="Tasks, updates, photos and files on this job will be deleted. Posts made from it stay on your profile." confirmLabel="Delete job"
      onConfirm={() => deleteProject(id)}
      trigger={(open) => <Button variant="ghost" size="sm" onClick={open} aria-label="Delete job" className="text-site-red"><Trash2 className="h-4 w-4" /></Button>} />
  );
}

/** One-tap "done" for the next task shown at the top of the job. */
export function DoneButton({ taskId }: { taskId: string }) {
  const [pending, run] = useServerAction();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setTaskStatus(taskId, "done"))}><Check className="h-4 w-4" />{pending ? "Saving…" : "Done"}</Button>;
}

// ---------------- Tasks ----------------

export function TaskList({ projectId, tasks, team, canDelete, today }: { projectId: string; tasks: Task[]; team: TeamMember[]; canDelete: boolean; today: string }) {
  const [adding, setAdding] = useState(tasks.length === 0);
  const [editing, setEditing] = useState<Task | null>(null);
  const [pending, run] = useServerAction();
  const names = new Map(team.map((m) => [m.user_id, m.full_name]));
  return (
    <div className="space-y-3">
      {tasks.length > 0 && (
        <ul className="divide-y divide-concrete-200 rounded-lg border border-concrete-200">
          {tasks.map((t) => {
            const done = t.status === "done";
            const overdue = !done && t.due_date && t.due_date < today;
            return (
              <li key={t.id} className="flex items-start gap-3 p-3">
                <button disabled={pending} aria-label={done ? "Mark not done" : "Mark done"}
                  onClick={() => run(() => setTaskStatus(t.id, done ? "todo" : "done"))}
                  className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2", done ? "border-site-green bg-site-green text-white" : "border-concrete-300 hover:border-ink-500")}>
                  {done && <Check className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold", done && "text-ink-500 line-through")}>{t.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    {!done && <StatusBadge kind="priority" value={t.priority} />}
                    {t.status === "in_progress" && <StatusBadge kind="task" value="in_progress" />}
                    {t.due_date && !done && <span className={cn(overdue && "font-bold text-site-red")}>{overdue ? "Overdue · " : "Due "}{relativeDay(t.due_date, today)}</span>}
                    <span>{t.assigned_to ? names.get(t.assigned_to) ?? "Team member" : "Unassigned"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {t.status === "todo" && (
                    <button disabled={pending} onClick={() => run(() => setTaskStatus(t.id, "in_progress"))} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-ink-500 hover:bg-concrete-100">Start</button>
                  )}
                  {!done && <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-concrete-100"><Pencil className="h-4 w-4" /></button>}
                  {canDelete && <button disabled={pending} onClick={() => run(() => deleteTask(t.id))} aria-label={`Delete ${t.title}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:text-site-red"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {adding ? <TaskForm key="new" action={createTask.bind(null, projectId)} team={team} onDone={() => setAdding(false)} submitLabel="Add task" /> : (
        <Button variant="secondary" block onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add task</Button>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit task">
        {editing && <TaskForm key={editing.id} action={updateTask.bind(null, editing.id)} team={team} task={editing} onDone={() => setEditing(null)} submitLabel="Save task" closeOnSave />}
      </Modal>
    </div>
  );
}

function TaskForm({ action: serverAction, team, task, onDone, submitLabel, closeOnSave }: {
  action: (s: { ok?: boolean }, fd: FormData) => Promise<{ ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string[] | undefined> }>;
  team: TeamMember[]; task?: Task; onDone: () => void; submitLabel: string; closeOnSave?: boolean;
}) {
  const [state, action] = useFormAction(serverAction);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state);
  useEffect(() => {
    if (!state.ok) return;
    if (closeOnSave) onDone(); else ref.current?.reset();
  }, [state, closeOnSave, onDone]);
  const id = task ? `t-${task.id}` : "t-new";
  return (
    <form ref={ref} action={action} className={cn("space-y-3", !task && "rounded-lg bg-concrete-50 p-3")}>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Task" htmlFor={`${id}-title`} error={state.fieldErrors?.title}><Input id={`${id}-title`} name="title" defaultValue={task?.title} placeholder="e.g. Order cement & blocks" required autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due" htmlFor={`${id}-due`}><Input id={`${id}-due`} name="dueDate" type="date" defaultValue={task?.due_date ?? ""} /></Field>
        <Field label="Priority" htmlFor={`${id}-priority`}><Select id={`${id}-priority`} name="priority" defaultValue={task?.priority ?? "medium"} options={TASK_PRIORITIES} /></Field>
      </div>
      {team.length > 1 && <Field label="Who's doing it" htmlFor={`${id}-assignee`}><Select id={`${id}-assignee`} name="assignedTo" defaultValue={task?.assigned_to ?? ""} placeholder="Unassigned" options={team.map((m) => ({ value: m.user_id, label: m.full_name || "Team member" }))} /></Field>}
      <div className="flex gap-2"><SubmitButton className="flex-1">{submitLabel}</SubmitButton><Button variant="ghost" onClick={onDone}>{task ? "Cancel" : "Done"}</Button></div>
    </form>
  );
}

// ---------------- Updates, photos, files ----------------

/** Post what happened on site today: a note and/or photos. */
export function UpdateComposer({ projectId }: { projectId: string }) {
  const [state, action, pending] = useFormAction(postUpdate.bind(null, projectId));
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  // React resets the form after the action runs; the photo counter resets with it.
  return (
    <form ref={ref} action={action} onSubmit={() => setCount(0)} className="space-y-2">
      <Textarea name="body" rows={2} placeholder="What happened on site today?" aria-label="Update" />
      <div className="flex flex-wrap items-center gap-2">
        <label className={buttonClasses({ variant: "outline", size: "sm", className: "cursor-pointer" })}>
          <ImagePlus className="h-4 w-4" />{count ? `${count} photo${count > 1 ? "s" : ""}` : "Add photos"}
          <input type="file" name="photos" accept={UPLOAD.imageAccept} multiple className="sr-only" disabled={pending} onChange={(e) => setCount(e.target.files?.length ?? 0)} />
        </label>
        <SubmitButton size="sm" className="ml-auto" pendingText="Posting…">Post update</SubmitButton>
      </div>
      {state.ok === false && !state.fieldErrors && <p className="text-sm text-site-red">{state.error}</p>}
    </form>
  );
}

export function PhotoGrid({ photos }: { photos: (Media & { deletable: boolean })[] }) {
  const [pending, run] = useServerAction();
  if (photos.length === 0) return <p className="text-sm text-ink-500">Photos from site updates appear here.</p>;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {photos.map((ph) => (
        <div key={ph.id} className="relative aspect-square overflow-hidden rounded-lg bg-concrete-100">
          <a href={`/media/${ph.path}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route */}
            <img src={`/media/${ph.path}`} alt="Site photo" loading="lazy" className="h-full w-full object-cover" />
          </a>
          {ph.deletable && (
            <button disabled={pending} onClick={() => run(() => deleteMedia(ph.id))} aria-label="Delete photo"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"><X className="h-4 w-4" /></button>
          )}
        </div>
      ))}
    </div>
  );
}

export function FilesSection({ projectId, files }: { projectId: string; files: (Media & { deletable: boolean })[] }) {
  const [state, action, pending] = useFormAction(uploadProjectFiles.bind(null, projectId));
  const [count, setCount] = useState(0);
  const [, run] = useServerAction();
  useActionToast(state);
  return (
    <div className="space-y-3">
      {files.length === 0 ? <p className="text-sm text-ink-500">Quotes, permits, drawings and receipts for this job.</p> : (
        <ul className="divide-y divide-concrete-200 rounded-lg border border-concrete-200">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 p-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              <a href={`/media/${f.path}?name=${encodeURIComponent(f.name ?? "file")}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{f.name ?? "File"}</a>
              <span className="shrink-0 text-xs text-ink-500">{Math.max(1, Math.round(f.bytes / 1024))} KB</span>
              {f.deletable && <button onClick={() => run(() => deleteMedia(f.id))} aria-label={`Delete ${f.name}`} className="flex h-8 w-8 items-center justify-center rounded text-ink-500 hover:text-site-red"><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      <form action={action} onSubmit={() => setCount(0)} className="flex flex-wrap items-center gap-2">
        <label className={buttonClasses({ variant: "outline", size: "sm", className: "cursor-pointer" })}>
          <Paperclip className="h-4 w-4" />{pending ? "Uploading…" : count ? `${count} selected` : "Add files"}
          <input type="file" name="files" accept={UPLOAD.fileAccept} multiple className="sr-only" disabled={pending} onChange={(e) => setCount(e.target.files?.length ?? 0)} />
        </label>
        {count > 0 && <SubmitButton size="sm">Upload</SubmitButton>}
        {state.ok === false && <p className="w-full text-sm text-site-red">{state.error}</p>}
      </form>
    </div>
  );
}

// ---------------- Reviews ----------------

/** "Ask for a review": creates the job's review link and shares it (WhatsApp first). */
export function ReviewRequestButton({ projectId, requested }: { projectId: string; requested: boolean }) {
  const [link, setLink] = useState<{ url: string; whatsapp: string | null; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const open = async () => {
    setPending(true);
    try {
      const r = await requestReview(projectId);
      if (!r.ok) toast(r.error, "error"); else setLink(r);
    } catch { toast("Couldn't create the review link. Please try again.", "error"); }
    setPending(false);
  };
  return (
    <>
      <Button variant="outline" onClick={open} disabled={pending} className="shrink-0"><Star className="h-4 w-4" />{pending ? "Getting link…" : requested ? "Share review link" : "Ask for a review"}</Button>
      <Modal open={link !== null} onClose={() => setLink(null)} title="Ask for a review">
        {link && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Send this link to your customer. Only people with the link can review this job, so your reviews are always from real customers.</p>
            <p className="break-all rounded-lg bg-concrete-50 p-3 font-mono text-xs" data-testid="review-link">{link.url}</p>
            <div className="grid gap-2">
              {link.whatsapp && <a href={link.whatsapp} target="_blank" rel="noreferrer" className={buttonClasses({})}>Send on WhatsApp</a>}
              <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link.text).catch(() => {}); toast("Message copied"); }}>Copy message</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function ReviewReplyForm({ projectId, reply }: { projectId: string; reply: string | null }) {
  const [state, action] = useFormAction(replyToReview.bind(null, projectId));
  const [editing, setEditing] = useState(!reply);
  useActionToast(state);
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-safety-700">Edit reply</button>;
  return (
    <form action={action} className="space-y-2">
      <Textarea name="body" rows={2} defaultValue={reply ?? ""} placeholder="Thank them, or respond to their feedback. Your reply is public." aria-label="Reply to review" required />
      <div className="flex justify-end"><SubmitButton size="sm">Post reply</SubmitButton></div>
    </form>
  );
}
