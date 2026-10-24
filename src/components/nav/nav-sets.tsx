"use client";

import { useState } from "react";
import {
  BarChart3, Bookmark, Briefcase, Building2, ClipboardList, Compass, CreditCard, Flag, Home, Inbox, LayoutDashboard,
  Megaphone, Plus, Settings, Store, User, Users, UsersRound, Tags, UserPlus, BriefcaseBusiness, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { BottomNavigation, SideNavigation, type NavItem } from "./bottom-navigation";

/** What the signed-in member may see; computed on the server from the policy. */
export type NavAccess = { crm: boolean; manageJobs: boolean; editProfile: boolean; analytics: boolean; billing: boolean };

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
// UX_ARCHITECTURE_V2.md §1.1: Today · Leads · [+] · Jobs · Inbox. Crew: Today · Jobs · Inbox.
function primary(access: NavAccess, unread: number): NavItem[] {
  return [
    { href: "/app", label: "Today", icon: Home, exact: true },
    ...(access.crm ? [{ href: "/app/leads", label: "Leads", icon: ClipboardList }] : []),
    { href: "/app/jobs", label: "Jobs", icon: Briefcase },
    { href: "/app/inbox", label: "Inbox", icon: Inbox, badge: unread },
  ];
}

type CreateItem = { href: string; label: string; description: string; icon: LucideIcon };
export function createItems(access: NavAccess): CreateItem[] {
  return [
    ...(access.crm ? [{ href: "/app/leads/new", label: "New lead", description: "Someone called or messaged about work", icon: ClipboardList }] : []),
    ...(access.manageJobs ? [{ href: "/app/jobs/new", label: "New job", description: "Work that's agreed and ready to plan", icon: BriefcaseBusiness }] : []),
    ...(access.crm ? [{ href: "/app/customers/new", label: "New customer", description: "Add a client's contact details", icon: UserPlus }] : []),
    ...(access.editProfile ? [{ href: "/app/posts/new", label: "Showcase work", description: "Post photos of a finished job to your profile", icon: Megaphone }] : []),
  ];
}

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

/** "More" (avatar menu) links, also the sidebar's Business group. */
export function moreLinks(access: NavAccess, slug: string): NavItem[] {
  return [
    ...(access.crm ? [{ href: "/app/customers", label: "Customers", icon: Users }] : []),
    ...(access.analytics ? [{ href: "/app/analytics", label: "Insights", icon: BarChart3 }] : []),
    ...(access.editProfile ? [{ href: "/app/profile", label: "Business profile", icon: Settings }] : []),
    { href: "/app/team", label: "Team", icon: UsersRound },
    ...(access.billing ? [{ href: "/app/billing", label: "Billing", icon: CreditCard }] : []),
    { href: `/contractor/${slug}`, label: "View public profile", icon: Store },
    { href: "/explore", label: "Explore", icon: Compass },
  ];
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
