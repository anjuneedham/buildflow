"use client";

import { useTransition } from "react";
import { setBusinessFlag, setUserSuspended, resolveReport, toggleService } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function SuspendUser({ id, suspended }: { id: string; suspended: boolean }) {
  const [p, start] = useTransition();
  return <Button size="sm" variant={suspended ? "outline" : "ghost"} disabled={p} className={suspended ? "" : "text-site-red"} onClick={() => start(async () => { await setUserSuspended(id, !suspended); })}>{suspended ? "Unsuspend" : "Suspend"}</Button>;
}

export function BusinessFlags({ id, verified, suspended }: { id: string; verified: boolean; suspended: boolean }) {
  const [p, start] = useTransition();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { await setBusinessFlag(id, "is_verified", !verified); })}>{verified ? "Unverify" : "Verify"}</Button>
      <Button size="sm" variant="ghost" disabled={p} className={suspended ? "" : "text-site-red"} onClick={() => start(async () => { await setBusinessFlag(id, "is_suspended", !suspended); })}>{suspended ? "Unsuspend" : "Suspend"}</Button>
    </span>
  );
}

export function ReportActions({ id }: { id: string }) {
  const [p, start] = useTransition();
  return (
    <span className="flex gap-1">
      <Button size="sm" variant="danger" disabled={p} onClick={() => start(async () => { await resolveReport(id, "hide"); })}>Hide / suspend</Button>
      <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { await resolveReport(id, "dismiss"); })}>Dismiss</Button>
    </span>
  );
}

export function ServiceToggle({ id, active }: { id: string; active: boolean }) {
  const [p, start] = useTransition();
  return <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { await toggleService(id, !active); })}>{active ? "Disable" : "Enable"}</Button>;
}
