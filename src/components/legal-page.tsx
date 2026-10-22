import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { LEGAL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: {LEGAL.lastUpdated}</p>
      <div role="note" className="mt-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p><b>Product draft.</b> This document is a working draft prepared for product development. It has not been reviewed by a lawyer and must be reviewed by qualified legal counsel before BuildFlow launches to the public.</p>
      </div>
      <article className="prose-legal mt-4">{children}</article>
    </main>
  );
}
