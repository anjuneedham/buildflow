import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Avatar, Card } from "@/components/ui";
import { fromDoc } from "@/lib/data/db";
import { tenant } from "@/lib/data/tenant";
import { reviewRequestRef } from "@/lib/data/trust";
import { formatDate, isPast } from "@/lib/utils";
import type { Business } from "@/lib/types";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Leave a review", robots: { index: false, follow: false } };

/** Opened from the link a contractor sends after finishing a job. No account needed. */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const req = await reviewRequestRef(token).get();
  if (!req.exists) notFound();
  const expired = isPast(req.get("expires_at"));
  const t = tenant(req.get("business_id"));
  const [biz, project, existing] = await Promise.all([t.root.get(), t.doc("projects", req.get("project_id")).get(), t.doc("reviews", req.get("project_id")).get()]);
  const b = fromDoc<Business>(biz);
  if (!b || !project.exists) notFound();
  const customerName = (req.get("customer_name") as string | null) ?? "";

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-lg px-4 py-8">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <Avatar src={b.logo_url} name={b.name} size="lg" square />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-bold">{b.name}{b.is_verified && <BadgeCheck className="h-4 w-4 text-site-blue" aria-label="Verified" />}</p>
            <p className="text-sm text-ink-500">{[req.get("service_name"), project.get("completed_at") && `finished ${formatDate(project.get("completed_at"), { month: "long", year: "numeric" })}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <h1 className="mt-5 font-display text-2xl font-extrabold">How did {b.name} do?</h1>
        <p className="mt-1 text-sm text-ink-500">Your review helps other people in Jamaica find good contractors.</p>
        {expired ? (
          <p className="mt-5 rounded-lg bg-concrete-50 p-3 text-sm text-ink-600">This review link has expired. Ask {b.name} to send a new one.</p>
        ) : (
          <div className="mt-5">
            <ReviewForm token={token} defaultName={existing.exists ? existing.get("reviewer_name") : customerName} existing={existing.exists ? { rating: existing.get("rating"), body: existing.get("body") ?? "" } : null} />
          </div>
        )}
        <p className="mt-5 flex items-start gap-2 text-xs text-ink-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Reviews on BuildFlow come only from customers of real, completed jobs. Your review shows your first name and last initial.</p>
      </Card>
    </main>
  );
}
