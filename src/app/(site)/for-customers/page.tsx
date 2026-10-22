import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "For customers", description: "Find contractors by trade and location, see their real work, and request quotes for free." };

export default function ForCustomers() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Hire based on real work, not guesswork</h1>
      <p className="mt-3 text-lg text-ink-500">See what a contractor has actually built before you call them. Search by trade and parish, save work you like, and request quotes in under a minute. Always free.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[["Discover", "Browse finished projects and before/afters near you."], ["Compare", "Check services, service area, years in business and completed jobs."], ["Request a quote", "Send your project details straight to the contractor."]].map(([t, b]) => (
          <div key={t} className="rounded-xl border border-concrete-200 bg-white p-5"><h2 className="font-bold">{t}</h2><p className="mt-1 text-sm text-ink-500">{b}</p></div>
        ))}
      </div>
      <p className="mt-8 rounded-xl bg-concrete-100 p-4 text-sm text-ink-600">BuildFlow is a discovery platform. Contractors are independent businesses: we don&apos;t employ them or guarantee their work. Verified badges are being rolled out. Always confirm licences, insurance and written quotes before work starts.</p>
      <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/explore" size="lg">Explore contractors</ButtonLink><ButtonLink href="/signup?type=customer" size="lg" variant="outline">Create a free account</ButtonLink></div>
    </main>
  );
}
