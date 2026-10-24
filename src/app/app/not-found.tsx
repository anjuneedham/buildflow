import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

// Inside the app layout: a deleted or foreign record keeps the navigation and points back to work.
export default function AppNotFound() {
  return (
    <EmptyState icon={SearchX} title="We couldn't find that"
      description="It may have been deleted, or it isn't part of your business."
      action={<div className="flex flex-wrap justify-center gap-2"><ButtonLink href="/app">Go to Today</ButtonLink><ButtonLink href="/app/leads" variant="outline">Leads</ButtonLink><ButtonLink href="/app/jobs" variant="outline">Jobs</ButtonLink></div>} />
  );
}
