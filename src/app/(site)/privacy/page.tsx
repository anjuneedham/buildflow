import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy", description: "How BuildFlow collects, uses and protects information." };

export default function Privacy() {
  const L = LEGAL;
  return (
    <LegalPage title="Privacy Policy">
      <p>This Privacy Policy explains how {L.companyName} (&quot;we&quot;, &quot;us&quot;) collects, uses and shares information when you use the BuildFlow website and applications (the &quot;Service&quot;).</p>

      <h2>1. Information we collect</h2>
      <h3>Account information</h3>
      <p>When you sign up we collect your name, email address, password (stored in hashed form by our authentication provider), and whether you are a contractor or a customer. You may add a profile photo.</p>
      <h3>Business information</h3>
      <p>Contractors provide business details such as business name, phone, email, location, service area, services, description, years in business, logo, cover image, website and social links. Information you mark as part of your public profile is visible to anyone, including people who are not signed in, and may be indexed by search engines.</p>
      <h3>Customer information entered by contractors</h3>
      <p>Contractors can store information about their own leads, customers and projects (for example names, phone numbers, addresses, notes and job photos). For this data, the contractor decides what is collected and why; we process it on their behalf to provide the Service. This data is private to the contractor&apos;s business and its team members. Contractors are responsible for having a lawful basis to store it and for responding to their customers&apos; requests.</p>
      <h3>Quote requests and messages</h3>
      <p>When you request a quote or contact a contractor, the details you submit (name, contact information, location, project description) are shared with that contractor and stored in their BuildFlow account.</p>
      <h3>Content you post</h3>
      <p>Posts, photos, captions, comments, likes, saves and follows. Posts and comments are public; likes, saves and follows are used to show counts and personalise your experience.</p>
      <h3>Usage data</h3>
      <p>We record events such as profile views, post views and quote requests so contractors can see basic analytics. We also collect standard technical data (IP address, device and browser type, pages visited, timestamps) for security, abuse prevention and to keep the Service working.</p>

      <h2>2. Cookies</h2>
      <p>We use essential cookies to keep you signed in and secure your session. We may use privacy-respecting analytics. We do not sell your data or use third-party advertising cookies. You can block cookies in your browser, but signing in will not work without essential cookies.</p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide, maintain and secure the Service;</li>
        <li>To show contractor profiles and posts to people discovering contractors;</li>
        <li>To deliver quote requests and notifications;</li>
        <li>To show contractors analytics about their profile and posts;</li>
        <li>To process subscriptions and payments;</li>
        <li>To prevent fraud, spam and abuse and to enforce our Terms;</li>
        <li>To communicate with you about your account and, where permitted, product updates.</li>
      </ul>

      <h2>4. Communications</h2>
      <p>We send service messages (such as verification, password reset and billing notices). If we send marketing emails, you can unsubscribe at any time.</p>

      <h2>5. Data storage and third-party services</h2>
      <p>We use trusted providers to run the Service, which may include Google Firebase (database, authentication and file storage), Vercel (hosting), payment providers such as Google Play Billing, and an email delivery provider. These providers process data on our behalf under their own security and privacy commitments. Data may be stored on servers located outside your country.</p>

      <h2>6. Payments</h2>
      <p>Payments are processed by our payment provider. We do not store full card numbers. We receive limited billing information such as the last four digits, card brand, billing country and payment status.</p>

      <h2>7. Sharing</h2>
      <p>We share information only: with contractors when you contact them; publicly, for content you choose to make public; with service providers who help us run BuildFlow; when required by law or to protect rights and safety; and as part of a business transfer such as a merger, subject to this policy.</p>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have rights to access, correct, export or delete your personal information, and to object to or restrict certain processing. You can edit most information in your account settings and delete your account yourself under Account → Delete my account (see <a href="/delete-account">how deletion works</a>). To make any other request, email {L.contactEmail}. If your data was entered by a contractor (for example, you are one of their customers), we may refer your request to that contractor.</p>

      <h2>9. Data retention</h2>
      <p>We keep information for as long as your account is active and as needed to provide the Service. When an account or business is deleted, we delete or anonymise associated data within a reasonable period, except where we must keep it for legal, tax, security or dispute purposes. Backups are overwritten on a rolling basis.</p>

      <h2>10. Security</h2>
      <p>We use encryption in transit, hashed passwords, access controls that isolate each business&apos;s private data, and least-privilege access for staff. No system is perfectly secure; please use a strong, unique password and tell us promptly about any suspected unauthorised access.</p>

      <h2>11. Children&apos;s privacy</h2>
      <p>The Service is not directed to children. You must be at least {L.minimumAge} years old (or the age of majority where you live) to create an account. We do not knowingly collect personal information from children.</p>

      <h2>12. International users</h2>
      <p>BuildFlow is designed to be used in multiple countries. By using the Service you understand your information may be transferred to and processed in countries other than your own, which may have different data protection laws. Where required we will use appropriate safeguards.</p>

      <h2>13. Changes</h2>
      <p>We may update this policy. We will post the new version here and, for significant changes, notify you by email or in the app.</p>

      <h2>14. Contact</h2>
      <p>{L.companyName} · {L.mailingAddress} · {L.contactEmail}</p>
    </LegalPage>
  );
}
