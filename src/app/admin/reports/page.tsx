import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { list } from "@/lib/data/db";
import { REPORT_REASONS, optionFor } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { ReportActions } from "../admin-client";
import { firstParams } from "@/lib/params";

export const metadata = { title: "Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = firstParams(await searchParams);
  const data = await list<{ id: string; target_type: string; target_id: string; target_path: string | null; reason: string; details: string | null; reporter_name: string | null; created_at: string }>(
    db().collection("reports").where("status", "==", ["open", "actioned", "dismissed"].includes(status) ? status : "open").orderBy("created_at", "desc").limit(100));
  const link = (t: string, id: string, path: string | null) => (t === "post" ? `/post/${id}` : t === "comment" && path ? `/post/${path.split("/")[1]}#comments` : null);
  return (
    <>
      <PageHeader title="Reported content" />
      <Tabs className="mb-4" active={status} tabs={["open", "actioned", "dismissed"].map((x) => ({ key: x, label: x[0].toUpperCase() + x.slice(1), href: `/admin/reports?status=${x}` }))} />
      {data.length === 0 ? <EmptyState icon={Flag} title="Nothing here" /> : (
        <div className="space-y-3">
          {data.map((r) => {
            const href = link(r.target_type, r.target_id, r.target_path);
            return (
              <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="flex flex-wrap items-center gap-2"><Badge tone="red">{optionFor(REPORT_REASONS, r.reason)?.label}</Badge><Badge>{r.target_type}</Badge><span className="text-ink-500">{timeAgo(r.created_at)} by {r.reporter_name || "a user"}</span></p>
                  {r.details && <p className="mt-1 text-ink-600">{r.details}</p>}
                  <p className="mt-1 font-mono text-xs text-ink-500">{href ? <Link href={href} className="underline">{r.target_id}</Link> : r.target_id}</p>
                </div>
                {status === "open" && <ReportActions id={r.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
