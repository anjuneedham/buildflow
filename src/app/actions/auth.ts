"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase/admin";
import { now } from "@/lib/data/db";
import { rateLimit } from "@/lib/rate-limit";
import { AUTH_HINT_COOKIE, getSession, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session";
import { syncClaims } from "@/server/claims";
import { isEmailVerified, sendVerificationEmail } from "@/server/email-verification";
import { safeNext } from "@/lib/utils";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

async function setSessionCookie(idToken: string) {
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, cookie, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_MS / 1000 });
  // Readable by the browser; grants nothing. Lets static pages render the right header.
  jar.set(AUTH_HINT_COOKIE, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_MS / 1000 });
}

/**
 * Exchanges a fresh Firebase ID token for a session cookie. Creates the
 * user profile document on first sign-in. Returns where to go next.
 *
 * If the user's custom claims were out of date, they are updated and the
 * result asks the client to refresh its ID token and call again, so the
 * session cookie carries current claims (src/server/claims.ts).
 */
export async function establishSession(input: { idToken: string; fullName?: string; accountType?: "contractor" | "customer"; next?: string }): Promise<{ ok: true; next: string } | { ok: false; refreshToken: true } | { ok: false; error: string }> {
  if (!rateLimit(`session:${await clientIp()}`, 30, 15 * 60_000).ok) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  const parsed = z.object({
    idToken: z.string().min(10).max(5000),
    fullName: z.string().trim().max(120).optional(),
    accountType: z.enum(["contractor", "customer"]).optional(),
    next: z.string().max(500).optional(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid sign-in request." };

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(parsed.data.idToken);
  } catch {
    return { ok: false, error: "Your sign-in expired. Please try again." };
  }
  const ref = db().collection("users").doc(decoded.uid);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      full_name: parsed.data.fullName ?? decoded.name ?? "", email: decoded.email ?? null, avatar_url: null,
      account_type: parsed.data.accountType ?? "customer", is_platform_admin: false, is_suspended: false,
      business_id: null, business_role: null, created_at: now(),
    });
  } else if (existing.get("is_suspended")) {
    return { ok: false, error: "This account is suspended. Contact support." };
  }
  if (await syncClaims(decoded.uid)) return { ok: false, refreshToken: true };
  await setSessionCookie(parsed.data.idToken);

  const profile = (await ref.get()).data()!;
  if (parsed.data.next) return { ok: true, next: safeNext(parsed.data.next) };
  if (profile.business_id) return { ok: true, next: "/app" };
  return { ok: true, next: profile.account_type === "contractor" ? "/onboarding" : "/explore" };
}

export async function signOut() {
  const s = await getSession();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(AUTH_HINT_COOKIE);
  if (s.user) await adminAuth().revokeRefreshTokens(s.user.id).catch(() => {});
  // The caller does a full page load afterwards so every client-side cache
  // (header state, router cache) starts clean.
}

export async function resendVerificationEmail(): Promise<{ ok: boolean; message: string }> {
  const s = await getSession();
  if (!s.user) return { ok: false, message: "Please log in again." };
  if (await isEmailVerified(s.user.id)) return { ok: true, message: "Your email is already verified." };
  if (!rateLimit(`verify:${s.user.id}`, 3, 60 * 60_000).ok) return { ok: false, message: "We've sent a few already. Check your spam folder, or try again in an hour." };
  return (await sendVerificationEmail(s.user.id))
    ? { ok: true, message: `Verification email sent to ${s.user.email}.` }
    : { ok: false, message: "We couldn't send the email. Please try again shortly." };
}
