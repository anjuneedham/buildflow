// Security-rules tests (second line of defence). Run: npm run test:rules
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "businesses/a"), { name: "A", is_public: true, is_suspended: false });
    await setDoc(doc(db, "businesses/b"), { name: "B", is_public: true, is_suspended: false });
    await setDoc(doc(db, "businesses/hidden"), { name: "H", is_public: false, is_suspended: false });
    await setDoc(doc(db, "businesses/a/members/alice"), { role: "owner" });
    await setDoc(doc(db, "businesses/b/members/bob"), { role: "owner" });
    await setDoc(doc(db, "businesses/a/leads/l1"), { name: "Lead of A" });
    await setDoc(doc(db, "businesses/a/customers/c1"), { name: "Customer of A" });
    await setDoc(doc(db, "users/alice"), { full_name: "Alice", is_platform_admin: false });
    await setDoc(doc(db, "users/bob"), { full_name: "Bob", is_platform_admin: false });
    await setDoc(doc(db, "users/root"), { full_name: "Admin", is_platform_admin: true });
    await setDoc(doc(db, "posts/p1"), { business_id: "a", visible: true });
    await setDoc(doc(db, "posts/p2"), { business_id: "a", visible: false });
    await setDoc(doc(db, "services/mason"), { name: "Mason" });
  });
});
after(async () => { await env.cleanup(); });

const as = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

test("anyone can read public profiles, posts and reference data", async () => {
  await assertSucceeds(getDoc(doc(as(), "businesses/a")));
  await assertSucceeds(getDoc(doc(as(), "posts/p1")));
  await assertSucceeds(getDoc(doc(as(), "services/mason")));
});

test("private profiles and hidden posts are not public", async () => {
  await assertFails(getDoc(doc(as(), "businesses/hidden")));
  await assertFails(getDoc(doc(as("bob"), "posts/p2")));
  await assertSucceeds(getDoc(doc(as("alice"), "posts/p2")));
});

test("tenant data is readable only by members", async () => {
  await assertSucceeds(getDoc(doc(as("alice"), "businesses/a/leads/l1")));
  await assertSucceeds(getDocs(collection(as("alice"), "businesses/a/customers")));
  await assertFails(getDoc(doc(as("bob"), "businesses/a/leads/l1")));
  await assertFails(getDocs(collection(as("bob"), "businesses/a/customers")));
  await assertFails(getDoc(doc(as(), "businesses/a/leads/l1")));
});

test("users read only their own profile; admins read all", async () => {
  await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
  await assertFails(getDoc(doc(as("bob"), "users/alice")));
  await assertSucceeds(getDoc(doc(as("root"), "users/alice")));
});

test("clients can never write", async () => {
  await assertFails(setDoc(doc(as("alice"), "businesses/a/leads/l2"), { name: "x" }));
  await assertFails(setDoc(doc(as("alice"), "users/alice"), { is_platform_admin: true }));
  await assertFails(setDoc(doc(as("alice"), "posts/p3"), { business_id: "a", visible: true }));
  await assertFails(setDoc(doc(as("root"), "plans/basic"), { base_price_cents: 0 }));
});
