import "server-only";
import { adminAuth, db } from "@/lib/firebase/admin";
import { normalizeRole, type Role } from "./policy";

/**
 * Custom claims mirror the user's membership so a session can be authorised
 * without reading users/members on every request (ARCHITECTURE_V2.md §5.1).
 * Source of truth stays in Firestore: users/{uid}.business_id/business_role
 * and businesses/{bid}/members/{uid}. Call after any membership change.
 */
export type BuildFlowClaims = { bid: string | null; brole: Role | null; adm: boolean };

export async function desiredClaims(uid: string): Promise<BuildFlowClaims> {
  const u = await db().collection("users").doc(uid).get();
  const bid = (u.get("business_id") as string | null) ?? null;
  return { bid, brole: bid ? normalizeRole(u.get("business_role")) : null, adm: u.get("is_platform_admin") === true };
}

/** Writes claims if they changed. Returns true when the user's token is now stale. */
export async function syncClaims(uid: string, opts: { revoke?: boolean } = {}): Promise<boolean> {
  const want = await desiredClaims(uid);
  const user = await adminAuth().getUser(uid);
  const have = (user.customClaims ?? {}) as Partial<BuildFlowClaims>;
  const changed = have.bid !== want.bid || have.brole !== want.brole || Boolean(have.adm) !== want.adm;
  if (changed) await adminAuth().setCustomUserClaims(uid, { ...user.customClaims, ...want });
  // Losing access must take effect now: revoked sessions fail verification.
  if (changed && opts.revoke) await adminAuth().revokeRefreshTokens(uid);
  return changed;
}
