// Values the business must confirm before launch. Policies render from these,
// so changing the final business policy is a config change, not a rewrite.
import { env } from "@/lib/env";

export const LEGAL = {
  companyName: "BuildFlow",                     // TODO: registered legal entity name
  contactEmail: env.supportEmail,
  mailingAddress: "[Registered business address — to be confirmed]",
  governingLaw: "[Jurisdiction — to be confirmed by counsel]",
  lastUpdated: "October 22, 2026",
  trialDays: 14,
  // Refund & cancellation policy knobs
  cancellationTakesEffect: "end_of_period" as "end_of_period" | "immediately",
  refundsForPartialPeriods: false,
  refundRequestWindowDays: 14,                  // for duplicate/erroneous charges
  failedPaymentGraceDays: 7,
  minimumAge: 18,
};

