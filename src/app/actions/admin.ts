"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";

// Admin writes go through the user's own session; RLS grants these rights
// only when profiles.is_platform_admin is true.

export async function setUserSuspended(userId: string, suspended: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_suspended: suspended }).eq("id", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setBusinessFlag(businessId: string, flag: "is_suspended" | "is_verified", value: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("businesses").update({ [flag]: value }).eq("id", businessId);
  revalidatePath("/admin/businesses");
  return { ok: true };
}

export async function resolveReport(reportId: string, action: "dismiss" | "hide") {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single();
  if (!report) return { ok: false, error: "Report not found" };
  if (action === "hide") {
    if (report.target_type === "post") await supabase.from("posts").update({ is_hidden: true }).eq("id", report.target_id);
    if (report.target_type === "comment") await supabase.from("comments").update({ is_hidden: true }).eq("id", report.target_id);
    if (report.target_type === "business") await supabase.from("businesses").update({ is_suspended: true }).eq("id", report.target_id);
  }
  await supabase.from("reports").update({ status: action === "hide" ? "actioned" : "dismissed", resolved_by: admin.user.id, resolved_at: new Date().toISOString() }).eq("id", reportId);
  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function updatePlan(planId: string, _: unknown, fd: FormData) {
  await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(1).max(80),
    basePrice: z.coerce.number().min(0).max(100000),
    includedSeats: z.coerce.number().int().min(1).max(1000),
    seatPrice: z.coerce.number().min(0).max(100000),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: "Check the plan values." };
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase.from("subscription_plans").update({
    name: d.name, base_price_cents: Math.round(d.basePrice * 100), included_seats: d.includedSeats, additional_seat_price_cents: Math.round(d.seatPrice * 100),
  }).eq("id", planId);
  if (error) return { ok: false, error: "Couldn't save the plan." };
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Plan saved" };
}

export async function toggleService(serviceId: string, active: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("services").update({ is_active: active }).eq("id", serviceId);
  revalidatePath("/admin/plans");
  return { ok: true };
}
