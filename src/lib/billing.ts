import "server-only";

// Stripe-ready seam. V1 runs in "manual" mode: subscriptions are tracked in
// the database (14-day trial created with each business) and price is
// computed from subscription_plans. When STRIPE_SECRET_KEY is set, implement
// createCheckoutSession / handleWebhook here; nothing else needs to change.
export const billingMode = process.env.STRIPE_SECRET_KEY ? "stripe" : "manual";

export async function createCheckoutSession(input: { businessId: string; planId: string; seats: number }): Promise<{ url: string } | { error: string }> {
  void input;
  if (billingMode === "manual") return { error: "Online payments are coming soon. Your trial continues in the meantime." };
  // TODO(stripe): stripe.checkout.sessions.create({ mode: "subscription", line_items: [base price, seat price x extra seats] })
  return { error: "Stripe checkout is not implemented yet." };
}
