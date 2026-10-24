// Account deletion (Google Play policy): a customer, a team member and a business owner each delete their account;
// everything that should go is gone, everything that should stay is intact, and nobody else is touched.
import { BASE, check, finish, fs, adminAuth, newPage, login, run, sleep, until, phone } from "./lib.mjs";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
const { initializeApp } = await import("firebase-admin/app");
const { getStorage } = await import("firebase-admin/storage");
const bucket = getStorage(initializeApp({ projectId: "demo-buildflow", storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-buildflow.appspot.com" }, "del-" + run)).bucket();

async function signUp(email, name, type) {
  const { page } = await newPage(phone, email);
  await page.goto(`${BASE}/signup?type=${type}`); await page.fill("#fullName", name); await page.fill("#email", email); await page.fill("#password", "password-123"); await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 30000 });
  return { page, uid: (await adminAuth.getUserByEmail(email)).uid };
}
async function deleteViaUi(page, word = "DELETE") {
  await page.goto(`${BASE}/account`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dlg = page.locator("dialog[open]");
  const go = dlg.getByRole("button", { name: "Delete forever" });
  const disabledBefore = await go.isDisabled();
  await dlg.locator("#delete-confirm").fill(word);
  return { disabledBefore, go, dlg };
}

// ---- customer
const cEmail = `delcust${run}@test.dev`;
const cust = await signUp(cEmail, "Del Customer", "customer");
await fs.doc(`users/${cust.uid}/saves/demo-post-1`).set({ created_at: new Date().toISOString(), business_id: "demo-kpb" });
await fs.doc(`users/${cust.uid}/following/demo-kpb`).set({ created_at: new Date().toISOString() });
await fs.doc(`users/${cust.uid}/quote_requests/qr-del-${run}`).set({ business_id: "demo-kpb", business_name: "Kingston Pro Builders", description: "x", created_at: new Date().toISOString() });
await fs.doc(`businesses/demo-kpb/quote_requests/qr-del-${run}`).set({ requester_id: cust.uid, name: "Del Customer", description: "x", created_at: new Date().toISOString() });
await fs.doc(`businesses/demo-kpb/reviews/rv-del-${run}`).set({ reviewer_uid: cust.uid, reviewer_name: "Del C.", rating: 5, status: "published", body: "kept", created_at: new Date().toISOString() });
await fs.doc(`reports/${cust.uid}_post_demo-post-1`).set({ reporter_id: cust.uid, target_type: "post", target_id: "demo-post-1", status: "open", created_at: new Date().toISOString() });

await check("delete account: needs the word DELETE, and a wrong word does nothing", async () => {
  const { disabledBefore, go, dlg } = await deleteViaUi(cust.page, "delete me");
  await sleep(300);
  const still = await go.isDisabled();
  return disabledBefore && still && (await fs.doc(`users/${cust.uid}`).get()).exists ? true : { status: "FAIL", detail: `disabledBefore=${disabledBefore} stillDisabled=${still}` };
});
await check("customer deletion removes profile, saves, history, reports and the sign-in; keeps the contractor's lead and the review (anonymised)", async () => {
  await cust.page.locator("#delete-confirm").fill("DELETE");
  await cust.page.locator("dialog[open]").getByRole("button", { name: "Delete forever" }).click();
  await cust.page.waitForURL("**/account-deleted", { timeout: 30000 });
  const gone = !(await fs.doc(`users/${cust.uid}`).get()).exists && (await fs.collection(`users/${cust.uid}/saves`).get()).empty && (await fs.collection(`users/${cust.uid}/quote_requests`).get()).empty;
  const authGone = await adminAuth.getUser(cust.uid).then(() => false, () => true);
  const reports = (await fs.collection("reports").where("reporter_id", "==", cust.uid).get()).empty;
  const qr = (await fs.doc(`businesses/demo-kpb/quote_requests/qr-del-${run}`).get()).get("requester_id");
  const rv = (await fs.doc(`businesses/demo-kpb/reviews/rv-del-${run}`).get()).data();
  const ok = gone && authGone && reports && qr === null && rv.reviewer_uid === null && rv.reviewer_name === "Former customer" && rv.body === "kept";
  return ok ? true : { status: "FAIL", detail: JSON.stringify({ gone, authGone, reports, qr, rv }) };
});
await check("after deletion the old session no longer works and the same email can sign up again", async () => {
  const r = await cust.page.goto(`${BASE}/account`); const url = cust.page.url();
  const again = await signUp(cEmail, "Del Customer Again", "customer");
  return /login/.test(url) && again.uid !== cust.uid ? true : { status: "FAIL", detail: `url after deletion ${url}` };
});

// ---- team member of someone else's business
const crewEmail = `delcrew${run}@test.dev`;
const owner = await signUp(`delowner${run}@test.dev`, "Del Owner", "contractor");
await owner.page.fill("#name", `Delete Test Builders ${run}`); await owner.page.click("button[type=submit]"); await owner.page.waitForURL("**step=3", { timeout: 30000 });
const biz = (await fs.collection("businesses").where("owner_id", "==", owner.uid).get()).docs[0];
const crew = await signUp(crewEmail, "Del Crew", "contractor");
await fs.doc(`businesses/${biz.id}/members/${crew.uid}`).set({ role: "field", full_name: "Del Crew", created_at: new Date().toISOString() });
await fs.doc(`users/${crew.uid}`).set({ business_id: biz.id, business_role: "field" }, { merge: true });
const job = await fs.collection(`businesses/${biz.id}/projects`).add({ name: "Crew job", status: "in_progress", member_ids: [owner.uid, crew.uid], responsible_id: crew.uid, created_at: new Date().toISOString() });
await sleep(1200);
await check("team member deletion removes their membership and assignments but leaves the business intact", async () => {
  const { go } = await deleteViaUi(crew.page); await go.click(); await crew.page.waitForURL("**/account-deleted", { timeout: 30000 });
  const j = (await job.get()).data();
  const ok = !(await fs.doc(`businesses/${biz.id}/members/${crew.uid}`).get()).exists && !j.member_ids.includes(crew.uid) && j.responsible_id === owner.uid && (await fs.doc(`businesses/${biz.id}`).get()).exists;
  return ok ? true : { status: "FAIL", detail: JSON.stringify(j) };
});

// ---- owner: the whole business goes
await fs.collection(`businesses/${biz.id}/customers`).add({ name: "C1", created_at: new Date().toISOString() });
await fs.collection(`businesses/${biz.id}/leads`).add({ name: "L1", status: "new", created_at: new Date().toISOString() });
await fs.doc(`posts/post-del-${run}`).set({ business_id: biz.id, visible: true, caption: "bye", media: [], created_at: new Date().toISOString() });
await fs.doc(`review_requests/rr-del-${run}`).set({ business_id: biz.id, project_id: job.id });
await bucket.file(`project-files/${biz.id}/a.webp`).save(Buffer.from("x")).catch(() => {});
await bucket.file(`public-media/${biz.id}/b.webp`).save(Buffer.from("x")).catch(() => {});
const other = (await fs.doc("businesses/demo-ies").get()).data();
const slug = biz.get("slug");
await check("owner deletion removes the business, its data, files, posts, slug and subscription; other businesses are untouched", async () => {
  await owner.page.goto(`${BASE}/account`); await owner.page.waitForLoadState("networkidle");
  const warn = await owner.page.getByText(/permanently deletes your account and/).count();
  const { go } = await deleteViaUi(owner.page); await go.click(); await owner.page.waitForURL("**/account-deleted", { timeout: 60000 });
  const stillThere = [
    (await fs.doc(`businesses/${biz.id}`).get()).exists, !(await fs.collection(`businesses/${biz.id}/customers`).get()).empty, !(await fs.collection(`businesses/${biz.id}/leads`).get()).empty,
    (await fs.doc(`posts/post-del-${run}`).get()).exists, (await fs.doc(`slugs/${slug}`).get()).exists, (await fs.doc(`subscriptions/${biz.id}`).get()).exists, (await fs.doc(`review_requests/rr-del-${run}`).get()).exists,
    (await bucket.file(`project-files/${biz.id}/a.webp`).exists())[0], (await bucket.file(`public-media/${biz.id}/b.webp`).exists())[0],
    (await fs.doc(`users/${owner.uid}`).get()).exists, await adminAuth.getUser(owner.uid).then(() => true, () => false),
  ];
  const profileHtml = await (await fetch(`${BASE}/contractor/${slug}`)).text(); // streamed pages answer 200; the page says "not found" and is noindex
  const profile = /We couldn.t find that page/.test(profileHtml) && /name="robots" content="noindex"/.test(profileHtml) ? "gone" : "STILL SERVED";
  const after = (await fs.doc("businesses/demo-ies").get()).data();
  const ok = warn >= 1 && stillThere.every((x) => x === false) && profile === "gone" && after.name === other.name && after.post_count === other.post_count;
  return ok ? true : { status: "FAIL", detail: `warned=${warn} stillThere=${JSON.stringify(stillThere)} profile=${profile}` };
});
await check("platform admin accounts cannot delete themselves from the UI (and the demo data survives)", async () => {
  const { page } = await newPage(phone, "adm"); await login(page, "admin@buildflow.demo"); await sleep(1200);
  const { go } = await deleteViaUi(page); await go.click(); await sleep(2500);
  const text = await page.locator("dialog[open]").innerText();
  return /Platform admin accounts/.test(text) && (await fs.doc("users/demo-admin").get()).exists ? true : { status: "FAIL", detail: text.slice(0, 160) };
});
await finish();
