// Security-rules tests. Run: npm run test:rules
// Every client read and write is denied: all access is server-side.
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

// One document in every collection the app uses (FIRESTORE_SCHEMA_V2.md §2).
const PATHS = [
  "users/alice", "users/alice/notifications/n1", "users/alice/likes/p1", "users/alice/saves/p1", "users/alice/following/a",
  "businesses/a", "businesses/a/private/config", "businesses/a/members/alice", "businesses/a/leads/l1", "businesses/a/customers/c1",
  "businesses/a/projects/j1", "businesses/a/tasks/t1", "businesses/a/notes/n1", "businesses/a/activity/x1", "businesses/a/photos/ph1",
  "businesses/a/media/m1", "businesses/a/events/e1", "businesses/a/quote_requests/q1", "businesses/a/followers/bob",
  "posts/p1", "posts/p1/comments/c1", "slugs/a", "invitations/tok", "subscriptions/a", "plans/basic", "services/mason",
  "locations/kingston", "reports/r1",
];

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const p of PATHS) await setDoc(doc(db, p), { seeded: true, visible: true, is_public: true, is_suspended: false });
    await setDoc(doc(db, "businesses/a/members/alice"), { role: "owner" });
    await setDoc(doc(db, "users/root"), { is_platform_admin: true });
  });
});
after(async () => { await env.cleanup(); });

const clients = () => [
  ["anonymous", env.unauthenticatedContext().firestore()],
  ["member", env.authenticatedContext("alice").firestore()],
  ["forged claims", env.authenticatedContext("mallory", { bid: "a", brole: "owner", adm: true }).firestore()],
  ["platform admin", env.authenticatedContext("root").firestore()],
] as const;

test("no client can read any document", async () => {
  for (const [, db] of clients()) for (const p of PATHS) await assertFails(getDoc(doc(db, p)));
});

test("no client can list any collection", async () => {
  for (const [, db] of clients()) {
    for (const c of ["posts", "businesses", "businesses/a/leads", "businesses/a/customers", "users", "services"]) await assertFails(getDocs(collection(db, c)));
  }
});

test("no client can write any document", async () => {
  for (const [, db] of clients()) for (const p of PATHS) await assertFails(setDoc(doc(db, p), { hacked: true }));
});
