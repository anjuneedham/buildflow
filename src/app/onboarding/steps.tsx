"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Briefcase, PartyPopper, UserPlus } from "lucide-react";
import { createBusiness, finishOnboarding, saveBranding, saveFirstRecord, saveServiceArea, saveServices, skipStep } from "@/app/actions/onboarding";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { Business, Location, Service } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

const init: ActionState = {};

function StepShell({ title, subtitle, children, back, skipTo }: { title: string; subtitle?: string; children: ReactNode; back?: number; skipTo?: number }) {
  return (
    <section>
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
      <div className="mt-4 flex items-center justify-between text-sm">
        {back ? <Link href={`/onboarding?step=${back}`} className="font-semibold text-ink-500 hover:text-ink">← Back</Link> : <span />}
        {skipTo && (
          <form action={skipStep}><input type="hidden" name="to" value={skipTo} /><button className="font-semibold text-ink-500 underline hover:text-ink">Skip for now</button></form>
        )}
      </div>
    </section>
  );
}

export function BusinessStep({ business, regions, ownerName, email }: { business: Business | null; regions: Location[]; ownerName: string; email: string }) {
  const [state, action] = useActionState(createBusiness, init);
  const fe = state.fieldErrors ?? {};
  return (
    <StepShell title="Tell us about your business" subtitle="This is what customers will see first. You can change it later.">
      <form action={action} className="space-y-4">
        <FormError message={state.fieldErrors ? undefined : state.error} />
        <Field label="Business name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={business?.name} placeholder="e.g. Reid Construction" required autoFocus /></Field>
        <Field label="Owner name" htmlFor="ownerName"><Input id="ownerName" name="ownerName" defaultValue={ownerName} autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={business?.phone ?? ""} /></Field>
          <Field label="Business email" htmlFor="email" error={fe.email} optional><Input id="email" name="email" type="email" defaultValue={business?.email ?? email} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Country" htmlFor="countryCode">
            <Select id="countryCode" name="countryCode" defaultValue={business?.country_code ?? "JM"} options={[{ value: "JM", label: "Jamaica" }]} />
          </Field>
          <Field label="Parish / region" htmlFor="regionId" optional>
            <Select id="regionId" name="regionId" defaultValue={business?.region_id ?? ""} placeholder="Choose…" options={regions.map((r) => ({ value: r.id, label: r.name }))} />
          </Field>
          <Field label="City / area" htmlFor="city" optional><Input id="city" name="city" defaultValue={business?.city ?? ""} placeholder="e.g. Half Way Tree" /></Field>
        </div>
        <SubmitButton size="lg" block pendingText="Saving…">Continue</SubmitButton>
        <p className="text-center text-xs text-ink-500">Joining someone else&apos;s team? Open the invite link they sent you instead.</p>
      </form>
    </StepShell>
  );
}

export function ServicesStep({ services, selected, primary }: { services: Service[]; selected: string[]; primary: string | null }) {
  const [state, action] = useActionState(saveServices, init);
  const [main, setMain] = useState(primary ?? "");
  const [extra, setExtra] = useState(new Set(selected.filter((s) => s !== primary)));
  return (
    <StepShell title="What services do you offer?" subtitle="Pick your main trade, then anything else you do." back={2}>
      <form action={action} className="space-y-6">
        <FormError message={state.error} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Main service</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {services.map((s) => (
              <label key={s.id} className={cn("flex min-h-12 cursor-pointer items-center rounded-xl border-2 px-3 text-sm font-semibold", main === s.id ? "border-safety-500 bg-safety-50" : "border-concrete-200 bg-white")}>
                <input type="radio" name="primaryServiceId" value={s.id} checked={main === s.id} onChange={() => setMain(s.id)} className="sr-only" />{s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Other services <span className="font-normal text-ink-500">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {services.filter((s) => s.id !== main).map((s) => {
              const on = extra.has(s.id);
              return (
                <label key={s.id} className={cn("cursor-pointer rounded-full border px-3.5 py-2 text-sm font-semibold", on ? "border-ink bg-ink text-white" : "border-concrete-300 bg-white")}>
                  <input type="checkbox" name="serviceIds" value={s.id} checked={on} className="sr-only"
                    onChange={() => setExtra((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
                  {s.name}
                </label>
              );
            })}
          </div>
        </fieldset>
        <SubmitButton size="lg" block disabled={!main}>Continue</SubmitButton>
      </form>
    </StepShell>
  );
}

export function ServiceAreaStep({ business, regions }: { business: Business; regions: Location[] }) {
  const [state, action] = useActionState(saveServiceArea, init);
  return (
    <StepShell title="Where do you work?" subtitle="Customers search by location. Add a short description so they know what you're about." back={3} skipTo={5}>
      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Based in (parish / region)" htmlFor="regionId"><Select id="regionId" name="regionId" defaultValue={business.region_id ?? ""} placeholder="Choose…" options={regions.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="City / area" htmlFor="city"><Input id="city" name="city" defaultValue={business.city ?? ""} /></Field>
        </div>
        <Field label="Areas you serve" htmlFor="serviceArea" hint="e.g. Kingston, St Andrew & St Catherine, or Island-wide" optional><Input id="serviceArea" name="serviceArea" defaultValue={business.service_area ?? ""} /></Field>
        <Field label="About your business" htmlFor="description" optional><Textarea id="description" name="description" rows={4} defaultValue={business.description ?? ""} placeholder="What you specialise in, the kind of jobs you take on, what customers can expect." /></Field>
        <Field label="Years in business" htmlFor="yearsInBusiness" optional><Input id="yearsInBusiness" name="yearsInBusiness" type="number" inputMode="numeric" min={0} max={200} defaultValue={business.years_in_business ?? ""} className="max-w-32" /></Field>
        <SubmitButton size="lg" block>Continue</SubmitButton>
      </form>
    </StepShell>
  );
}

export function BrandingStep({ business }: { business: Business }) {
  const [state, action] = useActionState(saveBranding, init);
  const [logo, setLogo] = useState<string | null>(business.logo_url);
  const [cover, setCover] = useState<string | null>(business.cover_url);
  const preview = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) set(URL.createObjectURL(f)); };
  return (
    <StepShell title="Add your logo and a cover photo" subtitle="Profiles with photos get far more quote requests. A clear photo of your work makes a great cover." back={4} skipTo={6}>
      <form action={action} className="space-y-5">
        <FormError message={state.error} />
        <div className="overflow-hidden rounded-xl border border-concrete-200 bg-white">
          <div className="relative h-32 bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
            <label className={buttonClasses({ size: "sm", variant: "secondary", className: "absolute bottom-2 right-2 cursor-pointer" })}>
              {cover ? "Change cover" : "Add cover photo"}<input type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={preview(setCover)} />
            </label>
          </div>
          <div className="flex items-center gap-3 p-3">
            <Avatar src={logo} name={business.name} size="lg" square className="-mt-10 ring-4 ring-white" />
            <label className={buttonClasses({ size: "sm", variant: "outline", className: "cursor-pointer" })}>
              {logo ? "Change logo" : "Upload logo"}<input type="file" name="logo" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={preview(setLogo)} />
            </label>
          </div>
        </div>
        <Field label="Website" htmlFor="website" error={state.fieldErrors?.website} optional><Input id="website" name="website" defaultValue={business.website ?? ""} placeholder="yourbusiness.com" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram" htmlFor="instagram" optional><Input id="instagram" name="instagram" defaultValue={business.social_links?.instagram ?? ""} placeholder="instagram.com/…" /></Field>
          <Field label="Facebook" htmlFor="facebook" optional><Input id="facebook" name="facebook" defaultValue={business.social_links?.facebook ?? ""} placeholder="facebook.com/…" /></Field>
        </div>
        <SubmitButton size="lg" block pendingText="Uploading…">Continue</SubmitButton>
      </form>
    </StepShell>
  );
}

export function FirstRecordStep() {
  const [state, action] = useActionState(saveFirstRecord, init);
  const [kind, setKind] = useState<"project" | "customer">("project");
  const fe = state.fieldErrors ?? {};
  return (
    <StepShell title="Add your first job or customer" subtitle="Get a feel for how BuildFlow works. You can add more details later." back={5} skipTo={7}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {([["project", "A project", Briefcase], ["customer", "A customer", UserPlus]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 font-semibold", kind === k ? "border-safety-500 bg-safety-50" : "border-concrete-200 bg-white")}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </div>
      <form action={action} className="space-y-4" key={kind}>
        <input type="hidden" name="kind" value={kind} />
        <FormError message={state.fieldErrors ? undefined : state.error} />
        {kind === "project" ? (
          <>
            <Field label="Project name" htmlFor="name" error={fe.name}><Input id="name" name="name" placeholder="e.g. Brown kitchen remodel" required /></Field>
            <Field label="Location" htmlFor="location" optional><Input id="location" name="location" /></Field>
            <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue="in_progress" options={[{ value: "planning", label: "Planning" }, { value: "upcoming", label: "Upcoming" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }]} /></Field>
          </>
        ) : (
          <>
            <Field label="Customer name" htmlFor="name" error={fe.name}><Input id="name" name="name" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" inputMode="tel" /></Field>
              <Field label="Email" htmlFor="email" error={fe.email} optional><Input id="email" name="email" type="email" /></Field>
            </div>
            <Field label="City / area" htmlFor="city" optional><Input id="city" name="city" /></Field>
          </>
        )}
        <SubmitButton size="lg" block>Save & continue</SubmitButton>
      </form>
    </StepShell>
  );
}

export function FinishStep({ slug }: { slug: string }) {
  return (
    <section className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-safety-50 text-safety-600"><PartyPopper className="h-8 w-8" /></span>
      <h1 className="mt-4 font-display text-2xl font-extrabold">You&apos;re set up!</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-500">Your public profile is live at <b className="break-all text-ink">/contractor/{slug}</b>. Next: post a photo of your best work so customers can find you.</p>
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
        <form action={finishOnboarding}><SubmitButton size="lg" block>Go to my dashboard</SubmitButton></form>
        <ButtonLink href={`/contractor/${slug}`} variant="outline" size="lg">View my public profile</ButtonLink>
      </div>
    </section>
  );
}
