import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { startOfMonthISO } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const supabase = await createClient();
  const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const month = startOfMonthISO();
  const [users, contractors, businesses, newBiz, posts, quotes, openReports, trialing, active] = await Promise.all([
    c(supabase.from("profiles").select("id", { count: "exact", head: true })),
    c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "contractor")),
    c(supabase.from("businesses").select("id", { count: "exact", head: true })),
    c(supabase.from("businesses").select("id", { count: "exact", head: true }).gte("created_at", month)),
    c(supabase.from("posts").select("id", { count: "exact", head: true })),
    c(supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "quote_request").gte("created_at", month)),
    c(supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    c(supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trialing")),
    c(supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active")),
  ]);
  const tiles = [
    ["Users", users, "/admin/users"], ["Contractor accounts", contractors, "/admin/users"], ["Businesses", businesses, "/admin/businesses"],
    ["New businesses (month)", newBiz, "/admin/businesses"], ["Posts", posts, null], ["Quote requests (month)", quotes, null],
    ["Open reports", openReports, "/admin/reports"], ["Trialing", trialing, null], ["Paying", active, null],
  ] as const;
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(([label, value, href]) => {
          const inner = <Card className="p-4"><p className="text-sm text-ink-500">{label}</p><p className="mt-1 text-3xl font-extrabold">{value}</p></Card>;
          return href ? <Link key={label} href={href}>{inner}</Link> : <div key={label}>{inner}</div>;
        })}
      </div>
    </>
  );
}
