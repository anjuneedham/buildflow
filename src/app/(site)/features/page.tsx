import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Features", description: "CRM, lead pipeline, customers, projects, tasks, public contractor profiles and a work showcase feed — built for construction businesses." };

const groups = [
  { title: "Win work", items: ["Public contractor profile at buildflow.app/contractor/your-name", "Request a Quote and Contact buttons that create leads automatically", "Post completed projects, before/afters and work in progress", "Followers, likes, saves and comments on your work", "Show up in search for your trade and parish"] },
  { title: "Manage leads & customers", items: ["Lead pipeline: New, Contacted, Qualified, Quote sent, Negotiation, Won, Lost", "Estimated value and pipeline total", "Lead sources: BuildFlow, website, referral, social, phone", "Convert a lead to a customer in one tap", "Customer records with notes, history and projects"] },
  { title: "Run projects", items: ["Projects with customer, budget, timeline and location", "Statuses from Planning to Completed", "Simple tasks with assignee, due date and priority", "Private job-site photos", "Activity history on every project"] },
  { title: "Run the business", items: ["Dashboard that answers ‘how is my business doing?’", "Basic analytics: views, quote requests, lead sources, wins", "Team members with basic permissions", "In-app notifications for quotes, comments, followers and assignments", "Works on any phone; add it to your home screen"] },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Features</h1>
      <p className="mt-2 max-w-2xl text-ink-500">The smallest set of tools that actually moves a construction business forward: find customers, convert them, deliver the job, and show it off.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="rounded-xl border border-concrete-200 bg-white p-6">
            <h2 className="text-lg font-bold">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">{g.items.map((i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-safety-500" />{i}</li>)}</ul>
          </section>
        ))}
      </div>
      <section className="mt-10 rounded-xl border border-dashed border-concrete-300 p-6">
        <h2 className="font-bold">On the roadmap</h2>
        <p className="mt-1 text-sm text-ink-500">Estimates & invoices, reviews, messaging, calendar, email & push notifications, and native iOS/Android apps. These are not available yet.</p>
      </section>
      <ButtonLink href="/signup?type=contractor" size="lg" className="mt-10">Get started</ButtonLink>
    </main>
  );
}
