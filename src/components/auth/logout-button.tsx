"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function LogoutButton({ className, role }: { className?: string; role?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" role={role} disabled={pending} className={cn("disabled:opacity-50", className)}
      onClick={() => start(async () => {
        await signOut();
        // Deliberate full page load: clears the router cache and the header's session state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      })}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
