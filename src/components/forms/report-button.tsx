"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { reportContent } from "@/app/actions/social";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, FormSuccess, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { REPORT_REASONS } from "@/lib/constants";
import type { ActionState } from "@/lib/validation";

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "post" | "comment" | "business"; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportContent, {} as ActionState);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-500 hover:bg-concrete-100 hover:text-ink">
        <Flag className="h-3.5 w-3.5" />{label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report content">
        {state.ok ? <FormSuccess message={state.message} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <FormError message={state.error} />
            <Field label="Reason" htmlFor="reason"><Select id="reason" name="reason" options={REPORT_REASONS} required /></Field>
            <Field label="Details" htmlFor="details" optional><Textarea id="details" name="details" rows={3} /></Field>
            <SubmitButton block>Send report</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
