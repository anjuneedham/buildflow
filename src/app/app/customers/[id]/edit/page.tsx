import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions/crm";
import { CustomerForm } from "@/components/crm/customer-form";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/session";
import type { Customer } from "@/lib/types";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).eq("business_id", s.business.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit customer" back={{ href: `/app/customers/${id}`, label: data.name }} />
      <Card className="p-4"><CustomerForm action={updateCustomer.bind(null, id)} customer={data as Customer} submitLabel="Save changes" /></Card>
    </div>
  );
}
