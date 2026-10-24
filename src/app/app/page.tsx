import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Briefcase, CalendarClock, CalendarDays, Camera, CheckCircle2, ClipboardList, Flag, FileText, ListTodo, MessageCircle, Users,
} from "lucide-react";
import { Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { FormSuccess } from "@/components/ui/input";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { isEmailVerified } from "@/server/email-verification";
import { count, list } from "@/lib/data/db";
import { monthStats, tenant } from "@/lib/data/tenant";
import { getTeam } from "@/lib/team";
import { requireBusiness } from "@/lib/session";
import { ACTIVE_PROJECT_STATUSES, OPEN_LEAD_STATUSES } from "@/lib/constants";
import { cn, compactAmount, dateInDays, formatDate, relativeDay, timeAgo, whatsappLink } from "@/lib/utils";

export const metadata = { title: "Today" };

type TaskRow = { id: string; title: string; due_date: string | null; priority: string; status: string; project_id: string; project_name: string; assigned_to: string | null };
type LeadRow = { id: string; name: string; phone: string | null; status: string; created_at: string; next_follow_up: string | null; assigned_to: string | null; description: string | null };
type JobRow = { id: string; name: string; status: string; customer_name: string | null; start_date: string | null; expected_end_date: string | null; responsible_id?: string | null };
type ActivityRow = { id: string; summary: string; created_at: string; entity_type: string; entity_id: string | null; actor_name: string | null };

const OPEN_TASK = ["todo", "in_progress"];

/**
 * Today (UX_ARCHITECTURE_V2.md §3.4): what needs attention right now, then
 * the week's schedule (task deadlines, follow-ups, job start and finish
 * dates), then the numbers. Every row links to the record it's about.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await requireBusiness();
  const { welcome } = await searchParams;
  if (!s.can("crm")) return <CrewToday businessId={s.business.id} userId={s.user.id} firstName={s.profile?.full_name?.split(" ")[0]} />;
  const t = tenant(s.business.id);
  // The cookie's flag can be stale after the user clicks the link; confirm only when it says "no".
  const emailVerified = s.user.emailVerified || (await isEmailVerified(s.user.id));
  const today = dateInDays(0);
  const weekEnd = dateInDays(6);

  const [newLeads, followUps, overdueTasks, weekTasks, starting, finishing, activeJobs, customers, openLeads, activity, team, [month]] = await Promise.all([
    list<LeadRow>(t.col("leads").where("status", "==", "new").orderBy("created_at", "desc").limit(5)),
    list<LeadRow>(t.col("leads").where("next_follow_up", "<=", weekEnd).orderBy("next_follow_up").limit(30)),
    list<TaskRow>(t.col("tasks").where("status", "in", OPEN_TASK).where("due_date", "<", today).orderBy("due_date").limit(10)),
    list<TaskRow>(t.col("tasks").where("status", "in", OPEN_TASK).where("due_date", ">=", today).where("due_date", "<=", weekEnd).orderBy("due_date").limit(40)),
    list<JobRow>(t.col("projects").where("start_date", ">=", today).where("start_date", "<=", weekEnd).orderBy("start_date").limit(20)),
    list<JobRow>(t.col("projects").where("expected_end_date", ">=", today).where("expected_end_date", "<=", weekEnd).orderBy("expected_end_date").limit(20)),
    count(t.col("projects").where("status", "in", ACTIVE_PROJECT_STATUSES)),
    count(t.col("customers")),
    list<{ estimated_value: number | null }>(t.col("leads").where("status", "in", OPEN_LEAD_STATUSES).select("estimated_value").limit(1000)),
    list<ActivityRow>(t.col("activity").orderBy("created_at", "desc").limit(6)),
    getTeam(s.business.id),
    monthStats(s.business.id),
  ]);
  const names = new Map(team.map((m) => [m.user_id, m.full_name.split(" ")[0]]));
  const who = (id: string | null | undefined) => (id ? names.get(id) ?? "Team member" : "Unassigned");
  const openFollowUps = followUps.filter((l) => OPEN_LEAD_STATUSES.includes(l.status as never) && l.next_follow_up);
  const dueFollowUps = openFollowUps.filter((l) => l.next_follow_up! <= today);
  const pipeline = openLeads.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);
  const quotes = month.totals.quote_request ?? 0;
  const views = month.totals.profile_view ?? 0;

  // ---------- Needs attention ----------
  type Attention = { key: string; icon: typeof Flag; tone: "red" | "orange" | "ink"; title: string; detail: string; href: string; action?: { label: string; href: string } };
  const attention: Attention[] = [
    ...dueFollowUps.map((l): Attention => ({
      key: `f${l.id}`, icon: CalendarClock, tone: l.next_follow_up! < today ? "red" : "orange", href: `/app/leads/${l.id}`,
      title: `Follow up with ${l.name}`, detail: `${l.next_follow_up! < today ? `Overdue since ${relativeDay(l.next_follow_up!, today).toLowerCase()}` : "Due today"} · ${who(l.assigned_to)}`,
      action: whatsappLink(l.phone) ? { label: "WhatsApp", href: whatsappLink(l.phone)! } : undefined,
    })),
    ...newLeads.filter((l) => !dueFollowUps.some((f) => f.id === l.id)).map((l): Attention => ({
      key: `n${l.id}`, icon: ClipboardList, tone: "orange", href: `/app/leads/${l.id}`,
      title: `New enquiry from ${l.name}`, detail: `${timeAgo(l.created_at)} · waiting for a reply`,
      action: whatsappLink(l.phone) ? { label: "WhatsApp", href: whatsappLink(l.phone)! } : undefined,
    })),
    ...overdueTasks.map((task): Attention => ({
      key: `t${task.id}`, icon: AlertTriangle, tone: "red", href: `/app/jobs/${task.project_id}`,
      title: task.title, detail: `Overdue since ${relativeDay(task.due_date!, today).toLowerCase()} · ${task.project_name} · ${who(task.assigned_to)}`,
    })),
  ];
  // Most urgent first: anything overdue (red), then due today, then new enquiries.
  const rank = (a: Attention) => (a.tone === "red" ? 0 : a.key.startsWith("f") ? 1 : 2);
  attention.sort((a, b) => rank(a) - rank(b));
  const SHOWN = 8;

  // ---------- Schedule (next 7 days) ----------
  type Item = { key: string; date: string; icon: typeof Flag; title: string; detail: string; href: string };
  const items: Item[] = [
    ...weekTasks.map((task) => ({ key: `t${task.id}`, date: task.due_date!, icon: ListTodo, title: task.title, detail: `${task.project_name} · ${who(task.assigned_to)}`, href: `/app/jobs/${task.project_id}` })),
    ...openFollowUps.filter((l) => l.next_follow_up! >= today).map((l) => ({ key: `f${l.id}`, date: l.next_follow_up!, icon: CalendarClock, title: `Follow up with ${l.name}`, detail: who(l.assigned_to), href: `/app/leads/${l.id}` })),
    ...starting.filter((j) => j.status !== "completed" && j.status !== "cancelled").map((j) => ({ key: `s${j.id}`, date: j.start_date!, icon: Briefcase, title: `${j.name} starts`, detail: `${j.customer_name ?? "No customer"} · ${who(j.responsible_id)}`, href: `/app/jobs/${j.id}` })),
    ...finishing.filter((j) => (ACTIVE_PROJECT_STATUSES as string[]).includes(j.status)).map((j) => ({ key: `e${j.id}`, date: j.expected_end_date!, icon: Flag, title: `${j.name} due to finish`, detail: `${j.customer_name ?? "No customer"} · ${who(j.responsible_id)}`, href: `/app/jobs/${j.id}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const days = Array.from(new Set(items.map((i) => i.date)));
  const isNew = activeJobs + customers + openLeads.length === 0;

  return (
    <div className="space-y-5">
      {welcome && <FormSuccess message="Welcome to BuildFlow! Your profile is live. Post your best work to start getting discovered." />}
      {!emailVerified && <VerifyEmailBanner email={s.user.email} />}
      <div>
        <p className="text-sm font-semibold text-ink-500">{formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">How&apos;s business{s.profile?.full_name ? `, ${s.profile.full_name.split(" ")[0]}` : ""}?</h1>
      </div>

      {isNew && (
        <Card className="p-5">
          <h2 className="text-lg font-bold">Get your first lead</h2>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/posts/new" className="font-semibold underline">Post a finished job</Link>: customers find you through your work.</span></li>
            <li className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-safety-500" /><span>Share your profile link on WhatsApp: <Link href={`/contractor/${s.business.slug}`} className="font-semibold underline">/contractor/{s.business.slug}</Link></span></li>
            <li className="flex items-start gap-3"><ClipboardList className="mt-0.5 h-5 w-5 text-safety-500" /><span><Link href="/app/leads/new" className="font-semibold underline">Add a lead you already have</Link> from a call or referral.</span></li>
          </ol>
        </Card>
      )}

      <Card>
        <CardHeader title="Needs attention" subtitle={attention.length ? `${attention.length} thing${attention.length === 1 ? "" : "s"}` : undefined} />
        {attention.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-600"><CheckCircle2 className="h-5 w-5 text-site-green" aria-hidden />You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y divide-concrete-200" aria-label="Needs attention">
            {attention.slice(0, SHOWN).map((a) => (
              <li key={a.key} className="flex items-center gap-3 px-4 py-3">
                <a.icon className={cn("h-5 w-5 shrink-0", a.tone === "red" ? "text-site-red" : a.tone === "orange" ? "text-action" : "text-ink-500")} aria-hidden />
                <Link href={a.href} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.title}</span>
                  <span className={cn("block truncate text-xs", a.tone === "red" ? "font-semibold text-site-red" : "text-ink-500")}>{a.detail}</span>
                </Link>
                {a.action && <a href={a.action.href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-concrete-100 px-3 text-xs font-semibold hover:bg-concrete-200"><MessageCircle className="h-3.5 w-3.5" />{a.action.label}</a>}
              </li>
            ))}
            {attention.length > SHOWN && (
              <li className="px-4 py-3 text-sm text-ink-500">
                And {attention.length - SHOWN} more: see <Link href="/app/leads" className="font-semibold underline">Leads</Link> and <Link href="/app/jobs" className="font-semibold underline">Jobs</Link>.
              </li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="This week" subtitle="Deadlines, follow-ups and job dates for the next 7 days" action={<Link href="/app/jobs" className="text-sm font-semibold text-safety-700">Jobs</Link>} />
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-500">Nothing scheduled this week. Give tasks a due date, or set a follow-up on a lead, and it shows up here.</p>
        ) : (
          <div className="divide-y divide-concrete-200">
            {days.map((d) => (
              <section key={d} aria-label={relativeDay(d, today)}>
                <h3 className={cn("bg-concrete-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide", d === today ? "text-action" : "text-ink-500")}>
                  {relativeDay(d, today)}{d !== today && d !== dateInDays(1) ? "" : ` · ${formatDate(d, { month: "short", day: "numeric" })}`}
                </h3>
                <ul className="divide-y divide-concrete-100">
                  {items.filter((i) => i.date === d).map((i) => (
                    <li key={i.key}><Link href={i.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-concrete-50">
                      <i.icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{i.title}</span><span className="block truncate text-xs text-ink-500">{i.detail}</span></span>
                    </Link></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Open leads", value: openLeads.length, href: "/app/leads", icon: ClipboardList },
          { label: "Active jobs", value: activeJobs, href: "/app/jobs", icon: Briefcase },
          { label: "Customers", value: customers, href: "/app/customers", icon: Users },
          { label: "Quote requests this month", value: quotes, href: "/app/analytics", icon: CalendarDays },
        ].map((x) => (
          <Link key={x.label} href={x.href} className="rounded-xl border border-concrete-200 bg-white p-4 shadow-card hover:border-concrete-300">
            <x.icon className="h-5 w-5 text-ink-500" aria-hidden />
            <p className="mt-2 text-2xl font-extrabold">{x.value}</p>
            <p className="text-sm text-ink-500">{x.label}</p>
          </Link>
        ))}
      </div>
      <p className="text-sm text-ink-500">{compactAmount(pipeline)} in open leads · {views} profile view{views === 1 ? "" : "s"} this month. <Link href="/app/analytics" className="font-semibold text-safety-700 hover:underline">Insights →</Link></p>

      <Card>
        <CardHeader title="Recent activity" />
        {activity.length === 0 ? <EmptyState className="m-4 border-0" title="No activity yet" description="Leads, jobs and updates will show up here." /> : (
          <ul className="divide-y divide-concrete-200">
            {activity.map((a) => {
              const href = a.entity_id && a.entity_type === "lead" ? `/app/leads/${a.entity_id}` : a.entity_id && a.entity_type === "customer" ? `/app/customers/${a.entity_id}`
                : a.entity_id && a.entity_type === "project" ? `/app/jobs/${a.entity_id}` : a.entity_type === "post" && a.entity_id ? `/post/${a.entity_id}` : null;
              const inner = <><span className="min-w-0 truncate">{a.actor_name ? `${a.actor_name.split(" ")[0]}: ` : ""}{a.summary}</span><span className="shrink-0 text-xs text-ink-500">{timeAgo(a.created_at)}</span></>;
              return <li key={a.id}>{href ? <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-concrete-50">{inner}<ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-500" /></Link> : <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">{inner}</div>}</li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Today for crew: their tasks and the jobs they're on. No CRM data (ARCHITECTURE_V2.md §5.3). */
async function CrewToday({ businessId, userId, firstName }: { businessId: string; userId: string; firstName?: string }) {
  const t = tenant(businessId);
  const [tasks, jobs] = await Promise.all([
    list<TaskRow>(t.col("tasks").where("assigned_to", "==", userId).limit(100)),
    list<JobRow & { next_task?: { title: string; due_date: string | null } | null }>(
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
                    {task.due_date && <span className={`shrink-0 text-xs font-bold ${overdue ? "text-site-red" : "text-ink-500"}`}>{overdue ? "Overdue · " : ""}{relativeDay(task.due_date, today)}</span>}
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
                <span className="min-w-0"><span className="block truncate font-semibold">{j.name}</span>
                  <span className="block truncate text-xs text-ink-500">{j.next_task ? `Next: ${j.next_task.title}` : j.customer_name ?? ""}</span></span>
                <StatusBadge kind="project" value={j.status} />
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
