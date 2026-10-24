"use client";

import { ErrorState } from "@/components/ui/error-state";

// Inside the app layout, so the navigation stays usable when one screen fails.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} digest={error.digest} homeHref="/app" homeLabel="Go to Today" />;
}
