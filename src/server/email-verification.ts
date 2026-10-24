import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Fresh check against Firebase Auth (the session cookie's email_verified can
 * be days old). Used only for the actions that require it
 * (ARCHITECTURE_V2.md §5.1): publishing work, accepting invites.
 */
export async function isEmailVerified(uid: string) {
  try {
    return (await adminAuth().getUser(uid)).emailVerified;
  } catch {
    return false;
  }
}

export const VERIFY_EMAIL_MESSAGE = "Please verify your email first. Check your inbox for the link, or resend it from your account page.";

/**
 * Asks Firebase Auth to send its standard verification email. The browser
 * no longer holds a Firebase user after sign-in (only the session cookie),
 * so the server signs in as the user with a custom token and calls the
 * Identity Toolkit REST API on their behalf.
 */
export async function sendVerificationEmail(uid: string): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return false;
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulator ? `http://${emulator}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1";
  try {
    const token = await adminAuth().createCustomToken(uid);
    const signIn = await fetch(`${base}/accounts:signInWithCustomToken?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, returnSecureToken: true }),
    });
    if (!signIn.ok) return false;
    const { idToken } = (await signIn.json()) as { idToken: string };
    const send = await fetch(`${base}/accounts:sendOobCode?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken }),
    });
    return send.ok;
  } catch (e) {
    console.error("verification email failed", e);
    return false;
  }
}
