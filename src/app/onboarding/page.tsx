import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getRegions, getServices } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BrandingStep, BusinessStep, FinishStep, FirstRecordStep, ServiceAreaStep, ServicesStep } from "./steps";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up your business", robots: { index: false } };

const STEPS = ["Account", "Business", "Services", "Service area", "Logo & photos", "First job", "Finish"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const s = await requireUser("/onboarding");
  const business = s.membership?.business ?? null;
  if (s.membership && s.membership.role !== "owner") redirect("/app");
  const reached = business ? Math.max(3, business.onboarding_step) : 2;
  const requested = Number((await searchParams).step) || reached;
  // Can revisit earlier steps, never skip ahead of where you've reached.
  const step = Math.min(Math.max(2, requested), reached);

  const [services, regions] = await Promise.all([getServices(), getRegions(business?.country_code ?? "JM")]);
  let selected: string[] = [];
  if (business) {
    const supabase = await createClient();
    const { data } = await supabase.from("business_services").select("service_id").eq("business_id", business.id);
    selected = (data ?? []).map((r) => r.service_id);
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-concrete-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Logo href={business ? "/app" : "/"} />
          <span className="text-sm font-semibold text-ink-500">Step {step} of {STEPS.length}</span>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <ol className="flex gap-1" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1" aria-current={i + 1 === step ? "step" : undefined}>
                <span className={cn("block h-1.5 rounded-full", i + 1 < step ? "bg-site-green" : i + 1 === step ? "bg-safety-500" : "bg-concrete-200")} />
                <span className={cn("mt-1 hidden text-[11px] font-semibold sm:block", i + 1 === step ? "text-ink" : "text-ink-500")}>
                  {i + 1 < step && <Check className="mr-0.5 inline h-3 w-3 text-site-green" />}{label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16">
        {step === 2 && <BusinessStep business={business} regions={regions} ownerName={s.profile?.full_name ?? ""} email={s.user.email ?? ""} />}
        {step === 3 && <ServicesStep services={services} selected={selected} primary={business?.primary_service_id ?? null} />}
        {step === 4 && business && <ServiceAreaStep business={business} regions={regions} />}
        {step === 5 && business && <BrandingStep business={business} />}
        {step === 6 && <FirstRecordStep />}
        {step === 7 && business && <FinishStep slug={business.slug} />}
      </main>
    </div>
  );
}
