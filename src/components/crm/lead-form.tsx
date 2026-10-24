"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import type { Lead, Service, TeamMember } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

export function LeadForm({ action: serverAction, lead, services, team, submitLabel }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; lead?: Lead; services: Service[]; team: TeamMember[]; submitLabel: string;
}) {
  const [state, action] = useFormAction(serverAction);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={lead?.name} required autoFocus={!lead} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone ?? ""} /></Field>
        <Field label="Email" htmlFor="email" error={fe.email} optional><Input id="email" name="email" type="email" inputMode="email" defaultValue={lead?.email ?? ""} /></Field>
      </div>
      <Field label="What do they need?" htmlFor="description" optional><Textarea id="description" name="description" rows={3} defaultValue={lead?.description ?? ""} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" htmlFor="serviceId" optional><Select id="serviceId" name="serviceId" defaultValue={lead?.service_id ?? ""} placeholder="—" options={services.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <Field label="Location" htmlFor="location" optional><Input id="location" name="location" defaultValue={lead?.location ?? ""} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Estimated value" htmlFor="estimatedValue" error={fe.estimatedValue} optional><Input id="estimatedValue" name="estimatedValue" inputMode="decimal" placeholder="0" defaultValue={lead?.estimated_value ?? ""} /></Field>
        <Field label="Source" htmlFor="source"><Select id="source" name="source" defaultValue={lead?.source ?? "phone"} options={LEAD_SOURCES} /></Field>
        <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={lead?.status ?? "new"} options={LEAD_STATUSES} /></Field>
      </div>
      <Field label="Follow up on" htmlFor="nextFollowUp" optional hint="You'll see it on Today when it's due"><Input id="nextFollowUp" name="nextFollowUp" type="date" defaultValue={lead?.next_follow_up ?? ""} /></Field>
      {team.length > 1 && (
        <Field label="Responsible" htmlFor="assignedTo" optional hint="Who follows up with this person"><Select id="assignedTo" name="assignedTo" defaultValue={lead?.assigned_to ?? ""} placeholder="Nobody yet" options={team.map((m) => ({ value: m.user_id, label: m.full_name || "Team member" }))} /></Field>
      )}
      <SubmitButton size="lg" block pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
