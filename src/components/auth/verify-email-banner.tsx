"use client";

import { useState, useTransition } from "react";
import { MailWarning } from "lucide-react";
import { resendVerificationEmail } from "@/app/actions/auth";

/** Shown until the email is verified; verification gates publishing and invites. */
export function VerifyEmailBanner({ email }: { email: string | null }) {
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
      <MailWarning className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message ?? <>Verify your email to publish work and accept invites. We sent a link to {email}.</>}</span>
      <button type="button" disabled={pending} onClick={() => start(async () => setMessage((await resendVerificationEmail()).message))}
        className="min-h-9 font-semibold underline disabled:opacity-50">{pending ? "Sending…" : "Resend email"}</button>
    </div>
  );
}
