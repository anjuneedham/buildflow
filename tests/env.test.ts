import { test } from "node:test";
import assert from "node:assert/strict";
import { serverEnvProblems } from "../src/lib/env.ts";

const good = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "k", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "buildflow-staging",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "b", NEXT_PUBLIC_SITE_URL: "https://staging.buildflow.app",
};

test("local tolerates missing config and emulators", () => {
  assert.deepEqual(serverEnvProblems({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }, "local"), []);
});

test("staging with complete config passes", () => {
  assert.deepEqual(serverEnvProblems(good, "staging"), []);
});

test("production rejects emulators, demo projects and http site URLs", () => {
  const problems = serverEnvProblems({
    ...good, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-buildflow", NEXT_PUBLIC_SITE_URL: "http://x", FIRESTORE_EMULATOR_HOST: "h",
  }, "production");
  assert.equal(problems.length, 3);
});

test("deployed environments require Firebase config", () => {
  assert.ok(serverEnvProblems({}, "production").some((p) => p.includes("NEXT_PUBLIC_FIREBASE_PROJECT_ID")));
});
