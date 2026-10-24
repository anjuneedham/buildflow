"use client";

import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { prepareUploads } from "@/lib/shrink-images";
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
//
// React 19 resets a <form action> after the action finishes, whether or not it
// succeeded, which wiped everything the person typed on any validation error.
// So the hook remembers what was submitted and puts it back when the action
// fails. (Files can't be restored by a page; people re-choose those.)

let lastSubmitted: HTMLFormElement | null = null;
if (typeof document !== "undefined" && !(window as unknown as { __bfFormTrack?: boolean }).__bfFormTrack) {
  (window as unknown as { __bfFormTrack?: boolean }).__bfFormTrack = true;
  // Capture phase: runs before React turns the submit into an action call.
  document.addEventListener("submit", (e) => { if (e.target instanceof HTMLFormElement) lastSubmitted = e.target; }, true);
}

type Snapshot = { form: HTMLFormElement | null; entries: [string, string][] };

function takeSnapshot(fd: FormData): Snapshot {
  return { form: lastSubmitted, entries: [...fd.entries()].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$ACTION")) };
}

function restore({ form, entries }: Snapshot) {
  if (!form?.isConnected) return;
  const byName = new Map<string, string[]>();
  for (const [k, v] of entries) byName.set(k, [...(byName.get(k) ?? []), v]);
  for (const [name, values] of byName) {
    const fields = Array.from(form.elements).filter((el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => "name" in el && (el as HTMLInputElement).name === name);
    fields.forEach((el, i) => {
      if (el instanceof HTMLInputElement) {
        if (["file", "hidden", "submit", "button", "image", "reset"].includes(el.type)) return;
        if (el.type === "checkbox") el.checked = values.includes(el.value);
        else if (el.type === "radio") { if (values.includes(el.value)) el.checked = true; }
        else if (el.value !== (values[i] ?? values[values.length - 1])) el.value = values[i] ?? values[values.length - 1];
      } else if (el instanceof HTMLSelectElement) {
        if (el.multiple) Array.from(el.options).forEach((o) => { o.selected = values.includes(o.value); });
        else if (el.value !== values[0]) el.value = values[0];
      } else if (el.value !== (values[i] ?? values[values.length - 1])) el.value = values[i] ?? values[values.length - 1];
    });
  }
}

export async function failureMessage() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Check your connection and try again. Nothing was lost.";
  // A session that expired while the page was open makes every action fail the same unhelpful way.
  if (typeof document !== "undefined" && document.cookie.includes("bf_auth=")) {
    const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json() as Promise<{ signedIn?: boolean }>, () => null);
    if (me && me.signedIn === false) return "You were signed out. Log in again in another tab, then tap the button again. What you typed is still here.";
  }
  return "Something went wrong. Please check whether it saved, then try again.";
}

async function settle<T>(fn: () => Promise<T>, fallback: (message: string) => T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    console.error("action failed", e);
    return fallback(await failureMessage());
  }
}

/**
 * useActionState that navigates to `redirectTo`, or refreshes the page on
 * success (`refresh: false` for forms that show their own success state).
 * Keeps what was typed when the action fails.
 */
export function useFormAction(action: (state: ActionState, fd: FormData) => Promise<ActionState>, initial: ActionState = {}, options: { refresh?: boolean } = {}) {
  const submitted = useRef<Snapshot | null>(null);
  const safe = useCallback(
    async (state: ActionState, fd: FormData) => {
      submitted.current = takeSnapshot(fd);
      // Photos are shrunk in the browser first: a 12 MP phone photo is 3-6 MB, and the host accepts about 4.5 MB per request.
      const prepared = await prepareUploads(fd);
      if (!prepared.fd) return { ok: false, error: prepared.error } as ActionState;
      const next = await settle(() => action(state, prepared.fd), (error): ActionState => ({ ok: false, error }));
      if (next.ok) submitted.current = null;
      return next;
    },
    [action],
  );
  const [state, formAction, actionPending] = useActionState(safe, initial);
  const [navigating, startNavigation] = useTransition();
  const router = useRouter();
  // After React's own form reset (same commit), before the browser paints.
  useLayoutEffect(() => {
    if (state.ok !== false || !submitted.current) return;
    restore(submitted.current);
    submitted.current = null;
  }, [state]);
  const refresh = options.refresh ?? true;
  useEffect(() => {
    if (!state.ok) return;
    if (state.redirectTo) startNavigation(() => router.push(state.redirectTo!));
    else if (refresh) startNavigation(() => router.refresh());
  }, [state, router, refresh]);
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
        if (threw && !onResult) toast(r?.error ?? "Something went wrong. Please try again.", "error");
        onResult?.(r);
        if (r && r.ok === false) return;
        if (r && r.redirectTo) router.push(r.redirectTo);
        else router.refresh();
      }),
    [router, toast],
  );
  return [pending, run] as const;
}
