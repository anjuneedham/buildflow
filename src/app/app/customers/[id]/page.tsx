import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight, ClipboardList, Mail, MapPin, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { ProjectCard } from "@/components/cards/project-card";
import { Timeline } from "@/components/workflow/timeline";
import { ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requirePermission } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import { dateInDays, formatAmount, formatDate, relativeDay, whatsappLink } from "@/lib/utils";
import type { ActivityRow, Customer, Lead, Project } from "@/lib/types";
import { DeleteCustomer } from "./delete-customer";
import { firstParams } from "@/lib/params";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ converted?: string }> }) {
  const { id } = await params;
  const { converted } = firstParams(await searchParams);
  const s = await requirePermission("crm");
  const t = tenant(s.business.id);
  const c = isId(id) ? fromDoc<Customer>(await t.doc("customers", id).get()) : null;
  if (!c) notFound();
  const [projects, leads, activity, team] = await Promise.all([
    list<Project>(t.col("projects").where("customer_id", "==", id).orderBy("created_at", "desc").limit(50)),
    list<Lead>(t.col("leads").where("customer_id", "==", id).orderBy("created_at", "desc").limit(50)),
    list<ActivityRow>(t.col("activity").where("customer_id", "==", id).orderBy("created_at", "desc").limit(60)),
    getTeam(s.business.id),
  ]);
  const today = dateInDays(0);
  const names = Object.fromEntries(team.map((m) => [m.user_id, m.full_name]));
  const openLeads = leads.filter((l) => OPEN_LEAD_STATUSES.includes(l.status));
  const totalValue = projects.reduce((n, p) => n + Number(p.budget ?? 0), 0);
  const labels = Object.fromEntries([...projects.map((p) => [p.id, p.name]), ...leads.map((l) => [l.id, l.service_name ? `${l.service_name} enquiry` : "enquiry"])]);
  const wa = whatsappLink(c.phone);

  return (
    <div className="space-y-4">
      {converted && <FormSuccess message="Saved as a customer. Start a job when you're ready." />}
      <PageHeader title={c.name} back={{ href: "/app/customers", label: "Customers" }}
        subtitle={<span className="flex items-center gap-2"><StatusBadge kind="customer" value={c.status} />Customer since {formatDate(c.created_at)}</span>}
        actions={<>
          <ButtonLink href={`/app/customers/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>
          {s.can("records.delete") && <DeleteCustomer id={id} />}
        </>} />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {wa && <ButtonLink href={wa} target="_blank" variant="dark"><MessageCircle className="h-4 w-4" />WhatsApp</ButtonLink>}
        {c.phone && <ButtonLink href={`tel:${c.phone}`} variant={wa ? "outline" : "dark"}><Phone className="h-4 w-4" />Call</ButtonLink>}
        {c.email && <ButtonLink href={`mailto:${c.email}`} variant="outline"><Mail className="h-4 w-4" />Email</ButtonLink>}
        {s.can("projects.manage") && <ButtonLink href={`/app/jobs/new?customerId=${id}`} className="col-span-2 sm:col-auto"><Plus className="h-4 w-4" />New job</ButtonLink>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <div className="space-y-4">
          {openLeads.length > 0 && (
            <section aria-labelledby="open-leads">
              <h2 id="open-leads" className="mb-2 font-bold">Open enquiries</h2>
              <ul className="space-y-2">
                {openLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/app/leads/${l.id}`} className="flex items-center gap-3 rounded-xl border border-concrete-200 bg-white p-3 hover:border-concrete-300">
                      <ClipboardList className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{l.description?.split("\n")[0] || l.service_name || "Enquiry"}</span>
                        <span className="block text-xs text-ink-500">{formatAmount(l.estimated_value)} · {l.assigned_to ? names[l.assigned_to] ?? "Team member" : "Nobody responsible yet"}
                          {l.next_follow_up && <span className={l.next_follow_up < today ? "font-bold text-site-red" : ""}> · <CalendarClock className="inline h-3 w-3" aria-hidden /> {relativeDay(l.next_follow_up, today)}</span>}
                        </span>
                      </span>
                      <StatusBadge kind="lead" value={l.status} /><ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="jobs">
            <h2 id="jobs" className="mb-2 font-bold">Jobs <span className="font-normal text-ink-500">· {formatAmount(totalValue)} total</span></h2>
            {projects.length === 0 ? (
              <Card className="p-4 text-sm text-ink-500">No jobs yet. {openLeads.length ? "Start one from the enquiry when it's agreed." : ""}</Card>
            ) : <div className="grid gap-3 sm:grid-cols-2">{projects.map((p) => <ProjectCard key={p.id} project={p} names={names} today={today} showCustomer={false} />)}</div>}
          </section>
          <Card><CardHeader title="History" subtitle="Everything with this customer, across enquiries and jobs" /><CardBody>
            <Timeline entityType="customer" entityId={id} items={activity} viewerId={s.user.id} canDeleteAny={s.can("records.delete")} labels={labels} />
          </CardBody></Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-2 text-sm">
              {c.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-500" />{c.phone}</p>}
              {c.email && <p className="flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0 text-ink-500" />{c.email}</p>}
              {(c.address || c.city) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-500" />{[c.address, c.city].filter(Boolean).join(", ")}</p>}
              {c.notes && <p className="whitespace-pre-line rounded-lg bg-concrete-50 p-3 text-ink-600">{c.notes}</p>}
              {!c.phone && !c.email && !c.address && <p className="text-ink-500">No contact details yet.</p>}
            </CardBody>
          </Card>
          {leads.length > openLeads.length && (
            <Card>
              <CardHeader title="Past enquiries" />
              <CardBody>
                <ul className="space-y-2">
                  {leads.filter((l) => !OPEN_LEAD_STATUSES.includes(l.status)).map((l) => (
                    <li key={l.id}><Link href={`/app/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-concrete-50 p-2.5 text-sm hover:bg-concrete-100">
                      <span>{formatDate(l.created_at)} · {formatAmount(l.estimated_value)}</span><StatusBadge kind="lead" value={l.status} />
                    </Link></li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
