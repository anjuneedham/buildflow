import "server-only";
import { isFirebaseConfigured } from "@/lib/env";
import { db } from "@/lib/firebase/admin";
import { fromQuery } from "@/lib/data/db";
import { PLANS, planFromRow, type Plan } from "@/lib/plans";

type PlanRow = Parameters<typeof planFromRow>[0] & { is_active: boolean; is_public: boolean; sort_order: number };

/** Active public plans from Firestore, falling back to code defaults. */
export async function getPlans(): Promise<Plan[]> {
  if (!isFirebaseConfigured) return Object.values(PLANS);
  try {
    const rows = fromQuery<PlanRow>(await db().collection("plans").orderBy("sort_order").get()).filter((p) => p.is_active && p.is_public);
    return rows.length ? rows.map(planFromRow) : Object.values(PLANS);
  } catch {
    return Object.values(PLANS);
  }
}

export async function getPlan(id: string): Promise<Plan> {
  const snap = await db().collection("plans").doc(id).get();
  return snap.exists ? planFromRow({ id: snap.id, ...(snap.data() as Omit<PlanRow, "id">) }) : PLANS[id] ?? PLANS.basic;
}
