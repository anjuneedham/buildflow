import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { SeatCalculator } from "@/components/forms/seat-calculator";
import { formatMoney, seatPriceBreakdown } from "@/lib/plans";
import { getPlans } from "@/lib/plans.server";

export const metadata: Metadata = { title: "Pricing", description: "BuildFlow Basic: $50/month including one user, plus $20/month per additional team member." };

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Simple pricing</h1>
      <p className="mt-2 text-ink-500">One plan with everything you need. Pay for the people who use it. Free for customers.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-2xl border-2 border-ink bg-white p-6 md:p-8">
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="text-sm text-ink-500">{plan.description}</p>
            <p className="mt-4"><span className="font-display text-5xl font-extrabold">{formatMoney(plan.basePriceCents, plan.currency)}</span><span className="text-ink-500"> {plan.currency}/{plan.interval}</span></p>
            <p className="mt-1 text-sm text-ink-600">Includes {plan.includedSeats} user · +{formatMoney(plan.additionalSeatPriceCents, plan.currency)}/{plan.interval} per additional user</p>
            <ul className="mt-6 space-y-2.5">
              {plan.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="h-5 w-5 shrink-0 text-site-green" />{f}</li>)}
            </ul>
            <ButtonLink href="/signup?type=contractor" size="lg" block className="mt-8">Start 14-day free trial</ButtonLink>
            <div className="mt-6"><SeatCalculator plan={plan} /></div>
          </section>
        ))}
        <aside className="space-y-4">
          <div className="rounded-xl border border-concrete-200 bg-white p-5">
            <h3 className="font-bold">Examples</h3>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {[1, 2, 3, 4].map((n) => (
                  <tr key={n} className="border-t border-concrete-200"><td className="py-2">{n} user{n > 1 ? "s" : ""}</td><td className="py-2 text-right font-bold">{formatMoney(seatPriceBreakdown(plans[0], n).totalCents)}/month</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-concrete-200 bg-white p-5 text-sm text-ink-600">
            <h3 className="font-bold text-ink">Questions</h3>
            <p className="mt-2"><b>Do customers pay?</b> No. Browsing, following and requesting quotes is free.</p>
            <p className="mt-2"><b>Can I cancel?</b> Yes, any time. See our <a href="/refund-policy" className="underline">cancellation policy</a>.</p>
            <p className="mt-2"><b>Bigger teams?</b> Pro, Business and Enterprise plans are planned. <a href="/contact" className="underline">Talk to us</a>.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
