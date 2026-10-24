import { createCustomer } from "@/app/actions/crm";
import { CustomerForm } from "@/components/crm/customer-form";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requirePermission("crm");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add customer" back={{ href: "/app/customers", label: "Customers" }} />
      <Card className="p-4"><CustomerForm action={createCustomer} submitLabel="Save customer" /></Card>
    </div>
  );
}
