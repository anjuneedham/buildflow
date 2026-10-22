"use client";

import { useFormAction, useServerAction } from "@/components/ui/use-form-action";
import { Copy, X } from "lucide-react";
import { inviteMember, removeMember, revokeInvite } from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/input";
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
