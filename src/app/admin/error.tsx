"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} digest={error.digest} homeHref="/admin" homeLabel="Admin dashboard" />;
}
