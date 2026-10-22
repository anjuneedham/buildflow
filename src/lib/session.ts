import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/env";
import { fromDoc } from "@/lib/data/db";
import type { Business, Profile } from "@/lib/types";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string | null; emailVerified: boolean };
export type Membership = { role: "owner" | "member"; business: Business };
type Session = { user: SessionUser | null; profile: Profile | null; membership: Membership | null; isAdmin: boolean };

const empty: Session = { user: null, profile: null, membership: null, isAdmin: false };

export const getSession = cache(async (): Promise<Session> => {
  if (!isFirebaseConfigured) return empty;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return empty;
  let claims;
  try {
    claims = await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return empty; // expired, revoked or forged
  }
  const user: SessionUser = { id: claims.uid, email: claims.email ?? null, emailVerified: Boolean(claims.email_verified) };
  const profile = fromDoc<Profile>(await db().collection("users").doc(claims.uid).get());
  let membership: Membership | null = null;
  if (profile?.business_id && profile.business_role) {
    // Membership is confirmed against the business's own member list, not just the user doc.
    const [biz, member] = await Promise.all([
      db().collection("businesses").doc(profile.business_id).get(),
      db().collection("businesses").doc(profile.business_id).collection("members").doc(claims.uid).get(),
    ]);
    if (biz.exists && member.exists) membership = { role: member.get("role"), business: fromDoc<Business>(biz)! };
  }
  return { user, profile, membership, isAdmin: Boolean(profile?.is_platform_admin) };
});

export async function requireUser(next = "/") {
  const s = await getSession();
  if (!s.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (s.profile?.is_suspended) redirect("/suspended");
  return s as Session & { user: SessionUser };
}

/** For /app pages and tenant actions: signed in and a member of a business. */
export async function requireBusiness() {
  const s = await requireUser("/app");
  if (!s.membership) redirect("/onboarding");
  return { ...s, membership: s.membership, business: s.membership.business, isOwner: s.membership.role === "owner" };
}

export async function requireAdmin() {
  const s = await requireUser("/admin");
  if (!s.isAdmin) redirect("/");
  return s;
}
