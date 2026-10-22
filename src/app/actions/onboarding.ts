"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { uploadImage, validImage } from "@/lib/storage";
import { businessSchema, customerSchema, parseForm, projectSchema, type ActionState } from "@/lib/validation";

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const base = slugify(name) || "contractor";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase.from("businesses").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function current() {
  const s = await requireUser("/onboarding");
  if (!s.membership || s.membership.role !== "owner") redirect("/onboarding");
  return { supabase: await createClient(), business: s.membership.business, user: s.user };
}

async function advance(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string, step: number) {
  await supabase.from("businesses").update({ onboarding_step: step }).eq("id", businessId).lt("onboarding_step", step);
  revalidatePath("/onboarding");
  redirect(`/onboarding?step=${step}`);
}

// Step 2: create the business (tenant).
export async function createBusiness(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser("/onboarding");
  const parsed = parseForm(businessSchema, fd);
  if (!parsed.data) return parsed.state;
  const supabase = await createClient();
  const d = parsed.data;

  if (s.membership) {
    // Already created: allow edits from the back button.
    await supabase.from("businesses").update({ name: d.name, phone: d.phone ?? null, email: d.email ?? null, country_code: d.countryCode, region_id: d.regionId ?? null, city: d.city ?? null }).eq("id", s.membership.business.id);
  } else {
    const { error } = await supabase.from("businesses").insert({
      owner_id: s.user.id, name: d.name, slug: await uniqueSlug(supabase, d.name), phone: d.phone ?? null,
      email: d.email ?? s.user.email ?? null, country_code: d.countryCode, region_id: d.regionId ?? null, city: d.city ?? null, onboarding_step: 3,
    });
    if (error) return { ok: false, error: "We couldn't create your business. Please try again." };
  }
  if (d.ownerName) await supabase.from("profiles").update({ full_name: d.ownerName }).eq("id", s.user.id);
  revalidatePath("/", "layout");
  redirect("/onboarding?step=3");
}

// Step 3: services.
export async function saveServices(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, business } = await current();
  const primary = z.string().uuid().safeParse(fd.get("primaryServiceId"));
  if (!primary.success) return { ok: false, error: "Pick your main service", fieldErrors: { primaryServiceId: ["Pick your main service"] } };
  const extra = fd.getAll("serviceIds").map(String).filter((v) => z.string().uuid().safeParse(v).success);
  const all = Array.from(new Set([primary.data, ...extra])).slice(0, 15);
  await supabase.from("businesses").update({ primary_service_id: primary.data }).eq("id", business.id);
  await supabase.from("business_services").delete().eq("business_id", business.id);
  const { error } = await supabase.from("business_services").insert(all.map((service_id) => ({ business_id: business.id, service_id })));
  if (error) return { ok: false, error: "Couldn't save services." };
  await advance(supabase, business.id, 4);
  return { ok: true };
}

// Step 4: where you work + about.
export async function saveServiceArea(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, business } = await current();
  const parsed = parseForm(z.object({
    regionId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
    city: z.string().trim().max(120).optional(),
    serviceArea: z.string().trim().max(300).optional(),
    description: z.string().trim().max(3000).optional(),
    yearsInBusiness: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0).max(200).optional()),
  }), fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  await supabase.from("businesses").update({
    region_id: d.regionId ?? business.region_id, city: d.city || business.city, service_area: d.serviceArea || null,
    description: d.description || null, years_in_business: d.yearsInBusiness ?? null,
  }).eq("id", business.id);
  await advance(supabase, business.id, 5);
  return { ok: true };
}

// Step 5: logo, cover, links.
export async function saveBranding(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, business } = await current();
  const patch: Record<string, unknown> = {};
  for (const [field, column] of [["logo", "logo_url"], ["cover", "cover_url"]] as const) {
    const f = fd.get(field);
    if (validImage(f)) {
      const r = await uploadImage(supabase, "public-media", business.id, f);
      if ("error" in r) return { ok: false, error: r.error, fieldErrors: { [field]: [r.error!] } };
      patch[column] = r.url;
    }
  }
  const link = (k: string) => {
    const v = String(fd.get(k) ?? "").trim();
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  };
  const website = link("website");
  const social = { ...business.social_links, instagram: link("instagram"), facebook: link("facebook") };
  if (website && !z.string().url().safeParse(website).success) return { ok: false, error: "Website link looks wrong", fieldErrors: { website: ["Enter a valid link"] } };
  patch.website = website ?? business.website;
  patch.social_links = Object.fromEntries(Object.entries(social).filter(([, v]) => v));
  await supabase.from("businesses").update(patch).eq("id", business.id);
  await advance(supabase, business.id, 6);
  return { ok: true };
}

// Step 6: first customer or project.
export async function saveFirstRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, business, user } = await current();
  const kind = fd.get("kind");
  if (kind === "customer") {
    const parsed = parseForm(customerSchema, fd);
    if (!parsed.data) return parsed.state;
    const d = parsed.data;
    await supabase.from("customers").insert({ business_id: business.id, name: d.name, phone: d.phone ?? null, email: d.email ?? null, city: d.city ?? null, created_by: user.id });
  } else if (kind === "project") {
    const parsed = parseForm(projectSchema, fd);
    if (!parsed.data) return parsed.state;
    const d = parsed.data;
    await supabase.from("projects").insert({ business_id: business.id, name: d.name, location: d.location ?? null, status: d.status, created_by: user.id });
  }
  await advance(supabase, business.id, 7);
  return { ok: true };
}

export async function skipStep(fd: FormData) {
  const { supabase, business } = await current();
  const to = Math.min(7, Math.max(3, Number(fd.get("to")) || 7));
  await advance(supabase, business.id, to);
}

export async function finishOnboarding() {
  const s = await getSession();
  if (!s.membership) redirect("/onboarding");
  const supabase = await createClient();
  await supabase.from("businesses").update({ onboarding_step: 7, onboarding_completed_at: new Date().toISOString() }).eq("id", s.membership.business.id);
  revalidatePath("/", "layout");
  redirect("/app?welcome=1");
}
