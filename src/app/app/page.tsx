import Link from "next/link";
import { ArrowRight, Briefcase, Camera, CheckCircle2, ClipboardList, Eye, FileText, Heart, Plus, Users } from "lucide-react";
import { ButtonLink, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { isEmailVerified } from "@/server/email-verification";
import { count, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { ACTIVE_PROJECT_STATUSES, OPEN_LEAD_STATUSES } from "@/lib/constants";
import { compactAmount, dateInDays, formatDate, startOfMonthISO, timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

type TaskRow = { id: string; title: string; due_date: string; priority: string; status: string; project_id: string; project_name: string };
type ActivityRow = { id: string; summary: string; created_at: string; entity_type: string; entity_id: string | null };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await requireBusiness();
  const { welcome } = await searchParams;
  if (!s.can("crm")) return <CrewToday businessId={s.business.id} userId={s.user.id} firstName={s.profile?.full_name?.split(" ")[0]} />;
  const t = tenant(s.business.id);
  // The cookie's flag can be stale after the user clicks the link; confirm only when it says "no".
  const emailVerified = s.user.emailVerified || (await isEmailVerified(s.user.id));
  const month = startOfMonthISO();
  const weekAhead = dateInDays(7);
  const monthEvents = (type: string) => count(t.col("events").where("type", "==", type).where("created_at", ">=", month));

  const [newLeads, activeProjects, completedProjects, customers, openLeads, tasksDue, activity, views, quotes, likes, comments, follows] = await Promise.all([
    count(t.col("leads").where("status", "==", "new")),
    count(t.col("projects").where("status", "in", ACTIVE_PROJECT_STATUSES)),
    count(t.col("projects").where("status", "==", "completed")),
    count(t.col("customers")),
    list<{ estimated_value: number | null }>(t.col("leads").where("status", "in", OPEN_LEAD_STATUSES).select("estimated_value")),
    list<TaskRow>(t.col("tasks").where("due_date", "<=", weekAhead).orderBy("due_date").limit(30)),
    list<ActivityRow>(t.col("activity").orderBy("created_at", "desc").limit(8)),
    monthEvents("profile_view"), monthEvents("quote_request"), monthEvents("like"), monthEvents("comment"), monthEvents("follow"),
  ]);
  const due = tasksDue.filter((x) => x.status !== "done").slice(0, 6);
  const pipeline = openLeads.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);
  const engagement = likes + comments + follows;
  const isNew = newLeads + activeProjects + completedProjects + customers === 0;
  const today = dateInDays(0);

  const stats = [
    { label: "New leads", value: newLeads, href: "/app/leads?status=new", icon: ClipboardList, accent: newLeads > 0 },
    { label: "Active jobs", value: activeProjects, href: "/app/jobs", icon: Briefcase },
    { label: "Completed", value: completedProjects, href: "/app/jobs?status=completed", icon: CheckCircle2 },
    { label: "Customers", value: customers, href: "/app/customers", icon: Users },
  ];

  return (
    <div className="space-y-5">
      {welcome && <FormSuccess message="Welcome to BuildFlow! Your profile is live. Post your best work to start getting discovered." />}
      {!emailVerified && <VerifyEmailBanner email={s.user.email} />}
      <div>
        <p className="text-sm font-semibold text-ink-500">{formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">How&apos;s business{s.profile?.full_name ? `, ${s.profile.full_name.split(" ")[0]}` : ""}?</h1>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {[["/app/leads/new", "Add lead"], ["/app/customers/new", "Add customer"], ["/app/jobs/new", "New job"], ["/app/posts/new", "Create post"]].map(([href, label]) => (
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
          <p className="text-xs text-concrete-400">{openLeads.length} open lead{openLeads.length === 1 ? "" : "s"}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center md:gap-8">
          <div><Eye className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{views}</p><p className="text-[11px] text-concrete-400">Profile views</p></div>
          <div><FileText className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{quotes}</p><p className="text-[11px] text-concrete-400">Quote requests</p></div>
          <div><Heart className="mx-auto h-4 w-4 text-concrete-400" /><p className="text-xl font-bold">{engagement}</p><p className="text-[11px] text-concrete-400">Engagement</p></div>
        </div>
      </Card>
      <p className="-mt-2 text-xs text-ink-500">Views, quotes and engagement are for this month. <Link href="/app/analytics" className="font-semibold text-safety-700 hover:underline">See analytics →</Link></p>

      {isNew && (
        <Card className="p-5">
          <h2 className="text-lg font-bold">Get your first lead</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/posts/new" className="font-semibold underline">Post a finished job</Link>: customers find you through your work.</span></li>
            <li className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-safety-500" /><span>Share your profile link on WhatsApp and social: <Link href={`/contractor/${s.business.slug}`} className="font-semibold underline">/contractor/{s.business.slug}</Link></span></li>
            <li className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/leads/new" className="font-semibold underline">Add leads you already have</Link> from calls and referrals.</span></li>
          </ol>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tasks due this week" action={<Link href="/app/jobs" className="text-sm font-semibold text-safety-700">Jobs</Link>} />
          {due.length === 0 ? <p className="p-4 text-sm text-ink-500">Nothing due in the next 7 days.</p> : (
            <ul className="divide-y divide-concrete-200">
              {due.map((task) => {
                const overdue = task.due_date < today;
                return (
                  <li key={task.id}>
                    <Link href={`/app/jobs/${task.project_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-concrete-50">
                      <span className="min-w-0"><span className="block truncate font-semibold">{task.title}</span><span className="block truncate text-xs text-ink-500">{task.project_name}</span></span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`text-xs font-bold ${overdue ? "text-site-red" : "text-ink-500"}`}>{overdue ? "Overdue · " : ""}{formatDate(task.due_date, { month: "short", day: "numeric" })}</span>
                        <StatusBadge kind="priority" value={task.priority} />
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
          {activity.length === 0 ? <EmptyState className="m-4 border-0" title="No activity yet" description="Leads, jobs and updates will show up here." /> : (
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

/** Today for crew: their tasks and the jobs they're on. No CRM data (ARCHITECTURE_V2.md §5.3). */
async function CrewToday({ businessId, userId, firstName }: { businessId: string; userId: string; firstName?: string }) {
  const t = tenant(businessId);
  const [tasks, jobs] = await Promise.all([
    list<TaskRow>(t.col("tasks").where("assigned_to", "==", userId).limit(100)),
    list<{ id: string; name: string; status: string; customer_name: string | null }>(
      t.col("projects").where("member_ids", "array-contains", userId).where("status", "in", ACTIVE_PROJECT_STATUSES).limit(20)),
  ]);
  const today = dateInDays(0);
  const open = tasks.filter((x) => x.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-ink-500">{formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">Hi{firstName ? ` ${firstName}` : ""}, here&apos;s your day</h1>
      </div>
      <Card>
        <CardHeader title="My tasks" />
        {open.length === 0 ? <EmptyState className="m-4 border-0" icon={CheckCircle2} title="No open tasks" description="Tasks assigned to you show up here." /> : (
          <ul className="divide-y divide-concrete-200">
            {open.slice(0, 20).map((task) => {
              const overdue = task.due_date && task.due_date < today;
              return (
                <li key={task.id}>
                  <Link href={`/app/jobs/${task.project_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-concrete-50">
                    <span className="min-w-0"><span className="block truncate font-semibold">{task.title}</span><span className="block truncate text-xs text-ink-500">{task.project_name}</span></span>
                    {task.due_date && <span className={`shrink-0 text-xs font-bold ${overdue ? "text-site-red" : "text-ink-500"}`}>{overdue ? "Overdue · " : ""}{formatDate(task.due_date, { month: "short", day: "numeric" })}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="My jobs" />
        {jobs.length === 0 ? <EmptyState className="m-4 border-0" icon={Briefcase} title="No active jobs" description="When you're added to a job, it shows up here." /> : (
          <ul className="divide-y divide-concrete-200">
            {jobs.map((j) => (
              <li key={j.id}><Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-concrete-50">
                <span className="min-w-0"><span className="block truncate font-semibold">{j.name}</span>{j.customer_name && <span className="block truncate text-xs text-ink-500">{j.customer_name}</span>}</span>
                <StatusBadge kind="project" value={j.status} />
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
