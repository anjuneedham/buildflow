import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ContractorBottomNav, ContractorSideNav } from "@/components/nav/nav-sets";
import { UserMenu } from "@/components/nav/user-menu";
import { unreadCount } from "@/components/nav/top-navigation";
import { Avatar } from "@/components/ui";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false } };

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const s = await requireBusiness();
  const unread = await unreadCount(s.user.id);
  const b = s.business;
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-concrete-200 bg-white p-4 md:flex">
        <Logo href="/app" />
        <Link href="/app/profile" className="flex items-center gap-2.5 rounded-xl bg-concrete-50 p-2.5">
          <Avatar src={b.logo_url} name={b.name} size="sm" square />
          <span className="min-w-0"><span className="block truncate text-sm font-bold">{b.name}</span><span className="text-xs capitalize text-ink-500">{s.membership.role}</span></span>
        </Link>
        <ContractorSideNav slug={b.slug} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-concrete-200 bg-white/95 px-4 backdrop-blur">
          <div className="md:hidden"><Logo href="/app" /></div>
          <p className="hidden truncate text-sm font-semibold text-ink-500 md:block">{b.name}</p>
          <div className="flex items-center gap-1">
            <Link href="/app/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-concrete-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="h-5 w-5 text-ink-600" />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <UserMenu name={s.profile?.full_name || s.user.email || ""} avatar={<Avatar src={s.profile?.avatar_url} name={s.profile?.full_name} size="sm" />}
              links={[
                { href: "/app/analytics", label: "Analytics" },
                { href: "/app/profile", label: "Edit business profile" },
                { href: "/app/team", label: "Team" },
                { href: "/app/billing", label: "Billing & plan" },
                { href: "/explore", label: "Explore BuildFlow" },
                { href: "/account", label: "My account" },
                ...(s.isAdmin ? [{ href: "/admin", label: "Platform admin" }] : []),
              ]} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-5 pb-safe-nav md:pb-10">{children}</main>
      </div>
      <ContractorBottomNav slug={b.slug} />
    </div>
  );
}
