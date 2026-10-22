"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "./button";
import { Modal } from "./modal";
import { useToast } from "./toast";

/** Wraps a destructive server action behind an explicit confirm step. */
export function ConfirmationDialog({ trigger, title, description, confirmLabel = "Confirm", onConfirm, variant = "danger" }: {
  trigger: (open: () => void) => ReactNode; title: string; description: ReactNode; confirmLabel?: string;
  onConfirm: () => Promise<{ ok?: boolean; error?: string } | void>; variant?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-sm text-ink-600">{description}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={variant} disabled={pending} onClick={() => start(async () => {
            const r = await onConfirm();
            if (r && r.ok === false) toast(r.error ?? "Something went wrong", "error");
            setOpen(false);
          })}>{pending ? "Working…" : confirmLabel}</Button>
        </div>
      </Modal>
    </>
  );
}
