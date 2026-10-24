import Link from "next/link";
import { CalendarDays, ListTodo, MapPin, User, UserCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { cn, formatDate, relativeDay } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** A job at a glance: who it's for, what's next, who's responsible, progress. */
export function ProjectCard({ project, names = {}, today, showCustomer = true }: {
  project: Project; names?: Record<string, string>; today: string; showCustomer?: boolean;
}) {
  const total = project.task_total ?? 0;
  const done = project.task_done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : null;
  const next = project.next_task;
  const overdue = next?.due_date && next.due_date < today;
  const finished = project.status === "completed" || project.status === "cancelled";
  return (
    <Link href={`/app/jobs/${project.id}`} className="block rounded-xl border border-concrete-200 bg-white p-4 shadow-card hover:border-concrete-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-bold text-ink">{project.name}</h3>
        <StatusBadge kind="project" value={project.status} />
      </div>
      <div className="mt-2 space-y-1 text-sm text-ink-500">
        {showCustomer && project.customer_name && <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{project.customer_name}</span></p>}
        {project.location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{project.location}</span></p>}
        {(project.start_date || project.expected_end_date) && (
          <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />{formatDate(project.start_date, { month: "short", day: "numeric" })} → {formatDate(project.expected_end_date, { month: "short", day: "numeric" })}</p>
        )}
        {project.responsible_id && names[project.responsible_id] && <p className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />{names[project.responsible_id]}</p>}
      </div>
      {!finished && (
        <div className={cn("mt-3 rounded-lg px-3 py-2 text-sm", next ? (overdue ? "bg-red-50" : "bg-concrete-50") : "bg-concrete-50")}>
          {next ? (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500"><ListTodo className="h-3.5 w-3.5" aria-hidden />Next</p>
              <p className="truncate font-semibold text-ink">{next.title}</p>
              <p className={cn("text-xs", overdue ? "font-bold text-site-red" : "text-ink-500")}>
                {next.due_date ? `${overdue ? "Overdue · " : ""}${relativeDay(next.due_date, today)}` : "No due date"}
                {next.assigned_to ? ` · ${names[next.assigned_to] ?? "Team member"}` : " · Unassigned"}
              </p>
            </>
          ) : <p className="text-xs text-ink-500">No open tasks. Add what&apos;s next.</p>}
        </div>
      )}
      {pct !== null && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-concrete-200"><span className="block h-full bg-safety-500" style={{ width: `${pct}%` }} /></span>
          {done}/{total} tasks
        </div>
      )}
    </Link>
  );
}
