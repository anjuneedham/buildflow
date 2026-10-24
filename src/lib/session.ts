import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, db } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/env";
import { fromDoc } from "@/lib/data/db";
import { can, normalizeRole, type Permission, type Role } from "@/server/policy";
import type { Business, Profile } from "@/lib/types";

export const SESSION_COOKIE = "__session";
/** Non-sensitive hint so static public pages can pick "Log in" vs "Dashboard" without a server read. */
export const AUTH_HINT_COOKIE = "bf_auth";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string | null; emailVerified: boolean };
export type Membership = { role: Role; business: Business };
type Session = { user: SessionUser | null; profile: Profile | null; membership: Membership | null; isAdmin: boolean };

const empty: Session = { user: null, profile: null, membership: null, isAdmin: false };

// Revocation (a Firebase Auth API call) is checked on every mutation and
// admin request, and at most every 5 minutes per user for page reads
// (ARCHITECTURE_V2.md §5.1). Removing a member or suspending a user revokes
// their tokens, so access ends immediately for anything that changes data.
const REVOCATION_TTL_MS = 5 * 60_000;
const lastRevocationCheck = new Map<string, number>();

async function verify(cookie: string): Promise<DecodedIdToken | null> {
  try {
    const h = await headers();
    const isMutation = h.has("next-action"); // set by Next on every server action call
    const decoded = await adminAuth().verifySessionCookie(cookie, false);
    const last = lastRevocationCheck.get(decoded.uid) ?? 0;
    if (isMutation || Date.now() - last > REVOCATION_TTL_MS) {
      await adminAuth().verifySessionCookie(cookie, true);
      lastRevocationCheck.set(decoded.uid, Date.now());
      if (lastRevocationCheck.size > 10_000) lastRevocationCheck.clear();
    }
    return decoded;
  } catch {
    return null; // expired, revoked or forged
  }
}

export const getSession = cache(async (): Promise<Session> => {
  if (!isFirebaseConfigured) return empty;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return empty;
  const claims = await verify(cookie);
  if (!claims) return empty;
  const user: SessionUser = { id: claims.uid, email: claims.email ?? null, emailVerified: Boolean(claims.email_verified) };
  const profile = fromDoc<Profile>(await db().collection("users").doc(claims.uid).get());
  let membership: Membership | null = null;
  if (profile?.business_id && profile.business_role) {
    const bizRef = db().collection("businesses").doc(profile.business_id);
    // Claims that agree with the profile are trusted (they are re-synced and
    // the session revoked on every membership change); otherwise confirm
    // against the business's own member list.
    const claimsAgree = claims.bid === profile.business_id && claims.brole === normalizeRole(profile.business_role);
    if (claimsAgree) {
      const biz = await bizRef.get();
      if (biz.exists) membership = { role: claims.brole as Role, business: fromDoc<Business>(biz)! };
    } else {
      const [biz, member] = await Promise.all([bizRef.get(), bizRef.collection("members").doc(claims.uid).get()]);
      if (biz.exists && member.exists) membership = { role: normalizeRole(member.get("role")), business: fromDoc<Business>(biz)! };
    }
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
  const role = s.membership.role;
  return {
    ...s, membership: s.membership, business: s.membership.business, role,
    isOwner: role === "owner",
    can: (permission: Permission) => can(role, permission),
  };
}

/** For pages a role may not open: crew land on Today instead of an error. */
export async function requirePermission(permission: Permission) {
  const s = await requireBusiness();
  if (!s.can(permission)) redirect("/app");
  return s;
}

export async function requireAdmin() {
  const s = await requireUser("/admin");
  if (!s.isAdmin) redirect("/");
  return s;
}
