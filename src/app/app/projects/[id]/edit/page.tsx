import { notFound } from "next/navigation";
import { updateProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/crm/project-form";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { Project } from "@/lib/types";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const supabase = await createClient();
  const [{ data: project }, { data: customers }, { data: members }, team] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).eq("business_id", s.business.id).maybeSingle(),
    supabase.from("customers").select("id, name").eq("business_id", s.business.id).order("name"),
    supabase.from("project_members").select("user_id").eq("project_id", id),
    getTeam(s.business.id),
  ]);
  if (!project) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit project" back={{ href: `/app/projects/${id}`, label: project.name }} />
      <Card className="p-4"><ProjectForm action={updateProject.bind(null, id)} project={project as Project} customers={customers ?? []} team={team} members={(members ?? []).map((m) => m.user_id)} submitLabel="Save changes" /></Card>
    </div>
  );
}
