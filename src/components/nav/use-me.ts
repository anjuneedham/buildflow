"use client";

import { useSyncExternalStore } from "react";
import type { Me } from "@/app/api/me/route";

const HINT = "bf_auth";
const SIGNED_OUT: Me = { signedIn: false };

// Module-level store shared by every header component on the page.
let value: Me | null = null;
let started = false;
const listeners = new Set<() => void>();

function hasHint() {
  return document.cookie.split("; ").some((c) => c.startsWith(`${HINT}=`));
}

function load() {
  if (started) return;
  started = true;
  const done = (m: Me) => {
    if (!m.signedIn) document.cookie = `${HINT}=; Max-Age=0; path=/`; // stale hint
    value = m;
    listeners.forEach((l) => l());
  };
  if (!hasHint()) { queueMicrotask(() => done(SIGNED_OUT)); return; }
  fetch("/api/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : SIGNED_OUT)).catch(() => SIGNED_OUT).then(done);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Signed in or out since the store loaded (another layout did it): reload.
  if (started && value && hasHint() !== value.signedIn) started = false;
  load();
  return () => { listeners.delete(listener); };
}

/**
 * Session summary for client components on static pages: null while
 * loading. Without the hint cookie the visitor is signed out and no request
 * is made.
 */
export function useMe(): Me | null {
  return useSyncExternalStore(subscribe, () => value, () => null);
}
