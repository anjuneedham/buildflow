"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, Trash2, UserPlus } from "lucide-react";
import { deleteLead, linkLeadCustomer, setFollowUp, setLeadStatus } from "@/app/actions/crm";
import { StatusChanger } from "@/components/crm/status-changer";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/ui/use-form-action";
import { LEAD_STATUSES, LOST_REASONS } from "@/lib/constants";
import { cn, relativeDay } from "@/lib/utils";

const addDays = (date: string, n: number) => new Date(Date.parse(date + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/**
 * Pipeline stage. "Lost" asks why (one tap); "Won" means a job starts, so
 * it goes to Start job instead of just flipping a label.
 */
export function LeadStatus({ id, status, hasJob }: { id: string; status: string; hasJob: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, run] = useServerAction();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <StatusChanger label="Lead stage" value={status} options={LEAD_STATUSES} onChange={(v) => setLeadStatus(id, v)}
        intercept={{ values: hasJob ? ["lost"] : ["lost", "won"], onSelect: (v) => (v === "lost" ? setAsking(true) : router.push(`/app/jobs/new?leadId=${id}`)) }} />
      <Modal open={asking} onClose={() => setAsking(false)} title="Why was it lost?">
        <p className="mb-3 text-sm text-ink-500">Optional, but it shows patterns over time.</p>
        <div className="grid gap-2">
          {[...LOST_REASONS, null].map((r) => (
            <Button key={r ?? "skip"} variant={r ? "outline" : "ghost"} disabled={pending}
              onClick={() => run(() => setLeadStatus(id, "lost", r ?? undefined), (res) => {
                setAsking(false);
                if (res && res.ok === false) toast(res.error ?? "Couldn't update", "error"); else toast("Moved to Lost");
              })}>
              {r ?? "Skip"}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}

/** When to chase this lead. Due follow-ups show on Today. */
export function FollowUp({ id, value, today, disabled }: { id: string; value: string | null; today: string; disabled?: boolean }) {
  const [pending, run] = useServerAction();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const set = (date: string | null) => run(() => setFollowUp(id, date), (r) => {
    if (r && r.ok === false) toast(r.error ?? "Couldn't save", "error");
    else toast(date ? `Follow up ${relativeDay(date, today).toLowerCase()}` : "Follow-up cleared");
  });
  const overdue = value && value < today;
  if (disabled) return <p className="text-sm text-ink-500">Closed leads don&apos;t need a follow-up.</p>;
  return (
    <div className="space-y-2">
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", overdue ? "text-site-red" : "text-ink")}>
        <CalendarClock className="h-4 w-4" aria-hidden />
        {value ? `${overdue ? "Overdue: " : ""}${relativeDay(value, today)}` : "No follow-up set"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {([["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]] as const).map(([label, n]) => (
          <button key={label} type="button" disabled={pending} onClick={() => set(addDays(today, n))}
            className="min-h-9 rounded-lg border border-concrete-300 bg-white px-3 text-sm font-semibold text-ink-600 hover:border-ink-500">{label}</button>
        ))}
        {picking ? (
          <input type="date" aria-label="Follow-up date" min={today} autoFocus className="min-h-9 rounded-lg border border-concrete-300 px-2 text-sm"
            onChange={(e) => { if (e.target.value) { setPicking(false); set(e.target.value); } }} />
        ) : (
          <button type="button" onClick={() => setPicking(true)} className="min-h-9 rounded-lg border border-concrete-300 bg-white px-3 text-sm font-semibold text-ink-600 hover:border-ink-500">Pick date</button>
        )}
        {value && <button type="button" disabled={pending} onClick={() => set(null)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-ink-500 hover:bg-concrete-100">Clear</button>}
      </div>
    </div>
  );
}

export function LeadActions({ id, hasCustomer, projectId, canDelete, isOpen }: { id: string; hasCustomer: boolean; projectId: string | null; canDelete: boolean; isOpen: boolean }) {
  const [pending, run] = useServerAction();
  return (
    <div className="space-y-2">
      {!projectId && (
        <ButtonLink href={`/app/jobs/new?leadId=${id}`} variant={isOpen ? "primary" : "outline"} block>
          <Briefcase className="h-4 w-4" />Start job
        </ButtonLink>
      )}
      {!hasCustomer && (
        <Button variant="outline" block disabled={pending} onClick={() => run(() => linkLeadCustomer(id))}>
          <UserPlus className="h-4 w-4" />{pending ? "Saving…" : "Save as customer"}
        </Button>
      )}
      {canDelete && !projectId && (
        <ConfirmationDialog title="Delete this lead?" description="The lead and its notes will be permanently deleted. The customer record stays." confirmLabel="Delete lead"
          onConfirm={() => deleteLead(id)}
          trigger={(open) => <Button variant="ghost" block onClick={open} className="text-site-red"><Trash2 className="h-4 w-4" />Delete lead</Button>} />
      )}
    </div>
  );
}
