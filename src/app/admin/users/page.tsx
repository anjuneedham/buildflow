import { Badge, DataTable, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { SuspendUser } from "../admin-client";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, account_type, is_suspended, created_at").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  return (
    <>
      <PageHeader title="Users" />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search by name" className="min-h-11 w-full rounded-lg border border-concrete-300 px-3" /></form>
      <DataTable rows={data ?? []} rowKey={(r) => r.id} columns={[
        { key: "name", header: "Name", cell: (r) => r.full_name || "(no name)" },
        { key: "type", header: "Type", cell: (r) => <Badge tone={r.account_type === "contractor" ? "orange" : "neutral"}>{r.account_type}</Badge> },
        { key: "status", header: "Status", cell: (r) => r.is_suspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge> },
        { key: "joined", header: "Joined", cell: (r) => formatDate(r.created_at), hideOnMobile: true },
        { key: "act", header: "", cell: (r) => <SuspendUser id={r.id} suspended={r.is_suspended} /> },
      ]} />
    </>
  );
}
