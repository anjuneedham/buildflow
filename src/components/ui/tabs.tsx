import Link from "next/link";
import { cn } from "@/lib/utils";

// URL-driven tabs: shareable, work without JS, and keep server rendering simple.
export function Tabs({ tabs, active, className }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav className={cn("-mx-4 flex gap-1 overflow-x-auto border-b border-concrete-200 px-4 no-scrollbar", className)} aria-label="Tabs">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href} scroll={false} aria-current={on ? "page" : undefined}
            className={cn("flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors",
              on ? "border-safety-500 text-ink" : "border-transparent text-ink-500 hover:text-ink")}>
            {t.label}
            {t.count !== undefined && <span className={cn("rounded px-1.5 text-xs", on ? "bg-safety-100 text-safety-700" : "bg-concrete-100")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
