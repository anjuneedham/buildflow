"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="max-w-sm text-ink-500">Please try again. If it keeps happening, contact support.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
