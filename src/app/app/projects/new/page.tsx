import { createProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/crm/project-form";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customerId?: string; leadId?: string }> }) {
  const s = await requireBusiness();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: customers }, team, lead] = await Promise.all([
    supabase.from("customers").select("id, name").eq("business_id", s.business.id).order("name"),
    getTeam(s.business.id),
    sp.leadId ? supabase.from("leads").select("id, name, location, description, estimated_value, customer_id").eq("id", sp.leadId).eq("business_id", s.business.id).maybeSingle().then((r) => r.data) : null,
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New project" back={{ href: "/app/projects", label: "Projects" }} subtitle={lead ? `From lead: ${lead.name}` : undefined} />
      <Card className="p-4">
        <ProjectForm action={createProject} customers={customers ?? []} team={team} members={[s.user.id]} submitLabel="Create project"
          defaults={{ customerId: sp.customerId ?? lead?.customer_id ?? undefined, leadId: lead?.id, name: lead ? `${lead.name} project` : undefined, location: lead?.location ?? undefined, budget: lead?.estimated_value, description: lead?.description }} />
      </Card>
    </div>
  );
}
