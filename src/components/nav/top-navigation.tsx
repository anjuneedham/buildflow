import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar, ButtonLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { db } from "@/lib/firebase/admin";
import { UserMenu } from "./user-menu";

export async function unreadCount(userId: string) {
  const snap = await db().collection("users").doc(userId).collection("notifications").where("read_at", "==", null).count().get();
  return snap.data().count;
}

/** Shared header for public pages; adapts to signed-in state. */
export async function TopNavigation() {
  const s = await getSession();
  const unread = s.user ? await unreadCount(s.user.id) : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-concrete-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-600 md:flex" aria-label="Main">
          <Link href="/explore" className="hover:text-ink">Explore</Link>
          <Link href="/for-contractors" className="hover:text-ink">For contractors</Link>
          <Link href="/features" className="hover:text-ink">Features</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          {s.user ? (
            <>
              {s.membership && (
                <Link href="/app/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-concrete-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                  <Bell className="h-5 w-5 text-ink-600" />
                  {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-safety-500 ring-2 ring-white" />}
                </Link>
              )}
              <UserMenu
                name={s.profile?.full_name ?? s.user.email ?? ""}
                avatar={<Avatar src={s.profile?.avatar_url} name={s.profile?.full_name} size="sm" />}
                links={[
                  ...(s.membership ? [{ href: "/app", label: "Business dashboard" }, { href: `/contractor/${s.membership.business.slug}`, label: "My public profile" }] : []),
                  ...(!s.membership && s.profile?.account_type === "contractor" ? [{ href: "/onboarding", label: "Finish business setup" }] : []),
                  { href: "/saved", label: "Saved & following" },
                  { href: "/account", label: "Account settings" },
                  ...(s.isAdmin ? [{ href: "/admin", label: "Platform admin" }] : []),
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
