"use client";

import { useActionState, useCallback, useEffect, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/validation";
import { useToast } from "./toast";

// Data refresh policy: server actions never call revalidatePath/redirect for
// /app routes (those pages are fully dynamic). Instead they return
// `{ ok, redirectTo? }` and the client navigates or refreshes. In testing,
// revalidating the /app layout inside an action intermittently left the
// Next 15 client router stuck; client-driven refresh was 100% reliable.
//
// Failure policy (UX_ARCHITECTURE_V2.md §7): an action that throws (server
// error, network drop) becomes an inline error instead of an error page, and
// the form keeps what the user typed. Next's own redirect/notFound signals
// are re-thrown untouched.

export function failureMessage() {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? "You're offline. Check your connection and try again. Nothing was lost."
    : "Something went wrong. Please check whether it saved, then try again.";
}

async function settle<T>(fn: () => Promise<T>, fallback: (message: string) => T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    console.error("action failed", e);
    return fallback(failureMessage());
  }
}

/** useActionState that navigates to `redirectTo`, or refreshes the page on success. */
export function useFormAction(action: (state: ActionState, fd: FormData) => Promise<ActionState>, initial: ActionState = {}) {
  const safe = useCallback(
    (state: ActionState, fd: FormData) => settle(() => action(state, fd), (error): ActionState => ({ ok: false, error })),
    [action],
  );
  const [state, formAction, actionPending] = useActionState(safe, initial);
  const [navigating, startNavigation] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    startNavigation(() => (state.redirectTo ? router.push(state.redirectTo) : router.refresh()));
  }, [state, router]);
  return [state, formAction, actionPending || navigating] as const;
}

type Result = { ok?: boolean; error?: string; redirectTo?: string } | void | undefined;

/** Wraps an imperative server action call with the same navigate/refresh and failure behaviour. */
export function useServerAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<Result>, onResult?: (r: Result) => void) =>
      start(async () => {
        let threw = false;
        const r = await settle(fn, (error): Result => { threw = true; return { ok: false, error }; });
        if (threw && !onResult) toast(r?.error ?? failureMessage(), "error");
        onResult?.(r);
        if (r && r.ok === false) return;
        if (r && r.redirectTo) router.push(r.redirectTo);
        else router.refresh();
      }),
    [router, toast],
  );
  return [pending, run] as const;
}
