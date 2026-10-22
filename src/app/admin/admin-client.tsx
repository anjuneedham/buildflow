"use client";

import { useServerAction } from "@/components/ui/use-form-action";
import { setBusinessFlag, setUserSuspended, resolveReport, toggleService } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function SuspendUser({ id, suspended }: { id: string; suspended: boolean }) {
  const [p, run] = useServerAction();
  return <Button size="sm" variant={suspended ? "outline" : "ghost"} disabled={p} className={suspended ? "" : "text-site-red"} onClick={() => run(() => setUserSuspended(id, !suspended))}>{suspended ? "Unsuspend" : "Suspend"}</Button>;
}

export function BusinessFlags({ id, verified, suspended }: { id: string; verified: boolean; suspended: boolean }) {
  const [p, run] = useServerAction();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="outline" disabled={p} onClick={() => run(() => setBusinessFlag(id, "is_verified", !verified))}>{verified ? "Unverify" : "Verify"}</Button>
      <Button size="sm" variant="ghost" disabled={p} className={suspended ? "" : "text-site-red"} onClick={() => run(() => setBusinessFlag(id, "is_suspended", !suspended))}>{suspended ? "Unsuspend" : "Suspend"}</Button>
    </span>
  );
}

export function ReportActions({ id }: { id: string }) {
  const [p, run] = useServerAction();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="danger" disabled={p} onClick={() => run(() => resolveReport(id, "hide"))}>Hide / suspend</Button>
      <Button size="sm" variant="outline" disabled={p} onClick={() => run(() => resolveReport(id, "dismiss"))}>Dismiss</Button>
    </span>
  );
}

export function ServiceToggle({ id, active }: { id: string; active: boolean }) {
  const [p, run] = useServerAction();
  return <Button size="sm" variant="outline" disabled={p} onClick={() => run(() => toggleService(id, !active))}>{active ? "Disable" : "Enable"}</Button>;
}
