import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env, firebaseConfig, serverEnvProblems } from "@/lib/env";

// Admin SDK: server only. Bypasses security rules, so every query that
// touches tenant data goes through src/lib/data/tenant.ts, which scopes it
// to the signed-in user's business. When FIRESTORE_EMULATOR_HOST etc. are
// set, the SDK talks to the local emulators automatically.
function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return undefined; // emulators, or Google-hosted runtimes with ADC
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(json));
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const problems = serverEnvProblems();
  if (problems.length) {
    const msg = `Invalid ${env.appEnv} environment:\n- ${problems.join("\n- ")}`;
    if (env.appEnv !== "local") throw new Error(msg);
    console.warn(msg);
  }
  const cred = credential();
  return initializeApp({
    ...(cred ? { credential: cred } : {}),
    projectId: firebaseConfig.projectId || process.env.GCLOUD_PROJECT,
    storageBucket: firebaseConfig.storageBucket,
  });
}

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
