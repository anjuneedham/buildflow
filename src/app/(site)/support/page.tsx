import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Support", description: "Get help with BuildFlow: contact us, common fixes, and how to report a problem." };

export default function Support() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Support</h1>
      <p className="mt-3 text-ink-500">A person reads every message. We usually reply within two working days.</p>
      <a href={`mailto:${LEGAL.contactEmail}`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl border border-concrete-200 bg-white px-5 font-semibold hover:bg-concrete-50">
        <Mail className="h-5 w-5 text-safety-500" />{LEGAL.contactEmail}
      </a>

      <h2 className="mt-10 font-display text-xl font-extrabold">Common fixes</h2>
      <dl className="mt-3 space-y-4">
        <div><dt className="font-bold">I didn&apos;t get the verification email</dt><dd className="text-ink-600">Check spam, then open <Link className="underline" href="/account">Account</Link> and tap Resend. Verification is needed before you can publish work.</dd></div>
        <div><dt className="font-bold">I forgot my password</dt><dd className="text-ink-600">Use <Link className="underline" href="/forgot-password">Forgot password</Link>. The link works once.</dd></div>
        <div><dt className="font-bold">A photo won&apos;t upload</dt><dd className="text-ink-600">Use a JPG, PNG or WEBP photo. iPhone HEIC photos are not supported yet; change the camera to &ldquo;Most Compatible&rdquo; or share the photo as JPEG. BuildFlow shrinks large photos before sending them.</dd></div>
        <div><dt className="font-bold">I want to delete my account</dt><dd className="text-ink-600">See <Link className="underline" href="/delete-account">how to delete your account</Link>.</dd></div>
      </dl>

      <h2 className="mt-10 font-display text-xl font-extrabold">Report a problem with a post, review or business</h2>
      <p className="mt-2 text-ink-600">Log in, open the post, review or profile and choose <b>Report</b>. Our team reviews every report. For anything urgent or unsafe, email us as well.</p>
    </main>
  );
}
