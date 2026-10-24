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
    list<{ id: string; name: string }>(t.col("customers").orderBy("name_lower").select("name")),
    getTeam(s.business.id),
    isId(sp.leadId) ? t.doc("leads", sp.leadId).get().then((d) => fromDoc<Lead>(d)) : null,
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New job" back={{ href: "/app/jobs", label: "Jobs" }} subtitle={lead ? `From lead: ${lead.name}` : undefined} />
      <Card className="p-4">
        <ProjectForm action={createProject} customers={customers} team={team} members={[s.user.id]} submitLabel="Create job"
          defaults={{ customerId: sp.customerId ?? lead?.customer_id ?? undefined, leadId: lead?.id, name: lead ? `${lead.name} job` : undefined, location: lead?.location ?? undefined, budget: lead?.estimated_value, description: lead?.description }} />
      </Card>
    </div>
  );
}
