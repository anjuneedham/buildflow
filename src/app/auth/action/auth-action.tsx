"use client";

import { useEffect, useState, type FormEvent } from "react";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/input";
import { clientAuth } from "@/lib/firebase/client";

export function AuthAction({ mode, oobCode }: { mode: string; oobCode: string }) {
  const valid = Boolean(oobCode) && (mode === "verifyEmail" || mode === "resetPassword");
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">(valid ? "loading" : "error");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!valid) return;
    if (mode === "verifyEmail") applyActionCode(clientAuth(), oobCode).then(() => setStatus("done"), () => setStatus("error"));
    else verifyPasswordResetCode(clientAuth(), oobCode).then((e) => { setEmail(e); setStatus("ready"); }, () => setStatus("error"));
  }, [mode, oobCode, valid]);

  async function onReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? "");
    if (pw.length < 8) return setError("Use at least 8 characters");
    if (pw !== fd.get("confirm")) return setError("Passwords don't match");
    try {
      await confirmPasswordReset(clientAuth(), oobCode, pw);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "loading") return <p className="text-ink-500">Checking your link…</p>;
  if (status === "error") return <div className="space-y-4"><FormError message="This link is invalid or has expired. Please request a new one." /><ButtonLink href="/login" block>Back to log in</ButtonLink></div>;
  if (status === "done") return (
    <div className="space-y-4">
      <FormSuccess message={mode === "verifyEmail" ? "Your email is verified." : "Password updated. Log in with your new password."} />
      <ButtonLink href="/login" block>Continue</ButtonLink>
    </div>
  );
  return (
    <form onSubmit={onReset} className="space-y-4">
      <h1 className="text-2xl font-extrabold">Choose a new password</h1>
      <p className="text-sm text-ink-500">For {email}</p>
      <FormError message={error} />
      <Field label="New password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="new-password" required /></Field>
      <Field label="Confirm password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <Button type="submit" block size="lg">Update password</Button>
    </form>
  );
}
