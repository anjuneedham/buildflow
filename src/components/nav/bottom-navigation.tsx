"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Fixed bottom tab bar for phones. Hidden from md up. */
export function BottomNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-concrete-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const on = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} prefetch={false} aria-current={on ? "page" : undefined}
                className={cn("flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-action" : "text-ink-500")}>
                <Icon className={cn("h-5 w-5", on && "stroke-[2.5]")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sidebar using the same items. */
export function SideNavigation({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map((item) => {
        const on = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} prefetch={false} aria-current={on ? "page" : undefined}
            className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
              on ? "bg-ink text-white" : "text-ink-600 hover:bg-concrete-100 hover:text-ink")}>
            <Icon className={cn("h-[18px] w-[18px]", on && "text-safety-400")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      {footer}
    </nav>
  );
}
