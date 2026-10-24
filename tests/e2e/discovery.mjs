// Customer discovery and the contractor trust loop, starting from a brand-new
// customer account:
//   sign up → Explore (work, then contractors for a service) → profile (proof,
//   reviews, services, area, reply time) → shortlist (Saved) → "Request a
//   similar job" from a post → contractor gets the lead with the reference →
//   job → completion → publish job photos (Verified job) → review link →
//   customer reviews → rating updates everywhere → contractor replies.
// Every step checks one of DISCOVERY, TRUST or LEAD GENERATION.
// Needs: emulators, npm run seed, app on :3000. Run: node tests/e2e/discovery.mjs
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const fs = getFirestore(initializeApp({ projectId: "demo-buildflow" }, "e2e-discovery"));

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const FIX = new URL("./fixtures/", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const errors = [];
const step = (m) => console.log("✓", m);
const main = (p) => p.locator("main");
const KPB = "/contractor/kingston-pro-builders";

async function newPage(label) {
  const ctx = await browser.newContext(phone);
  // Contact links leave BuildFlow; don't let them reach the network.
  await ctx.route(/wa\.me|api\.whatsapp\.com/, (r) => r.fulfill({ status: 200, body: "whatsapp" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/ERR_TUNNEL|ERR_NAME|Failed to load resource/.test(m.text()) && errors.push(`${label}: ${m.text().slice(0, 300)}`));
  return page;
}
const monthKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const until = async (fn, what) => { for (let i = 0; i < 40; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 250)); } throw new Error(`timed out waiting for ${what}`); };
const stat = async (type) => (await fs.doc(`businesses/demo-kpb/stats/${monthKey()}`).get()).get(`totals.${type}`) ?? 0;

// Start from whatever the business has now (other suites may have finished jobs).
const kpb0 = (await fs.doc("businesses/demo-kpb").get()).data();
const fmt = (sum, n) => (Math.round((sum / n) * 10) / 10).toString();
const rated = (sum, n) => `Rated ${fmt(sum, n)} out of 5 from ${n} review${n === 1 ? "" : "s"}`;
const jobsText = (n) => `${n} job${n === 1 ? "" : "s"} completed`;
const BEFORE = { rating: rated(kpb0.rating_sum, kpb0.review_count), jobs: jobsText(kpb0.completed_project_count) };
// Same rule as responseLabel() in src/lib/data/trust.ts.
const replies = (() => {
  const r = kpb0.response; const h = r.total_minutes / r.count / 60;
  return h <= 1 ? "within an hour" : h <= 24 ? `within ${Math.ceil(h)} hours` : `within ${Math.ceil(h / 24)} days`;
})();
const AFTER = { rating: rated(kpb0.rating_sum + 5, kpb0.review_count + 1), jobs: jobsText(kpb0.completed_project_count + 1) };

const run = Date.now().toString().slice(-6);
const NAME = `Renee Walker ${run}`;
const email = `customer${run}@test.dev`;

// 1. Brand-new customer account
const c = await newPage("customer");
await c.goto(`${BASE}/signup?type=customer`);
await c.fill("#fullName", NAME);
await c.fill("#email", email);
await c.fill("#password", "password-123");
await c.click("button[type=submit]");
await c.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 30000 });
const me = (await fs.collection("users").where("email", "==", email).limit(1).get()).docs[0];
assert.equal(me?.get("account_type"), "customer");
step("signed up as a customer (no business, no trial)");

// 2. DISCOVERY: Explore leads with finished work, each with proof and a next step
await c.goto(`${BASE}/explore`);
await main(c).getByText(/^Verified job · /).first().waitFor();
// No single business floods the feed: at most 2 posts each.
const perBiz = await main(c).locator("article a[href^='/contractor/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter((h) => !h.includes("?")));
const counts = Object.values(perBiz.reduce((m, h) => ({ ...m, [h]: (m[h] ?? 0) + 1 }), {}));
assert.ok(counts.length >= 3 && Math.max(...counts) <= 2, `posts per business: ${JSON.stringify(counts)}`);
await main(c).getByRole("img", { name: BEFORE.rating }).first().waitFor();
assert.ok(await main(c).getByRole("link", { name: "Request a similar job" }).count() >= 3);
for (const vanity of ["Like", "Follow", "Comment"]) assert.equal(await main(c).getByRole("button", { name: vanity, exact: true }).count(), 0, `no ${vanity} button`);
step("Explore shows finished work from several businesses (max 2 each) with Verified job badges, ratings and 'Request a similar job' (no likes, follows or comments)");

// Picking a service switches to the people who do it, best-trusted first
await main(c).getByRole("link", { name: "General Contractors" }).click();
await c.waitForURL(/service=general-contractor/);
await main(c).locator("[aria-current=page]", { hasText: "Contractors" }).waitFor();
const firstCard = main(c).locator(`a[href="${KPB}"]`).first();
await firstCard.waitFor();
const card = main(c).locator("article, li, div").filter({ has: c.locator(`a[href="${KPB}"]`) }).last();
await card.getByText(BEFORE.jobs).first().waitFor();
step("choosing 'General Contractors' lists contractors with rating, jobs completed and reply time");

// 3. TRUST: the profile answers "can I trust them?" before "how do I contact them?"
await firstCard.click();
await c.waitForURL(`**${KPB}`);
for (const text of [`Usually replies ${replies}`, "Verified by BuildFlow", BEFORE.jobs, "12 years in business"]) await main(c).getByText(text).first().waitFor();
await main(c).getByRole("link", { name: /^Work/ }).first().waitFor();
const reviews = main(c).locator("#reviews");
await reviews.getByText("Verified customer").first().waitFor();
await reviews.getByText("Paul H.").first().waitFor();
await reviews.getByText("Reply from Kingston Pro Builders").first().waitFor();
await main(c).getByText("Only customers of completed jobs can review").first().waitFor();
const about = main(c).locator("#about");
for (const text of ["General Contractor", "Home Renovation", "Mason", "Kingston, St Andrew & St Catherine"]) await about.getByText(text).first().waitFor();
await main(c).getByText("Verified job").first().waitFor();
step("profile shows reply time, verified badge, jobs, years, verified-job work, verified reviews with reply, services and area");

// Contact is counted for the contractor
const contactsBefore = await stat("contact_click");
const [wa] = await Promise.all([c.waitForEvent("popup"), c.locator(".fixed").getByRole("link", { name: "WhatsApp" }).click()]);
assert.match(wa.url(), /wa\.me\/18765550101/);
await wa.close();
await until(async () => (await stat("contact_click")) === contactsBefore + 1, "contact click to be counted");
step("WhatsApp opens a chat with the business number and counts as a contact for them");

// 4. Shortlist: save the contractor and a piece of work (private, no public counts)
await main(c).getByRole("button", { name: "Save", exact: true }).first().click();
await main(c).getByRole("button", { name: "Saved", exact: true }).first().waitFor();
await until(async () => (await me.ref.collection("following").doc("demo-kpb").get()).exists, "contractor save");
await c.goto(`${BASE}/post/demo-post-1`);
await main(c).getByRole("button", { name: "Save", exact: true }).click();
await main(c).getByRole("button", { name: "Remove from saved" }).waitFor();
await until(async () => (await me.ref.collection("saves").doc("demo-post-1").get()).exists, "post save");
await c.goto(`${BASE}/saved`);
await main(c).getByText("Stamped concrete driveway").first().waitFor();
await c.goto(`${BASE}/saved?tab=contractors`);
await main(c).locator(`a[href="${KPB}"]`).first().waitFor();
step("saved the contractor and the post; both appear on Saved (Saved work / Contractors)");

// 5. LEAD GENERATION: "Request a similar job" from the post carries the reference
await c.goto(`${BASE}/post/demo-post-1`);
await main(c).getByText(/^Verified job · /).first().waitFor();
await main(c).getByRole("link", { name: "Request a similar job" }).click();
await c.waitForURL(/request=1&post=demo-post-1/);
const dlg = c.locator("dialog[open]");
await dlg.getByText(/^Similar to: Stamped concrete driveway and covered patio finished in Portmore\. Six weeks…$/).waitFor();
assert.equal(await dlg.locator("#quote-name").inputValue(), NAME, "name is prefilled for a signed-in customer");
await dlg.locator("#quote-desc").fill("Same style driveway for my house in Spanish Town, about 40ft long.");
await dlg.locator("#quote-phone").fill("876-555-7" + run.slice(-3));
await dlg.getByRole("button", { name: "Send request" }).click();
await dlg.getByText("Request sent").waitFor();
await dlg.getByText(`They usually reply ${replies}`).waitFor();
await dlg.getByRole("link", { name: "See your requests" }).click();
await c.waitForURL("**/account");
await main(c).getByText("Kingston Pro Builders").first().waitFor();
await main(c).getByText("Same style driveway").first().waitFor();
step("'Request a similar job' opened a prefilled request naming the post; sent; the customer sees it under My quote requests");

// 6. Contractor gets the lead with the work that prompted it
const o = await newPage("owner");
await o.goto(`${BASE}/login`);
await o.fill("#email", "owner@kingstonpro.demo");
await o.fill("#password", "demo-password-123");
await o.click("button[type=submit]");
await o.waitForURL("**/app", { timeout: 30000 });
await o.goto(`${BASE}/app/leads`);
await main(o).getByText(NAME).first().click();
await o.waitForURL("**/app/leads/**");
await main(o).getByText("Saw your work: Stamped concrete driveway").first().waitFor();
await main(o).getByText("General Contractor").first().waitFor();
step("contractor's new lead says which post the customer saw and has the service filled in");

// 7. Win it, do the job, finish it
await main(o).getByRole("link", { name: "Start job" }).click();
await o.waitForURL("**/app/jobs/new?leadId=**");
await o.fill("#name", `Walker driveway ${run}`);
await o.selectOption("#status", "in_progress");
await o.click("button[type=submit]");
await o.waitForURL(/\/app\/jobs\/[A-Za-z0-9_-]{15,}$/, { timeout: 20000 });
const jobUrl = o.url();
await o.waitForLoadState("networkidle");
await o.setInputFiles("input[name=photos]", `${FIX}wall.png`);
await o.getByRole("button", { name: "Post update" }).click();
await main(o).locator("img[alt=\"Site photo\"]").first().waitFor({ timeout: 20000 });
await o.getByRole("radio", { name: "Completed" }).click();
await o.locator("dialog[open]").getByRole("button", { name: "Complete job" }).click();
await main(o).getByText("Job done! Turn it into your next customer.").waitFor({ timeout: 20000 });
step("lead → job → site photo → completed; the job page prompts to publish and ask for a review");

// 8. Publish the job's own photos to the portfolio → Verified job
await main(o).getByRole("link", { name: "Publish to portfolio" }).click();
await o.waitForURL("**/app/posts/new?projectId=**");
await main(o).getByText("Photos from this job").waitFor();
assert.equal(await main(o).locator("input[name=jobMediaIds]:checked").count(), 1, "the job photo is preselected");
await o.fill("#caption", `Driveway for Renee in Spanish Town ${run}`);
await o.click("button[type=submit]");
await o.waitForURL("**/post/**");
await main(o).getByText(/^Verified job · /).first().waitFor();
const img = await main(o).locator("img").first().getAttribute("src");
assert.ok(!img.includes("project-files"), "published photo is served from public media, not the private job files");
step("published the job photo (copied to public media) with a Verified job badge, no re-upload");

// 9. Ask for a review (capability link, no customer account needed)
await o.goto(jobUrl);
await main(o).getByRole("button", { name: "Ask for a review" }).click();
const link = (await o.locator("dialog[open] [data-testid=review-link]").textContent()).trim();
assert.match(link, /\/review\/[\w-]{20,}$/);
await o.locator("dialog[open]").getByRole("link", { name: "Send on WhatsApp" }).waitFor();
step("review link created with a WhatsApp share button");

// 10. Customer leaves a review; the rating updates everywhere
const reviewPath = new URL(link).pathname;
await c.goto(`${BASE}${reviewPath}`);
await main(c).getByText("Kingston Pro Builders").first().waitFor();
await main(c).getByRole("radio", { name: "5 stars: Excellent" }).check({ force: true });
await c.fill("#review-name", "Renee Walker");
await c.fill("#review-body", `Driveway looks perfect, they showed up every day on time. ${run}`);
await main(c).getByRole("button", { name: "Post review" }).click();
await main(c).getByText("Thank you! Your review is live on their profile.").waitFor();
await c.goto(`${BASE}${KPB}`);
await main(c).locator("#reviews").getByText(`Driveway looks perfect, they showed up every day on time. ${run}`).waitFor();
await main(c).locator("#reviews").getByText("Renee W.").first().waitFor();
await main(c).getByRole("img", { name: AFTER.rating }).first().waitFor();
await main(c).getByText(AFTER.jobs).first().waitFor();
await c.goto(`${BASE}/explore`);
await main(c).getByRole("img", { name: AFTER.rating }).first().waitFor();
step(`verified review is live: shown as 'Renee W.'; profile and Explore posts now say "${AFTER.rating}" and "${AFTER.jobs}"`);

// A review link is for one job: reopening it edits the same review, not a second one
await c.goto(`${BASE}${reviewPath}`);
await main(c).getByRole("button", { name: /Update review|Post review/ }).waitFor();
assert.equal((await fs.collection("businesses/demo-kpb/reviews").where("reviewer_name", "==", "Renee W.").get()).docs.filter((d) => d.get("body")?.includes(run)).length, 1);
step("one review per job (link reopens the same review)");

// 11. Contractor sees it and replies publicly
await o.goto(jobUrl);
await main(o).getByText(`Driveway looks perfect`).first().waitFor();
await main(o).getByLabel("Reply to review").fill(`Thanks Renee, enjoy the new driveway! ${run}`);
await main(o).getByRole("button", { name: "Post reply" }).click();
await o.locator("[aria-live=polite]").getByText(/Reply (posted|saved)/).first().waitFor();
await c.goto(`${BASE}${KPB}`);
await main(c).locator("#reviews").getByText(`Thanks Renee, enjoy the new driveway! ${run}`).waitFor();
step("contractor replied; the reply shows under the review on the profile");

// 12. The contractor can see what the profile earned
await o.goto(`${BASE}/app/analytics`);
await main(o).getByText("Contact messages").waitFor();
await main(o).getByText("New reviews").waitFor();
assert.equal(await main(o).getByText(/followers|Likes|Comments/).count(), 0);
step("analytics shows contacts, saves and reviews (no follower, like or comment counts)");

console.log(errors.length ? "\nBrowser errors:\n" + [...new Set(errors)].join("\n") : "\nNo browser errors");
if (errors.length) process.exitCode = 1;
await browser.close();
process.exit();
