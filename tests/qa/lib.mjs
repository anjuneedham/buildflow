// Shared helpers for the adversarial QA scripts (tests/qa/*.mjs).
import { chromium, devices } from "playwright-core";
import { execSync } from "node:child_process";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore } = await import("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-buildflow" }, "qa-" + Math.random().toString(36).slice(2));
export const adminAuth = getAuth(app);
export const fs = getFirestore(app);
export const BASE = process.env.APP_URL ?? "http://localhost:3000";
export const FIX = new URL("../e2e/fixtures/", import.meta.url).pathname;
export const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
export const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const android = devices["Pixel 7"];
export const run = Date.now().toString().slice(-7);

const results = [];
export const errors = [];
/** Records one check. status: PASS | FAIL | FINDING (works but is a problem worth reporting). */
export function rec(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(7)} ${name}${detail ? "  — " + detail : ""}`);
}
export async function check(name, fn) {
  try { const r = await fn(); if (r === undefined || r === true) rec(name, "PASS"); else if (typeof r === "object") rec(name, r.status, r.detail); else rec(name, "FAIL", String(r)); }
  catch (e) { rec(name, "FAIL", String(e.message).split("\n")[0].slice(0, 300)); }
}
export const finish = async () => {
  const bad = results.filter((r) => r.status !== "PASS");
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  for (const b of bad) console.log(`${b.status}: ${b.name} — ${b.detail}`);
  if (errors.length) console.log("\nBrowser errors seen:\n" + [...new Set(errors)].slice(0, 20).join("\n"));
  await browser.close();
  process.exit(bad.some((b) => b.status === "FAIL") ? 1 : 0);
};
export async function newPage(opts = phone, label = "page") {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/ERR_TUNNEL|ERR_NAME|Failed to load resource|net::ERR_/.test(m.text()) && errors.push(`${label}: ${m.text().slice(0, 200)}`));
  return { ctx, page };
}
export async function login(page, email, password = "demo-password-123") {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}
export const until = async (fn, what, tries = 40) => { for (let i = 0; i < tries; i++) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 250)); } throw new Error(`timed out waiting for ${what}`); };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const serverRssMb = () => { try { const pid = execSync("pgrep -f '[n]ext-server' | head -1").toString().trim(); return Math.round(Number(execSync(`ps -o rss= -p ${pid}`).toString()) / 1024); } catch { return -1; } };
export async function verifyEmail(email) { const u = await adminAuth.getUserByEmail(email); await adminAuth.updateUser(u.uid, { emailVerified: true }); return u.uid; }
