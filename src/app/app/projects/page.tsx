import { Briefcase, Plus } from "lucide-react";
import { ProjectCard } from "@/components/cards/project-card";
import { ButtonLink, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUSES } from "@/lib/constants";
import type { Project } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireBusiness();
  const { status = "active" } = await searchParams;
  const all = await list<Project>(tenant(s.business.id).col("projects").orderBy("created_at", "desc").limit(500));
  const visible = all.filter((p) => status === "all" || (status === "active" ? ACTIVE_PROJECT_STATUSES.includes(p.status) : p.status === status));
  const n = (st: string) => all.filter((p) => p.status === st).length;
  return (
    <>
      <PageHeader title="Projects" actions={<ButtonLink href="/app/projects/new"><Plus className="h-4 w-4" />New project</ButtonLink>} />
      <Tabs active={status} tabs={[
        { key: "active", label: "Active", href: "/app/projects", count: all.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status)).length },
        ...PROJECT_STATUSES.map((x) => ({ key: x.value, label: x.label, href: `/app/projects?status=${x.value}`, count: n(x.value) })),
        { key: "all", label: "All", href: "/app/projects?status=all", count: all.length },
      ]} />
      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState icon={Briefcase} title={all.length === 0 ? "No projects yet" : "Nothing in this view"} description={all.length === 0 ? "Create a project for each job: track the budget, timeline, tasks and site photos." : undefined}
            action={all.length === 0 ? <ButtonLink href="/app/projects/new">Create a project</ButtonLink> : undefined} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((p) => <ProjectCard key={p.id} project={p} customerName={p.customer_name} tasks={{ total: p.task_total ?? 0, done: p.task_done ?? 0 }} />)}
          </div>
        )}
      </div>
    </>
  );
}
