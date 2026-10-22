import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PLANS, planFromRow, type Plan } from "@/lib/plans";

/** Active public plans from the database, falling back to code defaults. */
export async function getPlans(): Promise<Plan[]> {
  if (!isSupabaseConfigured) return Object.values(PLANS);
  const supabase = await createClient();
  const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true).eq("is_public", true).order("sort_order");
  return data && data.length ? data.map(planFromRow) : Object.values(PLANS);
}
