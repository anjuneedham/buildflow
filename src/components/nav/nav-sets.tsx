"use client";

import { useState } from "react";
import { Bookmark, Briefcase, Building2, Compass, Flag, LayoutDashboard, Plus, User, Users, Tags } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { BottomNavigation, SideNavigation, type NavItem } from "./bottom-navigation";
import { createItems, moreLinks, primary, type CreateItem, type NavAccess } from "./nav-config";

export type { NavAccess };

// ---------- Public (customers) ----------
// UX_ARCHITECTURE_V2.md §1.4: Find (explore + search in one) · Saved · Account.
export function CustomerBottomNav({ signedIn, isContractor }: { signedIn: boolean; isContractor: boolean }) {
  const items: NavItem[] = [
    { href: "/explore", label: "Find", icon: Compass },
    { href: signedIn ? "/saved" : "/login?next=/saved", label: "Saved", icon: Bookmark },
    isContractor
      ? { href: "/app", label: "Business", icon: Briefcase }
      : { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Log in", icon: User },
  ];
  return <BottomNavigation items={items} />;
}

// ---------- Contractor app ----------
function CreateButton({ items }: { items: CreateItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Create"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-action text-white shadow-lg ring-4 ring-white active:bg-action-active">
        <Plus className="h-6 w-6" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create">
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-concrete-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-safety-50 text-action"><i.icon className="h-5 w-5" aria-hidden /></span>
                <span><span className="block font-semibold text-ink">{i.label}</span><span className="block text-sm text-ink-500">{i.description}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export function ContractorBottomNav({ access, unread }: { access: NavAccess; unread: number }) {
  const items = createItems(access);
  return <BottomNavigation items={primary(access, unread)} center={items.length ? <CreateButton items={items} /> : undefined} />;
}

export function ContractorSideNav({ access, unread, slug }: { access: NavAccess; unread: number; slug: string }) {
  const create = createItems(access);
  return (
    <SideNavigation
      items={primary(access, unread)}
      groups={[{ label: "Business", items: moreLinks(access, slug) }]}
      footer={create.length ? (
        <div className="mt-4 flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-ink-500">Create</p>
          {create.map((c) => (
            <Link key={c.href} href={c.href} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-600 hover:bg-concrete-100 hover:text-ink">
              <c.icon className="h-[18px] w-[18px]" aria-hidden />{c.label}
            </Link>
          ))}
        </div>
      ) : undefined}
    />
  );
}

// ---------- Platform admin ----------
const adminItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/plans", label: "Plans", icon: Tags },
];
export function AdminSideNav() { return <SideNavigation items={adminItems} />; }
export function AdminBottomNav() { return <BottomNavigation items={adminItems} />; }
