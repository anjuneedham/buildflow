import { test } from "node:test";
import assert from "node:assert/strict";
import { serverEnvProblems } from "../src/lib/env.ts";

const good = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "k", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "buildflow-staging",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "b", NEXT_PUBLIC_SITE_URL: "https://staging.buildflow.app",
};

const legalOk = {
  NEXT_PUBLIC_SUPPORT_EMAIL: "help@buildflow.app", NEXT_PUBLIC_LEGAL_COMPANY_NAME: "BuildFlow Ltd", NEXT_PUBLIC_LEGAL_ADDRESS: "1 Main St, Kingston",
  NEXT_PUBLIC_LEGAL_GOVERNING_LAW: "Jamaica", NEXT_PUBLIC_LEGAL_REVIEWED: "true",
};

test("local tolerates missing config and emulators", () => {
  assert.deepEqual(serverEnvProblems({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }, "local"), []);
});

test("staging with complete config passes", () => {
  assert.deepEqual(serverEnvProblems(good, "staging"), []);
});

test("production rejects emulators, demo projects and http site URLs", () => {
  const problems = serverEnvProblems({
    ...good, ...legalOk, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-buildflow", NEXT_PUBLIC_SITE_URL: "http://x", FIRESTORE_EMULATOR_HOST: "h",
  }, "production");
  assert.equal(problems.length, 3);
});

test("deployed environments require Firebase config", () => {
  assert.ok(serverEnvProblems({}, "production").some((p) => p.includes("NEXT_PUBLIC_FIREBASE_PROJECT_ID")));
});

test("production needs a real support address and the legal details, reviewed by counsel", () => {
  assert.deepEqual(serverEnvProblems({ ...good, ...legalOk }, "production"), []);
  const empty = serverEnvProblems(good, "production");
  for (const k of ["NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_LEGAL_COMPANY_NAME", "NEXT_PUBLIC_LEGAL_ADDRESS", "NEXT_PUBLIC_LEGAL_GOVERNING_LAW", "NEXT_PUBLIC_LEGAL_REVIEWED"]) assert.ok(empty.some((p) => p.includes(k)), k);
  assert.ok(serverEnvProblems({ ...good, ...legalOk, NEXT_PUBLIC_SUPPORT_EMAIL: "support@buildflow.example" }, "production").some((p) => p.includes("SUPPORT_EMAIL")));
  assert.deepEqual(serverEnvProblems(good, "staging"), [], "staging may still show drafts");
});
