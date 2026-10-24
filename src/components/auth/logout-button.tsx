"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function LogoutButton({ className, role }: { className?: string; role?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button type="button" role={role} disabled={pending} className={cn("disabled:opacity-50", className)}
      onClick={() => start(async () => {
        try {
          await signOut();
        } catch {
          // Offline or the server is unreachable: the session cookie is still there, so don't pretend it's gone.
          toast("Couldn't log out. Check your connection and try again.", "error");
          return;
        }
        // Deliberate full page load: clears the router cache and the header's session state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      })}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
