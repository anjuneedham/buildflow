import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { list } from "@/lib/data/db";
import { requireBusiness } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { formatMoney } from "@/lib/plans";
import { getPlans } from "@/lib/plans.server";
import { formatDate } from "@/lib/utils";
import { InviteForm, RemoveMember, RevokeInvite, RoleSelect } from "./team-client";
import { normalizeRole, ROLE_LABELS } from "@/server/policy";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const s = await requireBusiness();
  const [team, invites, plans] = await Promise.all([
    getTeam(s.business.id),
    s.can("team.manage") ? list<{ id: string; email: string; created_at: string }>(db().collection("invitations").where("business_id", "==", s.business.id).where("accepted_at", "==", null)) : Promise.resolve([]),
    getPlans(),
  ]);
  const plan = plans[0];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Team" subtitle={`${ROLE_LABELS.admin.label}: ${ROLE_LABELS.admin.description} ${ROLE_LABELS.field.label}: ${ROLE_LABELS.field.description}`} />
      <Card>
        <CardHeader title={`Members (${team.length})`} />
        <ul className="divide-y divide-concrete-200">
          {team.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={m.avatar_url} name={m.full_name} />
              <span className="flex-1 font-semibold">{m.full_name || "Team member"}{m.user_id === s.user.id && <span className="font-normal text-ink-500"> (you)</span>}</span>
              {s.can("team.manage") && m.role !== "owner" && m.user_id !== s.user.id
                ? <RoleSelect userId={m.user_id} role={normalizeRole(m.role)} name={m.full_name} />
                : <Badge tone={m.role === "owner" ? "orange" : "neutral"}>{ROLE_LABELS[normalizeRole(m.role)].label}</Badge>}
              {s.can("team.manage") && m.role !== "owner" && m.user_id !== s.user.id && <RemoveMember userId={m.user_id} name={m.full_name} />}
            </li>
          ))}
        </ul>
      </Card>
      {s.can("team.manage") && (
        <Card>
          <CardHeader title="Invite a team member" subtitle={plan ? `Each additional user is ${formatMoney(plan.additionalSeatPriceCents)}/month on ${plan.name}.` : undefined} />
          <CardBody className="space-y-4">
            <InviteForm />
            {invites.length > 0 && (
              <ul className="space-y-2">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-concrete-50 p-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold">{i.email}</span><span className="text-xs text-ink-500">Invited {formatDate(i.created_at)} · link: /invite/{i.id.slice(0, 8)}…</span></span>
                    <RevokeInvite token={i.id} />
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
