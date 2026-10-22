import { Plus, Search, Users } from "lucide-react";
import { ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { Customer } from "@/lib/types";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireBusiness();
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("customers").select("*, projects(count)").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(300);
  const term = q?.replace(/[%_,()]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,city.ilike.%${term}%`);
  const { data } = await query;
  const rows = (data ?? []) as (Customer & { projects: { count: number }[] })[];

  return (
    <>
      <PageHeader title="Customers" subtitle={`${rows.length}${term ? " matching" : ""} customer${rows.length === 1 ? "" : "s"}`} actions={<ButtonLink href="/app/customers/new"><Plus className="h-4 w-4" />Add customer</ButtonLink>} />
      <form className="relative mb-4" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input name="q" defaultValue={q} placeholder="Search name, phone, email, area…" aria-label="Search customers" className="min-h-11 w-full rounded-lg border border-concrete-300 bg-white pl-9 pr-3 text-base" />
      </form>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/app/customers/${r.id}`}
        empty={<EmptyState icon={Users} title={term ? "No matches" : "No customers yet"} description={term ? "Try a different search." : "Add customers yourself, or convert a lead when you win the job."} action={!term ? <ButtonLink href="/app/customers/new">Add a customer</ButtonLink> : undefined} />}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
          { key: "city", header: "Area", cell: (r) => r.city ?? "—", hideOnMobile: true },
          { key: "projects", header: "Projects", cell: (r) => `${r.projects?.[0]?.count ?? 0} project${r.projects?.[0]?.count === 1 ? "" : "s"}` },
          { key: "status", header: "Status", cell: (r) => <StatusBadge kind="customer" value={r.status} /> },
          { key: "created", header: "Added", cell: (r) => formatDate(r.created_at), hideOnMobile: true },
        ]}
      />
    </>
  );
}
