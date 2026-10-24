"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Image as ImageIcon } from "lucide-react";
import { submitQuoteRequest } from "@/app/actions/social";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Service } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

/** The portfolio post a "Request a similar job" came from. */
export type QuoteReference = { id: string; caption: string | null; serviceId: string | null };

/**
 * The one request form (UX_ARCHITECTURE_V2.md §3.20): what needs doing,
 * name, phone or email. Everything else is optional. The request becomes a
 * lead for this contractor only; it is never shared or sold.
 */
export function QuoteForm({ businessId, businessName, services, defaults, reference }: {
  businessId: string; businessName: string; services: Pick<Service, "id" | "name">[]; defaults?: { name?: string; email?: string }; reference?: QuoteReference | null;
}) {
  const [state, action] = useActionState(submitQuoteRequest, {} as ActionState);
  if (state.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <CheckCircle2 className="h-12 w-12 text-site-green" />
        <p className="mt-3 text-lg font-bold">Request sent</p>
        <p className="mt-1 max-w-sm text-sm text-ink-600">{state.message}</p>
        {defaults?.email && <p className="mt-3 text-sm"><Link href="/account" className="font-semibold text-action underline">See your requests</Link></p>}
      </div>
    );
  }
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="kind" value="quote" />
      {reference && <input type="hidden" name="postId" value={reference.id} />}
      {/* Honeypot: hidden from people, filled by bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      {reference && (
        <p className="flex items-start gap-2 rounded-lg bg-concrete-50 p-3 text-sm text-ink-600"><ImageIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Similar to: {reference.caption ?? "their portfolio post"}</p>
      )}
      <Field label="What needs doing?" htmlFor="quote-desc" error={fe.description}>
        <Textarea id="quote-desc" name="description" rows={4} placeholder="What needs doing, rough size, anything special…" required />
      </Field>
      <Field label="Your name" htmlFor="quote-name" error={fe.name}><Input id="quote-name" name="name" autoComplete="name" defaultValue={defaults?.name} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone (WhatsApp)" htmlFor="quote-phone" error={fe.phone}><Input id="quote-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email" htmlFor="quote-email" error={fe.email}><Input id="quote-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={defaults?.email} /></Field>
      </div>
      <details className="rounded-lg border border-concrete-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-ink-600">More details (optional)</summary>
        <div className="mt-3 space-y-4">
          {services.length > 0 && (
            <Field label="Service" htmlFor="quote-service" optional>
              <Select id="quote-service" name="serviceId" defaultValue={reference?.serviceId ?? ""} options={services.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choose a service" />
            </Field>
          )}
          <Field label="Where is the job?" htmlFor="quote-location" optional><Input id="quote-location" name="location" placeholder="e.g. Liguanea, St Andrew" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget" htmlFor="quote-budget" optional>
              <Select id="quote-budget" name="budgetRange" placeholder="Not sure yet" options={["Under 250k", "250k – 500k", "500k – 1M", "1M – 5M", "5M+"].map((v) => ({ value: v, label: v }))} />
            </Field>
            <Field label="When" htmlFor="quote-timeline" optional>
              <Select id="quote-timeline" name="timeline" placeholder="Flexible" options={["As soon as possible", "Within 1 month", "1 – 3 months", "3+ months"].map((v) => ({ value: v, label: v }))} />
            </Field>
          </div>
        </div>
      </details>
      <SubmitButton block size="lg" pendingText="Sending…">Send request</SubmitButton>
      <p className="text-center text-xs text-ink-500">Your details go only to {businessName}. BuildFlow never sells or shares your request.</p>
    </form>
  );
}
