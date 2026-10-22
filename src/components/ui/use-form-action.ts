"use client";

import { useActionState, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/validation";

// Data refresh policy: server actions never call revalidatePath/redirect for
// /app routes (those pages are fully dynamic). Instead they return
// `{ ok, redirectTo? }` and the client navigates or refreshes. In testing,
// revalidating the /app layout inside an action intermittently left the
// Next 15 client router stuck; client-driven refresh was 100% reliable.

/** useActionState that navigates to `redirectTo`, or refreshes the page on success. */
export function useFormAction(action: (state: ActionState, fd: FormData) => Promise<ActionState>, initial: ActionState = {}) {
  const [state, formAction, actionPending] = useActionState(action, initial);
  const [navigating, startNavigation] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    startNavigation(() => (state.redirectTo ? router.push(state.redirectTo) : router.refresh()));
  }, [state, router]);
  return [state, formAction, actionPending || navigating] as const;
}

type Result = { ok?: boolean; error?: string; redirectTo?: string } | void | undefined;

/** Wraps an imperative server action call with the same navigate/refresh behaviour. */
export function useServerAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<Result>, onResult?: (r: Result) => void) =>
      start(async () => {
        const r = await fn();
        onResult?.(r);
        if (r && r.ok === false) return;
        if (r && r.redirectTo) router.push(r.redirectTo);
        else router.refresh();
      }),
    [router],
  );
  return [pending, run] as const;
}
