import { createLead } from "@/app/actions/crm";
import { LeadForm } from "@/components/crm/lead-form";
import { Card, PageHeader } from "@/components/ui";
import { getServices } from "@/lib/queries";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const s = await requireBusiness();
  const [services, team] = await Promise.all([getServices(), getTeam(s.business.id)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add lead" back={{ href: "/app/leads", label: "Leads" }} />
      <Card className="p-4"><LeadForm action={createLead} services={services} team={team} submitLabel="Save lead" /></Card>
    </div>
  );
}
