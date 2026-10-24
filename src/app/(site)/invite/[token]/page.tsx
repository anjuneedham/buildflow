import { acceptInvite } from "@/app/actions/business";
import { ButtonLink } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormError } from "@/components/ui/input";
import { getSession } from "@/lib/session";
import { INVITE_ERRORS } from "@/lib/invite-errors";
import { firstParams } from "@/lib/params";

export const metadata = { title: "Join a team", robots: { index: false } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = firstParams(await searchParams);
  const s = await getSession();
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">You&apos;ve been invited to a BuildFlow team</h1>
      <p className="mt-2 text-ink-500">Join to see assigned work, update projects and add notes.</p>
      {error && (INVITE_ERRORS as readonly string[]).includes(error) && <div className="mt-4"><FormError message={error} /></div>}
      <div className="mt-6">
        {s.user ? (
          <form action={acceptInvite.bind(null, token)}><SubmitButton size="lg" block>Accept invitation</SubmitButton></form>
        ) : (
          <div className="flex flex-col gap-2">
            <ButtonLink href={`/signup?type=contractor&next=${encodeURIComponent(`/invite/${token}`)}`} size="lg">Create an account</ButtonLink>
            <ButtonLink href={`/login?next=/invite/${token}`} variant="outline" size="lg">I already have an account</ButtonLink>
            <p className="text-xs text-ink-500">Use the same email address the invite was sent to, then return to this link.</p>
          </div>
        )}
      </div>
    </main>
  );
}
