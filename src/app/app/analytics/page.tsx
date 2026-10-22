import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { LEAD_SOURCES } from "@/lib/constants";

export const metadata = { title: "Analytics" };

const METRICS = [
  { key: "profile_view", label: "Profile views" },
  { key: "post_view", label: "Post views" },
  { key: "quote_request", label: "Quote requests" },
  { key: "contact_click", label: "Contact messages" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "follow", label: "New followers" },
  { key: "save", label: "Saves" },
  { key: "lead_created", label: "Leads created" },
  { key: "project_won", label: "Leads won" },
  { key: "project_completed", label: "Projects completed" },
] as const;

export default async function AnalyticsPage() {
  const s = await requireBusiness();
  const supabase = await createClient();
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [{ data: events }, { data: leads }] = await Promise.all([
    supabase.from("analytics_events").select("event_type, created_at").eq("business_id", s.business.id).gte("created_at", lastMonth.toISOString()).limit(50000),
    supabase.from("leads").select("source, status").eq("business_id", s.business.id).limit(5000),
  ]);
  const ev = events ?? [];
  const count = (type: string, from: Date, to?: Date) => ev.filter((e) => e.event_type === type && new Date(e.created_at) >= from && (!to || new Date(e.created_at) < to)).length;
  const quotes = count("quote_request", thisMonth);
  const sources = LEAD_SOURCES.map((src) => {
    const rows = (leads ?? []).filter((l) => l.source === src.value);
    return { ...src, total: rows.length, won: rows.filter((l) => l.status === "won").length };
  }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  const maxSource = Math.max(1, ...sources.map((x) => x.total));
  const monthName = now.toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle={`${monthName} so far, compared with last month`} />
      <Card className="bg-ink p-5 text-white">
        <p className="text-lg">Your profile generated <b className="text-2xl text-safety-400">{quotes}</b> quote request{quotes === 1 ? "" : "s"} this month.</p>
        <p className="mt-1 text-sm text-concrete-300">From {count("profile_view", thisMonth)} profile views. Posting finished work regularly is the best way to grow this.</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRICS.map((m) => {
          const cur = count(m.key, thisMonth);
          const prev = count(m.key, lastMonth, thisMonth);
          const diff = cur - prev;
          return (
            <div key={m.key} className="rounded-xl border border-concrete-200 bg-white p-3">
              <p className="text-xs text-ink-500">{m.label}</p>
              <p className="mt-1 text-2xl font-extrabold">{cur}</p>
              <p className={`text-xs font-semibold ${diff > 0 ? "text-site-green" : diff < 0 ? "text-site-red" : "text-ink-500"}`}>{diff > 0 ? "▲" : diff < 0 ? "▼" : "–"} {Math.abs(diff)} vs last month</p>
            </div>
          );
        })}
        <div className="rounded-xl border border-concrete-200 bg-white p-3">
          <p className="text-xs text-ink-500">Total followers</p>
          <p className="mt-1 text-2xl font-extrabold">{s.business.follower_count}</p>
        </div>
      </div>
      <Card>
        <CardHeader title="Where your leads come from" subtitle="All time" />
        <CardBody>
          {sources.length === 0 ? <p className="text-sm text-ink-500">No leads yet.</p> : (
            <ul className="space-y-3">
              {sources.map((x) => (
                <li key={x.value}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{x.label}</span><span className="text-ink-500">{x.total} lead{x.total === 1 ? "" : "s"} · {x.won} won</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-concrete-100" role="img" aria-label={`${x.label}: ${x.total} leads, ${x.won} won`}>
                    <div className="relative h-full rounded-full bg-concrete-300" style={{ width: `${(x.total / maxSource) * 100}%` }}>
                      <div className="absolute inset-y-0 left-0 rounded-full bg-safety-500" style={{ width: `${x.total ? (x.won / x.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                </li>
              ))}
              <li className="flex gap-4 pt-1 text-xs text-ink-500"><span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-safety-500" />Won</span><span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-concrete-300" />All leads</span></li>
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
