import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardList, ListTodo, MapPin, Megaphone, Pencil, User, UserCheck, Wallet } from "lucide-react";
import { Timeline } from "@/components/workflow/timeline";
import { Avatar, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { fromDoc, isId, list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness } from "@/lib/session";
import { canAccessProject } from "@/server/policy";
import { getTeam } from "@/lib/team";
import { cn, dateInDays, formatAmount, formatDate, relativeDay } from "@/lib/utils";
import type { ActivityRow, Media, Project, Task } from "@/lib/types";
import { CompleteJobButton, DeleteProject, DoneButton, FilesSection, PhotoGrid, ProjectStatus, ReviewReplyForm, ReviewRequestButton, TaskList, UpdateComposer } from "./project-client";
import type { Review } from "@/lib/data/trust";

export const metadata = { title: "Job" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const t = tenant(s.business.id);
  const p = isId(id) ? fromDoc<Project>(await t.doc("projects", id).get()) : null;
  // Same response for "doesn't exist" and "not yours" (no existence leak).
  if (!p || !canAccessProject(s.role, s.user.id, p)) notFound();
  const canManage = s.can("projects.manage");
  const [tasks, media, activity, posts, team] = await Promise.all([
    list<Task>(t.col("tasks").where("project_id", "==", id).limit(200)),
    list<Media>(t.col("media").where("project_id", "==", id).orderBy("created_at", "desc").limit(200)),
    list<ActivityRow>(t.col("activity").where("project_id", "==", id).orderBy("created_at", "desc").limit(50)),
    db().collection("posts").where("business_id", "==", s.business.id).where("project_id", "==", id).limit(1).get(),
    getTeam(s.business.id),
  ]);
  const review = p.status === "completed" ? fromDoc<Review>(await t.doc("reviews", id).get()) : null;
  const today = dateInDays(0);
  const order = { in_progress: 0, todo: 1, done: 2 } as const;
  const allTasks = tasks.sort((a, b) => order[a.status] - order[b.status] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const openTasks = allTasks.filter((x) => x.status !== "done");
  const done = allTasks.length - openTasks.length;
  const names = new Map(team.map((m) => [m.user_id, m.full_name]));
  const crew = team.filter((m) => (p.member_ids ?? []).includes(m.user_id));
  const next = openTasks[0] ?? null;
  const isCompleted = p.status === "completed";
  const isClosed = isCompleted || p.status === "cancelled";
  const late = !isClosed && p.expected_end_date && p.expected_end_date < today;
  const deletable = (m: Media) => canManage || m.uploaded_by === s.user.id;
  const photos = media.filter((m) => m.kind === "image").map((m) => ({ ...m, deletable: deletable(m) }));
  const files = media.filter((m) => m.kind === "file").map((m) => ({ ...m, deletable: deletable(m) }));

  return (
    <div className="space-y-4">
      <PageHeader title={p.name} back={{ href: "/app/jobs", label: "Jobs" }}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="project" value={p.status} />{p.lead_id && s.can("crm") && <Link href={`/app/leads/${p.lead_id}`} className="text-sm font-semibold text-ink-500 underline">From enquiry</Link>}</span>}
        actions={<>
          {canManage && <ButtonLink href={`/app/jobs/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>}
          {s.can("records.delete") && <DeleteProject id={id} />}
        </>} />

      {/* After completion: turn the job into proof (portfolio post + verified review). */}
      {isCompleted && canManage && (
        <Card className="space-y-4 border-safety-400 bg-safety-50 p-4">
          <div>
            <p className="font-bold text-ink">{!posts.empty ? "This job is on your profile." : "Job done! Turn it into your next customer."}</p>
            <p className="text-sm text-ink-600">{review ? "Thanks to the review, it's verified proof of your work." : "Post the photos to your portfolio, and ask the customer for a review."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/app/posts/new?projectId=${id}`} variant={posts.empty ? "primary" : "outline"}><Megaphone className="h-4 w-4" />{posts.empty ? "Publish to portfolio" : "Post more from this job"}</ButtonLink>
            {!review && <ReviewRequestButton projectId={id} requested={Boolean(p.review_requested_at)} />}
          </div>
          {review && (
            <div className="rounded-lg bg-white p-3">
              <p className="text-sm"><span className="font-bold text-safety-600" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-concrete-300">{"★".repeat(5 - review.rating)}</span></span> <span className="font-semibold">{review.reviewer_name}</span></p>
              {review.body && <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{review.body}</p>}
              {review.reply && <p className="mt-2 border-l-2 border-concrete-300 pl-2 text-sm text-ink-600"><span className="font-semibold">Your reply:</span> {review.reply.body}</p>}
              <div className="mt-2"><ReviewReplyForm projectId={id} reply={review.reply?.body ?? null} /></div>
            </div>
          )}
        </Card>
      )}

      {/* Who, where, when, who's responsible */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile icon={User} label="Customer" value={p.customer_id && s.can("crm") ? <Link href={`/app/customers/${p.customer_id}`} className="underline">{p.customer_name}</Link> : p.customer_name ?? "—"} />
        <InfoTile icon={UserCheck} label="Responsible" value={p.responsible_id ? names.get(p.responsible_id) ?? "Team member" : "—"} />
        <InfoTile icon={CalendarDays} label={late ? "Past target date" : "Timeline"} danger={Boolean(late)}
          value={`${formatDate(p.start_date, { month: "short", day: "numeric" })} → ${formatDate(p.expected_end_date, { month: "short", day: "numeric" })}`} />
        {canManage ? <InfoTile icon={Wallet} label="Budget" value={formatAmount(p.budget)} /> : <InfoTile icon={MapPin} label="Location" value={p.location ?? "—"} />}
      </div>
      {(p.description || (canManage && p.location)) && (
        <Card className="space-y-1 p-4 text-sm text-ink-700">
          {canManage && p.location && <p className="flex items-center gap-1.5 text-ink-500"><MapPin className="h-3.5 w-3.5" />{p.location}</p>}
          {p.description && <p className="whitespace-pre-line">{p.description}</p>}
        </Card>
      )}

      {/* What happens next */}
      {!isClosed && (
        <Card className={cn("p-4", next?.due_date && next.due_date < today && "border-red-200 bg-red-50")}>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500"><ListTodo className="h-3.5 w-3.5" aria-hidden />What&apos;s next</p>
          {next ? (
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{next.title}</p>
                <p className={cn("text-sm", next.due_date && next.due_date < today ? "font-bold text-site-red" : "text-ink-500")}>
                  {next.due_date ? `${next.due_date < today ? "Overdue · " : "Due "}${relativeDay(next.due_date, today)}` : "No due date"} · {next.assigned_to ? names.get(next.assigned_to) ?? "Team member" : "Unassigned"}
                </p>
              </div>
              <DoneButton taskId={next.id} />
            </div>
          ) : <p className="mt-1 text-sm text-ink-600">No open tasks. {canManage ? "Add the next step below, or complete the job." : "Ask your manager what's next."}</p>}
          {canManage && openTasks.length === 0 && allTasks.length > 0 && <div className="mt-3"><CompleteJobButton id={id} openTasks={0} /></div>}
        </Card>
      )}

      {canManage && <Card><CardHeader title="Status" /><CardBody><ProjectStatus id={id} status={p.status} openTasks={openTasks.length} /></CardBody></Card>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Tasks" subtitle={allTasks.length ? `${done} of ${allTasks.length} done` : "Break the job into steps your crew can tick off"} />
            {allTasks.length > 0 && <div className="h-1.5 bg-concrete-200"><div className="h-full bg-safety-500" style={{ width: `${(done / allTasks.length) * 100}%` }} /></div>}
            <CardBody><TaskList projectId={id} tasks={allTasks} team={team} canDelete={canManage} today={today} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Updates & history" subtitle="Site updates, notes and everything that happened on this job" />
            <CardBody className="space-y-5">
              <UpdateComposer projectId={id} />
              <Timeline entityType="project" entityId={id} items={activity} viewerId={s.user.id} canDeleteAny={s.can("records.delete")} composer={false} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Crew" action={canManage ? <Link href={`/app/jobs/${id}/edit`} className="text-sm font-semibold text-safety-700">Manage</Link> : undefined} />
            <CardBody>
              {crew.length === 0 ? <p className="text-sm text-ink-500">No one assigned yet.</p> : (
                <ul className="space-y-2">{crew.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-2 text-sm"><Avatar src={m.avatar_url} name={m.full_name} size="sm" /><span className="min-w-0 flex-1 truncate">{m.full_name}</span>
                    {m.user_id === p.responsible_id && <span className="text-xs font-semibold text-ink-500">Responsible</span>}
                  </li>
                ))}</ul>
              )}
            </CardBody>
          </Card>
          <Card><CardHeader title="Photos" subtitle={photos.length ? `${photos.length}` : undefined} /><CardBody><PhotoGrid photos={photos} /></CardBody></Card>
          <Card><CardHeader title="Files" /><CardBody><FilesSection projectId={id} files={files} /></CardBody></Card>
          {!isClosed && canManage && openTasks.length > 0 && (
            <Card className="p-4"><p className="mb-2 flex items-center gap-1.5 text-sm text-ink-500"><ClipboardList className="h-4 w-4" />Finished early?</p><CompleteJobButton id={id} openTasks={openTasks.length} /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white p-3", danger ? "border-red-200" : "border-concrete-200")}>
      <p className={cn("flex items-center gap-1.5 text-xs", danger ? "font-bold text-site-red" : "text-ink-500")}><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
