import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { optionFor, type Tone, LEAD_STATUSES, PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES, CUSTOMER_STATUSES } from "@/lib/constants";

const tones: Record<Tone, string> = {
  neutral: "bg-concrete-100 text-ink-600 ring-concrete-300",
  blue: "bg-blue-50 text-site-blue ring-blue-200",
  orange: "bg-safety-50 text-safety-700 ring-safety-100",
  green: "bg-green-50 text-site-green ring-green-200",
  red: "bg-red-50 text-site-red ring-red-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const lists = { lead: LEAD_STATUSES, project: PROJECT_STATUSES, task: TASK_STATUSES, priority: TASK_PRIORITIES, customer: CUSTOMER_STATUSES };

export function StatusBadge({ kind, value, className }: { kind: keyof typeof lists; value: string; className?: string }) {
  const opt = optionFor(lists[kind], value);
  return <Badge tone={opt?.tone ?? "neutral"} className={className}>{opt?.label ?? value}</Badge>;
}
