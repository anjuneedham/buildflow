"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness, requireUser } from "@/lib/session";
import { uploadImage, validImage } from "@/lib/storage";
import { businessProfileSchema, inviteSchema, parseForm, type ActionState } from "@/lib/validation";
import { env } from "@/lib/env";

export async function updateBusinessProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.isOwner) return { ok: false, error: "Only the owner can edit the business profile." };
  const supabase = await createClient();
  const parsed = parseForm(businessProfileSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const patch: Record<string, unknown> = {
    name: d.name, tagline: d.tagline ?? null, description: d.description ?? null, phone: d.phone ?? null, email: d.email ?? null,
    website: d.website ?? null, years_in_business: d.yearsInBusiness ?? null, region_id: d.regionId ?? null, city: d.city ?? null,
    service_area: d.serviceArea ?? null, is_public: d.isPublic,
    social_links: Object.fromEntries(Object.entries({ instagram: d.instagram, facebook: d.facebook, tiktok: d.tiktok }).filter(([, v]) => v)),
  };
  for (const [field, column] of [["logo", "logo_url"], ["cover", "cover_url"]] as const) {
    const f = fd.get(field);
    if (validImage(f)) {
      const r = await uploadImage(supabase, "public-media", s.business.id, f);
      if ("error" in r) return { ok: false, error: r.error, fieldErrors: { [field]: [r.error!] } };
      patch[column] = r.url;
    }
  }
  const primary = z.string().uuid().safeParse(fd.get("primaryServiceId"));
  if (primary.success) patch.primary_service_id = primary.data;
  const { error } = await supabase.from("businesses").update(patch).eq("id", s.business.id);
  if (error) return { ok: false, error: "Couldn't save your profile." };

  const serviceIds = Array.from(new Set([...(primary.success ? [primary.data] : []), ...fd.getAll("serviceIds").map(String)]))
    .filter((v) => z.string().uuid().safeParse(v).success).slice(0, 15);
  if (serviceIds.length) {
    await supabase.from("business_services").delete().eq("business_id", s.business.id);
    await supabase.from("business_services").insert(serviceIds.map((service_id) => ({ business_id: s.business.id, service_id })));
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

// ---------------- Team ----------------
export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.isOwner) return { ok: false, error: "Only the owner can invite team members." };
  const parsed = parseForm(inviteSchema, fd);
  if (!parsed.data) return parsed.state;
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_invitations")
    .upsert({ business_id: s.business.id, email: parsed.data.email.toLowerCase(), invited_by: s.user.id }, { onConflict: "business_id,email" })
    .select("token").single();
  if (error) return { ok: false, error: "Couldn't create the invite." };
  revalidatePath("/app/team");
  // Email delivery is a V1.x item; the owner shares this link directly.
  return { ok: true, message: `Invite created. Share this link: ${env.siteUrl}/invite/${data.token}` };
}

export async function revokeInvite(id: string) {
  const s = await requireBusiness();
  const supabase = await createClient();
  await supabase.from("business_invitations").delete().eq("id", id).eq("business_id", s.business.id);
  revalidatePath("/app/team");
  return { ok: true };
}

export async function removeMember(userId: string) {
  const s = await requireBusiness();
  if (!s.isOwner) return { ok: false, error: "Only the owner can remove members." };
  const supabase = await createClient();
  await supabase.from("business_members").delete().eq("business_id", s.business.id).eq("user_id", userId).neq("role", "owner");
  revalidatePath("/app/team");
  return { ok: true };
}

export async function acceptInvite(token: string) {
  await requireUser(`/invite/${token}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message.includes("different email") ? "This invite was sent to a different email address." : "This invite is no longer valid.")}`);
  revalidatePath("/", "layout");
  redirect("/app");
}

// ---------------- Notifications ----------------
export async function markAllNotificationsRead() {
  const s = await requireUser("/app/notifications");
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

// ---------------- Account (any user) ----------------
export async function updateAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser("/account");
  const supabase = await createClient();
  const name = z.string().trim().min(1, "Name is required").max(120).safeParse(fd.get("fullName"));
  if (!name.success) return { ok: false, error: name.error.issues[0].message, fieldErrors: { fullName: [name.error.issues[0].message] } };
  const patch: Record<string, unknown> = { full_name: name.data };
  const f = fd.get("avatar");
  if (validImage(f)) {
    const r = await uploadImage(supabase, "public-media", `users/${s.user.id}`, f);
    if ("error" in r) return { ok: false, error: r.error };
    patch.avatar_url = r.url;
  }
  await supabase.from("profiles").update(patch).eq("id", s.user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Account updated" };
}
