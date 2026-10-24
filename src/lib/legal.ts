// Values the business must confirm before launch. Policies render from these,
// so changing the final business policy is a config change, not a rewrite.
import { env } from "@/lib/env";

const placeholder = (what: string) => `[${what} — to be confirmed]`;

export const LEGAL = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME || "BuildFlow",
  contactEmail: env.supportEmail,
  mailingAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || placeholder("Registered business address"),
  governingLaw: process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW || placeholder("Jurisdiction"),
  /** Set to "true" once counsel has reviewed the policies. Until then each policy page says it is a draft. */
  reviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true",
  lastUpdated: "October 24, 2026",
  trialDays: 14,
  // Refund & cancellation policy knobs
  cancellationTakesEffect: "end_of_period" as "end_of_period" | "immediately",
  refundsForPartialPeriods: false,
  refundRequestWindowDays: 14,                  // for duplicate/erroneous charges
  failedPaymentGraceDays: 7,
  minimumAge: 18,
};
