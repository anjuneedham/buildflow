"use client";

import { Trash2 } from "lucide-react";
import { deleteCustomer } from "@/app/actions/crm";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export function DeleteCustomer({ id }: { id: string }) {
  return (
    <ConfirmationDialog title="Delete this customer?" description="Their jobs will be kept but no longer linked to a customer. This can't be undone." confirmLabel="Delete customer"
      onConfirm={() => deleteCustomer(id)}
      trigger={(open) => <Button variant="ghost" size="sm" onClick={open} aria-label="Delete customer" className="text-site-red"><Trash2 className="h-4 w-4" /></Button>} />
  );
}
