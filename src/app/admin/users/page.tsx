import { Badge, DataTable, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { list } from "@/lib/data/db";
import type { Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { SuspendUser } from "../admin-client";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const all = await list<Profile>(db().collection("users").orderBy("created_at", "desc").limit(500));
  const term = q?.toLowerCase().trim();
  const data = all.filter((u) => !term || u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
  return (
    <>
      <PageHeader title="Users" />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search by name or email" className="min-h-11 w-full rounded-lg border border-concrete-300 px-3" /></form>
      <DataTable rows={data} rowKey={(r) => r.id} columns={[
        { key: "name", header: "Name", cell: (r) => <span>{r.full_name || "(no name)"}<span className="block text-xs font-normal text-ink-500">{r.email}</span></span> },
        { key: "type", header: "Type", cell: (r) => <Badge tone={r.account_type === "contractor" ? "orange" : "neutral"}>{r.account_type}</Badge> },
        { key: "status", header: "Status", cell: (r) => r.is_suspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge> },
        { key: "joined", header: "Joined", cell: (r) => formatDate(r.created_at ?? null), hideOnMobile: true },
        { key: "act", header: "", cell: (r) => <SuspendUser id={r.id} suspended={Boolean(r.is_suspended)} /> },
      ]} />
    </>
  );
}
