"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { CustomerBottomNav } from "./nav-sets";
import { UserMenu } from "./user-menu";
import { useMe } from "./use-me";

/** Shared header for public pages. Client-rendered so the pages themselves can be static. */
export function TopNavigation() {
  const me = useMe();
  return (
    <header className="sticky top-0 z-40 border-b border-concrete-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-600 md:flex" aria-label="Main">
          <Link href="/explore" className="py-2.5 hover:text-ink">Explore</Link>
          <Link href="/for-contractors" className="py-2.5 hover:text-ink">For contractors</Link>
          <Link href="/features" className="py-2.5 hover:text-ink">Features</Link>
          <Link href="/pricing" className="py-2.5 hover:text-ink">Pricing</Link>
        </nav>
        <div className="flex min-w-[7rem] items-center justify-end gap-2">
          {me === null ? (
            <span className="h-9 w-24 animate-pulse rounded-lg bg-concrete-100" aria-hidden />
          ) : me.signedIn ? (
            <>
              {me.business && (
                <Link href="/app/inbox" className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-concrete-100" aria-label={`Inbox${me.unread ? `, ${me.unread} unread` : ""}`}>
                  <Bell className="h-5 w-5 text-ink-600" />
                  {me.unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-action ring-2 ring-white" />}
                </Link>
              )}
              <UserMenu
                name={me.name}
                avatar={<Avatar src={me.avatarUrl} name={me.name} size="sm" />}
                links={[
                  ...(me.business ? [{ href: "/app", label: "Business dashboard" }, { href: `/contractor/${me.business.slug}`, label: "My public profile" }] : []),
                  ...(me.needsOnboarding ? [{ href: "/onboarding", label: "Finish business setup" }] : []),
                  { href: "/saved", label: "Saved" },
                  { href: "/account", label: "Account settings" },
                  ...(me.isAdmin ? [{ href: "/admin", label: "Platform admin" }] : []),
                ]}
              />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
              <ButtonLink href="/signup" size="sm">Get started</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteBottomNav() {
  const me = useMe();
  return <CustomerBottomNav signedIn={Boolean(me?.signedIn)} isContractor={Boolean(me?.signedIn && me.business)} />;
}
