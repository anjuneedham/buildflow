"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/utils";
import { parseForm, signInSchema, signUpSchema, type ActionState } from "@/lib/validation";
import { z } from "zod";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(signUpSchema, fd);
  if (!parsed.data) return parsed.state;
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) return { ok: false, error: "Too many sign-up attempts. Try again later." };

  const { fullName, email, password, accountType } = parsed.data;
  const supabase = await createClient();
  const next = accountType === "contractor" ? "/onboarding" : "/explore";
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: fullName, account_type: accountType },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation on, there is no session yet.
  if (!data.session) redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  redirect(next);
}

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(signInSchema, fd);
  if (!parsed.data) return parsed.state;
  if (!rateLimit(`signin:${await clientIp()}`, 20, 15 * 60_000).ok) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("confirm")) return { ok: false, error: "Please verify your email first. Check your inbox for the link." };
    return { ok: false, error: "Email or password is incorrect." };
  }
  const requested = fd.get("next");
  if (typeof requested === "string" && requested) redirect(safeNext(requested));
  const { data: member } = await supabase.from("business_members").select("business_id").eq("user_id", data.user.id).limit(1).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle();
  if (member) redirect("/app");
  redirect(profile?.account_type === "contractor" ? "/onboarding" : "/explore");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = z.string().trim().email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email", fieldErrors: { email: ["Enter a valid email"] } };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000).ok) return { ok: false, error: "Too many requests. Try again later." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` });
  // Same response whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const pw = z.string().min(8, "Use at least 8 characters").max(72).safeParse(fd.get("password"));
  if (!pw.success) return { ok: false, error: pw.error.issues[0].message, fieldErrors: { password: [pw.error.issues[0].message] } };
  if (fd.get("password") !== fd.get("confirm")) return { ok: false, error: "Passwords don't match", fieldErrors: { confirm: ["Passwords don't match"] } };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { ok: false, error: "Your reset link has expired. Request a new one." };
  return { ok: true, message: "Password updated. You're signed in." };
}

export async function resendVerification(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = z.string().trim().email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email" };
  if (!rateLimit(`resend:${email.data}`, 3, 60 * 60_000).ok) return { ok: false, error: "Please wait before requesting another email." };
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: email.data, options: { emailRedirectTo: `${env.siteUrl}/auth/callback` } });
  return { ok: true, message: "Verification email sent." };
}
