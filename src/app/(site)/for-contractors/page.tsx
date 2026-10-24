import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "For contractors", description: "Get a public profile that wins jobs, capture every quote request as a lead, and run projects from your phone." };

const steps = [
  ["Set up in minutes", "Business name, your trade, where you work, and a logo. Skip anything and finish later."],
  ["Post your best work", "Upload photos of finished jobs and before/afters straight from the site."],
  ["Get quote requests", "Customers tap Request a Quote on your profile. It lands in your leads with their details."],
  ["Win and run the job", "Move the lead through your pipeline, convert to a customer, create the project and tasks."],
  ["Finish and show it off", "Mark the project complete and post it. That's your next customer's first impression."],
];

export default function ForContractors() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="bg-ink text-white"><div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="font-display text-3xl font-extrabold md:text-5xl">Your work sells. <span className="text-safety-400">Let it.</span></h1>
        <p className="mt-4 max-w-2xl text-lg text-concrete-300">BuildFlow is for electricians, masons, tilers, carpenters, painters, roofers, plumbers, landscapers, HVAC techs, renovation companies and general contractors who want more of the right jobs and less paperwork.</p>
        <ButtonLink href="/signup?type=contractor" size="lg" className="mt-8">Create your business profile</ButtonLink>
      </div></section>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <ol className="space-y-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="flex gap-4 rounded-xl border border-concrete-200 bg-white p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action font-extrabold text-white">{i + 1}</span>
              <div><h2 className="font-bold">{t}</h2><p className="mt-1 text-ink-500">{b}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
