"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number };

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold leading-none text-white">{n > 9 ? "9+" : n}</span>;
}

/**
 * Fixed bottom tab bar for phones (hidden from md up). `center` is an
 * optional action (the Create button) placed in the middle slot.
 */
export function BottomNavigation({ items, center }: { items: NavItem[]; center?: ReactNode }) {
  const pathname = usePathname();
  const cells: ReactNode[] = items.map((item) => {
    const on = isActive(pathname, item);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        {/* The spoken name keeps the visible words ("1", "Inbox") and adds "unread". */}
        <Link href={item.href} prefetch={false} aria-current={on ? "page" : undefined}
          className={cn("flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-action" : "text-ink-500")}>
          <span className="relative"><Icon className={cn("h-5 w-5", on && "stroke-[2.5]")} aria-hidden /><Badge n={item.badge} /></span>
          <span>{item.label}{item.badge ? <span className="sr-only"> unread</span> : null}</span>
        </Link>
      </li>
    );
  });
  if (center) cells.splice(Math.floor(cells.length / 2), 0, <li key="center" className="flex items-center justify-center">{center}</li>);
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-concrete-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>{cells}</ul>
    </nav>
  );
}

/** Desktop sidebar. Optional `groups` render under small headings. */
export function SideNavigation({ items, groups = [], footer }: { items: NavItem[]; groups?: { label: string; items: NavItem[] }[]; footer?: ReactNode }) {
  const pathname = usePathname();
  const link = (item: NavItem) => {
    const on = isActive(pathname, item);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} prefetch={false} aria-current={on ? "page" : undefined}
        className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
          on ? "bg-ink text-white" : "text-ink-600 hover:bg-concrete-100 hover:text-ink")}>
        <Icon className={cn("h-[18px] w-[18px]", on && "text-safety-400")} aria-hidden />
        <span className="flex-1">{item.label}</span>
        {item.badge ? <span className="rounded-full bg-action px-1.5 text-[11px] font-bold text-white">{item.badge > 9 ? "9+" : item.badge}</span> : null}
      </Link>
    );
  };
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map(link)}
      {groups.filter((g) => g.items.length).map((g) => (
        <div key={g.label} className="mt-4 flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-ink-500">{g.label}</p>
          {g.items.map(link)}
        </div>
      ))}
      {footer}
    </nav>
  );
}
