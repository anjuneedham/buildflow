import { timeAgo } from "@/lib/utils";

import type { ActivityRow } from "@/lib/types";

export function ActivityList({ items }: { items: ActivityRow[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-500">No activity yet.</p>;
  return (
    <ol className="relative space-y-3 border-l-2 border-concrete-200 pl-4">
      {items.map((a) => (
        <li key={a.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-safety-500 ring-2 ring-white" />
          <p className="text-ink-700">{a.summary}</p>
          <p className="text-xs text-ink-500">{a.actor_name ? `${a.actor_name} · ` : ""}{timeAgo(a.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
