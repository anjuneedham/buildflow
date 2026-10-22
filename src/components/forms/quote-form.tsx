"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitQuoteRequest } from "@/app/actions/social";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Service } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

export function QuoteForm({ businessId, businessName, services, kind = "quote", defaults }: {
  businessId: string; businessName: string; services: Pick<Service, "id" | "name">[]; kind?: "quote" | "contact"; defaults?: { name?: string; email?: string };
}) {
  const [state, action] = useActionState(submitQuoteRequest, {} as ActionState);
  if (state.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <CheckCircle2 className="h-12 w-12 text-site-green" />
        <p className="mt-3 text-lg font-bold">{state.message}</p>
        <p className="mt-1 text-sm text-ink-500">{businessName} received your details. Keep your phone handy.</p>
      </div>
    );
  }
  const fe = state.fieldErrors ?? {};
  const isQuote = kind === "quote";
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="kind" value={kind} />
      {/* Honeypot: hidden from people, filled by bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Field label="Your name" htmlFor={`${kind}-name`} error={fe.name}><Input id={`${kind}-name`} name="name" autoComplete="name" defaultValue={defaults?.name} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor={`${kind}-phone`} error={fe.phone}><Input id={`${kind}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email" htmlFor={`${kind}-email`} error={fe.email}><Input id={`${kind}-email`} name="email" type="email" inputMode="email" autoComplete="email" defaultValue={defaults?.email} /></Field>
      </div>
      {isQuote && services.length > 0 && (
        <Field label="Service needed" htmlFor="quote-service" optional>
          <Select id="quote-service" name="serviceId" options={services.map((s) => ({ value: s.id, label: s.name }))} placeholder="Choose a service" />
        </Field>
      )}
      {isQuote && <Field label="Project location" htmlFor="quote-location" optional><Input id="quote-location" name="location" placeholder="e.g. Liguanea, St Andrew" /></Field>}
      <Field label={isQuote ? "Describe the job" : "Message"} htmlFor={`${kind}-desc`} error={fe.description}>
        <Textarea id={`${kind}-desc`} name="description" rows={4} placeholder={isQuote ? "What needs doing, rough size, anything special…" : "How can they help?"} required />
      </Field>
      {isQuote && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget" htmlFor="quote-budget" optional>
            <Select id="quote-budget" name="budgetRange" placeholder="Not sure yet" options={["Under 250k", "250k – 500k", "500k – 1M", "1M – 5M", "5M+"].map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label="Timeline" htmlFor="quote-timeline" optional>
            <Select id="quote-timeline" name="timeline" placeholder="Flexible" options={["As soon as possible", "Within 1 month", "1 – 3 months", "3+ months"].map((v) => ({ value: v, label: v }))} />
          </Field>
        </div>
      )}
      <SubmitButton block size="lg" pendingText="Sending…">{isQuote ? "Request a quote" : "Send message"}</SubmitButton>
      <p className="text-center text-xs text-ink-500">Your details go only to {businessName}.</p>
    </form>
  );
}
