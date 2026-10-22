// Tenant isolation over HTTP. Needs the emulators, `npm run seed`, and the
// app running on :3000 (npm run dev). Run: npm run test:integration
import { test } from "node:test";
import assert from "node:assert/strict";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099";

async function sessionFor(email: string) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "demo-password-123", returnSecureToken: true }),
  });
  const { idToken } = await r.json();
  const s = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-buildflow:createSessionCookie`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ idToken, validDuration: 3600 }),
  });
  return `__session=${(await s.json()).sessionCookie}`;
}
const get = (path: string, cookie?: string) => fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });

// Records that belong to Kingston Pro Builders in the demo seed.
const KPB = ["/app/leads/demo-lead-qr", "/app/customers/demo-cust-1", "/app/projects/demo-proj-1", "/app/projects/demo-proj-1/edit", "/app/customers/demo-cust-1/edit"];

test("owner can open their own records", async () => {
  const cookie = await sessionFor("owner@kingstonpro.demo");
  for (const path of KPB) assert.equal((await get(path, cookie)).status, 200, path);
  assert.ok((await (await get("/app/leads/demo-lead-qr", cookie)).text()).includes("Jordan Lewis"));
});

test("team member can open their business's records", async () => {
  const cookie = await sessionFor("crew@kingstonpro.demo");
  for (const path of KPB) assert.equal((await get(path, cookie)).status, 200, path);
});

// Strings that only appear in Kingston Pro Builders' private records.
const PRIVATE = ["Jordan Lewis", "walk-in shower", "Tamara Williams", "Hope Road", "Williams Home Extension"];

test("another business sees not-found and none of the data", async () => {
  const cookie = await sessionFor("owner@islandelectrical.demo");
  for (const path of KPB) {
    const res = await get(path, cookie);
    const html = await res.text();
    // Pages under /app stream behind loading.tsx, so Next sends 200 before
    // notFound() runs; what matters is the not-found page and zero data.
    assert.ok(res.status === 404 || html.includes("couldn't find") || html.includes("couldn&#x27;t find"), `${path} should render not-found`);
    for (const secret of PRIVATE) assert.ok(!html.includes(secret), `${path} leaked "${secret}"`);
  }
});

test("a customer account has no business workspace", async () => {
  const cookie = await sessionFor("customer@buildflow.demo");
  const r = await get("/app/leads/demo-lead-qr", cookie);
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /onboarding/);
});

test("private project photos are only served to members", async () => {
  const outsider = await sessionFor("owner@islandelectrical.demo");
  assert.equal((await get("/media/project-files/demo-kpb/any.jpg", outsider)).status, 404);
  assert.equal((await get("/media/project-files/demo-kpb/any.jpg")).status, 404);
});

test("signed-out visitors are sent to login", async () => {
  const r = await get("/app/leads");
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /\/login\?next=/);
});

test("admin area is closed to non-admins", async () => {
  const cookie = await sessionFor("owner@kingstonpro.demo");
  const r = await get("/admin", cookie);
  assert.equal(r.status, 307);
  const admin = await sessionFor("admin@buildflow.demo");
  assert.equal((await get("/admin", admin)).status, 200);
});
