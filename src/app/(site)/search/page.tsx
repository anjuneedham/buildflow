import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/forms/search-bar";
import { getRegions, getServices } from "@/lib/queries";
import { isFirebaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Search contractors" };

export default async function SearchPage() {
  const [services, regions] = isFirebaseConfigured ? await Promise.all([getServices(), getRegions()]) : [[], []];
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 font-display text-2xl font-extrabold">Search</h1>
      <SearchBar services={services} regions={regions} tab="contractors" autoFocus />
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-500">Browse by trade</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {services.map((s) => (
          <Link key={s.id} href={`/explore?service=${s.slug}&tab=contractors`} className="flex min-h-12 items-center rounded-xl border border-concrete-200 bg-white px-4 text-sm font-semibold hover:border-safety-500">{s.plural_name}</Link>
        ))}
      </div>
      {regions.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-500">Browse by location</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {regions.map((r) => <Link key={r.id} href={`/explore?area=${r.slug}&tab=contractors`} className="rounded-full border border-concrete-300 bg-white px-3.5 py-1.5 text-sm font-semibold hover:border-ink-500">{r.name}</Link>)}
          </div>
        </>
      )}
    </main>
  );
}
