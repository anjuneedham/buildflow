import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function AccountDeleted() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <CheckCircle2 className="h-14 w-14 text-site-green" />
      <h1 className="mt-4 font-display text-2xl font-extrabold">Your account has been deleted</h1>
      <p className="mt-2 text-ink-500">Your data has been removed as described in our Privacy Policy. If you subscribed through Google Play, remember to cancel that in the Play Store.</p>
      <ButtonLink href="/" className="mt-6">Back to BuildFlow</ButtonLink>
    </main>
  );
}
