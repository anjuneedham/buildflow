import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ContractorBottomNav, ContractorSideNav, moreLinks, type NavAccess } from "@/components/nav/nav-sets";
import { UserMenu } from "@/components/nav/user-menu";
import { Avatar } from "@/components/ui";
import { unreadCount } from "@/lib/notifications";
import { requireBusiness } from "@/lib/session";
import { ROLE_LABELS } from "@/server/policy";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false } };

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const s = await requireBusiness();
  const unread = await unreadCount(s.user.id);
  const b = s.business;
  const access: NavAccess = {
    crm: s.can("crm"), manageJobs: s.can("projects.manage"), editProfile: s.can("profile.edit"),
    analytics: s.can("analytics.view"), billing: s.can("billing.manage"),
  };
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-concrete-200 bg-white p-4 md:flex">
        <Logo href="/app" />
        <div className="flex items-center gap-2.5 rounded-xl bg-concrete-50 p-2.5">
          <Avatar src={b.logo_url} name={b.name} size="sm" square />
          <span className="min-w-0"><span className="block truncate text-sm font-bold">{b.name}</span><span className="text-xs text-ink-500">{ROLE_LABELS[s.role].label}</span></span>
        </div>
        <ContractorSideNav access={access} unread={unread} slug={b.slug} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-concrete-200 bg-white/95 px-4 backdrop-blur">
          <div className="md:hidden"><Logo href="/app" /></div>
          <p className="hidden truncate text-sm font-semibold text-ink-500 md:block">{b.name}</p>
          <div className="flex items-center gap-1">
            {access.crm && (
              // Global search = customers by name, then their leads and jobs (UX_ARCHITECTURE_V2.md §1.1).
              <Link href="/app/customers" aria-label="Search customers" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-concrete-100">
                <Search className="h-5 w-5 text-ink-600" aria-hidden />
              </Link>
            )}
            <UserMenu name={s.profile?.full_name || s.user.email || ""} avatar={<Avatar src={s.profile?.avatar_url} name={s.profile?.full_name} size="sm" />}
              links={[
                ...moreLinks(access, b.slug).map(({ href, label }) => ({ href, label })),
                { href: "/account", label: "My account" },
                ...(s.isAdmin ? [{ href: "/admin", label: "Platform admin" }] : []),
              ]} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-5 pb-safe-nav md:pb-10">{children}</main>
      </div>
      <ContractorBottomNav access={access} unread={unread} />
    </div>
  );
}
