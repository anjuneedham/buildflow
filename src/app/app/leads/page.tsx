import { ClipboardList, Plus, Search } from "lucide-react";
import { LeadCard } from "@/components/cards/lead-card";
import { ButtonLink, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requirePermission } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { LEAD_STATUSES, OPEN_LEAD_STATUSES } from "@/lib/constants";
import { compactAmount } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const s = await requirePermission("crm");
  const { status = "open", q } = await searchParams;
  const [leads, team] = await Promise.all([
    list<Lead>(tenant(s.business.id).col("leads").orderBy("created_at", "desc").limit(500)),
    getTeam(s.business.id),
  ]);
  const names = new Map(team.map((m) => [m.user_id, m.full_name.split(" ")[0]]));
  const term = q?.trim().toLowerCase();
  const visible = leads
    .filter((l) => status === "all" || (status === "open" ? OPEN_LEAD_STATUSES.includes(l.status) : l.status === status))
    .filter((l) => !term || [l.name, l.phone, l.email, l.description, l.location].some((v) => v?.toLowerCase().includes(term)));
  const counts = Object.fromEntries(LEAD_STATUSES.map((x) => [x.value, leads.filter((l) => l.status === x.value).length]));
  const openValue = leads.filter((l) => OPEN_LEAD_STATUSES.includes(l.status)).reduce((n, l) => n + Number(l.estimated_value ?? 0), 0);
  const href = (st: string) => `/app/leads?status=${st}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader title="Leads" subtitle={`${compactAmount(openValue)} in open pipeline`} actions={<ButtonLink href="/app/leads/new"><Plus className="h-4 w-4" />Add lead</ButtonLink>} />
      <form className="relative mb-2" role="search">
        <input type="hidden" name="status" value={status} />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input name="q" defaultValue={q} placeholder="Search name, phone, job…" aria-label="Search leads" className="min-h-11 w-full rounded-lg border border-concrete-300 bg-white pl-9 pr-3 text-base" />
      </form>
      <Tabs active={status} tabs={[
        { key: "open", label: "Open", href: href("open"), count: OPEN_LEAD_STATUSES.reduce((n, st) => n + counts[st], 0) },
        ...LEAD_STATUSES.map((x) => ({ key: x.value, label: x.label, href: href(x.value), count: counts[x.value] })),
        { key: "all", label: "All", href: href("all"), count: leads.length },
      ]} />
      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState icon={ClipboardList} title={leads.length === 0 ? "No leads yet" : "No leads here"}
            description={leads.length === 0 ? "Quote requests from your public profile appear here automatically. Share your profile to get your first one, or add a lead you got by phone." : "Try another status or search."}
            action={leads.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={`/contractor/${s.business.slug}`}>Share your profile</ButtonLink>
                <ButtonLink href="/app/leads/new" variant="outline">Add a lead</ButtonLink>
              </div>
            ) : undefined} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{visible.map((l) => <LeadCard key={l.id} lead={l} assigneeName={l.assigned_to ? names.get(l.assigned_to) : undefined} />)}</div>
        )}
      </div>
    </>
  );
}
