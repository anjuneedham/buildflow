import { Check, Info } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { count } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { getPlan } from "@/lib/plans.server";
import { requirePermission } from "@/lib/session";
import { billingMode } from "@/lib/billing";
import { formatMoney, seatPriceBreakdown } from "@/lib/plans";
import { daysUntil, formatDate } from "@/lib/utils";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const s = await requirePermission("billing.manage");
  const [subSnap, members] = await Promise.all([
    db().collection("subscriptions").doc(s.business.id).get(),
    count(tenant(s.business.id).col("members")),
  ]);
  const sub = subSnap.data() as { plan_id: string; status: string; seats: number; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | undefined;

  if (!sub) {
    return <><PageHeader title="Billing" /><Card className="p-4 text-sm text-ink-500">No subscription found for this business. Contact support.</Card></>;
  }
  const plan = await getPlan(sub.plan_id);
  const seats = Math.max(sub.seats, members ?? 1);
  const bill = seatPriceBreakdown(plan, seats);
  const trialing = sub.status === "trialing";
  const daysLeft = sub.trial_ends_at ? daysUntil(sub.trial_ends_at) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Billing & plan" />
      <Card>
        <CardHeader title={plan.name} action={<Badge tone={trialing ? "orange" : sub.status === "active" ? "green" : "red"}>{trialing ? `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : sub.status.replace("_", " ")}</Badge>} />
        <CardBody className="space-y-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Base plan ({plan.includedSeats} user included)</dt><dd>{formatMoney(bill.baseCents, plan.currency)}</dd></div>
            <div className="flex justify-between"><dt>{bill.extraSeats} additional user{bill.extraSeats === 1 ? "" : "s"} × {formatMoney(plan.additionalSeatPriceCents, plan.currency)}</dt><dd>{formatMoney(bill.extraCents, plan.currency)}</dd></div>
            <div className="flex justify-between border-t border-concrete-200 pt-2 text-base font-extrabold"><dt>{trialing ? "After your trial" : "Monthly total"}</dt><dd>{formatMoney(bill.totalCents, plan.currency)}/{plan.interval}</dd></div>
          </dl>
          <p className="text-xs text-ink-500">You have {members ?? 1} user{members === 1 ? "" : "s"} on your team. Adding or removing team members changes your bill.</p>
          {trialing && sub.trial_ends_at && <p className="text-sm">Your free trial ends on <b>{formatDate(sub.trial_ends_at)}</b>.</p>}
          {sub.current_period_end && !trialing && <p className="text-sm">{sub.cancel_at_period_end ? "Access ends" : "Next bill"} on <b>{formatDate(sub.current_period_end)}</b>.</p>}
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">{plan.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-site-green" />{f}</li>)}</ul>
        </CardBody>
      </Card>
      {billingMode === "manual" && (
        <Card className="flex gap-3 p-4 text-sm text-ink-600">
          <Info className="h-5 w-5 shrink-0 text-site-blue" />
          <p>Online card payments are coming soon. Your trial continues until then, and we&apos;ll contact you before any charge. Questions? Email support.</p>
        </Card>
      )}
    </div>
  );
}
