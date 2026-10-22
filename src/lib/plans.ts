// Pricing is data. The DB table `subscription_plans` is the source of truth
// at runtime; this file holds the same defaults for marketing pages and
// for pure price math, so there is one function to compute a bill.

export type PlanId = "basic" | (string & {});

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  currency: string;
  interval: "month" | "year";
  basePriceCents: number;
  includedSeats: number;
  additionalSeatPriceCents: number;
  maxSeats: number | null;
  features: string[];
}

export const PLANS: Record<string, Plan> = {
  basic: {
    id: "basic",
    name: "BuildFlow Basic",
    description: "Everything a small contractor needs to win and run jobs.",
    currency: "USD",
    interval: "month",
    basePriceCents: 5000,
    includedSeats: 1,
    additionalSeatPriceCents: 2000,
    maxSeats: null,
    features: [
      "1 business account, 1 user included",
      "CRM & lead pipeline",
      "Customer management",
      "Project & task management",
      "Public contractor profile",
      "Project/work posts",
      "Dashboard & basic analytics",
    ],
  },
  // pro / business / enterprise: add rows to subscription_plans + entries here.
};

export const DEFAULT_PLAN_ID = "basic";

export function seatPriceBreakdown(plan: Pick<Plan, "basePriceCents" | "includedSeats" | "additionalSeatPriceCents">, seats: number) {
  const s = Math.max(1, Math.floor(seats));
  const extraSeats = Math.max(0, s - plan.includedSeats);
  const extraCents = extraSeats * plan.additionalSeatPriceCents;
  return { seats: s, extraSeats, baseCents: plan.basePriceCents, extraCents, totalCents: plan.basePriceCents + extraCents };
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function planFromRow(row: {
  id: string; name: string; description: string | null; currency: string; billing_interval: string;
  base_price_cents: number; included_seats: number; additional_seat_price_cents: number; max_seats: number | null; features: unknown;
}): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    currency: row.currency,
    interval: row.billing_interval === "year" ? "year" : "month",
    basePriceCents: row.base_price_cents,
    includedSeats: row.included_seats,
    additionalSeatPriceCents: row.additional_seat_price_cents,
    maxSeats: row.max_seats,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
  };
}
