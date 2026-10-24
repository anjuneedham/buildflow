"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { isId, now } from "@/lib/data/db";
import { recountPosts, resolveRegion, resolveServices, syncBusinessToPosts } from "@/lib/data/business";
import { tenant } from "@/lib/data/tenant";
import { requireBusiness, requireUser } from "@/lib/session";
import { uploadImage, validImage } from "@/lib/storage";
import { businessProfileSchema, docId, inviteSchema, parseForm, type ActionState } from "@/lib/validation";
import { env } from "@/lib/env";
import { syncClaims } from "@/server/claims";
import { isEmailVerified, VERIFY_EMAIL_MESSAGE } from "@/server/email-verification";
import { assignableRoles, normalizeRole, type Role } from "@/server/policy";

async function syncSeats(businessId: string) {
  const n = (await tenant(businessId).col("members").count().get()).data().count;
  await db().collection("subscriptions").doc(businessId).set({ seats: Math.max(1, n) }, { merge: true });
}

export async function updateBusinessProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.can("profile.edit")) return { ok: false, error: "You don't have permission to edit the business profile." };
  const parsed = parseForm(businessProfileSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const region = await resolveRegion(d.regionId);
  const patch: Record<string, unknown> = {
    name: d.name, name_lower: d.name.toLowerCase(), tagline: d.tagline ?? null, description: d.description ?? null, phone: d.phone ?? null,
    email: d.email ?? null, website: d.website ?? null, years_in_business: d.yearsInBusiness ?? null, region_id: region?.id ?? null, region,
    city: d.city ?? null, service_area: d.serviceArea ?? null, is_public: d.isPublic, updated_at: now(),
    social_links: Object.fromEntries(Object.entries({ instagram: d.instagram, facebook: d.facebook, tiktok: d.tiktok }).filter(([, v]) => v)),
  };
  for (const [field, column] of [["logo", "logo_url"], ["cover", "cover_url"]] as const) {
    const f = fd.get(field);
    if (validImage(f)) {
      const r = await uploadImage("public", s.business.id, f);
      if ("error" in r) return { ok: false, error: r.error, fieldErrors: { [field]: [r.error!] } };
      patch[column] = r.url;
    }
  }
  const primary = docId.safeParse(fd.get("primaryServiceId"));
  const ids = Array.from(new Set([...(primary.success ? [primary.data] : []), ...fd.getAll("serviceIds").map(String)]))
    .filter((v) => docId.safeParse(v).success).slice(0, 15);
  if (ids.length) {
    const services = await resolveServices(ids);
    patch.services = services;
    patch.service_ids = services.map((x) => x.id);
    const p = services.find((x) => primary.success && x.id === primary.data) ?? services[0] ?? null;
    patch.primary_service = p;
    patch.primary_service_id = p?.id ?? null;
  }
  await tenant(s.business.id).root.update(patch);
  await syncBusinessToPosts(s.business.id);
  await recountPosts(s.business.id);
  return { ok: true, message: "Profile saved" };
}

// ---------------- Team ----------------
// Invites live at invitations/{token} so the link alone identifies them.
export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.can("team.manage")) return { ok: false, error: "You don't have permission to invite team members." };
  const parsed = parseForm(inviteSchema, fd);
  if (!parsed.data) return parsed.state;
  if (!assignableRoles(s.role).includes(parsed.data.role)) return { ok: false, error: "You can't invite someone with that role." };
  const email = parsed.data.email.toLowerCase();
  const existing = await db().collection("invitations").where("business_id", "==", s.business.id).where("email", "==", email).where("accepted_at", "==", null).limit(1).get();
  const token = existing.empty ? crypto.randomUUID() : existing.docs[0].id;
  if (existing.empty) {
    await db().collection("invitations").doc(token).set({
      business_id: s.business.id, business_name: s.business.name, email, role: parsed.data.role, invited_by: s.user.id, accepted_at: null, created_at: now(),
    });
  } else {
    await existing.docs[0].ref.update({ role: parsed.data.role });
  }
  // Email delivery is a V1.x item; the owner shares this link directly.
  return { ok: true, message: `Invite created. Share this link: ${env.siteUrl}/invite/${token}` };
}

export async function revokeInvite(token: string) {
  const s = await requireBusiness();
  if (!s.can("team.manage") || !isId(token)) return { ok: false };
  const ref = db().collection("invitations").doc(token);
  const inv = await ref.get();
  if (inv.exists && inv.get("business_id") === s.business.id) await ref.delete();
  return { ok: true };
}

export async function removeMember(userId: string) {
  const s = await requireBusiness();
  if (!s.can("team.manage")) return { ok: false, error: "You don't have permission to remove members." };
  if (!isId(userId) || userId === s.user.id) return { ok: false, error: "You can't remove yourself." };
  const member = tenant(s.business.id).doc("members", userId);
  const snap = await member.get();
  if (!snap.exists || snap.get("role") === "owner") return { ok: false, error: "Member not found." };
  const batch = db().batch();
  batch.delete(member);
  batch.set(db().collection("users").doc(userId), { business_id: null, business_role: null }, { merge: true });
  // Unassign from jobs so they don't linger on crew lists.
  const jobs = await tenant(s.business.id).col("projects").where("member_ids", "array-contains", userId).get();
  jobs.docs.forEach((j) => batch.update(j.ref, { member_ids: (j.get("member_ids") as string[]).filter((m) => m !== userId) }));
  await batch.commit();
  // Revoking ends their session now, not when the cookie expires.
  await syncClaims(userId, { revoke: true });
  await syncSeats(s.business.id);
  return { ok: true };
}

export async function setMemberRole(userId: string, role: string) {
  const s = await requireBusiness();
  if (!s.can("team.manage")) return { ok: false, error: "You don't have permission to change roles." };
  const next = role as Role;
  if (!isId(userId) || userId === s.user.id) return { ok: false, error: "You can't change your own role." };
  if (!assignableRoles(s.role).includes(next)) return { ok: false, error: "That role can't be assigned." };
  const member = tenant(s.business.id).doc("members", userId);
  const snap = await member.get();
  if (!snap.exists || snap.get("role") === "owner") return { ok: false, error: "Member not found." };
  if (normalizeRole(snap.get("role")) === next) return { ok: true };
  const batch = db().batch();
  batch.update(member, { role: next });
  batch.set(db().collection("users").doc(userId), { business_role: next }, { merge: true });
  await batch.commit();
  await syncClaims(userId, { revoke: true });
  return { ok: true };
}

export async function acceptInvite(token: string) {
  const s = await requireUser(`/invite/${token}`);
  const fail = (msg: string) => redirect(`/invite/${token}?error=${encodeURIComponent(msg)}`);
  if (!z.string().uuid().safeParse(token).success) fail("This invite is no longer valid.");
  if (s.membership) fail("You already belong to a business on BuildFlow.");
  if (!(await isEmailVerified(s.user.id))) fail(VERIFY_EMAIL_MESSAGE);
  const ref = db().collection("invitations").doc(token);
  let businessId = "";
  try {
    await db().runTransaction(async (tx) => {
      const inv = await tx.get(ref);
      if (!inv.exists || inv.get("accepted_at")) throw new Error("This invite is no longer valid.");
      if (inv.get("email") !== s.user.email?.toLowerCase()) throw new Error("This invite was sent to a different email address.");
      businessId = inv.get("business_id");
      tx.set(tenant(businessId).doc("members", s.user.id), { role: inv.get("role"), full_name: s.profile?.full_name ?? "", avatar_url: s.profile?.avatar_url ?? null, created_at: now() });
      tx.set(db().collection("users").doc(s.user.id), { business_id: businessId, business_role: inv.get("role"), account_type: "contractor" }, { merge: true });
      tx.update(ref, { accepted_at: now(), accepted_by: s.user.id });
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : "This invite is no longer valid.");
  }
  await syncSeats(businessId);
  await syncClaims(s.user.id).catch((e) => console.error("claims sync failed", e));
  redirect("/app");
}

// ---------------- Notifications ----------------
export async function markAllNotificationsRead() {
  const s = await requireUser("/app/inbox");
  const unread = await db().collection("users").doc(s.user.id).collection("notifications").where("read_at", "==", null).limit(400).get();
  const batch = db().batch();
  unread.docs.forEach((d) => batch.update(d.ref, { read_at: now() }));
  await batch.commit();
}

// ---------------- Account (any user) ----------------
export async function updateAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser("/account");
  const name = z.string().trim().min(1, "Name is required").max(120).safeParse(fd.get("fullName"));
  if (!name.success) return { ok: false, error: name.error.issues[0].message, fieldErrors: { fullName: [name.error.issues[0].message] } };
  const patch: Record<string, unknown> = { full_name: name.data };
  const f = fd.get("avatar");
  if (validImage(f)) {
    const r = await uploadImage("public", `users/${s.user.id}`, f);
    if ("error" in r) return { ok: false, error: r.error };
    patch.avatar_url = r.url;
  }
  await db().collection("users").doc(s.user.id).set(patch, { merge: true });
  if (s.membership) await tenant(s.membership.business.id).doc("members", s.user.id).set(patch, { merge: true });
  return { ok: true, message: "Account updated" };
}
