"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { Project, TeamMember } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

export function ProjectForm({ action: serverAction, project, customers, team, members = [], defaults = {}, submitLabel }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; project?: Project; customers: { id: string; name: string }[];
  team: TeamMember[]; members?: string[]; defaults?: { customerId?: string; leadId?: string; name?: string; location?: string; budget?: number | null; description?: string | null; responsibleId?: string }; submitLabel: string;
}) {
  const [state, action] = useFormAction(serverAction);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      {defaults.leadId && <input type="hidden" name="leadId" value={defaults.leadId} />}
      <Field label="Job name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={project?.name ?? defaults.name} placeholder="e.g. Campbell bathroom remodel" required autoFocus={!project} /></Field>
      <Field label="Customer" htmlFor="customerId" optional>
        <Select id="customerId" name="customerId" defaultValue={project?.customer_id ?? defaults.customerId ?? ""} placeholder="No customer" options={customers.map((c) => ({ value: c.id, label: c.name }))} />
      </Field>
      <Field label="Description" htmlFor="description" optional><Textarea id="description" name="description" rows={3} defaultValue={project?.description ?? defaults.description ?? ""} /></Field>
      <Field label="Location" htmlFor="location" optional><Input id="location" name="location" defaultValue={project?.location ?? defaults.location ?? ""} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="startDate" error={fe.startDate} optional><Input id="startDate" name="startDate" type="date" defaultValue={project?.start_date ?? ""} /></Field>
        <Field label="Expected completion" htmlFor="expectedEndDate" error={fe.expectedEndDate} optional><Input id="expectedEndDate" name="expectedEndDate" type="date" defaultValue={project?.expected_end_date ?? ""} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={project?.status ?? "planning"} options={PROJECT_STATUSES} /></Field>
        <Field label="Budget" htmlFor="budget" error={fe.budget} optional><Input id="budget" name="budget" inputMode="decimal" defaultValue={project?.budget ?? defaults.budget ?? ""} placeholder="0" /></Field>
      </div>
      {team.length > 1 && (
        <Field label="Responsible" htmlFor="responsibleId" hint="The person who answers for this job">
          <Select id="responsibleId" name="responsibleId" defaultValue={project?.responsible_id ?? defaults.responsibleId ?? ""} options={team.map((m) => ({ value: m.user_id, label: m.full_name || "Team member" }))} />
        </Field>
      )}
      {team.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Crew on this job</legend>
          <div className="flex flex-wrap gap-2">
            {team.map((m) => (
              <label key={m.user_id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-concrete-300 bg-white px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-concrete-100">
                <input type="checkbox" name="memberIds" value={m.user_id} defaultChecked={members.includes(m.user_id)} className="h-4 w-4 accent-safety-500" />{m.full_name || "Team member"}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <SubmitButton size="lg" block pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
