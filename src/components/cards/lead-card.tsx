import Link from "next/link";
import { CalendarClock, MessageCircle, Phone, User } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui";
import { LEAD_SOURCES, optionFor } from "@/lib/constants";
import { cn, formatAmount, relativeDay, timeAgo, whatsappLink } from "@/lib/utils";
import type { Lead } from "@/lib/types";

/** Who, what, when to follow up, who's on it, and one-tap contact. */
export function LeadCard({ lead, assigneeName, today }: { lead: Lead; assigneeName?: string; today: string }) {
  const due = lead.next_follow_up;
  const overdue = due && due < today;
  const wa = whatsappLink(lead.phone);
  return (
    <div className="relative rounded-xl border border-concrete-200 bg-white p-3.5 shadow-card hover:border-concrete-300">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/app/leads/${lead.id}`} className="min-w-0 font-bold text-ink after:absolute after:inset-0">
          <span className="line-clamp-1">{lead.name}</span>
        </Link>
        <StatusBadge kind="lead" value={lead.status} />
      </div>
      {lead.description && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{lead.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span className="font-bold text-ink">{formatAmount(lead.estimated_value)}</span>
        <Badge tone={lead.source === "buildflow" ? "orange" : "neutral"}>{optionFor(LEAD_SOURCES, lead.source)?.label}</Badge>
        <span>{timeAgo(lead.created_at)}</span>
        {assigneeName && <span className="flex items-center gap-1"><User className="h-3 w-3" aria-hidden />{assigneeName}</span>}
      </div>
      {due && (
        <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-bold", overdue ? "text-site-red" : due === today ? "text-action" : "text-ink-600")}>
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />Follow up {overdue ? `(overdue, ${relativeDay(due, today).toLowerCase()})` : relativeDay(due, today).toLowerCase()}
        </p>
      )}
      {(lead.phone || wa) && (
        <div className="relative z-10 mt-2.5 flex gap-2">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-concrete-100 px-3 text-xs font-semibold text-ink hover:bg-concrete-200"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
          {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-concrete-100 px-3 text-xs font-semibold text-ink hover:bg-concrete-200"><Phone className="h-3.5 w-3.5" />Call</a>}
        </div>
      )}
    </div>
  );
}
