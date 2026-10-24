import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { count } from "@/lib/data/db";
import { localDate, startOfMonthISO } from "@/lib/utils";
import { AggregateField } from "firebase-admin/firestore";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const d = db();
  const month = startOfMonthISO();
  const [users, contractors, businesses, newBiz, posts, quotes, openReports, trialing, active] = await Promise.all([
    count(d.collection("users")),
    count(d.collection("users").where("account_type", "==", "contractor")),
    count(d.collection("businesses")),
    count(d.collection("businesses").where("created_at", ">=", month)),
    count(d.collection("posts")),
    // Sum of every business's monthly counter: one aggregation, no document reads.
    d.collectionGroup("stats").where("month", "==", localDate().slice(0, 7)).aggregate({ n: AggregateField.sum("totals.quote_request") }).get().then((r) => r.data().n ?? 0),
    count(d.collection("reports").where("status", "==", "open")),
    count(d.collection("subscriptions").where("status", "==", "trialing")),
    count(d.collection("subscriptions").where("status", "==", "active")),
  ]);
  const tiles = [
    ["Users", users, "/admin/users"], ["Contractor accounts", contractors, "/admin/users"], ["Businesses", businesses, "/admin/businesses"],
    ["New businesses (month)", newBiz, "/admin/businesses"], ["Posts", posts, null], ["Quote requests (month)", quotes, null],
    ["Open reports", openReports, "/admin/reports"], ["Trialing", trialing, null], ["Paying", active, null],
  ] as const;
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(([label, value, href]) => {
          const inner = <Card className="p-4"><p className="text-sm text-ink-500">{label}</p><p className="mt-1 text-3xl font-extrabold">{value}</p></Card>;
          return href ? <Link key={label} href={href}>{inner}</Link> : <div key={label}>{inner}</div>;
        })}
      </div>
    </>
  );
}
