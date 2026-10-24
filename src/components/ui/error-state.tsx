"use client";

import Link from "next/link";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button, buttonClasses } from "./button";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

/**
 * Error screen used by every error boundary (UX_ARCHITECTURE_V2.md §7):
 * says what happened in plain words, offers a retry and a way out, and shows
 * a reference code that matches the server log entry.
 */
export function ErrorState({ reset, digest, homeHref = "/", homeLabel = "Go home" }: { reset?: () => void; digest?: string; homeHref?: string; homeLabel?: string }) {
  const online = useOnline();
  const Icon = online ? AlertTriangle : WifiOff;
  return (
    <div role="alert" className="mx-auto flex min-h-[50dvh] max-w-sm flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-safety-50 text-action"><Icon className="h-6 w-6" aria-hidden /></span>
      <h1 className="text-xl font-extrabold text-ink">{online ? "Something went wrong" : "You're offline"}</h1>
      <p className="text-sm text-ink-500">
        {online ? "This part of the page couldn't load. Your saved work is safe. Try again, and if it keeps happening contact support." : "Check your connection, then try again."}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {reset && <Button onClick={reset}>Try again</Button>}
        <Link href={homeHref} className={buttonClasses({ variant: "outline" })}>{homeLabel}</Link>
      </div>
      {digest && <p className="text-xs text-ink-500">Reference: <code className="font-mono">{digest}</code></p>}
    </div>
  );
}
