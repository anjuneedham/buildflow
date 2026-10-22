import { MailCheck } from "lucide-react";
import { ResendForm } from "../auth-forms";

export const metadata = { title: "Verify your email", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-safety-50 text-safety-600"><MailCheck className="h-7 w-7" /></span>
      <h1 className="mt-4 text-2xl font-extrabold">Check your email</h1>
      <p className="mt-2 text-sm text-ink-500">We sent a verification link to <b className="text-ink">{email ?? "your inbox"}</b>. Tap it to activate your account and continue.</p>
      {email && <div className="mt-6"><ResendForm email={email} /></div>}
    </div>
  );
}
