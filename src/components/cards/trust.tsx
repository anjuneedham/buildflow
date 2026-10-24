import { BadgeCheck, Clock, Hammer, MessageCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Star rating, e.g. ★★★★☆ 4.2 (12). Accessible as "Rated 4.2 out of 5 from 12 reviews". */
export function Stars({ avg, count, size = "sm", showCount = true }: { avg: number; count: number; size?: "sm" | "md"; showCount?: boolean }) {
  const full = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${avg} out of 5 from ${count} review${count === 1 ? "" : "s"}`} role="img">
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn(size === "md" ? "h-4 w-4" : "h-3.5 w-3.5", n <= full ? "fill-safety-500 text-safety-500" : "text-concrete-300")} />)}
      </span>
      <span aria-hidden className={cn("font-bold text-ink", size === "md" ? "text-sm" : "text-xs")}>{avg.toFixed(1)}</span>
      {showCount && <span aria-hidden className={cn("text-ink-500", size === "md" ? "text-sm" : "text-xs")}>({count})</span>}
    </span>
  );
}

export type TrustFacts = {
  rating: { avg: number; count: number } | null; jobs: number; response: string | null; years: number | null; verified: boolean;
};

/**
 * Credibility signals that are earned in BuildFlow, not self-declared:
 * verified reviews, completed jobs, reply speed. Shown wherever a customer
 * decides whether to trust a contractor.
 */
export function TrustStrip({ facts, className, compact }: { facts: TrustFacts; className?: string; compact?: boolean }) {
  const items: React.ReactNode[] = [];
  items.push(facts.rating ? <Stars key="r" avg={facts.rating.avg} count={facts.rating.count} size={compact ? "sm" : "md"} /> : <span key="r" className="text-ink-500">No reviews yet</span>);
  if (facts.jobs > 0) items.push(<span key="j" className="inline-flex items-center gap-1"><Hammer className="h-3.5 w-3.5 text-ink-500" aria-hidden />{facts.jobs} job{facts.jobs === 1 ? "" : "s"} completed</span>);
  if (facts.response) items.push(<span key="t" className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-ink-500" aria-hidden />{facts.response}</span>);
  if (!compact && facts.years) items.push(<span key="y" className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-ink-500" aria-hidden />{facts.years} year{facts.years === 1 ? "" : "s"} in business</span>);
  if (!compact && facts.verified) items.push(<span key="v" className="inline-flex items-center gap-1 font-semibold text-site-blue"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Verified by BuildFlow</span>);
  return <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", compact ? "text-xs" : "text-sm", "text-ink-700", className)}>{items}</div>;
}

/** "Verified job": the post is linked to a real job managed in BuildFlow. */
export function VerifiedJobBadge({ completedOn, className }: { completedOn?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-site-green", className)}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />Verified job{completedOn ? ` · ${new Date(completedOn + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}` : ""}
    </span>
  );
}
