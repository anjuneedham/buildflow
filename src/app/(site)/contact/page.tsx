import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the BuildFlow team." };

export default function Contact() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Contact us</h1>
      <p className="mt-3 text-ink-500">Questions about BuildFlow, billing, or a profile on the platform? Email us and a person will reply.</p>
      <a href={`mailto:${env.supportEmail}`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl border border-concrete-200 bg-white px-5 font-semibold hover:bg-concrete-50">
        <Mail className="h-5 w-5 text-safety-500" />{env.supportEmail}
      </a>
      <p className="mt-6 text-sm text-ink-500">Looking to hire a contractor? Use the <b>Request a Quote</b> button on their profile so your request goes straight to them.</p>
    </main>
  );
}
