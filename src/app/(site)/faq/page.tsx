import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/plans";
import { getPlans } from "@/lib/plans.server";

export const revalidate = 3600;
export const metadata: Metadata = { title: "FAQ", description: "Answers about BuildFlow for contractors and customers: pricing, requests, reviews, privacy." };

const faqs = (price: string) => [
  ["What is BuildFlow?", "A tool for contractors to manage leads, customers, jobs and photos, and a place for customers to find contractors by the work they have done."],
  ["Is it free for customers?", "Yes. Browsing, saving and requesting a quote cost nothing, and you do not need an account to send a request."],
  ["How much does it cost contractors?", `${price} with a 14-day free trial. Online card payments are not switched on yet, so your trial continues until they are, and we will contact you before any charge.`],
  ["What does \"Verified job\" mean?", "The photos are linked to a job the contractor marked completed in BuildFlow. It shows the work was recorded as a real job; it is not an inspection by BuildFlow."],
  ["How do reviews work?", "After a job is completed the contractor sends the customer a private link. Each job can have one review. Reviews are not paid for, and the contractor can reply but not remove them. You can report a review you think is false."],
  ["Who sees my details when I request a quote?", "Only the contractor you send it to. We never sell your details or share them with other contractors."],
  ["Can my crew use it?", "Yes. Crew members only see the jobs they are assigned to, with tasks and photos, and cannot see leads, customers or billing."],
  ["Can I delete my data?", "Yes. You can delete your account yourself and everything that belongs to it, see how in the account deletion page."],
];

export default async function Faq() {
  const plan = (await getPlans())[0];
  const items = faqs(plan ? `${formatMoney(plan.basePriceCents, plan.currency)} per month including one user, plus ${formatMoney(plan.additionalSeatPriceCents, plan.currency)} per extra user` : "A simple monthly price per user");
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-concrete-200 rounded-xl border border-concrete-200 bg-white">
        {items.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer font-bold">{q}</summary>
            <p className="mt-2 text-ink-600">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-ink-600">Still stuck? <Link className="font-semibold underline" href="/support">Contact support</Link>. To remove your account see <Link className="font-semibold underline" href="/delete-account">Delete your account</Link>.</p>
    </main>
  );
}
