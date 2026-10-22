import Link from "next/link";
import { ArrowRight, Briefcase, Camera, CheckCircle2, ClipboardList, Eye, FileText, Heart, Plus, Users } from "lucide-react";
import { ButtonLink, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { ACTIVE_PROJECT_STATUSES, OPEN_LEAD_STATUSES } from "@/lib/constants";
import { compactAmount, formatDate, startOfMonthISO, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await requireBusiness();
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const bid = s.business.id;
  const month = startOfMonthISO();
  const weekAhead = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [newLeads, activeProjects, completedProjects, customers, openLeads, tasksDue, activity, events] = await Promise.all([
    count(supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "new")),
    count(supabase.from("projects").select("id", { count: "exact", head: true }).eq("business_id", bid).in("status", ACTIVE_PROJECT_STATUSES)),
    count(supabase.from("projects").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "completed")),
    count(supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", bid)),
    supabase.from("leads").select("estimated_value").eq("business_id", bid).in("status", OPEN_LEAD_STATUSES).then((r) => r.data ?? []),
    supabase.from("tasks").select("id, title, due_date, priority, status, project:projects(id, name)").eq("business_id", bid).neq("status", "done")
      .not("due_date", "is", null).lte("due_date", weekAhead).order("due_date").limit(6).then((r) => r.data ?? []),
    supabase.from("activity_logs").select("id, summary, created_at, entity_type, entity_id").eq("business_id", bid).order("created_at", { ascending: false }).limit(8).then((r) => r.data ?? []),
    supabase.from("analytics_events").select("event_type").eq("business_id", bid).gte("created_at", month).in("event_type", ["profile_view", "quote_request", "like", "comment", "follow"]).limit(10000).then((r) => r.data ?? []),
  ]);
  const pipeline = openLeads.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);
  const ev = (t: string) => events.filter((e) => e.event_type === t).length;
  const engagement = ev("like") + ev("comment") + ev("follow");
  const isNew = newLeads + activeProjects + completedProjects + customers === 0;
  const today = new Date().toISOString().slice(0, 10);

  const stats = [
    { label: "New leads", value: newLeads, href: "/app/leads?status=new", icon: ClipboardList, accent: newLeads > 0 },
    { label: "Active projects", value: activeProjects, href: "/app/projects", icon: Briefcase },
    { label: "Completed", value: completedProjects, href: "/app/projects?status=completed", icon: CheckCircle2 },
    { label: "Customers", value: customers, href: "/app/customers", icon: Users },
  ];

  return (
    <div className="space-y-5">
      {welcome && <FormSuccess message="Welcome to BuildFlow! Your profile is live. Post your best work to start getting discovered." />}
      <div>
        <p className="text-sm font-semibold text-ink-500">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">How&apos;s business{s.profile?.full_name ? `, ${s.profile.full_name.split(" ")[0]}` : ""}?</h1>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {[["/app/leads/new", "Add lead"], ["/app/customers/new", "Add customer"], ["/app/projects/new", "New project"], ["/app/posts/new", "Create post"]].map(([href, label]) => (
          <ButtonLink key={href} href={href} variant={href === "/app/posts/new" ? "primary" : "outline"} className="shrink-0"><Plus className="h-4 w-4" />{label}</ButtonLink>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((x) => (
          <Link key={x.label} href={x.href} className={`rounded-xl border p-4 shadow-card transition-colors ${x.accent ? "border-safety-400 bg-safety-50" : "border-concrete-200 bg-white hover:border-concrete-300"}`}>
            <x.icon className={`h-5 w-5 ${x.accent ? "text-safety-600" : "text-ink-500"}`} aria-hidden />
            <p className="mt-2 text-3xl font-extrabold">{x.value}</p>
            <p className="text-sm text-ink-500">{x.label}</p>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-4 bg-ink p-4 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-concrete-300">Open pipeline value</p>
          <p className="text-3xl font-extrabold text-safety-400">{compactAmount(pipeline)}</p>
          <p className="text-xs text-concrete-400">{openLeads.length} open lead{openLeads.length === 1 ? "" : "s"} with estimates</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center md:gap-8">
          <div><Eye className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{ev("profile_view")}</p><p className="text-[11px] text-concrete-400">Profile views</p></div>
          <div><FileText className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{ev("quote_request")}</p><p className="text-[11px] text-concrete-400">Quote requests</p></div>
          <div><Heart className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{engagement}</p><p className="text-[11px] text-concrete-400">Engagement</p></div>
        </div>
      </Card>
      <p className="-mt-2 text-xs text-ink-500">Views, quotes and engagement are for this month. <Link href="/app/analytics" className="font-semibold text-safety-700 hover:underline">See analytics →</Link></p>

      {isNew ? (
        <Card className="p-5">
          <h2 className="text-lg font-bold">Get your first lead</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/posts/new" className="font-semibold underline">Post a finished job</Link>: customers find you through your work.</span></li>
            <li className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-safety-500" /><span>Share your profile link on WhatsApp and social: <Link href={`/contractor/${s.business.slug}`} className="font-semibold underline">/contractor/{s.business.slug}</Link></span></li>
            <li className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/leads/new" className="font-semibold underline">Add leads you already have</Link> from calls and referrals.</span></li>
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tasks due this week" action={<Link href="/app/projects" className="text-sm font-semibold text-safety-700">Projects</Link>} />
          {tasksDue.length === 0 ? <p className="p-4 text-sm text-ink-500">Nothing due in the next 7 days.</p> : (
            <ul className="divide-y divide-concrete-200">
              {tasksDue.map((t) => {
                const project = t.project as unknown as { id: string; name: string } | null;
                const overdue = t.due_date! < today;
                return (
                  <li key={t.id}>
                    <Link href={`/app/projects/${project?.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-concrete-50">
                      <span className="min-w-0"><span className="block truncate font-semibold">{t.title}</span><span className="block truncate text-xs text-ink-500">{project?.name}</span></span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`text-xs font-bold ${overdue ? "text-site-red" : "text-ink-500"}`}>{overdue ? "Overdue · " : ""}{formatDate(t.due_date, { month: "short", day: "numeric" })}</span>
                        <StatusBadge kind="priority" value={t.priority} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {activity.length === 0 ? <EmptyState className="m-4 border-0" title="No activity yet" description="Leads, projects and updates will show up here." /> : (
            <ul className="divide-y divide-concrete-200">
              {activity.map((a) => {
                const href = a.entity_id && ["lead", "customer", "project"].includes(a.entity_type) ? `/app/${a.entity_type}s/${a.entity_id}` : a.entity_type === "post" && a.entity_id ? `/post/${a.entity_id}` : null;
                const inner = <><span className="min-w-0 truncate">{a.summary}</span><span className="shrink-0 text-xs text-ink-500">{timeAgo(a.created_at)}</span></>;
                return <li key={a.id}>{href ? <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-concrete-50">{inner}<ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-500" /></Link> : <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">{inner}</div>}</li>;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
