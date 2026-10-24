import { Briefcase, Plus } from "lucide-react";
import { ProjectCard } from "@/components/cards/project-card";
import { ButtonLink, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUSES } from "@/lib/constants";
import type { Project } from "@/lib/types";
import { getTeam } from "@/lib/team";
import { dateInDays } from "@/lib/utils";

export const metadata = { title: "Jobs" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireBusiness();
  const { status = "active" } = await searchParams;
  const col = tenant(s.business.id).col("projects");
  // Crew see only the jobs they're assigned to (the query itself is scoped).
  const scoped = s.can("projects.manage") ? col : col.where("member_ids", "array-contains", s.user.id);
  const [all, team] = await Promise.all([list<Project>(scoped.orderBy("created_at", "desc").limit(500)), getTeam(s.business.id)]);
  const names = Object.fromEntries(team.map((m) => [m.user_id, m.full_name]));
  const today = dateInDays(0);
  const visible = all.filter((p) => status === "all" || (status === "active" ? ACTIVE_PROJECT_STATUSES.includes(p.status) : p.status === status));
  // Active jobs: the most urgent next step first (undated and taskless last).
  if (status === "active") visible.sort((a, b) => (a.next_task?.due_date ?? "9999").localeCompare(b.next_task?.due_date ?? "9999"));
  const n = (st: string) => all.filter((p) => p.status === st).length;
  return (
    <>
      <PageHeader title="Jobs" actions={s.can("projects.manage") ? <ButtonLink href="/app/jobs/new"><Plus className="h-4 w-4" />New job</ButtonLink> : undefined} />
      <Tabs active={status} tabs={[
        { key: "active", label: "Active", href: "/app/jobs", count: all.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status)).length },
        ...PROJECT_STATUSES.map((x) => ({ key: x.value, label: x.label, href: `/app/jobs?status=${x.value}`, count: n(x.value) })),
        { key: "all", label: "All", href: "/app/jobs?status=all", count: all.length },
      ]} />
      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState icon={Briefcase} title={all.length === 0 ? "No jobs yet" : "Nothing in this view"} description={all.length > 0 ? "Try another tab to see your other jobs." : all.length === 0 && !s.can("projects.manage") ? "Jobs you're assigned to will show up here." : all.length === 0 ? "Create a job for each piece of work: track the timeline, tasks, crew and site photos." : undefined}
            action={all.length === 0 && s.can("projects.manage") ? <ButtonLink href="/app/jobs/new">Create a job</ButtonLink> : undefined} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((p) => <ProjectCard key={p.id} project={p} names={names} today={today} />)}
          </div>
        )}
      </div>
    </>
  );
}
