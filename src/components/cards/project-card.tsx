import Link from "next/link";
import { CalendarDays, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { formatAmount, formatDate } from "@/lib/utils";
import type { Project } from "@/lib/types";

export function ProjectCard({ project, customerName, tasks }: { project: Project; customerName?: string | null; tasks?: { total: number; done: number } }) {
  const pct = tasks && tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : null;
  return (
    <Link href={`/app/jobs/${project.id}`} className="block rounded-xl border border-concrete-200 bg-white p-4 shadow-card hover:border-concrete-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-bold text-ink">{project.name}</h3>
        <StatusBadge kind="project" value={project.status} />
      </div>
      <div className="mt-2 space-y-1 text-sm text-ink-500">
        {customerName && <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{customerName}</p>}
        {project.location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{project.location}</p>}
        {(project.start_date || project.expected_end_date) && (
          <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(project.start_date, { month: "short", day: "numeric" })} → {formatDate(project.expected_end_date, { month: "short", day: "numeric" })}</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-ink">{formatAmount(project.budget)}</span>
        {pct !== null && (
          <span className="flex flex-1 items-center justify-end gap-2 text-xs text-ink-500">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-concrete-200"><span className="block h-full bg-safety-500" style={{ width: `${pct}%` }} /></span>
            {tasks!.done}/{tasks!.total} tasks
          </span>
        )}
      </div>
    </Link>
  );
}
