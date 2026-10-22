import Link from "next/link";
import { Bell, FileText, Heart, MessageCircle, UserPlus, Briefcase, ListTodo } from "lucide-react";
import { markAllNotificationsRead } from "@/app/actions/business";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Notifications" };

const ICONS: Record<string, typeof Bell> = { quote_request: FileText, new_lead: FileText, comment: MessageCircle, follower: UserPlus, project_assigned: Briefcase, task_assigned: ListTodo, system: Bell, like: Heart };

export default async function NotificationsPage() {
  const s = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", s.user.id).order("created_at", { ascending: false }).limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "You're all caught up"}
        actions={unread > 0 ? <form action={markAllNotificationsRead}><SubmitButton size="sm" variant="outline">Mark all read</SubmitButton></form> : undefined} />
      {items.length === 0 ? <EmptyState icon={Bell} title="No notifications yet" description="Quote requests, comments, new followers and assignments will show up here." /> : (
        <Card className="divide-y divide-concrete-200">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const body = (
              <div className={cn("flex gap-3 px-4 py-3", !n.read_at && "bg-safety-50/60")}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", !n.read_at ? "bg-safety-500 text-white" : "bg-concrete-100 text-ink-500")}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-bold")}>{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-sm text-ink-500">{n.body}</p>}
                  <p className="text-xs text-ink-500">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
            return n.link?.startsWith("/") ? <Link key={n.id} href={n.link} className="block hover:bg-concrete-50">{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </Card>
      )}
    </div>
  );
}
