import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Mail, MapPin, Pencil, Phone, UserCheck, Wrench } from "lucide-react";
import { ActivityList } from "@/components/crm/activity-list";
import { Notes } from "@/components/crm/notes";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { LEAD_SOURCES, optionFor } from "@/lib/constants";
import { formatAmount, formatDate } from "@/lib/utils";
import type { ActivityRow, Lead, NoteRow } from "@/lib/types";
import { LeadActions, LeadStatus } from "./lead-actions";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const t = tenant(s.business.id);
  const lead = isId(id) ? fromDoc<Lead>(await t.doc("leads", id).get()) : null;
  if (!lead) notFound();
  const [notes, activity, projects, team] = await Promise.all([
    list<NoteRow>(t.col("notes").where("entity_id", "==", id).orderBy("created_at", "desc")),
    list<ActivityRow>(t.col("activity").where("entity_id", "==", id).orderBy("created_at", "desc").limit(20)),
    list<{ id: string; name: string }>(t.col("projects").where("lead_id", "==", id)),
    getTeam(s.business.id),
  ]);
  const assignee = team.find((m) => m.user_id === lead.assigned_to);

  return (
    <div className="space-y-4">
      <PageHeader title={lead.name} back={{ href: "/app/leads", label: "Leads" }}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="lead" value={lead.status} /><Badge tone={lead.source === "buildflow" ? "orange" : "neutral"}>via {optionFor(LEAD_SOURCES, lead.source)?.label}</Badge><span>Added {formatDate(lead.created_at)}</span></span>}
        actions={<ButtonLink href={`/app/leads/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>} />

      <div className="grid grid-cols-2 gap-2 sm:flex">
        {lead.phone && <ButtonLink href={`tel:${lead.phone}`} variant="dark"><Phone className="h-4 w-4" />Call</ButtonLink>}
        {lead.phone && <ButtonLink href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`} target="_blank" variant="outline">WhatsApp</ButtonLink>}
        {lead.email && <ButtonLink href={`mailto:${lead.email}`} variant="outline"><Mail className="h-4 w-4" />Email</ButtonLink>}
      </div>

      <Card><CardHeader title="Pipeline stage" /><CardBody><LeadStatus id={id} status={lead.status} /></CardBody></Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-3 text-sm">
              {lead.description && <p className="whitespace-pre-line text-ink-700">{lead.description}</p>}
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-ink-500">Estimated value</dt><dd className="text-lg font-extrabold">{formatAmount(lead.estimated_value)}</dd></div>
                <div><dt className="text-xs text-ink-500">Assigned to</dt><dd className="font-semibold">{assignee?.full_name ?? "Unassigned"}</dd></div>
                {lead.service_name && <div><dt className="text-xs text-ink-500">Service</dt><dd className="flex items-center gap-1 font-semibold"><Wrench className="h-3.5 w-3.5" />{lead.service_name}</dd></div>}
                {lead.location && <div><dt className="text-xs text-ink-500">Location</dt><dd className="flex items-center gap-1 font-semibold"><MapPin className="h-3.5 w-3.5" />{lead.location}</dd></div>}
                {lead.phone && <div><dt className="text-xs text-ink-500">Phone</dt><dd className="font-semibold">{lead.phone}</dd></div>}
                {lead.email && <div><dt className="text-xs text-ink-500">Email</dt><dd className="break-all font-semibold">{lead.email}</dd></div>}
              </dl>
            </CardBody>
          </Card>
          <Card><CardHeader title="Notes" /><CardBody><Notes entityType="lead" entityId={id} notes={notes} viewerId={s.user.id} /></CardBody></Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Next steps" />
            <CardBody className="space-y-2">
              {lead.customer_id && (
                <Link href={`/app/customers/${lead.customer_id}`} className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-site-green"><UserCheck className="h-4 w-4" />Customer: {lead.customer_name ?? lead.name}</Link>
              )}
              {projects.map((p) => (
                <Link key={p.id} href={`/app/projects/${p.id}`} className="flex items-center gap-2 rounded-lg bg-concrete-50 p-3 text-sm font-semibold"><Briefcase className="h-4 w-4" />{p.name}</Link>
              ))}
              <LeadActions id={id} hasCustomer={Boolean(lead.customer_id)} customerId={lead.customer_id ?? undefined} isOwner={s.isOwner} />
            </CardBody>
          </Card>
          <Card><CardHeader title="Activity" /><CardBody><ActivityList items={activity} /></CardBody></Card>
        </div>
      </div>
    </div>
  );
}
