"use client";

import { useActionState } from "react";
import { updatePlan } from "@/app/actions/admin";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";

type PlanRow = { id: string; name: string; base_price_cents: number; included_seats: number; additional_seat_price_cents: number };

export function PlanForm({ plan }: { plan: PlanRow }) {
  const [state, action] = useActionState(updatePlan.bind(null, plan.id), {} as { ok?: boolean; error?: string; message?: string });
  useActionToast(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <Field label="Name" htmlFor={`n-${plan.id}`}><Input id={`n-${plan.id}`} name="name" defaultValue={plan.name} /></Field>
      <Field label="Base price (USD)" htmlFor={`b-${plan.id}`}><Input id={`b-${plan.id}`} name="basePrice" inputMode="decimal" defaultValue={plan.base_price_cents / 100} /></Field>
      <Field label="Included users" htmlFor={`i-${plan.id}`}><Input id={`i-${plan.id}`} name="includedSeats" type="number" min={1} defaultValue={plan.included_seats} /></Field>
      <Field label="Per extra user (USD)" htmlFor={`s-${plan.id}`}><Input id={`s-${plan.id}`} name="seatPrice" inputMode="decimal" defaultValue={plan.additional_seat_price_cents / 100} /></Field>
      <div className="sm:col-span-4"><SubmitButton>Save plan</SubmitButton>{state.error && <span className="ml-3 text-sm text-site-red">{state.error}</span>}</div>
    </form>
  );
}
