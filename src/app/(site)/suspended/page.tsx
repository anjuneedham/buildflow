import { env } from "@/lib/env";

export const metadata = { title: "Account suspended", robots: { index: false } };

export default function Suspended() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">Your account is suspended</h1>
      <p className="mt-3 text-ink-500">If you think this is a mistake, contact <a className="underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.</p>
    </main>
  );
}
