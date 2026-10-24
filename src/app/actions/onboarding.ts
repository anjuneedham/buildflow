"use server";

import { redirect } from "next/navigation";
import { syncClaims } from "@/server/claims";
import { defaultBusinessConfig } from "@/lib/data/business";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { now } from "@/lib/data/db";
import { resolveRegion, resolveServices, syncBusinessToPosts } from "@/lib/data/business";
import { tenant } from "@/lib/data/tenant";
import { DEFAULT_PLAN_ID } from "@/lib/plans";
import { getPlan } from "@/lib/plans.server";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { uploadImage, validImage } from "@/lib/storage";
import { businessSchema, customerSchema, docId, parseForm, projectSchema, type ActionState } from "@/lib/validation";

async function owner() {
  const s = await requireUser("/onboarding");
  if (!s.membership || s.membership.role !== "owner") redirect("/onboarding");
  return { business: s.membership.business, user: s.user, profile: s.profile };
}

async function advance(businessId: string, step: number, current: number) {
  if (current < step) await db().collection("businesses").doc(businessId).update({ onboarding_step: step, updated_at: now() });
  redirect(`/onboarding?step=${step}`);
}

// Step 2: create the business (tenant) atomically with its slug, owner membership and trial.
export async function createBusiness(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser("/onboarding");
  const parsed = parseForm(businessSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const region = await resolveRegion(d.regionId);
  const userRef = db().collection("users").doc(s.user.id);
  const ownerName = d.ownerName || s.profile?.full_name || "";

  if (s.membership) {
    if (s.membership.role !== "owner") redirect("/app");
    await tenant(s.membership.business.id).root.update({
      name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, country_code: d.countryCode,
      region_id: region?.id ?? null, region, city: d.city ?? null, updated_at: now(),
    });
    await syncBusinessToPosts(s.membership.business.id);
  } else {
    const plan = await getPlan(DEFAULT_PLAN_ID);
    const base = slugify(d.name) || "contractor";
    try {
      await db().runTransaction(async (tx) => {
        const user = await tx.get(userRef);
        if (user.get("business_id")) throw new Error("already-has-business");
        let slug = base;
        for (let i = 2; ; i++) {
          if (!(await tx.get(db().collection("slugs").doc(slug))).exists) break;
          slug = i > 20 ? `${base}-${Math.random().toString(36).slice(2, 7)}` : `${base}-${i}`;
        }
        const bizRef = db().collection("businesses").doc();
        const ts = now();
        tx.set(db().collection("slugs").doc(slug), { business_id: bizRef.id });
        tx.set(bizRef, {
          owner_id: s.user.id, name: d.name, name_lower: d.name.toLowerCase(), slug, tagline: null, description: null,
          phone: d.phone ?? null, email: d.email ?? s.user.email ?? null, website: null, social_links: {}, years_in_business: null,
          logo_url: null, cover_url: null, country_code: d.countryCode, region_id: region?.id ?? null, region, city: d.city ?? null,
          service_area: null, primary_service_id: null, primary_service: null, service_ids: [], services: [],
          is_public: true, is_verified: false, is_suspended: false, is_demo: false, onboarding_step: 3, onboarding_completed_at: null,
          follower_count: 0, post_count: 0, completed_project_count: 0, created_at: ts, updated_at: ts,
        });
        tx.set(bizRef.collection("members").doc(s.user.id), { role: "owner", full_name: ownerName, avatar_url: s.profile?.avatar_url ?? null, created_at: ts });
        // Private settings (FIRESTORE_SCHEMA_V2.md §3.3): never rendered publicly.
        tx.set(bizRef.collection("private").doc("config"), defaultBusinessConfig());
        tx.set(db().collection("subscriptions").doc(bizRef.id), {
          business_id: bizRef.id, plan_id: plan.id, status: "trialing", seats: 1,
          trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(), current_period_end: null, cancel_at_period_end: false,
          stripe_customer_id: null, stripe_subscription_id: null, created_at: ts,
        });
        tx.set(userRef, { business_id: bizRef.id, business_role: "owner", account_type: "contractor", full_name: ownerName }, { merge: true });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "already-has-business") redirect("/app");
      console.error(e);
      return { ok: false, error: "We couldn't create your business. Please try again." };
    }
  }
  if (d.ownerName) await userRef.set({ full_name: d.ownerName }, { merge: true });
  // The current session falls back to Firestore until the next sign-in picks up the claims.
  await syncClaims(s.user.id).catch((e) => console.error("claims sync failed", e));
  redirect("/onboarding?step=3");
}

// Step 3: services.
export async function saveServices(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business } = await owner();
  const primary = docId.safeParse(fd.get("primaryServiceId"));
  if (!primary.success) return { ok: false, error: "Pick your main service", fieldErrors: { primaryServiceId: ["Pick your main service"] } };
  const extra = fd.getAll("serviceIds").map(String).filter((v) => docId.safeParse(v).success);
  const services = await resolveServices(Array.from(new Set([primary.data, ...extra])).slice(0, 15));
  const primaryService = services.find((x) => x.id === primary.data);
  if (!primaryService) return { ok: false, error: "Pick your main service" };
  await tenant(business.id).root.update({ primary_service_id: primaryService.id, primary_service: primaryService, services, service_ids: services.map((x) => x.id), updated_at: now() });
  await advance(business.id, 4, business.onboarding_step);
  return { ok: true };
}

// Step 4: where you work + about.
export async function saveServiceArea(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business } = await owner();
  const parsed = parseForm(z.object({
    regionId: z.preprocess((v) => (v === "" ? undefined : v), docId.optional()),
    city: z.string().trim().max(120).optional(),
    serviceArea: z.string().trim().max(300).optional(),
    description: z.string().trim().max(3000).optional(),
    yearsInBusiness: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(0).max(200).optional()),
  }), fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const region = d.regionId ? await resolveRegion(d.regionId) : business.region;
  await tenant(business.id).root.update({
    region_id: region?.id ?? null, region, city: d.city || business.city || null, service_area: d.serviceArea || null,
    description: d.description || null, years_in_business: d.yearsInBusiness ?? null, updated_at: now(),
  });
  await syncBusinessToPosts(business.id);
  await advance(business.id, 5, business.onboarding_step);
  return { ok: true };
}

// Step 5: logo, cover, links.
export async function saveBranding(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business } = await owner();
  const patch: Record<string, unknown> = { updated_at: now() };
  for (const [field, column] of [["logo", "logo_url"], ["cover", "cover_url"]] as const) {
    const f = fd.get(field);
    if (validImage(f)) {
      const r = await uploadImage("public", business.id, f);
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
  if (website && !z.string().url().safeParse(website).success) return { ok: false, error: "Website link looks wrong", fieldErrors: { website: ["Enter a valid link"] } };
  const social = { ...business.social_links, instagram: link("instagram"), facebook: link("facebook") };
  patch.website = website ?? business.website ?? null;
  patch.social_links = Object.fromEntries(Object.entries(social).filter(([, v]) => v));
  await tenant(business.id).root.update(patch);
  if (patch.logo_url) await syncBusinessToPosts(business.id);
  await advance(business.id, 6, business.onboarding_step);
  return { ok: true };
}

// Step 6: first customer or project.
export async function saveFirstRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business, user } = await owner();
  const t = tenant(business.id);
  const kind = fd.get("kind");
  if (kind === "customer") {
    const parsed = parseForm(customerSchema, fd);
    if (!parsed.data) return parsed.state;
    const d = parsed.data;
    await t.col("customers").add({ name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, address: null, city: d.city ?? null, notes: null, status: "active", created_by: user.id, created_at: now(), updated_at: now() });
  } else if (kind === "project") {
    const parsed = parseForm(projectSchema, fd);
    if (!parsed.data) return parsed.state;
    const d = parsed.data;
    await t.col("projects").add({
      name: d.name, customer_id: null, customer_name: null, lead_id: null, description: null, location: d.location ?? null, start_date: null, expected_end_date: null,
      status: d.status, budget: null, completed_at: d.status === "completed" ? now() : null, member_ids: [user.id], task_total: 0, task_done: 0, created_by: user.id, created_at: now(), updated_at: now(),
    });
    if (d.status === "completed") await t.root.update({ completed_project_count: (await t.col("projects").where("status", "==", "completed").count().get()).data().count });
  }
  await advance(business.id, 7, business.onboarding_step);
  return { ok: true };
}

export async function skipStep(fd: FormData) {
  const { business } = await owner();
  await advance(business.id, Math.min(7, Math.max(3, Number(fd.get("to")) || 7)), business.onboarding_step);
}

export async function finishOnboarding() {
  const { business } = await owner();
  await tenant(business.id).root.update({ onboarding_step: 7, onboarding_completed_at: now(), updated_at: now() });
  redirect("/app?welcome=1");
}
