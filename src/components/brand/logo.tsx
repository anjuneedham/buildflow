import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // Stacked beams forming a "B" step: a nod to blockwork and progress.
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1c2127" />
      <rect x="7" y="7" width="12" height="5" rx="1" fill="#f26b1d" />
      <rect x="7" y="13.5" width="16" height="5" rx="1" fill="#ff8a3d" />
      <rect x="7" y="20" width="18" height="5" rx="1" fill="#efede8" />
    </svg>
  );
}

export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="BuildFlow home">
      <LogoMark />
      <span className={cn("font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        BUILD<span className="text-safety-500">Flow</span>
      </span>
    </Link>
  );
}
