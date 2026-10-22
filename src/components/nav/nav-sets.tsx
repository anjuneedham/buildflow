"use client";

import {
  BarChart3, Bookmark, Briefcase, Building2, ClipboardList, Compass, CreditCard, Flag, Home, LayoutDashboard,
  Search, Settings, Store, User, Users, UsersRound, Bell, Tags,
} from "lucide-react";
import { BottomNavigation, SideNavigation, type NavItem } from "./bottom-navigation";

export function CustomerBottomNav({ signedIn, isContractor }: { signedIn: boolean; isContractor: boolean }) {
  const items: NavItem[] = [
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/search", label: "Search", icon: Search },
    { href: signedIn ? "/saved" : "/login?next=/saved", label: "Saved", icon: Bookmark },
    isContractor
      ? { href: "/app", label: "Business", icon: Briefcase }
      : { href: signedIn ? "/account" : "/login", label: "Profile", icon: User },
  ];
  return <BottomNavigation items={items} />;
}

const contractorPrimary: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/leads", label: "Leads", icon: ClipboardList },
  { href: "/app/projects", label: "Projects", icon: Briefcase },
  { href: "/app/customers", label: "Customers", icon: Users },
];

export function ContractorBottomNav({ slug }: { slug: string }) {
  return <BottomNavigation items={[...contractorPrimary, { href: `/contractor/${slug}`, label: "Profile", icon: Store }]} />;
}

export function ContractorSideNav({ slug }: { slug: string }) {
  return (
    <SideNavigation
      items={[
        ...contractorPrimary,
        { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/app/notifications", label: "Notifications", icon: Bell },
        { href: "/app/profile", label: "Edit profile", icon: Settings },
        { href: "/app/team", label: "Team", icon: UsersRound },
        { href: "/app/billing", label: "Billing", icon: CreditCard },
        { href: `/contractor/${slug}`, label: "View public profile", icon: Store },
        { href: "/explore", label: "Explore", icon: Compass },
      ]}
    />
  );
}

const adminItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/plans", label: "Plans", icon: Tags },
];
export function AdminSideNav() { return <SideNavigation items={adminItems} />; }
export function AdminBottomNav() { return <BottomNavigation items={adminItems} />; }
