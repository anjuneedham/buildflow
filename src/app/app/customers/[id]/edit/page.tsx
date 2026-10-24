import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions/crm";
import { CustomerForm } from "@/components/crm/customer-form";
import { Card, PageHeader } from "@/components/ui";
import { fromDoc, isId } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { requirePermission } from "@/lib/session";
import type { Customer } from "@/lib/types";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePermission("crm");
  const data = isId(id) ? fromDoc<Customer>(await tenant(s.business.id).doc("customers", id).get()) : null;
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit customer" back={{ href: `/app/customers/${id}`, label: data.name }} />
      <Card className="p-4"><CustomerForm action={updateCustomer.bind(null, id)} customer={data} submitLabel="Save changes" /></Card>
    </div>
  );
}
