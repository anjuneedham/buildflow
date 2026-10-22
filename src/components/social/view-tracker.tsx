"use client";

import { useEffect } from "react";
import { trackView } from "@/app/actions/social";

/** Records a profile/post view once per browser session (not on prefetch). */
export function ViewTracker({ businessId, postId }: { businessId: string; postId?: string }) {
  useEffect(() => {
    const key = `bf-view:${businessId}:${postId ?? ""}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage blocked: still count */ }
    void trackView(businessId, postId);
  }, [businessId, postId]);
  return null;
}
