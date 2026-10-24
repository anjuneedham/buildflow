// Needs: emulators running (npm run emulators), npm run seed, and the app on
// :3000 (npm run dev, or npm run build && npm start). Run: npm run test:e2e
// Chromium: set CHROMIUM_PATH, otherwise Playwright's default browser is used.
import { chromium } from "playwright-core";
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const errors = [];
const ok = (m) => console.log("✓", m);
async function login(email) {
  const ctx = await b.newContext(phone);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${email}: ${m.text()}`));
  await p.goto(`${BASE}/login`);
  await p.fill("#email", email); await p.fill("#password", "demo-password-123");
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  return { ctx, p };
}
const navLabels = (p) => p.locator("nav[aria-label=Primary]").last().locator("li").allTextContents();

// Owner
const o = await login("owner@kingstonpro.demo");
await o.p.waitForURL("**/app");
ok("owner lands on " + new URL(o.p.url()).pathname);
console.log("  nav:", (await navLabels(o.p)).map((t) => t.trim() || "[+]").join(" | "));
ok("cookies: " + (await o.ctx.cookies()).map((c) => c.name).join(", "));
await o.p.getByRole("button", { name: "Create" }).click();
await o.p.locator("dialog[open]").getByText("New lead").waitFor();
ok("create sheet items: " + (await o.p.locator("dialog[open] li span.font-semibold").allTextContents()).join(", "));
await o.p.keyboard.press("Escape");
await o.p.goto(`${BASE}/app/leads`); await o.p.getByRole("heading", { name: "Leads" }).waitFor(); ok("owner opens leads");
await o.p.goto(`${BASE}/app/jobs`); await o.p.getByRole("heading", { name: "Jobs" }).waitFor();
ok(`owner sees ${await o.p.locator("a[href^='/app/jobs/demo']").count()} active jobs`);
await o.p.goto(`${BASE}/`); await o.p.getByRole("button", { name: "Account menu" }).waitFor(); ok("public header shows signed-in owner");
await o.p.goto(`${BASE}/app/team`); await o.p.getByText("Members").waitFor();
ok("team page role controls: " + (await o.p.locator("select[aria-label^='Role for']").count()));

// Crew
const c = await login("crew@kingstonpro.demo");
await c.p.waitForURL("**/app");
await c.p.getByText("here's your day").waitFor(); ok("crew Today view");
console.log("  nav:", (await navLabels(c.p)).map((t) => t.trim() || "[+]").join(" | "));
await c.p.goto(`${BASE}/app/leads`); await c.p.waitForURL("**/app"); ok("crew redirected away from leads");
await c.p.goto(`${BASE}/app/customers`); await c.p.waitForURL("**/app"); ok("crew redirected away from customers");
await c.p.goto(`${BASE}/app/jobs`); await c.p.getByRole("heading", { name: "Jobs" }).waitFor();
ok(`crew sees ${await c.p.locator("a[href^='/app/jobs/demo']").count()} assigned jobs`);
const notAssigned = await c.p.goto(`${BASE}/app/jobs/demo-proj-2`); ok(`crew opening unassigned job → HTTP ${notAssigned.status()}`);
await c.p.goto(`${BASE}/app/jobs/demo-proj-1`); await c.p.getByText("Tasks").first().waitFor();
ok(`crew opens assigned job; Edit links visible: ${await c.p.getByRole("link", { name: "Edit" }).count()}`);

// Logout
await o.p.goto(`${BASE}/account`);
await o.p.getByRole("button", { name: "Log out" }).click();
await o.p.waitForURL(`${BASE}/`); await o.p.getByRole("link", { name: "Log in" }).first().waitFor(); ok("logout → public header shows Log in");

console.log(errors.length ? "\nBrowser errors:\n" + [...new Set(errors)].join("\n") : "\nNo browser errors");
if (errors.length) process.exitCode = 1;
await b.close();
