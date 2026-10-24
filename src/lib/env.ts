// Environment configuration. NEXT_PUBLIC_* values are inlined into the
// browser bundle; everything else is server-only. See .env.example.

export type AppEnv = "local" | "staging" | "production";

function appEnv(): AppEnv {
  const v = process.env.NEXT_PUBLIC_APP_ENV;
  return v === "staging" || v === "production" ? v : "local";
}

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const env = {
  appEnv: appEnv(),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@buildflow.example",
  useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * Problems with the server environment for the current APP_ENV. Called once
 * when the Admin SDK initialises; staging/production refuse to start on
 * errors instead of failing later on the first request.
 */
export function serverEnvProblems(e: Record<string, string | undefined> = process.env, current: AppEnv = appEnv()): string[] {
  const problems: string[] = [];
  const deployed = current !== "local";
  for (const k of ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"]) {
    if (deployed && !e[k]) problems.push(`${k} is required in ${current}`);
  }
  if (deployed && !e.NEXT_PUBLIC_SITE_URL?.startsWith("https://")) problems.push(`NEXT_PUBLIC_SITE_URL must be an https URL in ${current}`);
  if (deployed) {
    for (const k of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
      if (e[k]) problems.push(`${k} must not be set in ${current}`);
    }
    if (e.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") problems.push(`NEXT_PUBLIC_USE_FIREBASE_EMULATORS must not be true in ${current}`);
    if ((e.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").startsWith("demo-")) problems.push(`demo-* Firebase projects are emulator-only, not for ${current}`);
  }
  return problems;
}
