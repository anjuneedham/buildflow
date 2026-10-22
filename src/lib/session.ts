import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Business, Profile } from "@/lib/types";

export type Membership = { role: "owner" | "member"; business: Business };

export const getSession = cache(async () => {
  if (!isSupabaseConfigured) return { user: null, profile: null, membership: null, isAdmin: false } as const;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, membership: null, isAdmin: false } as const;

  const [{ data: profile }, { data: member }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, account_type, is_suspended").eq("id", user.id).maybeSingle(),
    supabase.from("business_members").select("role, business:businesses(*, region:locations(name))")
      .eq("user_id", user.id).order("role", { ascending: true }).limit(1).maybeSingle(),
    supabase.rpc("is_platform_admin"),
  ]);

  const membership = member?.business
    ? ({ role: member.role, business: member.business as unknown as Business } as Membership)
    : null;
  return { user, profile: profile as Profile | null, membership, isAdmin: Boolean(isAdmin) } as const;
});

export async function requireUser(next = "/") {
  const s = await getSession();
  if (!s.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s as typeof s & { user: NonNullable<typeof s.user> };
}

/** For /app pages: signed in, member of a business, onboarding started. */
export async function requireBusiness() {
  const s = await requireUser("/app");
  if (s.profile?.is_suspended) redirect("/suspended");
  if (!s.membership) redirect("/onboarding");
  return { ...s, membership: s.membership, business: s.membership.business, isOwner: s.membership.role === "owner" };
}

export async function requireAdmin() {
  const s = await requireUser("/admin");
  if (!s.isAdmin) redirect("/");
  return s;
}
