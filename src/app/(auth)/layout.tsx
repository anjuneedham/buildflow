import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4"><Logo /></header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-concrete-200 bg-white p-6 shadow-card sm:p-8">{children}</div>
      </main>
      <footer className="pb-6 text-center text-xs text-ink-500">
        <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link>
      </footer>
    </div>
  );
}
