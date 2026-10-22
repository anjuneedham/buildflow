import { Logo } from "@/components/brand/logo";
import { AuthAction } from "./auth-action";

export const metadata = { title: "Account", robots: { index: false } };

// Target for Firebase email links (set "Action URL" in Firebase console →
// Authentication → Templates to https://your-domain/auth/action).
export default async function AuthActionPage({ searchParams }: { searchParams: Promise<{ mode?: string; oobCode?: string }> }) {
  const { mode, oobCode } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4"><Logo /></header>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-concrete-200 bg-white p-6 shadow-card sm:p-8">
          <AuthAction mode={mode ?? ""} oobCode={oobCode ?? ""} />
        </div>
      </main>
    </div>
  );
}
