"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main" tabIndex={-1}><ErrorState reset={reset} digest={error.digest} /></main>;
}
