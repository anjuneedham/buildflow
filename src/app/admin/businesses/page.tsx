import Link from "next/link";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { list } from "@/lib/data/db";
import type { Business } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { BusinessFlags } from "../admin-client";

export const metadata = { title: "Businesses" };

export default async function AdminBusinesses() {
  const [rows, subs] = await Promise.all([
    list<Business>(db().collection("businesses").orderBy("created_at", "desc").limit(300)),
    list<{ id: string; status: string; seats: number }>(db().collection("subscriptions").limit(1000)),
  ]);
  const subBy = new Map(subs.map((x) => [x.id, x]));
  return (
    <>
      <PageHeader title="Businesses" />
      <DataTable rows={rows} rowKey={(r) => r.id} columns={[
        { key: "name", header: "Business", cell: (r) => <Link href={`/contractor/${r.slug}`} className="underline">{r.name}</Link> },
        { key: "city", header: "City", cell: (r) => r.city ?? "—", hideOnMobile: true },
        { key: "flags", header: "Flags", cell: (r) => <span className="flex flex-wrap gap-1">{r.is_verified && <Badge tone="blue">Verified</Badge>}{r.is_suspended && <Badge tone="red">Suspended</Badge>}{!r.is_public && <Badge>Private</Badge>}{r.is_demo && <Badge tone="yellow">Demo</Badge>}</span> },
        { key: "sub", header: "Plan", cell: (r) => { const x = subBy.get(r.id); return x ? `${x.status} · ${x.seats} seat${x.seats === 1 ? "" : "s"}` : "—"; } },
        { key: "created", header: "Created", cell: (r) => formatDate(r.created_at), hideOnMobile: true },
        { key: "act", header: "", cell: (r) => <BusinessFlags id={r.id} verified={r.is_verified} suspended={r.is_suspended} /> },
      ]} />
    </>
  );
}
