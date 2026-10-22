import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { formatMoney } from "@/lib/plans";
import { getPlans } from "@/lib/plans.server";
import { formatDate } from "@/lib/utils";
import { InviteForm, RemoveMember, RevokeInvite } from "./team-client";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const s = await requireBusiness();
  const supabase = await createClient();
  const [team, { data: invites }, plans] = await Promise.all([
    getTeam(s.business.id),
    s.isOwner ? supabase.from("business_invitations").select("id, email, created_at, token").eq("business_id", s.business.id).is("accepted_at", null) : Promise.resolve({ data: [] }),
    getPlans(),
  ]);
  const plan = plans[0];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Team" subtitle="Team members can see leads, customers and projects, add notes and update statuses. Only owners can delete records, edit the profile or manage billing." />
      <Card>
        <CardHeader title={`Members (${team.length})`} />
        <ul className="divide-y divide-concrete-200">
          {team.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={m.avatar_url} name={m.full_name} />
              <span className="flex-1 font-semibold">{m.full_name || "Team member"}{m.user_id === s.user.id && <span className="font-normal text-ink-500"> (you)</span>}</span>
              <Badge tone={m.role === "owner" ? "orange" : "neutral"}>{m.role}</Badge>
              {s.isOwner && m.role !== "owner" && <RemoveMember userId={m.user_id} name={m.full_name} />}
            </li>
          ))}
        </ul>
      </Card>
      {s.isOwner && (
        <Card>
          <CardHeader title="Invite a team member" subtitle={plan ? `Each additional user is ${formatMoney(plan.additionalSeatPriceCents)}/month on ${plan.name}.` : undefined} />
          <CardBody className="space-y-4">
            <InviteForm />
            {(invites ?? []).length > 0 && (
              <ul className="space-y-2">
                {(invites ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-concrete-50 p-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold">{i.email}</span><span className="text-xs text-ink-500">Invited {formatDate(i.created_at)} · link: /invite/{i.token.slice(0, 8)}…</span></span>
                    <RevokeInvite id={i.id} token={i.token} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
