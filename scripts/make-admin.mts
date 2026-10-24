/** Grants platform admin to a user by email: npm run make-admin -- someone@example.com */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) { console.error("Usage: npm run make-admin -- <email>"); process.exit(1); }
const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-buildflow",
  ...(key ? { credential: cert(JSON.parse(key.trim().startsWith("{") ? key : Buffer.from(key, "base64").toString())) } : {}),
});
const user = await getAuth().getUserByEmail(email);
await getFirestore().collection("users").doc(user.uid).set({ is_platform_admin: true }, { merge: true });
// Claims are what the session reads; revoke so the next sign-in picks them up.
await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), adm: true });
await getAuth().revokeRefreshTokens(user.uid);
console.log(`✓ ${email} is now a platform admin`);
process.exit(0);
