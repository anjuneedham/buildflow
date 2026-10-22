import "server-only";
import { fromQuery } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import type { TeamMember } from "@/lib/types";

export async function getTeam(businessId: string): Promise<TeamMember[]> {
  const rows = fromQuery<TeamMember & { id: string }>(await tenant(businessId).col("members").get());
  return rows.map((m) => ({ user_id: m.id, full_name: m.full_name, avatar_url: m.avatar_url ?? null, role: m.role }))
    .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name) : a.role === "owner" ? -1 : 1));
}
