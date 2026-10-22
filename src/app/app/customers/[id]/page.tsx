import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { ProjectCard } from "@/components/cards/project-card";
import { Notes } from "@/components/crm/notes";
import { ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { formatAmount, formatDate } from "@/lib/utils";
import type { Customer, Lead, NoteRow, Project } from "@/lib/types";
import { DeleteCustomer } from "./delete-customer";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ converted?: string }> }) {
  const { id } = await params;
  const { converted } = await searchParams;
  const s = await requireBusiness();
  const t = tenant(s.business.id);
  const c = isId(id) ? fromDoc<Customer>(await t.doc("customers", id).get()) : null;
  if (!c) notFound();
  const [projects, leads, notes] = await Promise.all([
    list<Project>(t.col("projects").where("customer_id", "==", id).orderBy("created_at", "desc")),
    list<Lead>(t.col("leads").where("customer_id", "==", id).orderBy("created_at", "desc")),
    list<NoteRow>(t.col("notes").where("entity_id", "==", id).orderBy("created_at", "desc")),
  ]);
  const totalValue = projects.reduce((n, p) => n + Number(p.budget ?? 0), 0);

  return (
    <div className="space-y-4">
      {converted && <FormSuccess message="Lead converted to a customer. Create a project when you're ready to start." />}
      <PageHeader title={c.name} back={{ href: "/app/customers", label: "Customers" }}
        subtitle={<span className="flex items-center gap-2"><StatusBadge kind="customer" value={c.status} />Customer since {formatDate(c.created_at)}</span>}
        actions={<>
          <ButtonLink href={`/app/customers/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>
          {s.isOwner && <DeleteCustomer id={id} />}
        </>} />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {c.phone && <ButtonLink href={`tel:${c.phone}`} variant="dark"><Phone className="h-4 w-4" />Call</ButtonLink>}
        {c.email && <ButtonLink href={`mailto:${c.email}`} variant="outline"><Mail className="h-4 w-4" />Email</ButtonLink>}
        <ButtonLink href={`/app/projects/new?customerId=${id}`} className="col-span-2 sm:col-auto"><Plus className="h-4 w-4" />New project</ButtonLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 font-bold">Projects <span className="font-normal text-ink-500">· {formatAmount(totalValue)} total</span></h2>
            {projects.length === 0 ? (
              <Card className="p-4 text-sm text-ink-500">No projects yet for this customer.</Card>
            ) : <div className="grid gap-3 sm:grid-cols-2">{projects.map((p) => <ProjectCard key={p.id} project={p} />)}</div>}
          </section>
          <Card><CardHeader title="Notes" /><CardBody><Notes entityType="customer" entityId={id} notes={notes} viewerId={s.user.id} /></CardBody></Card>
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
          <Card>
            <CardHeader title="Lead history" />
            <CardBody>
              {leads.length === 0 ? <p className="text-sm text-ink-500">Added directly, not from a lead.</p> : (
                <ul className="space-y-2">
                  {leads.map((l) => (
                    <li key={l.id}><Link href={`/app/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-concrete-50 p-2.5 text-sm hover:bg-concrete-100">
                      <span><Briefcase className="mr-1 inline h-3.5 w-3.5" />{formatDate(l.created_at)} · {formatAmount(l.estimated_value)}</span><StatusBadge kind="lead" value={l.status} />
                    </Link></li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
