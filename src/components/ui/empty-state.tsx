import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-concrete-300 bg-white/60 px-6 py-10 text-center", className)}>
      {Icon && <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-safety-50 text-safety-600"><Icon className="h-6 w-6" aria-hidden /></span>}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
