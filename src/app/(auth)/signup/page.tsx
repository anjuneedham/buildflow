import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "../auth-forms";
import { firstParams } from "@/lib/params";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Create your account", description: "Join BuildFlow free as a customer, or start a 14-day trial for your construction business." };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ type?: string; next?: string }> }) {
  const { type, next } = firstParams(await searchParams);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Takes about a minute.</p>
      <SignUpForm defaultType={type === "customer" ? "customer" : "contractor"} next={safeNext(next, "")} />
      <p className="mt-6 text-center text-sm text-ink-500">Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(safeNext(next, ""))}` : "/login"} className="font-semibold text-safety-700 hover:underline">Log in</Link></p>
    </>
  );
}
