"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Horizontal pill picker for pipeline/project/task status. Optimistic. */
export function StatusChanger({ value, options, onChange, label }: {
  value: string; options: readonly { value: string; label: string }[]; label: string;
  onChange: (value: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [current, setCurrent] = useOptimistic(value);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:px-0">
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button key={o.value} role="radio" aria-checked={on} disabled={pending && !on}
            onClick={() => !on && start(async () => {
              setCurrent(o.value);
              const r = await onChange(o.value);
              if (r.ok === false) toast(r.error ?? "Couldn't update", "error");
              else { toast(`Moved to ${o.label}`); router.refresh(); }
            })}
            className={cn("min-h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold transition-colors", on ? "border-ink bg-ink text-white" : "border-concrete-300 bg-white text-ink-600 hover:border-ink-500")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
