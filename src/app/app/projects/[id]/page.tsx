import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Camera, MapPin, Megaphone, Pencil, User, Wallet } from "lucide-react";
import { ActivityList } from "@/components/crm/activity-list";
import { Notes, type NoteRow } from "@/components/crm/notes";
import { Avatar, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { getTeam } from "@/lib/team";
import { formatAmount, formatDate } from "@/lib/utils";
import type { Project, Task } from "@/lib/types";
import { DeleteProject, PhotoUpload, ProjectStatus, TaskList } from "./project-client";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*, customer:customers(id, name, phone)").eq("id", id).eq("business_id", s.business.id).maybeSingle();
  if (!data) notFound();
  const p = data as Project & { customer: { id: string; name: string; phone: string | null } | null };
  const [{ data: tasks }, { data: photos }, { data: members }, { data: notes }, { data: activity }, { data: posts }, team] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", id).order("status").order("due_date", { nullsFirst: false }),
    supabase.from("project_photos").select("id, url, caption, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_members").select("user_id").eq("project_id", id),
    supabase.from("notes").select("id, body, created_at, author_id, author:profiles(full_name)").eq("business_id", s.business.id).eq("entity_type", "project").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select("id, summary, created_at, actor:profiles(full_name)").eq("business_id", s.business.id).eq("entity_type", "project").eq("entity_id", id).order("created_at", { ascending: false }).limit(25),
    supabase.from("posts").select("id").eq("project_id", id).limit(1),
    getTeam(s.business.id),
  ]);
  const urls = await signedUrls(supabase, (photos ?? []).map((ph) => ph.url));
  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const crew = team.filter((m) => memberIds.has(m.user_id));
  const allTasks = (tasks ?? []) as Task[];
  const done = allTasks.filter((t) => t.status === "done").length;
  const isCompleted = p.status === "completed";
  const hasPost = (posts ?? []).length > 0;

  return (
    <div className="space-y-4">
      <PageHeader title={p.name} back={{ href: "/app/projects", label: "Projects" }}
        subtitle={<StatusBadge kind="project" value={p.status} />}
        actions={<>
          <ButtonLink href={`/app/projects/${id}/edit`} variant="outline" size="sm"><Pencil className="h-4 w-4" />Edit</ButtonLink>
          {s.isOwner && <DeleteProject id={id} />}
        </>} />

      {isCompleted && (
        <Card className="flex flex-col gap-3 border-safety-400 bg-safety-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-ink">{hasPost ? "This project is on your profile." : "Job done! Show it off."}</p>
            <p className="text-sm text-ink-600">{hasPost ? "Post an update or a before/after to keep it fresh." : "Completed work is the best way to win your next customer."}</p>
          </div>
          <ButtonLink href={`/app/posts/new?projectId=${id}`} className="shrink-0"><Megaphone className="h-4 w-4" />Showcase this project</ButtonLink>
        </Card>
      )}

      <Card><CardHeader title="Status" /><CardBody><ProjectStatus id={id} status={p.status} /></CardBody></Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile icon={User} label="Customer" value={p.customer ? <Link href={`/app/customers/${p.customer.id}`} className="underline">{p.customer.name}</Link> : "—"} />
        <InfoTile icon={Wallet} label="Budget" value={formatAmount(p.budget)} />
        <InfoTile icon={CalendarDays} label="Timeline" value={`${formatDate(p.start_date, { month: "short", day: "numeric" })} → ${formatDate(p.expected_end_date, { month: "short", day: "numeric" })}`} />
        <InfoTile icon={MapPin} label="Location" value={p.location ?? "—"} />
      </div>
      {p.description && <Card className="p-4 text-sm text-ink-700"><p className="whitespace-pre-line">{p.description}</p></Card>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Tasks" subtitle={allTasks.length ? `${done} of ${allTasks.length} done` : undefined} />
            {allTasks.length > 0 && <div className="h-1.5 bg-concrete-200"><div className="h-full bg-safety-500" style={{ width: `${(done / allTasks.length) * 100}%` }} /></div>}
            <CardBody><TaskList projectId={id} tasks={allTasks} team={team} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Site photos" subtitle="Private to your team" />
            <CardBody className="space-y-4">
              <PhotoUpload projectId={id} />
              {(photos ?? []).length === 0 ? <p className="flex items-center gap-2 text-sm text-ink-500"><Camera className="h-4 w-4" />No photos yet.</p> : (
                <div className="grid grid-cols-3 gap-1.5">
                  {(photos ?? []).map((ph) => urls.get(ph.url) && (
                    <a key={ph.id} href={urls.get(ph.url)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-concrete-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls.get(ph.url)} alt={ph.caption ?? "Site photo"} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
          <Card><CardHeader title="Notes" /><CardBody><Notes entityType="project" entityId={id} notes={(notes ?? []) as unknown as NoteRow[]} viewerId={s.user.id} path={`/app/projects/${id}`} /></CardBody></Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Team" action={<Link href={`/app/projects/${id}/edit`} className="text-sm font-semibold text-safety-700">Manage</Link>} />
            <CardBody>
              {crew.length === 0 ? <p className="text-sm text-ink-500">No one assigned yet.</p> : (
                <ul className="space-y-2">{crew.map((m) => <li key={m.user_id} className="flex items-center gap-2 text-sm"><Avatar src={m.avatar_url} name={m.full_name} size="sm" />{m.full_name}<span className="text-xs capitalize text-ink-500">{m.role}</span></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card><CardHeader title="Activity" /><CardBody><ActivityList items={(activity ?? []) as never} /></CardBody></Card>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-concrete-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-500"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
