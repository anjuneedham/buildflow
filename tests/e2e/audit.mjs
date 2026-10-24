// Needs: emulators running (npm run emulators), npm run seed, and the app on
// :3000 (npm run dev, or npm run build && npm start). Run: npm run test:e2e
// Chromium: set CHROMIUM_PATH, otherwise Playwright's default browser is used.
import { chromium } from "playwright-core"; import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const B = process.env.APP_URL ?? "http://localhost:3000"; const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const VIEWS = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, tablet: { width: 820, height: 1180, hasTouch: true }, desktop: { width: 1280, height: 800 } };
const PUBLIC = ["/", "/explore", "/explore?service=electrician&area=st-andrew", "/pricing", "/contractor/kingston-pro-builders", "/post/demo-post-4", "/login", "/signup", "/privacy", "/terms", "/refund-policy", "/faq", "/support", "/delete-account", "/contact", "/about", "/features", "/for-contractors", "/for-customers", "/search"];
const OWNER = ["/app", "/app/leads", "/app/leads/demo-lead-qr", "/app/customers", "/app/customers/demo-cust-1", "/app/jobs", "/app/jobs/demo-proj-1", "/app/posts/new", "/app/profile", "/app/team", "/app/billing", "/app/analytics", "/app/inbox"];
async function login(ctx, email) { const p = await ctx.newPage(); await p.goto(B + "/login"); await p.fill("#email", email); await p.fill("#password", "demo-password-123"); await p.click("button[type=submit]"); await p.waitForURL(/\/(app|explore)/); await p.close(); }
const results = { overflow: [], axe: {}, perf: [], broken: [] };
for (const [vname, vp] of Object.entries(VIEWS)) {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await login(ctx, "owner@kingstonpro.demo");
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message)); page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errs.push(r.status() + " " + r.url().replace(B, "")); });
  for (const path of [...PUBLIC, ...OWNER]) {
    errs.length = 0; const t0 = Date.now();
    const res = await page.goto(B + path, { waitUntil: "load" }).catch(() => null); const ms = Date.now() - t0;
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) results.overflow.push(`${vname} ${path} +${over}px`);
    if (vname === "phone") results.perf.push([path, res?.status(), ms]);
    if (errs.length) results.broken.push(`${vname} ${path}: ${[...new Set(errs)].slice(0, 3).join(" | ")}`);
    if (vname === "phone") { await page.addScriptTag({ content: AXE }); const r = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, ex: v.nodes[0].target.join(" ").slice(0, 80) })));
      for (const v of r) { const k = v.id; (results.axe[k] ||= { impact: v.impact, help: v.help, pages: [], ex: v.ex }).pages.push(path + "×" + v.n); } }
  }
  await ctx.close();
}
await b.close();
console.log("OVERFLOW:", results.overflow.length ? "\n" + results.overflow.join("\n") : "none");
console.log("\nBROKEN REQUESTS / PAGE ERRORS:", results.broken.length ? "\n" + results.broken.join("\n") : "none");
console.log("\nAXE (phone, WCAG 2.1 A/AA):"); for (const [k, v] of Object.entries(results.axe)) console.log(`- ${k} [${v.impact}] ${v.help}\n    pages: ${v.pages.slice(0, 6).join(", ")}${v.pages.length > 6 ? " …+" + (v.pages.length - 6) : ""}\n    e.g. ${v.ex}`);
console.log("\nSLOWEST (ms, local, phone UA):", results.perf.sort((a, b) => b[2] - a[2]).slice(0, 5).map((x) => x.join(" ")).join(" | "));
console.log("non-200:", results.perf.filter((x) => x[1] !== 200).map((x) => x[0] + "→" + x[1]).join(", ") || "none");

if (results.overflow.length || results.broken.length || Object.keys(results.axe).length) process.exitCode = 1;
