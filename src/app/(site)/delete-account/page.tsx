import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Delete your BuildFlow account", description: "How to delete your BuildFlow account and what happens to your data." };

// The page Google Play asks for ("account deletion URL"): how a person deletes their account and what is kept.
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your BuildFlow account">
      <p>You can delete your BuildFlow account at any time, and the deletion starts immediately.</p>

      <h2>In the app or on the website</h2>
      <ol>
        <li>Log in. (If you logged in a while ago, log out and log in again; we ask for a recent sign-in so nobody else can do this from a borrowed phone.)</li>
        <li>Open <Link href="/account">Account</Link>.</li>
        <li>Scroll to <b>Delete my account</b>, choose it, type <b>DELETE</b> and confirm.</li>
      </ol>
      <p>If you cannot log in, email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from the address on the account and we will delete it after confirming it is you.</p>

      <h2>What is deleted</h2>
      <ul>
        <li>Your account and sign-in, your name and photo, your saved work and contractors, your notifications and your request history.</li>
        <li><b>If you own a business:</b> the business and everything in it, including customers, leads, jobs, tasks, photos and files, posts, reviews and reports, its public profile and its subscription record. Your team members are removed from the business. You may want to tell customers first. There is no undo and no export yet.</li>
        <li><b>If you are a team member:</b> your membership and your job assignments. The business keeps its own history.</li>
      </ul>

      <h2>What is kept</h2>
      <ul>
        <li>Reviews you wrote about a contractor stay on their profile, with your name replaced by &ldquo;Former customer&rdquo;.</li>
        <li>If you sent a request to a contractor, they keep their own record of it (it is their customer data) without a link to your account. Ask the contractor if you want it removed.</li>
        <li>Notes in a business&apos;s history that mention your name as a team member.</li>
        <li>Information we must keep for legal, tax, security or dispute reasons, and encrypted backups that are overwritten on a rolling basis (see the <Link href="/privacy">Privacy Policy</Link>).</li>
      </ul>

      <h2>Subscriptions</h2>
      <p>Deleting your account does not cancel a subscription bought through Google Play. Cancel it in the Google Play app under Payments &amp; subscriptions.</p>
    </LegalPage>
  );
}
