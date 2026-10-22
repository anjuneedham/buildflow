import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const cols = [
  { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["For contractors", "/for-contractors"], ["For customers", "/for-customers"]] },
  { title: "Discover", links: [["Explore contractors", "/explore"], ["Search", "/search"]] },
  { title: "Company", links: [["About", "/about"], ["Contact", "/contact"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds & cancellation", "/refund-policy"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-700 bg-ink text-concrete-200">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-5">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm text-concrete-400">Run your construction business. Showcase your work. Win more jobs.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-concrete-400">{c.title}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([label, href]) => <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-ink-700 py-4 text-center text-xs text-concrete-400">© {new Date().getFullYear()} BuildFlow. All rights reserved.</p>
    </footer>
  );
}
