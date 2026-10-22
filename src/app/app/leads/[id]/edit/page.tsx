import { notFound } from "next/navigation";
import { updateLead } from "@/app/actions/crm";
import { LeadForm } from "@/components/crm/lead-form";
import { Card, PageHeader } from "@/components/ui";
import { fromDoc, isId } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { getServices } from "@/lib/queries";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Edit lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const lead = isId(id) ? fromDoc<Lead>(await tenant(s.business.id).doc("leads", id).get()) : null;
  if (!lead) notFound();
  const [services, team] = await Promise.all([getServices(), getTeam(s.business.id)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit lead" back={{ href: `/app/leads/${id}`, label: lead.name }} />
      <Card className="p-4"><LeadForm action={updateLead.bind(null, id)} lead={lead} services={services} team={team} submitLabel="Save changes" /></Card>
    </div>
  );
}
