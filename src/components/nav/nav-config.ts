// Navigation definitions shared by server layouts and client nav components
// (no "use client": the server layout reads moreLinks for the account menu).
import {
  BarChart3, Briefcase, BriefcaseBusiness, ClipboardList, Compass, CreditCard, Home, Inbox, Megaphone, Settings, Store,
  UserPlus, Users, UsersRound, type LucideIcon,
} from "lucide-react";
import type { NavItem } from "./bottom-navigation";

/** What the signed-in member may see; computed on the server from the policy. */
export type NavAccess = { crm: boolean; manageJobs: boolean; editProfile: boolean; analytics: boolean; billing: boolean };

// UX_ARCHITECTURE_V2.md §1.1: Today · Leads · [+] · Jobs · Inbox. Crew: Today · Jobs · Inbox.
export function primary(access: NavAccess, unread: number): NavItem[] {
  return [
    { href: "/app", label: "Today", icon: Home, exact: true },
    ...(access.crm ? [{ href: "/app/leads", label: "Leads", icon: ClipboardList }] : []),
    { href: "/app/jobs", label: "Jobs", icon: Briefcase },
    { href: "/app/inbox", label: "Inbox", icon: Inbox, badge: unread },
  ];
}

export type CreateItem = { href: string; label: string; description: string; icon: LucideIcon };
export function createItems(access: NavAccess): CreateItem[] {
  return [
    ...(access.crm ? [{ href: "/app/leads/new", label: "New lead", description: "Someone called or messaged about work", icon: ClipboardList }] : []),
    ...(access.manageJobs ? [{ href: "/app/jobs/new", label: "New job", description: "Work that's agreed and ready to plan", icon: BriefcaseBusiness }] : []),
    ...(access.crm ? [{ href: "/app/customers/new", label: "New customer", description: "Add a client's contact details", icon: UserPlus }] : []),
    ...(access.editProfile ? [{ href: "/app/posts/new", label: "Showcase work", description: "Post photos of a finished job to your profile", icon: Megaphone }] : []),
  ];
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

