"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_STATUSES } from "@/lib/constants";
import type { Customer } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

export function CustomerForm({ action: serverAction, customer, submitLabel }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; customer?: Customer; submitLabel: string }) {
  const [state, action] = useFormAction(serverAction);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={customer?.name} required autoFocus={!customer} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={customer?.phone ?? ""} /></Field>
        <Field label="Email" htmlFor="email" error={fe.email} optional><Input id="email" name="email" type="email" inputMode="email" defaultValue={customer?.email ?? ""} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address" htmlFor="address" optional><Input id="address" name="address" autoComplete="street-address" defaultValue={customer?.address ?? ""} /></Field>
        <Field label="City / area" htmlFor="city" optional><Input id="city" name="city" defaultValue={customer?.city ?? ""} /></Field>
      </div>
      <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={customer?.status ?? "active"} options={CUSTOMER_STATUSES} /></Field>
      <Field label="Notes" htmlFor="notes" hint="General info, e.g. gate code, best time to call." optional><Textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ""} /></Field>
      <SubmitButton size="lg" block pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
