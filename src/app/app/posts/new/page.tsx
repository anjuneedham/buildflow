import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getServices } from "@/lib/queries";
import { requireBusiness } from "@/lib/session";
import { PostForm } from "./post-form";

export const metadata = { title: "Create post" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const s = await requireBusiness();
  const { projectId } = await searchParams;
  const supabase = await createClient();
  const [{ data: projects }, services] = await Promise.all([
    supabase.from("projects").select("id, name, status, location").eq("business_id", s.business.id).order("created_at", { ascending: false }).limit(100),
    getServices(),
  ]);
  const project = projects?.find((p) => p.id === projectId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Showcase your work" subtitle="Posts appear on your public profile and in Explore." back={{ href: "/app", label: "Dashboard" }} />
      <Card className="p-4">
        <PostForm projects={projects ?? []} services={services}
          defaults={{ projectId: project?.id, type: project ? (project.status === "completed" ? "completed_project" : "work_in_progress") : "completed_project", serviceId: s.business.primary_service_id ?? undefined, location: project?.location ?? [s.business.city, s.business.region?.name].filter(Boolean).join(", ") }} />
      </Card>
    </div>
  );
}
