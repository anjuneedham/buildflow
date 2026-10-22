import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "./plan-form";
import { ServiceToggle } from "../admin-client";

export const metadata = { title: "Plans & categories" };

export default async function AdminPlans() {
  const supabase = await createClient();
  const [{ data: plans }, { data: services }] = await Promise.all([
    supabase.from("subscription_plans").select("*").order("sort_order"),
    supabase.from("services").select("id, name, is_active").order("sort_order"),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Plans & categories" subtitle="Prices here drive the pricing page and billing math. Add new plans (Pro, Business, Enterprise) as rows in subscription_plans." />
      {(plans ?? []).map((p) => (
        <Card key={p.id}><CardHeader title={p.name} subtitle={`id: ${p.id}`} /><CardBody><PlanForm plan={p} /></CardBody></Card>
      ))}
      <Card>
        <CardHeader title="Service categories" />
        <ul className="divide-y divide-concrete-200">
          {(services ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span className={s.is_active ? "" : "text-ink-500 line-through"}>{s.name}</span><ServiceToggle id={s.id} active={s.is_active} /></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
