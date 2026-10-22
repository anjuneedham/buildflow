import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Refund & Cancellation Policy", description: "How BuildFlow subscription billing, cancellation and refunds work." };

export default function RefundPolicy() {
  const L = LEGAL;
  const endOfPeriod = L.cancellationTakesEffect === "end_of_period";
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>BuildFlow is a subscription software service. There are no physical products, so there are no returns. This policy explains how billing, cancellation and refunds work.</p>

      <h2>Subscription billing</h2>
      <p>New businesses start with a {L.trialDays}-day free trial. After the trial, your subscription is billed in advance each billing period (monthly unless stated otherwise). Your charge is your plan&apos;s base price plus a fee for each additional user beyond those included. Adding a user increases your next bill; removing one decreases it.</p>

      <h2>Cancellation</h2>
      <p>You can cancel at any time from your billing settings or by emailing {L.contactEmail}. {endOfPeriod
        ? "Cancellation takes effect at the end of your current billing period. You keep full access until then, and you will not be charged again."
        : "Cancellation takes effect immediately and access to paid features ends at that time."}
      </p>
      <p>After cancellation, your public profile is hidden and your business data is retained for a limited period so you can reactivate or export it, then deleted as described in our Privacy Policy.</p>

      <h2>Refunds</h2>
      <p>{L.refundsForPartialPeriods
        ? "If you cancel part-way through a billing period, we will refund the unused portion on a pro-rated basis."
        : "Payments are non-refundable, and we do not provide refunds or credits for partial billing periods, unused users, or unused features, except where required by law or described below."}
      </p>

      <h2>Duplicate or incorrect charges</h2>
      <p>If you were charged twice or charged in error, contact us within {L.refundRequestWindowDays} days of the charge. After verifying, we will refund the incorrect amount to the original payment method.</p>

      <h2>Billing disputes</h2>
      <p>Please contact us before opening a dispute with your bank. Most issues can be resolved quickly. Accounts with an open chargeback may be restricted until it is resolved.</p>

      <h2>Failed payments</h2>
      <p>If a payment fails, we will retry and notify you. You will have {L.failedPaymentGraceDays} days to update your payment method. If payment is still not received, paid features may be paused until the balance is paid. Your data is not deleted because of a failed payment during this period.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. Changes do not affect charges made before the update.</p>

      <h2>Contact</h2>
      <p>{L.contactEmail}</p>
    </LegalPage>
  );
}
