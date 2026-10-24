"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { createTask, deleteProject, deleteTask, setProjectStatus, setTaskStatus, uploadProjectPhotos } from "@/app/actions/projects";
import { StatusChanger } from "@/components/crm/status-changer";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field, FormError, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/ui/use-form-action";
import { PROJECT_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { Task, TeamMember } from "@/lib/types";

export function ProjectStatus({ id, status }: { id: string; status: string }) {
  return <StatusChanger label="Project status" value={status} options={PROJECT_STATUSES} onChange={(v) => setProjectStatus(id, v)} />;
}

export function DeleteProject({ id }: { id: string }) {
  return (
    <ConfirmationDialog title="Delete this project?" description="Tasks, site photos and notes on this project will be deleted. Posts made from it stay on your profile." confirmLabel="Delete project"
      onConfirm={() => deleteProject(id)}
      trigger={(open) => <Button variant="ghost" size="sm" onClick={open} aria-label="Delete project" className="text-site-red"><Trash2 className="h-4 w-4" /></Button>} />
  );
}

export function TaskList({ projectId, tasks, team, canDelete, today }: { projectId: string; tasks: Task[]; team: TeamMember[]; canDelete: boolean; today: string }) {
  const [adding, setAdding] = useState(tasks.length === 0);
  const [pending, run] = useServerAction();
  const names = new Map(team.map((m) => [m.user_id, m.full_name]));
  return (
    <div className="space-y-3">
      {tasks.length > 0 && (
        <ul className="divide-y divide-concrete-200 rounded-lg border border-concrete-200">
          {tasks.map((t) => {
            const done = t.status === "done";
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
                    <StatusBadge kind="priority" value={t.priority} />
                    {t.status === "in_progress" && <StatusBadge kind="task" value="in_progress" />}
                    {t.due_date && <span className={cn(!done && t.due_date < today && "font-bold text-site-red")}>Due {formatDate(t.due_date, { month: "short", day: "numeric" })}</span>}
                    {t.assigned_to && <span>→ {names.get(t.assigned_to) ?? "Team member"}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {t.status === "todo" && (
                    <button disabled={pending} onClick={() => run(() => setTaskStatus(t.id, "in_progress"))} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-ink-500 hover:bg-concrete-100">Start</button>
                  )}
                  {canDelete && <button disabled={pending} onClick={() => run(() => deleteTask(t.id))} aria-label="Delete task" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:text-site-red"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {adding ? <TaskForm projectId={projectId} team={team} onDone={() => setAdding(false)} /> : (
        <Button variant="secondary" block onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add task</Button>
      )}
    </div>
  );
}

function TaskForm({ projectId, team, onDone }: { projectId: string; team: TeamMember[]; onDone: () => void }) {
  const [state, action] = useFormAction(createTask.bind(null, projectId));
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3 rounded-lg bg-concrete-50 p-3">
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Task" htmlFor="title" error={state.fieldErrors?.title}><Input id="title" name="title" placeholder="e.g. Order cement & blocks" required autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due" htmlFor="dueDate"><Input id="dueDate" name="dueDate" type="date" /></Field>
        <Field label="Priority" htmlFor="priority"><Select id="priority" name="priority" defaultValue="medium" options={TASK_PRIORITIES} /></Field>
      </div>
      {team.length > 1 && <Field label="Assign to" htmlFor="assignedTo"><Select id="assignedTo" name="assignedTo" placeholder="Unassigned" options={team.map((m) => ({ value: m.user_id, label: m.full_name || "Team member" }))} /></Field>}
      <div className="flex gap-2"><SubmitButton className="flex-1">Add task</SubmitButton><Button variant="ghost" onClick={onDone}>Done</Button></div>
    </form>
  );
}

export function PhotoUpload({ projectId }: { projectId: string }) {
  const [state, action, pending] = useFormAction(uploadProjectPhotos.bind(null, projectId));
  const [count, setCount] = useState(0);
  useActionToast(state);
  // React resets the form after a successful action; we clear the counter on submit.
  return (
    <form action={action} onSubmit={() => setCount(0)} className="flex flex-wrap items-center gap-2">
      <label className={buttonClasses({ variant: "outline", className: "cursor-pointer" })}>
        <ImagePlus className="h-4 w-4" />{pending ? "Uploading…" : count ? `${count} selected` : "Choose photos"}
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={pending} onChange={(e) => setCount(e.target.files?.length ?? 0)} />
      </label>
      {count > 0 && <SubmitButton>Upload</SubmitButton>}
      {state.ok === false && <p className="w-full text-sm text-site-red">{state.error}</p>}
    </form>
  );
}
