import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ResetForm } from "../auth-forms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage() {
  // The emailed link signs the user in via /auth/callback first.
  const s = await getSession();
  if (!s.user) redirect("/forgot-password");
  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold">Choose a new password</h1>
      <ResetForm />
    </>
  );
}
