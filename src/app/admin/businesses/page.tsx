import Link from "next/link";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { BusinessFlags } from "../admin-client";

export const metadata = { title: "Businesses" };

export default async function AdminBusinesses() {
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("id, name, slug, city, is_verified, is_suspended, is_public, is_demo, created_at, post_count, subscription:subscriptions(status, seats)").order("created_at", { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title="Businesses" />
      <DataTable rows={data ?? []} rowKey={(r) => r.id} columns={[
        { key: "name", header: "Business", cell: (r) => <Link href={`/contractor/${r.slug}`} className="underline">{r.name}</Link> },
        { key: "city", header: "City", cell: (r) => r.city ?? "—", hideOnMobile: true },
        { key: "flags", header: "Flags", cell: (r) => <span className="flex flex-wrap gap-1">{r.is_verified && <Badge tone="blue">Verified</Badge>}{r.is_suspended && <Badge tone="red">Suspended</Badge>}{!r.is_public && <Badge>Private</Badge>}{r.is_demo && <Badge tone="yellow">Demo</Badge>}</span> },
        { key: "sub", header: "Plan", cell: (r) => { const sub = (r.subscription as unknown as { status: string; seats: number }[] | { status: string; seats: number } | null); const x = Array.isArray(sub) ? sub[0] : sub; return x ? `${x.status} · ${x.seats} seat${x.seats === 1 ? "" : "s"}` : "—"; } },
        { key: "created", header: "Created", cell: (r) => formatDate(r.created_at), hideOnMobile: true },
        { key: "act", header: "", cell: (r) => <BusinessFlags id={r.id} verified={r.is_verified} suspended={r.is_suspended} /> },
      ]} />
    </>
  );
}
