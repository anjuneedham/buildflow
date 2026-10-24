import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, ChevronRight, Mail, MapPin, MessageCircle, Pencil, Phone, User, Wrench } from "lucide-react";
import { Timeline } from "@/components/workflow/timeline";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requirePermission } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { LEAD_SOURCES, OPEN_LEAD_STATUSES, optionFor } from "@/lib/constants";
import { dateInDays, formatAmount, formatDate, whatsappLink } from "@/lib/utils";
import type { ActivityRow, Customer, Lead, Project } from "@/lib/types";
import { FollowUp, LeadActions, LeadStatus } from "./lead-actions";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePermission("crm");
  const t = tenant(s.business.id);
  const lead = isId(id) ? fromDoc<Lead>(await t.doc("leads", id).get()) : null;
  if (!lead) notFound();
  const [customer, job, activity, team] = await Promise.all([
    lead.customer_id ? t.doc("customers", lead.customer_id).get().then((d) => fromDoc<Customer>(d)) : null,
    lead.project_id ? t.doc("projects", lead.project_id).get().then((d) => fromDoc<Project>(d)) : null,
    list<ActivityRow>(t.col("activity").where("lead_id", "==", id).orderBy("created_at", "desc").limit(50)),
    getTeam(s.business.id),
  ]);
  const responsible = team.find((m) => m.user_id === lead.assigned_to);
  const isOpen = OPEN_LEAD_STATUSES.includes(lead.status);
  const today = dateInDays(0);
  const wa = whatsappLink(lead.phone, `Hi ${lead.name.split(" ")[0]}, this is ${s.business.name} about your enquiry.`);

  return (
    <div className="space-y-4">
      <PageHeader title={lead.name} back={{ href: "/app/leads", label: "Leads" }}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="lead" value={lead.status} /><Badge tone={lead.source === "buildflow" ? "orange" : "neutral"}>via {optionFor(LEAD_SOURCES, lead.source)?.label}</Badge><span>Added {formatDate(lead.created_at)}</span></span>}
        actions={<ButtonLink href={`/app/leads/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>} />

      <div className="grid grid-cols-2 gap-2 sm:flex">
        {wa && <ButtonLink href={wa} target="_blank" variant="dark"><MessageCircle className="h-4 w-4" />WhatsApp</ButtonLink>}
        {lead.phone && <ButtonLink href={`tel:${lead.phone}`} variant={wa ? "outline" : "dark"}><Phone className="h-4 w-4" />Call</ButtonLink>}
        {lead.email && <ButtonLink href={`mailto:${lead.email}`} variant="outline"><Mail className="h-4 w-4" />Email</ButtonLink>}
      </div>

      {/* What happens next: the job if it started, otherwise the follow-up and Start job. */}
      {job ? (
        <Link href={`/app/jobs/${job.id}`} className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 hover:border-site-green">
          <Briefcase className="h-5 w-5 shrink-0 text-site-green" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink-500">Job started</span><span className="block truncate font-bold">{job.name}</span></span>
          <StatusBadge kind="project" value={job.status} /><ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
        </Link>
      ) : (
        <Card>
          <CardHeader title="Next step" subtitle={isOpen ? "Set a reminder to follow up, or start the job when it's agreed." : undefined} />
          <CardBody className="space-y-4">
            <FollowUp id={id} value={lead.next_follow_up ?? null} today={today} disabled={!isOpen} />
            <LeadActions id={id} hasCustomer={Boolean(lead.customer_id)} projectId={lead.project_id ?? null} canDelete={s.can("records.delete")} isOpen={isOpen} />
          </CardBody>
        </Card>
      )}

      <Card><CardHeader title="Stage" /><CardBody><LeadStatus id={id} status={lead.status} hasJob={Boolean(job)} />
        {lead.status === "lost" && lead.lost_reason && <p className="mt-2 text-sm text-ink-500">Reason: {lead.lost_reason}</p>}
      </CardBody></Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card>
            <CardHeader title="What they need" />
            <CardBody className="space-y-3 text-sm">
              {lead.description ? <p className="whitespace-pre-line text-ink-700">{lead.description}</p> : <p className="text-ink-500">No details yet. Add them with Edit, or as a note after you talk.</p>}
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-ink-500">Estimated value</dt><dd className="text-lg font-extrabold">{formatAmount(lead.estimated_value)}</dd></div>
                {lead.service_name && <div><dt className="text-xs text-ink-500">Service</dt><dd className="flex items-center gap-1 font-semibold"><Wrench className="h-3.5 w-3.5" />{lead.service_name}</dd></div>}
                {lead.location && <div><dt className="text-xs text-ink-500">Location</dt><dd className="flex items-center gap-1 font-semibold"><MapPin className="h-3.5 w-3.5" />{lead.location}</dd></div>}
                {lead.quote?.timeline && <div><dt className="text-xs text-ink-500">Timeline</dt><dd className="font-semibold">{lead.quote.timeline}</dd></div>}
              </dl>
            </CardBody>
          </Card>
          <Card><CardHeader title="History" /><CardBody><Timeline entityType="lead" entityId={id} items={activity} viewerId={s.user.id} canDeleteAny={s.can("records.delete")} /></CardBody></Card>
        </div>
        {/* On phones, who the customer is and who's responsible come before the details. */}
        <div className="order-first space-y-4 lg:order-none">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-2 text-sm">
              {customer ? (
                <Link href={`/app/customers/${customer.id}`} className="flex items-center gap-3 rounded-lg bg-concrete-50 p-3 hover:bg-concrete-100">
                  <User className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{customer.name}</span><span className="block truncate text-xs text-ink-500">{customer.phone ?? customer.email ?? "No contact details"}</span></span>
                  <StatusBadge kind="customer" value={customer.status} />
                </Link>
              ) : <p className="text-ink-500">Not saved as a customer yet.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Responsible" action={<Link href={`/app/leads/${id}/edit`} className="text-sm font-semibold text-safety-700">Change</Link>} />
            <CardBody className="text-sm">{responsible ? <span className="font-semibold">{responsible.full_name}</span> : <span className="text-ink-500">Nobody yet. Assign someone so it doesn&apos;t slip.</span>}</CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
