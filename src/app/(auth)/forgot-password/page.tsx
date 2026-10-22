import Link from "next/link";
import { ForgotForm } from "../auth-forms";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">We&apos;ll email you a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-safety-700 hover:underline">Back to log in</Link></p>
    </>
  );
}
