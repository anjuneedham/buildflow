import { TopNavigation } from "@/components/nav/top-navigation";
import { SiteFooter } from "@/components/nav/site-footer";
import { CustomerBottomNav } from "@/components/nav/nav-sets";
import { getSession } from "@/lib/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <div className="flex min-h-dvh flex-col pb-safe-nav md:pb-0">
      <TopNavigation />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <CustomerBottomNav signedIn={Boolean(s.user)} isContractor={Boolean(s.membership)} />
    </div>
  );
}
