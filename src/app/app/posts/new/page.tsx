import { Card, PageHeader } from "@/components/ui";
import { list } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { getServices } from "@/lib/queries";
import { requirePermission } from "@/lib/session";
import { PostForm } from "./post-form";

export const metadata = { title: "Create post" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const s = await requirePermission("profile.edit");
  const { projectId } = await searchParams;
  const [projects, services] = await Promise.all([
    list<{ id: string; name: string; status: string; location: string | null }>(tenant(s.business.id).col("projects").orderBy("created_at", "desc").select("name", "status", "location").limit(100)),
    getServices(),
  ]);
  const project = projects.find((p) => p.id === projectId);
  // Opened from a job: offer that job's own photos (oldest first, so "before" shots come first).
  const jobPhotos = project
    ? (await list<{ id: string; path: string; created_at: string }>(tenant(s.business.id).col("media").where("project_id", "==", project.id).orderBy("created_at", "desc").limit(60)))
        .filter((m) => m.path.endsWith(".webp")).reverse()
    : [];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={project ? "Publish to portfolio" : "Showcase your work"} subtitle={project ? `From the job "${project.name}". It will show as a verified job.` : "Posts appear on your public profile and in Explore."} back={project ? { href: `/app/jobs/${project.id}`, label: "Job" } : { href: "/app", label: "Today" }} />
      <Card className="p-4">
        <PostForm projects={projects} services={services} jobPhotos={jobPhotos.map(({ id, path }) => ({ id, path }))} lockedProject={project ? { id: project.id, name: project.name } : undefined}
          defaults={{ projectId: project?.id, type: project ? (project.status === "completed" ? "completed_project" : "work_in_progress") : "completed_project", serviceId: s.business.primary_service_id ?? undefined, location: project?.location ?? [s.business.city, s.business.region?.name].filter(Boolean).join(", ") }} />
      </Card>
    </div>
  );
}
