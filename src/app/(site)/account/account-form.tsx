"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { updateAccount } from "@/app/actions/business";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";

export function AccountForm({ name, avatar, email }: { name: string; avatar: string | null; email: string }) {
  const [state, action] = useFormAction(updateAccount);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar src={avatar} name={name} size="lg" />
        <label className="text-sm font-semibold text-safety-700">Change photo<input type="file" name="avatar" accept="image/*" className="mt-1 block text-xs text-ink-500" /></label>
      </div>
      <Field label="Name" htmlFor="fullName" error={state.fieldErrors?.fullName}><Input id="fullName" name="fullName" defaultValue={name} required /></Field>
      <Field label="Email" htmlFor="email" hint="Contact support to change your email."><Input id="email" value={email} disabled readOnly /></Field>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
