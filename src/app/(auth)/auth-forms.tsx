"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { HardHat, Home, Loader2 } from "lucide-react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile, type User,
} from "firebase/auth";
import { establishSession } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/input";
import { clientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type Errors = Record<string, string | undefined>;

function friendly(e: unknown) {
  const code = e instanceof FirebaseError ? e.code : "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code)) return "Email or password is incorrect.";
  if (code === "auth/email-already-in-use") return "An account with this email already exists. Try logging in.";
  if (code === "auth/weak-password") return "Use at least 8 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes and try again.";
  if (code === "auth/network-request-failed") return "Network problem. Check your connection.";
  return "Something went wrong. Please try again.";
}

// A sign-up is two steps (create the Firebase account, then start the server
// session). If the second fails (network drop, server error) the account
// exists but has no profile. Remember what the person chose so a retry, or a
// later log in, still finishes it as the right kind of account.
const PENDING_SIGNUP_KEY = "bf_pending_signup";
type PendingSignup = { email: string; fullName: string; accountType: "contractor" | "customer" };
function readPendingSignup(email: string): PendingSignup | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_SIGNUP_KEY) ?? "null") as PendingSignup | null;
    return v && v.email.toLowerCase() === email.toLowerCase() ? v : null;
  } catch { return null; }
}
const savePendingSignup = (v: PendingSignup) => { try { localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(v)); } catch { /* private mode: retry still works in this tab */ } };
const clearPendingSignup = () => { try { localStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ } };

function Submit({ pending, children, pendingText }: { pending: boolean; children: React.ReactNode; pendingText: string }) {
  return <Button type="submit" block size="lg" disabled={pending} aria-busy={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? pendingText : children}</Button>;
}

/**
 * Exchanges the signed-in Firebase user for a server session. If the server
 * updated the user's claims, refresh the ID token once so the session cookie
 * carries them.
 */
async function startSession(user: User, extra: Omit<Parameters<typeof establishSession>[0], "idToken"> = {}) {
  let r = await establishSession({ idToken: await user.getIdToken(), ...extra });
  if (!r.ok && "refreshToken" in r) r = await establishSession({ idToken: await user.getIdToken(true), ...extra });
  if (!r.ok) throw new Error("error" in r ? r.error : "Couldn't sign you in. Please try again.");
  return r;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true); setError(undefined);
    try {
      const email = String(fd.get("email")).trim();
      const cred = await signInWithEmailAndPassword(clientAuth(), email, String(fd.get("password")));
      const pendingSignup = readPendingSignup(email);
      const r = await startSession(cred.user, { next, ...(pendingSignup ? { fullName: pendingSignup.fullName, accountType: pendingSignup.accountType } : {}) });
      clearPendingSignup();
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && !(err instanceof FirebaseError) ? err.message : friendly(err));
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError message={error} />
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-safety-700 hover:underline">Forgot password?</Link></div>
      <Submit pending={pending} pendingText="Signing in…">Log in</Submit>
    </form>
  );
}

export function SignUpForm({ defaultType, next }: { defaultType: "contractor" | "customer"; next?: string }) {
  const router = useRouter();
  const [type, setType] = useState(defaultType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Errors>({});
  const created = useRef<User | null>(null); // account made in a previous attempt whose session didn't start
  const options = [
    { value: "contractor", label: "I run a construction business", sub: "Manage jobs & get discovered", icon: HardHat },
    { value: "customer", label: "I'm looking to hire", sub: "Free: browse & request quotes", icon: Home },
  ] as const;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get("fullName") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const errs: Errors = {
      fullName: !fullName ? "Name is required" : fullName.length > 120 ? "Use 120 characters or fewer" : undefined,
      email: /^\S+@\S+\.\S+$/.test(email) && email.length <= 200 ? undefined : "Enter a valid email",
      password: password.length >= 8 ? undefined : "Use at least 8 characters",
    };
    setFe(errs);
    if (Object.values(errs).some(Boolean)) return;
    setPending(true); setError(undefined);
    try {
      let user = created.current && created.current.email?.toLowerCase() === email.toLowerCase() ? created.current : null;
      if (!user) {
        user = (await createUserWithEmailAndPassword(clientAuth(), email, password)).user;
        created.current = user;
        savePendingSignup({ email, fullName, accountType: type });
        await updateProfile(user, { displayName: fullName });
        await sendEmailVerification(user).catch(() => {});
      }
      const r = await startSession(user, { fullName, accountType: type, ...(next ? { next } : {}) });
      clearPendingSignup();
      created.current = null;
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error && !(err instanceof FirebaseError) ? err.message : friendly(err);
      setError(created.current ? `Your account was created, but we couldn't finish signing you in (${message.replace(/\.$/, "")}). Tap the button to try again.` : message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">I&apos;m signing up as…</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors", type === o.value ? "border-safety-500 bg-safety-50" : "border-concrete-200 hover:border-concrete-300")}>
              <input type="radio" name="accountType" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="sr-only" />
              <o.icon className={cn("h-5 w-5", type === o.value ? "text-safety-600" : "text-ink-500")} />
              <span className="text-sm font-bold leading-tight">{o.label}</span>
              <span className="text-xs text-ink-500">{o.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={error} />
      <Field label="Your name" htmlFor="fullName" error={fe.fullName}><Input id="fullName" name="fullName" autoComplete="name" maxLength={120} required /></Field>
      <Field label="Email" htmlFor="email" error={fe.email}><Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters" error={fe.password}><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
      <Submit pending={pending} pendingText="Creating account…">{type === "contractor" ? "Create account & set up business" : "Create free account"}</Submit>
      <p className="text-center text-xs text-ink-500">By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string>();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email");
    setState("pending"); setError(undefined);
    try {
      await sendPasswordResetEmail(clientAuth(), email, { url: `${window.location.origin}/login` });
    } catch (err) {
      if (err instanceof FirebaseError && err.code === "auth/too-many-requests") { setError(friendly(err)); return setState("idle"); }
      // Any other outcome (including unknown email) gets the same response.
    }
    setState("sent");
  }
  if (state === "sent") return <FormSuccess message="If an account exists for that email, a reset link is on its way." />;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={error}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Submit pending={state === "pending"} pendingText="Sending…">Send reset link</Submit>
    </form>
  );
}
