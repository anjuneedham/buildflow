import { createProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/crm/project-form";
import { Card, PageHeader } from "@/components/ui";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import type { Lead } from "@/lib/types";
import { requirePermission } from "@/lib/session";
import { getTeam } from "@/lib/team";

export const metadata = { title: "New job" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customerId?: string; leadId?: string }> }) {
  const s = await requirePermission("projects.manage");
  const sp = await searchParams;
  const t = tenant(s.business.id);
  const [customers, team, lead] = await Promise.all([
    list<{ id: string; name: string }>(t.col("customers").orderBy("name_lower").select("name").limit(1000)),
    getTeam(s.business.id),
    isId(sp.leadId) ? t.doc("leads", sp.leadId).get().then((d) => fromDoc<Lead>(d)) : null,
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New job" back={{ href: "/app/jobs", label: "Jobs" }} subtitle={lead ? `Starting a job for ${lead.name}. The enquiry will be marked won.` : undefined} />
      <Card className="p-4">
        <ProjectForm action={createProject} customers={customers} team={team} members={[s.user.id]} submitLabel="Create job"
          defaults={{ responsibleId: lead?.assigned_to ?? s.user.id, customerId: sp.customerId ?? lead?.customer_id ?? undefined, leadId: lead?.id, name: lead ? `${lead.service_name ?? "Job"} for ${lead.name}` : undefined, location: lead?.location ?? undefined, budget: lead?.estimated_value, description: lead?.description }} />
      </Card>
    </div>
  );
}
