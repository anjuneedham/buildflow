import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { REPORT_REASONS, optionFor } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { ReportActions } from "../admin-client";

export const metadata = { title: "Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(full_name)").eq("status", status).order("created_at", { ascending: false }).limit(100);
  const link = (t: string, id: string) => (t === "post" ? `/post/${id}` : t === "business" ? null : null);
  return (
    <>
      <PageHeader title="Reported content" />
      <Tabs className="mb-4" active={status} tabs={["open", "actioned", "dismissed"].map((x) => ({ key: x, label: x[0].toUpperCase() + x.slice(1), href: `/admin/reports?status=${x}` }))} />
      {(data ?? []).length === 0 ? <EmptyState icon={Flag} title="Nothing here" /> : (
        <div className="space-y-3">
          {(data ?? []).map((r) => {
            const href = link(r.target_type, r.target_id);
            return (
              <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="flex flex-wrap items-center gap-2"><Badge tone="red">{optionFor(REPORT_REASONS, r.reason)?.label}</Badge><Badge>{r.target_type}</Badge><span className="text-ink-500">{timeAgo(r.created_at)} by {(r.reporter as { full_name: string } | null)?.full_name || "a user"}</span></p>
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
