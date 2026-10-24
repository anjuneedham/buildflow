import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms that govern use of BuildFlow." };

export default function Terms() {
  const L = LEGAL;
  return (
    <LegalPage title="Terms of Service">
      <p>These Terms govern your use of BuildFlow (the &quot;Service&quot;), provided by {L.companyName}. By creating an account or using the Service you agree to these Terms.</p>

      <h2>1. Account registration</h2>
      <p>You must provide accurate information, be at least {L.minimumAge} years old, and keep your login credentials secure. You are responsible for activity on your account. Business owners are responsible for the team members they invite.</p>

      <h2>2. Acceptable use</h2>
      <p>You agree not to: post false, misleading or fraudulent content; impersonate another person or business; post content you do not have rights to; harass, threaten or discriminate against others; send spam or unsolicited bulk requests; scrape or harvest data; attempt to access other businesses&apos; private data; interfere with the Service&apos;s security or operation; or use the Service for unlawful purposes.</p>

      <h2>3. Contractor responsibilities</h2>
      <p>Contractors are independent businesses. You are solely responsible for your work, pricing, quotes, contracts, licences, permits, insurance, tax obligations, and compliance with applicable laws. Posts must show work you or your business actually performed. You are responsible for the customer data you store in BuildFlow and for using it lawfully.</p>

      <h2>4. Customer responsibilities</h2>
      <p>Customers are responsible for evaluating contractors, checking credentials, and agreeing terms directly with them. BuildFlow is not a party to any agreement between customers and contractors and does not guarantee the quality, safety or legality of any work. A &quot;verified&quot; indicator, where shown, reflects limited checks and is not an endorsement.</p>

      <h2>5. User-generated content</h2>
      <p>You keep ownership of content you post. You grant {L.companyName} a worldwide, non-exclusive, royalty-free licence to host, display, reproduce and distribute it for operating and promoting the Service. You confirm you have the rights to post it. We may remove content that violates these Terms.</p>

      <h2>6. Public profiles</h2>
      <p>Contractor profiles and posts marked public are visible to anyone and may appear in search engines. You can switch your profile to private in settings at any time; cached copies held by third parties are outside our control.</p>

      <h2>7. Intellectual property</h2>
      <p>The Service, including its software, design and branding, belongs to {L.companyName} and its licensors. These Terms do not grant you any rights to our trademarks.</p>

      <h2>8. Payments and subscriptions</h2>
      <p>Contractor features are currently available free during a {L.trialDays}-day trial, and billing is not yet live. Once paid subscriptions launch, fees will be shown on our <Link href="/pricing">pricing page</Link>, billed in advance on a recurring basis, and calculated from your plan&apos;s base price plus any additional users. Prices may change with reasonable notice. Taxes may apply.</p>

      <h2>9. Cancellation</h2>
      <p>You may cancel at any time. Cancellation and refunds are governed by our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</p>

      <h2>10. Suspension and termination</h2>
      <p>We may suspend or terminate accounts or content that violate these Terms, create risk for other users, or where required by law. Where reasonable we will give notice and a chance to resolve the issue. You may close your account at any time.</p>

      <h2>11. Service availability</h2>
      <p>We aim for high availability but do not guarantee the Service will be uninterrupted or error-free. We may change or discontinue features. Keep your own copies of important records.</p>

      <h2>12. Third-party services</h2>
      <p>The Service relies on third-party providers (for example hosting, storage and payments) and may link to third-party websites. We are not responsible for third-party services, which are governed by their own terms.</p>

      <h2>13. Disclaimers</h2>
      <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, to the fullest extent permitted by law.</p>

      <h2>14. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, {L.companyName} is not liable for indirect, incidental, special, consequential or punitive damages, lost profits or lost data, or for any dispute between customers and contractors. Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim. Some jurisdictions do not allow these limits, so they may not apply to you.</p>

      <h2>15. Governing law</h2>
      <p>These Terms are governed by the laws of {L.governingLaw}, without regard to conflict-of-law rules.</p>

      <h2>16. Changes</h2>
      <p>We may update these Terms. Continued use after changes take effect means you accept them.</p>

      <h2>17. Contact</h2>
      <p>{L.companyName} · {L.mailingAddress} · {L.contactEmail}</p>
    </LegalPage>
  );
}
