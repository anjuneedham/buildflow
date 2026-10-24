"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { DELETE_CONFIRMATION, recentlySignedIn } from "@/lib/account";
import { AUTH_HINT_COOKIE, requireUser, SESSION_COOKIE } from "@/lib/session";
import { deleteAccountCompletely } from "@/server/account-deletion";

/**
 * Permanently deletes the signed-in person's account (Google Play requires this to be possible inside the app).
 * Needs the word DELETE typed and a recent sign-in. An owner's deletion also deletes their business.
 */
export async function deleteMyAccount(confirmation: string): Promise<{ ok: boolean; error?: string; deletedBusiness?: boolean }> {
  const s = await requireUser("/account");
  if (z.literal(DELETE_CONFIRMATION).safeParse(String(confirmation).trim()).success === false) return { ok: false, error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  if (s.isAdmin) return { ok: false, error: "Platform admin accounts can't be deleted here. Remove the admin flag first." };
  if (!recentlySignedIn(s.user.authTime)) return { ok: false, error: "For your security, log out, log in again, then delete your account." };
  const result = await deleteAccountCompletely(s.user.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(AUTH_HINT_COOKIE);
  return { ok: true, deletedBusiness: result.deletedBusiness };
}
