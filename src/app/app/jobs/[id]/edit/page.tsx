import { notFound } from "next/navigation";
import { updateProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/crm/project-form";
import { Card, PageHeader } from "@/components/ui";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requirePermission } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { Project } from "@/lib/types";

export const metadata = { title: "Edit job" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePermission("projects.manage");
  if (!isId(id)) notFound();
  const t = tenant(s.business.id);
  const [project, customers, team] = await Promise.all([
    t.doc("projects", id).get().then((d) => fromDoc<Project>(d)),
    list<{ id: string; name: string }>(t.col("customers").orderBy("name_lower").select("name")),
    getTeam(s.business.id),
  ]);
  if (!project) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit job" back={{ href: `/app/jobs/${id}`, label: project.name }} />
      <Card className="p-4"><ProjectForm action={updateProject.bind(null, id)} project={project} customers={customers} team={team} members={project.member_ids ?? []} submitLabel="Save changes" /></Card>
    </div>
  );
}
