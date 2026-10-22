import { createCustomer } from "@/app/actions/crm";
import { CustomerForm } from "@/components/crm/customer-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add customer" back={{ href: "/app/customers", label: "Customers" }} />
      <Card className="p-4"><CustomerForm action={createCustomer} submitLabel="Save customer" /></Card>
    </div>
  );
}
