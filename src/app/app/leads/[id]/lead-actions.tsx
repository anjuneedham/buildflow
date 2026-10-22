"use client";

import { Briefcase, Trash2, UserPlus } from "lucide-react";
import { convertLead, deleteLead, setLeadStatus } from "@/app/actions/crm";
import { StatusChanger } from "@/components/crm/status-changer";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useServerAction } from "@/components/ui/use-form-action";
import { LEAD_STATUSES } from "@/lib/constants";

export function LeadStatus({ id, status }: { id: string; status: string }) {
  return <StatusChanger label="Lead status" value={status} options={LEAD_STATUSES} onChange={(v) => setLeadStatus(id, v)} />;
}

export function LeadActions({ id, hasCustomer, customerId, isOwner }: { id: string; hasCustomer: boolean; customerId?: string; isOwner: boolean }) {
  const [pending, run] = useServerAction();
  return (
    <div className="space-y-2">
      {!hasCustomer && (
        <Button block disabled={pending} onClick={() => run(() => convertLead(id))}>
          <UserPlus className="h-4 w-4" />{pending ? "Converting…" : "Convert to customer"}
        </Button>
      )}
      <ButtonLink href={`/app/projects/new?leadId=${id}${customerId ? `&customerId=${customerId}` : ""}`} variant={hasCustomer ? "primary" : "outline"} block>
        <Briefcase className="h-4 w-4" />Create project
      </ButtonLink>
      {isOwner && (
        <ConfirmationDialog title="Delete this lead?" description="The lead and its notes will be permanently deleted." confirmLabel="Delete lead"
          onConfirm={() => deleteLead(id)}
          trigger={(open) => <Button variant="ghost" block onClick={open} className="text-site-red"><Trash2 className="h-4 w-4" />Delete lead</Button>} />
      )}
    </div>
  );
}
