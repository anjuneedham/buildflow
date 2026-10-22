"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { HardHat, Home } from "lucide-react";
import { requestPasswordReset, resendVerification, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/input";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

const initial: ActionState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-safety-700 hover:underline">Forgot password?</Link></div>
      <SubmitButton block size="lg" pendingText="Signing in…">Log in</SubmitButton>
    </form>
  );
}

export function SignUpForm({ defaultType }: { defaultType: "contractor" | "customer" }) {
  const [state, action] = useActionState(signUp, initial);
  const [type, setType] = useState(defaultType);
  const options = [
    { value: "contractor", label: "I run a construction business", sub: "Manage jobs & get discovered", icon: HardHat },
    { value: "customer", label: "I'm looking to hire", sub: "Free: browse & request quotes", icon: Home },
  ] as const;
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">I&apos;m signing up as…</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors", type === o.value ? "border-safety-500 bg-safety-50" : "border-concrete-200 hover:border-concrete-300")}>
              <input type="radio" name="accountType" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="sr-only" />
              <o.icon className={cn("h-5 w-5", type === o.value ? "text-safety-600" : "text-ink-500")} />
              <span className="text-sm font-bold leading-tight">{o.label}</span>
              <span className="text-xs text-ink-500">{o.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Your name" htmlFor="fullName" error={state.fieldErrors?.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton block size="lg" pendingText="Creating account…">{type === "contractor" ? "Create account & set up business" : "Create free account"}</SubmitButton>
      <p className="text-center text-xs text-ink-500">By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state.ok) return <FormSuccess message={state.message} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email ?? state.error}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton block size="lg" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, initial);
  if (state.ok) return <div className="space-y-4"><FormSuccess message={state.message} /><ButtonLink href="/app" block>Continue</ButtonLink></div>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton block size="lg">Update password</SubmitButton>
    </form>
  );
}

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerification, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      {state.ok ? <FormSuccess message={state.message} /> : <FormError message={state.error} />}
      <SubmitButton variant="outline" block>Resend email</SubmitButton>
    </form>
  );
}
