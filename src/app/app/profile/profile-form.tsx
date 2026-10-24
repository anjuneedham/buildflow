"use client";

import { useFormAction } from "@/components/ui/use-form-action";
import { useState } from "react";
import { updateBusinessProfile } from "@/app/actions/business";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionToast } from "@/components/ui/toast";
import type { Business, Location, Service } from "@/lib/types";

export function ProfileForm({ business: b, services, regions, selected }: { business: Business; services: Service[]; regions: Location[]; selected: string[] }) {
  const [state, action] = useFormAction(updateBusinessProfile);
  const [logo, setLogo] = useState(b.logo_url);
  const [cover, setCover] = useState(b.cover_url);
  useActionToast(state);
  const fe = state.fieldErrors ?? {};
  const preview = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) set(URL.createObjectURL(f)); };
  const accept = "image/jpeg,image/png,image/webp";
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <Card className="overflow-hidden">
        <div className="relative h-32 bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
          <label className={buttonClasses({ size: "sm", variant: "secondary", className: "absolute bottom-2 right-2 cursor-pointer" })}>Change cover<input type="file" name="cover" accept={accept} className="sr-only" onChange={preview(setCover)} /></label>
        </div>
        <div className="flex items-center gap-3 p-3">
          <Avatar src={logo} name={b.name} size="lg" square className="-mt-10 ring-4 ring-white" />
          <label className={buttonClasses({ size: "sm", variant: "outline", className: "cursor-pointer" })}>Change logo<input type="file" name="logo" accept={accept} className="sr-only" onChange={preview(setLogo)} /></label>
          {(fe.logo || fe.cover) && <p role="alert" className="text-sm text-site-red">{fe.logo?.[0] ?? fe.cover?.[0]}</p>}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-bold">Basics</h2>
        <Field label="Business name" htmlFor="name" error={fe.name}><Input id="name" name="name" defaultValue={b.name} required /></Field>
        <Field label="Tagline" htmlFor="tagline" hint="One line customers see under your name." optional><Input id="tagline" name="tagline" maxLength={140} defaultValue={b.tagline ?? ""} placeholder="e.g. Licensed electrical work, done safely and on time." /></Field>
        <Field label="About" htmlFor="description" optional><Textarea id="description" name="description" rows={5} defaultValue={b.description ?? ""} /></Field>
        <Field label="Years in business" htmlFor="yearsInBusiness" error={fe.yearsInBusiness} optional><Input id="yearsInBusiness" name="yearsInBusiness" type="number" min={0} max={200} defaultValue={b.years_in_business ?? ""} className="max-w-32" /></Field>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-bold">Services</h2>
        <Field label="Main service" htmlFor="primaryServiceId"><Select id="primaryServiceId" name="primaryServiceId" defaultValue={b.primary_service_id ?? ""} placeholder="Choose…" options={services.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">All services you offer</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-concrete-300 bg-white px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-concrete-100">
                <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={selected.includes(s.id)} className="h-4 w-4 accent-safety-500" />{s.name}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-bold">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parish / region" htmlFor="regionId"><Select id="regionId" name="regionId" defaultValue={b.region_id ?? ""} placeholder="Choose…" options={regions.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="City / area" htmlFor="city"><Input id="city" name="city" defaultValue={b.city ?? ""} /></Field>
        </div>
        <Field label="Service area" htmlFor="serviceArea" optional><Input id="serviceArea" name="serviceArea" defaultValue={b.service_area ?? ""} /></Field>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-bold">Contact & links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" optional><Input id="phone" name="phone" type="tel" defaultValue={b.phone ?? ""} /></Field>
          <Field label="Email" htmlFor="email" error={fe.email} optional><Input id="email" name="email" type="email" defaultValue={b.email ?? ""} /></Field>
        </div>
        <Field label="Website" htmlFor="website" error={fe.website} optional><Input id="website" name="website" defaultValue={b.website ?? ""} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Instagram" htmlFor="instagram" error={fe.instagram} optional><Input id="instagram" name="instagram" defaultValue={b.social_links?.instagram ?? ""} /></Field>
          <Field label="Facebook" htmlFor="facebook" error={fe.facebook} optional><Input id="facebook" name="facebook" defaultValue={b.social_links?.facebook ?? ""} /></Field>
          <Field label="TikTok" htmlFor="tiktok" error={fe.tiktok} optional><Input id="tiktok" name="tiktok" defaultValue={b.social_links?.tiktok ?? ""} /></Field>
        </div>
      </Card>

      <Card className="p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="isPublic" defaultChecked={b.is_public} className="mt-1 h-5 w-5 accent-safety-500" />
          <span><span className="font-bold">Public profile</span><span className="block text-sm text-ink-500">Show your profile and posts in Explore and search engines. Your CRM data is always private.</span></span>
        </label>
      </Card>
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 md:bottom-4"><SubmitButton size="lg" block pendingText="Saving…" className="shadow-lg">Save profile</SubmitButton></div>
    </form>
  );
}
