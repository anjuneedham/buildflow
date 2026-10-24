"use client";

import { markAllNotificationsRead } from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/ui/use-form-action";

export function MarkAllRead() {
  const [pending, run] = useServerAction();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(markAllNotificationsRead)}>Mark all read</Button>;
}
