import Link from "next/link";
import { ArrowRight, BarChart3, Briefcase, CheckCircle2, ClipboardList, Hammer, Image as ImageIcon, MessageSquareQuote, Search, Store, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { PLANS, formatMoney } from "@/lib/plans";

const loop = [
  { icon: ImageIcon, title: "Showcase", body: "Post finished jobs, before/afters and work in progress." },
  { icon: Search, title: "Get discovered", body: "Customers find your work by trade and parish." },
  { icon: MessageSquareQuote, title: "Capture the lead", body: "Every quote request lands in your pipeline automatically." },
  { icon: Briefcase, title: "Run the job", body: "Convert to a customer, plan the project, track tasks." },
  { icon: CheckCircle2, title: "Finish & post", body: "Completed work becomes your next showcase." },
];

const features = [
  { icon: ClipboardList, title: "Lead pipeline", body: "New → Contacted → Quote sent → Won. See what every job is worth." },
  { icon: Users, title: "Customer records", body: "Phone, address, notes and every project for each client." },
  { icon: Briefcase, title: "Projects & tasks", body: "Budget, timeline, crew, photos and a simple task list." },
  { icon: Store, title: "Public profile", body: "A mini-website with your work, services and a Request a Quote button." },
  { icon: Hammer, title: "Work feed", body: "Show the quality of your work where customers are looking." },
  { icon: BarChart3, title: "Know what's working", body: "Profile views, quote requests and which lead sources win." },
];

export default function HomePage() {
  const basic = PLANS.basic;
  return (
    <main id="main" tabIndex={-1}>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-blueprint" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 md:pb-24 md:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-concrete-200">
            <span className="h-1.5 w-1.5 rounded-full bg-safety-400" /> Built for contractors & trades
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Run your construction business. <span className="text-safety-400">Showcase your work.</span> Win more jobs.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-concrete-300">
            BuildFlow helps construction professionals manage their customers and projects, while giving them a public profile where potential customers can discover and hire them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup?type=contractor" size="lg">Get started <ArrowRight className="h-4 w-4" /></ButtonLink>
            <ButtonLink href="/explore" size="lg" variant="outlineLight">Explore contractors</ButtonLink>
          </div>
          <p className="mt-4 text-sm text-concrete-400">{formatMoney(basic.basePriceCents)}/month · 14-day free trial · Cancel anytime</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl font-extrabold md:text-3xl">One loop that keeps work coming</h2>
        <p className="mt-2 max-w-2xl text-ink-500">Your finished jobs are your best marketing. BuildFlow connects the work you show with the work you win and the work you run.</p>
        <ol className="mt-8 grid gap-3 md:grid-cols-5">
          {loop.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-concrete-200 bg-white p-4">
              <span className="absolute right-3 top-3 text-xs font-bold text-ink-500">0{i + 1}</span>
              <s.icon className="h-6 w-6 text-safety-500" aria-hidden />
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-concrete-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-2xl font-extrabold md:text-3xl">Everything in one place. Nothing you don&apos;t need.</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-safety-400"><f.icon className="h-5 w-5" /></span>
                <div><h3 className="font-bold">{f.title}</h3><p className="mt-1 text-sm text-ink-500">{f.body}</p></div>
              </div>
            ))}
          </div>
          <Link href="/features" className="mt-8 inline-flex items-center gap-1 font-semibold text-safety-700 hover:underline">See all features <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
        <div className="rounded-2xl bg-action p-8 text-white">
          <h2 className="font-display text-2xl font-extrabold">For contractors</h2>
          <p className="mt-2 text-safety-50">Electricians, masons, tilers, roofers, plumbers, GCs: get a profile that sells for you and a simple system to run the jobs.</p>
          <ButtonLink href="/for-contractors" variant="dark" className="mt-6">How it works for you</ButtonLink>
        </div>
        <div className="rounded-2xl border border-concrete-200 bg-white p-8">
          <h2 className="font-display text-2xl font-extrabold">Looking for a contractor?</h2>
          <p className="mt-2 text-ink-500">Browse real finished work, see who works in your area, and request a quote in under a minute. Free for customers.</p>
          <ButtonLink href="/explore" variant="outline" className="mt-6">Explore contractors</ButtonLink>
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">{basic.name}: {formatMoney(basic.basePriceCents)}/month</h2>
            <p className="mt-1 text-concrete-300">Includes 1 user. Add team members for {formatMoney(basic.additionalSeatPriceCents)}/month each.</p>
          </div>
          <ButtonLink href="/signup?type=contractor" size="lg">Start free trial</ButtonLink>
        </div>
      </section>
    </main>
  );
}
