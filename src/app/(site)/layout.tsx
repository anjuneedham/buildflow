import { SiteBottomNav, TopNavigation } from "@/components/nav/top-navigation";
import { SiteFooter } from "@/components/nav/site-footer";

// No session read here: marketing and legal pages render statically and the
// header learns who is signed in from /api/me on the client.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-safe-nav md:pb-0">
      <TopNavigation />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <SiteBottomNav />
    </div>
  );
}
