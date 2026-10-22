import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/types";

export async function getTeam(businessId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_team", { p_business_id: businessId });
  return (data ?? []) as TeamMember[];
}
