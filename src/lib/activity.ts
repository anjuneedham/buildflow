import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logActivity(supabase: SupabaseClient, entry: {
  businessId: string; actorId: string; entityType: "lead" | "customer" | "project" | "task" | "post" | "business";
  entityId?: string | null; action: string; summary: string; metadata?: Record<string, unknown>;
}) {
  // Activity is best-effort; never fail the user's action because of it.
  await supabase.from("activity_logs").insert({
    business_id: entry.businessId, actor_id: entry.actorId, entity_type: entry.entityType,
    entity_id: entry.entityId ?? null, action: entry.action, summary: entry.summary, metadata: entry.metadata ?? {},
  });
}
