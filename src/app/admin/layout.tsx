import { Logo } from "@/components/brand/logo";
import { AdminBottomNav, AdminSideNav } from "@/components/nav/nav-sets";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: { default: "Admin", template: "%s · Admin · BuildFlow" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-concrete-200 bg-white p-4 md:flex">
        <Logo href="/admin" /><span className="-mt-4 text-xs font-bold uppercase tracking-wider text-safety-700">Platform admin</span>
        <AdminSideNav />
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center border-b border-concrete-200 bg-white px-4 md:hidden"><Logo href="/admin" /><span className="ml-2 text-xs font-bold uppercase text-safety-700">Admin</span></header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-5 pb-safe-nav md:pb-10">{children}</main>
      </div>
      <AdminBottomNav />
    </div>
  );
}
