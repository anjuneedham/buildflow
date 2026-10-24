import { cn } from "@/lib/utils";

// Loading skeletons shaped like the screens they stand in for, so the layout
// doesn't jump when content arrives (UX_ARCHITECTURE_V2.md §6).

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-concrete-200/70", className)} />;
}

function Status({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-3", className)} role="status" aria-live="polite" aria-label={label}><span className="sr-only">{label}…</span>{children}</div>;
}

/** Generic page: title + rows. */
export function LoadingState({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <Status label={label}>
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </Status>
  );
}

/** List screens (leads, jobs, customers, inbox): header, tabs, card grid. */
export function ListSkeleton({ label = "Loading", cards = 6 }: { label?: string; cards?: number }) {
  return (
    <Status label={label}>
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-11 w-28" /></div>
      <Skeleton className="h-11 w-full" />
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-20" />)}</div>
      <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: cards }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
    </Status>
  );
}

/** Record detail (lead, customer, job): header, action row, two columns. */
export function DetailSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <Status label={label}>
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-2 sm:flex"><Skeleton className="h-11 sm:w-28" /><Skeleton className="h-11 sm:w-28" /></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-56 w-full" /></div>
        <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
      </div>
    </Status>
  );
}

/** Public feed / profile grids. */
export function FeedSkeleton({ label = "Loading", items = 6 }: { label?: string; items?: number }) {
  return (
    <Status label={label} className="mx-auto max-w-6xl px-4 py-6">
      <Skeleton className="h-12 w-full max-w-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: items }).map((_, i) => <div key={i} className="space-y-2"><Skeleton className="aspect-[4/3] w-full" /><Skeleton className="h-4 w-2/3" /></div>)}
      </div>
    </Status>
  );
}
