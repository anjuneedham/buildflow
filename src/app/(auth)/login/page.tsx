import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../auth-forms";
import { firstParams } from "@/lib/params";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = firstParams(await searchParams);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Log in to your BuildFlow account.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-500">New to BuildFlow? <Link href="/signup" className="font-semibold text-safety-700 hover:underline">Create an account</Link></p>
    </>
  );
}
