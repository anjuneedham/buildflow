// Needs: emulators running (npm run emulators), npm run seed, and the app on
// :3000 (npm run dev, or npm run build && npm start). Run: npm run test:e2e
// Chromium: set CHROMIUM_PATH, otherwise Playwright's default browser is used.
import { chromium } from "playwright-core";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const adminAuth = getAuth(initializeApp({ projectId: "demo-buildflow" }, "e2e"));
const BASE = process.env.APP_URL ?? "http://localhost:3000";

const DIR = new URL(".", import.meta.url).pathname;
const FIX = DIR + "fixtures/";
const SHOTS = process.env.E2E_SHOTS; // optional screenshot folder
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const step = (m) => console.log("✓", m);
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false, caret: "initial" }) : Promise.resolve());
const errors = [];

const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const email = `e2e${Date.now()}@test.dev`;

// 1. Sign up
await page.goto(`${BASE}/signup`);
await page.fill("#fullName", "Dwayne Test");
await page.fill("#email", email);
await page.fill("#password", "password-123");
await shot(page, "01-signup");
await page.click("button[type=submit]");
await page.waitForURL("**/onboarding**");
step("signed up as contractor → onboarding");

// 2. Business
await page.fill("#name", "Blue Line Masonry");
await page.selectOption("#regionId", { label: "Clarendon" });
await page.fill("#city", "May Pen");
await shot(page, "02-onboarding-business");
await page.click("button[type=submit]");
await page.waitForURL("**step=3");
step("business created");

// 3. Services
await page.click("text=Mason");
await page.locator("label", { hasText: /^Tiler$/ }).last().click();
await page.click("button[type=submit]");
await page.waitForURL("**step=4");
step("services saved");
// 4. Area
await page.fill("#serviceArea", "Clarendon & Manchester");
await page.fill("#description", "Block work, boundary walls and foundations.");
await page.fill("#yearsInBusiness", "9");
await page.click("button[type=submit]");
await page.waitForURL("**step=5");
step("service area saved");
// 5. Branding (upload logo)
await page.setInputFiles("input[name=logo]", `${FIX}logo.png`);
await page.click("button[type=submit]");
await page.waitForURL("**step=6");
step("logo uploaded");
// 6. Skip first record
await page.click("text=Skip for now");
await page.waitForURL("**step=7");
await shot(page, "03-onboarding-finish");
await page.click("text=Go to my dashboard");
await page.waitForURL("**/app?welcome=1");
await shot(page, "04-dashboard-new");
step("onboarding finished → dashboard");

// Publishing requires a verified email (V2): first prove the gate, then verify.
await page.goto(`${BASE}/app/posts/new`);
await page.setInputFiles("input[name=images]", `${FIX}wall.png`);
await page.click("button[type=submit]");
await page.getByText("Please verify your email first").first().waitFor();
step("unverified email blocks publishing with a clear message");
await adminAuth.updateUser((await adminAuth.getUserByEmail(email)).uid, { emailVerified: true });

// Create a post (showcase)
await page.goto(`${BASE}/app/posts/new`);
await page.setInputFiles("input[name=images]", `${FIX}wall.png`);
await page.fill("#caption", "Fresh boundary wall in May Pen.");
await page.click("button[type=submit]");
await page.waitForURL("**/post/**published=1");
step("post published");
const slug = (await page.locator("a[href^='/contractor/']").first().getAttribute("href")).split("/")[2];
step("slug: " + slug);

// 7-8. Customer (anonymous) discovers and requests a quote
const anon = await browser.newContext(phone);
const ap = await anon.newPage();
ap.on("pageerror", (e) => errors.push("anon: " + e.message));
await ap.goto(`${BASE}/explore?q=masons+in+clarendon&tab=contractors`);
await ap.waitForSelector(`a[href="/contractor/${slug}"]`);
await shot(ap, "05-explore-search");
step("search 'masons in clarendon' finds the new contractor");
await ap.click(`a[href="/contractor/${slug}"]`);
await ap.waitForURL(`**/contractor/${slug}`);
await shot(ap, "06-profile-mobile");
await ap.locator(".fixed button", { hasText: "Request a quote" }).click();
const dlg = ap.locator("dialog[open]");
await dlg.locator("input[name=name]").fill("Keisha Customer");
await dlg.locator("input[name=phone]").fill("876-555-9999");
await dlg.locator("textarea[name=description]").fill("Need a retaining wall, about 30ft.");
await shot(ap, "07-quote-form");
await dlg.locator("button[type=submit]").click();
await dlg.getByText("Quote request sent").waitFor();
await shot(ap, "08-quote-sent");
step("customer submitted quote request");

// 9. Lead appears
await page.goto(`${BASE}/app/leads`);
await page.getByText("Keisha Customer").first().waitFor();
await shot(page, "09-leads");
step("quote request appears as lead");
await page.getByText("Keisha Customer").first().click();
await page.waitForURL("**/app/leads/**");
await page.getByRole("radio", { name: "Contacted" }).click();
await page.getByText("Moved to Contacted").waitFor();
await page.fill("textarea[name=body]", "Called, site visit Friday.");
await page.click("text=Add note");
await page.getByText("Called, site visit Friday.").waitFor();
await shot(page, "10-lead-detail");
step("lead moved to Contacted + note added");

// 10. Convert to customer
await page.click("text=Convert to customer");
await page.waitForURL("**/app/customers/**converted=1");
step("lead converted to customer");

// 11. Create job
await page.click("main a[href^='/app/jobs/new?customerId']");
await page.waitForURL("**/app/jobs/new**");
await page.fill("#name", "Keisha retaining wall");
await page.fill("#budget", "450000");
await page.selectOption("#status", "in_progress");
await page.click("button[type=submit]");
await page.waitForURL(/\/app\/jobs\/[A-Za-z0-9_-]{15,}$/, { timeout: 15000 }).catch(async (e) => { await shot(page, "err-project"); console.log((await page.locator("[role=alert]").allTextContents()).join(" | "), page.url()); throw e; });
await page.waitForLoadState("networkidle");
step("project created");

// 12. Tasks
for (const t of ["Excavate footing", "Lay blocks"]) {
  await page.fill("#title", t);
  await page.click("button:has-text('Add task')");
  await page.getByText(t, { exact: true }).waitFor({ timeout: 20000 }).catch(async () => { console.log("  (task UI slow to refresh; reloading)"); await page.reload(); await page.getByText(t, { exact: true }).waitFor(); });
  if (await page.locator("#title").count() === 0) await page.click("text=Add task");
}
step("tasks added");
for (let i = 0; i < 2; i++) { const n = await page.getByRole("button", { name: "Mark not done" }).count(); await page.getByRole("button", { name: "Mark done" }).first().click(); await page.waitForFunction((k) => document.querySelectorAll("button[aria-label='Mark not done']").length > k, n, { timeout: 15000 }); }
await page.waitForTimeout(800);
await page.reload();
await page.getByText("2 of 2 done").waitFor();
step("tasks completed");
// 13. Upload site photo
await page.setInputFiles("input[name=photos]", `${FIX}wall.png`);
await page.click("button:has-text('Upload')");
await page.locator("img[alt=\"Site photo\"]").first().waitFor();
step("site photo uploaded");

// 14. Complete project
await page.getByRole("radio", { name: "Completed" }).click();
await page.getByText("Moved to Completed").waitFor();
await page.reload();
await shot(page, "11-project-completed");
step("project completed");

// 15. Showcase
await page.click("text=Showcase this job");
await page.waitForURL("**/app/posts/new?projectId=**");
await page.locator("label", { hasText: "Before / after" }).click();
await page.setInputFiles("input[name=before]", `${FIX}logo.png`);
await page.setInputFiles("input[name=after]", `${FIX}wall.png`);
await page.fill("#caption", "Retaining wall finished for Keisha.");
await page.click("button[type=submit]");
await page.waitForURL("**/post/**");
step("completed project showcased (before/after)");

// 16. New discovery
await ap.goto(`${BASE}/explore`);
await ap.getByText("Retaining wall finished for Keisha.").first().waitFor();
await shot(ap, "12-explore-feed");
await ap.goto(`${BASE}/contractor/${slug}`);
const jobs = await ap.locator("dd").first().textContent();

step(`showcase appears in Explore; profile shows ${jobs} completed job(s)`);

// Dashboard + analytics
await page.goto(`${BASE}/app`);
await shot(page, "14-dashboard");
await page.goto(`${BASE}/app/analytics`);
const banner = await page.locator("text=quote request").first().textContent();
step("analytics: " + banner.trim());

// Desktop shots
const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const dp = await desk.newPage();
await dp.goto(`${BASE}/`); 
await dp.goto(`${BASE}/contractor/kingston-pro-builders`); 
await dp.goto(`${BASE}/pricing`); 
await page.goto(`${BASE}/`); await shot(page, "15-home-mobile");

console.log(errors.length ? "\nBrowser errors:\n" + [...new Set(errors)].join("\n") : "\nNo browser errors");
if (errors.length) process.exitCode = 1;
await browser.close();
