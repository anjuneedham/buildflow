import Link from "next/link";
import { db } from "@/lib/firebase/admin";
import { fromQuery } from "@/lib/data/db";
import { requireUser } from "@/lib/session";
import { AccountForm } from "./account-form";
import { Card, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const s = await requireUser("/account");
  const requests = fromQuery<{ id: string; created_at: string; kind: string; description: string; business_name: string; business_slug: string }>(
    await db().collection("users").doc(s.user.id).collection("quote_requests").orderBy("created_at", "desc").limit(20).get());
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold">Account</h1>
      <Card className="p-4">
        <AccountForm name={s.profile?.full_name ?? ""} avatar={s.profile?.avatar_url ?? null} email={s.user.email ?? ""} />
      </Card>
      {!s.membership && (
        <Card className="p-4">
          <h2 className="font-bold">Run a construction business?</h2>
          <p className="mt-1 text-sm text-ink-500">Set up a business profile to post your work and receive quote requests.</p>
          <Link href="/onboarding" className="mt-3 inline-block font-semibold text-safety-700 underline">Set up my business</Link>
        </Card>
      )}
      <section>
        <h2 className="mb-2 font-bold">My quote requests</h2>
        {requests.length === 0 ? <p className="text-sm text-ink-500">You haven&apos;t requested any quotes yet.</p> : (
          <ul className="divide-y divide-concrete-200 rounded-xl border border-concrete-200 bg-white">
            {requests.map((r) => {
              return (
                <li key={r.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><Link href={`/contractor/${r.business_slug}`} className="font-semibold">{r.business_name}</Link><span className="text-xs text-ink-500">{formatDate(r.created_at)}</span></div>
                  <p className="line-clamp-2 text-ink-600">{r.description}</p>
                  {r.kind === "contact" && <StatusBadge kind="lead" value="contacted" className="mt-1" />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <form action={signOut}><button className="font-semibold text-site-red">Log out</button></form>
    </main>
  );
}
