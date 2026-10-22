import { ButtonLink } from "@/components/ui";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-ink-500">It may have moved, or the contractor profile is no longer public.</p>
      <div className="flex gap-2"><ButtonLink href="/explore">Explore contractors</ButtonLink><ButtonLink href="/" variant="outline">Home</ButtonLink></div>
    </main>
  );
}
