"use client";

import { useFormAction, useServerAction } from "@/components/ui/use-form-action";
import { Copy, X } from "lucide-react";
import { inviteMember, removeMember, revokeInvite, setMemberRole } from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field, FormError, FormSuccess, Input, Select } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/server/policy";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";

export function InviteForm() {
  const [state, action] = useFormAction(inviteMember);
  return (
    <form action={action} className="space-y-3">
      {state.ok ? <FormSuccess message={state.message} /> : <FormError message={state.fieldErrors ? undefined : state.error} />}
      <Field label="Email" htmlFor="invite-email" error={state.fieldErrors?.email} hint="We'll create a private invite link for you to send them (email delivery is coming soon).">
        <Input id="invite-email" name="email" type="email" inputMode="email" required />
      </Field>
      <Field label="Role" htmlFor="invite-role" hint={`${ROLE_LABELS.field.label}: ${ROLE_LABELS.field.description} ${ROLE_LABELS.admin.label}: ${ROLE_LABELS.admin.description}`}>
        <Select id="invite-role" name="role" defaultValue="field" options={(["field", "admin"] as const).map((r) => ({ value: r, label: ROLE_LABELS[r].label }))} />
      </Field>
      <SubmitButton>Create invite link</SubmitButton>
    </form>
  );
}

export function RevokeInvite({ token }: { token: string }) {
  const [pending, run] = useServerAction();
  const toast = useToast();
  return (
    <span className="flex shrink-0 gap-1">
      <Button size="sm" variant="ghost" aria-label="Copy invite link" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`); toast("Invite link copied"); }}><Copy className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" aria-label="Revoke invite" disabled={pending} onClick={() => run(() => revokeInvite(token))}><X className="h-4 w-4" /></Button>
    </span>
  );
}

export function RemoveMember({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmationDialog title={`Remove ${name || "this member"}?`} description="They'll lose access to your business data immediately." confirmLabel="Remove"
      onConfirm={() => removeMember(userId)}
      trigger={(open) => <Button size="sm" variant="ghost" onClick={open} className="text-site-red">Remove</Button>} />
  );
}

export function RoleSelect({ userId, role, name }: { userId: string; role: Role; name: string }) {
  const [pending, run] = useServerAction();
  const toast = useToast();
  return (
    <select aria-label={`Role for ${name || "member"}`} defaultValue={role} disabled={pending}
      onChange={(e) => run(() => setMemberRole(userId, e.target.value), (r) => { if (r && r.ok === false) toast(r.error ?? "Couldn't change role", "error"); else toast("Role updated. They'll need to sign in again."); })}
      className="select-chevron min-h-9 rounded-lg border border-concrete-300 bg-white pl-2 pr-8 text-sm">
      {(["admin", "field"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
    </select>
  );
}
