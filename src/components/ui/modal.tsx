"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Native <dialog>: focus trapping, Esc and backdrop come for free.
// On phones it renders as a bottom sheet.
export function Modal({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className={cn("m-0 mt-auto w-full max-w-none rounded-t-2xl bg-white p-0 backdrop:bg-ink/50 sm:m-auto sm:max-w-lg sm:rounded-2xl", className)}>
      <div className="flex items-center justify-between border-b border-concrete-200 px-4 py-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-concrete-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
