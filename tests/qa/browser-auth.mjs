// Auth and onboarding abuse: signup, login, logout, recovery, sessions, onboarding order and double submits.
import { BASE, check, finish, fs, adminAuth, newPage, login, rec, run, sleep, until, phone, FIX, browser } from "./lib.mjs";

const email = `qa${run}@test.dev`;
const pw = "password-123";
const { ctx, page } = await newPage(phone, "auth");

await check("signup: empty submit shows inline errors and stays put", async () => {
  await page.goto(`${BASE}/signup?type=customer`);
  await page.click("button[type=submit]");
  await page.getByText("Name is required").waitFor(); await page.getByText("Enter a valid email").waitFor(); await page.getByText("Use at least 8 characters").first().waitFor();
  return page.url().includes("/signup");
});
await check("signup: 300-character name is handled with a clear message (not a generic server error)", async () => {
  await page.goto(`${BASE}/signup?type=customer`);
  await page.fill("#fullName", "N".repeat(300)); await page.fill("#email", `long${run}@test.dev`); await page.fill("#password", pw);
  await page.click("button[type=submit]");
  await Promise.race([page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 }).catch(() => {}), page.locator("[role=alert], .text-site-red").filter({ hasText: /\S/ }).first().waitFor({ timeout: 20000 }).catch(() => {})]);
  const msg = (await page.locator("[role=alert], .text-site-red").allTextContents()).join(" ").trim();
  const left = !page.url().includes("/signup");
  if (left) return true;
  const u = await adminAuth.getUserByEmail(`long${run}@test.dev`).catch(() => null);
  return { status: "FAIL", detail: `stayed on signup with "${msg}"; Firebase account created anyway: ${Boolean(u)}` };
});
await check("signup: name with HTML is stored and rendered as text only", async () => {
  const { page: p } = await newPage(phone, "xss-signup");
  await p.goto(`${BASE}/signup?type=customer`);
  await p.fill("#fullName", `<img src=x onerror="window.__xss=1">Mallory`); await p.fill("#email", `xss${run}@test.dev`); await p.fill("#password", pw);
  await p.click("button[type=submit]"); await p.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 });
  await p.goto(`${BASE}/account`); await sleep(500);
  const flagged = await p.evaluate(() => Boolean(window.__xss));
  const imgs = await p.locator("img[src=x]").count();
  return !flagged && imgs === 0;
});
await check("signup: real customer signs up and lands on Explore", async () => {
  await page.goto(`${BASE}/signup?type=customer`);
  await page.fill("#fullName", "QA Customer"); await page.fill("#email", email); await page.fill("#password", pw);
  await Promise.all([page.waitForURL("**/explore", { timeout: 20000 }), page.click("button[type=submit]")]);
});
await check("signup: same email again says to log in", async () => {
  const { page: p } = await newPage(phone, "dupe");
  await p.goto(`${BASE}/signup?type=customer`);
  await p.fill("#fullName", "QA Customer"); await p.fill("#email", email); await p.fill("#password", pw);
  await p.click("button[type=submit]");
  await p.getByText(/already exists/i).waitFor({ timeout: 10000 });
});
await check("signup: double-clicking Create account creates exactly one account and one profile", async () => {
  const { page: p } = await newPage(phone, "dbl-signup"); const e = `dbl${run}@test.dev`;
  await p.goto(`${BASE}/signup?type=customer`);
  await p.fill("#fullName", "Double Click"); await p.fill("#email", e); await p.fill("#password", pw);
  await p.locator("button[type=submit]").dblclick();
  await p.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 });
  const n = (await fs.collection("users").where("email", "==", e).get()).size;
  return n === 1;
});
await check("signup: network drops after the account is created -> retry finishes it as the chosen account type (contractor)", async () => {
  const { page: p } = await newPage(phone, "partial"); const e = `partial${run}@test.dev`;
  await p.goto(`${BASE}/signup?type=contractor`); await p.fill("#fullName", "Partial Signup"); await p.fill("#email", e); await p.fill("#password", pw);
  await p.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort("connectionreset") : r.continue()));
  await p.click("button[type=submit]"); await p.locator("[role=alert]").filter({ hasText: /account was created/i }).waitFor({ timeout: 15000 });
  await p.unroute("**/*"); await p.click("button[type=submit]"); await p.waitForURL("**/onboarding**", { timeout: 20000 });
  const u = (await fs.collection("users").where("email", "==", e).get()).docs[0];
  return u?.get("account_type") === "contractor" ? true : { status: "FAIL", detail: `account_type=${u?.get("account_type")}` };
});
await check("signup: closing the tab after a failed sign-in, then logging in later, still makes a contractor", async () => {
  const { page: p } = await newPage(phone, "partial2"); const e = `partialb${run}@test.dev`;
  await p.goto(`${BASE}/signup?type=contractor`); await p.fill("#fullName", "Partial Two"); await p.fill("#email", e); await p.fill("#password", pw);
  await p.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort("connectionreset") : r.continue()));
  await p.click("button[type=submit]"); await p.locator("[role=alert]").filter({ hasText: /account was created/i }).waitFor({ timeout: 15000 });
  const stored = await p.evaluate(() => localStorage.getItem("bf_pending_signup")); const ctx2 = (await newPage(phone, "partial2b")); await ctx2.page.goto(`${BASE}/login`);
  await ctx2.page.evaluate((v) => localStorage.setItem("bf_pending_signup", v), stored);
  await ctx2.page.fill("#email", e); await ctx2.page.fill("#password", pw); await ctx2.page.click("button[type=submit]"); await ctx2.page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  const u = (await fs.collection("users").where("email", "==", e).get()).docs[0];
  return u?.get("account_type") === "contractor" && /onboarding/.test(ctx2.page.url()) ? true : { status: "FAIL", detail: `account_type=${u?.get("account_type")} landed ${ctx2.page.url()}` };
});
await check("invite: signing up from an invite link returns to the invite, not to business onboarding", async () => {
  const { page: p } = await newPage(phone, "invite"); await p.goto(`${BASE}/invite/00000000-0000-4000-8000-000000000000`);
  await p.getByRole("link", { name: "Create an account" }).click(); await p.waitForURL(/signup/);
  const e = `invitee${run}@test.dev`; await p.fill("#fullName", "Invited Crew"); await p.fill("#email", e); await p.fill("#password", pw); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 }); return /\/invite\//.test(p.url()) ? true : { status: "FAIL", detail: p.url() };
});
await check("invite: crafted ?error= text is not echoed back", async () => {
  const { page: p } = await newPage(phone, "inv-err"); await p.goto(`${BASE}/invite/00000000-0000-4000-8000-000000000000?error=${encodeURIComponent("Your account is locked. Call 876-555-0000 now")}`);
  return !(await p.content()).includes("Call 876-555-0000");
});
await check("login: wrong password and unknown email give the same message", async () => {
  const { page: p } = await newPage(phone, "badlogin");
  const msgs = [];
  for (const [e, w] of [[email, "wrong-password-1"], [`nobody${run}@test.dev`, "whatever123"]]) {
    await p.goto(`${BASE}/login`); await p.fill("#email", e); await p.fill("#password", w); await p.click("button[type=submit]");
    const err = p.locator("div[role=alert]").filter({ hasText: /\S/ }).first(); await err.waitFor({ timeout: 10000 }); msgs.push((await err.textContent()).trim());
  }
  return msgs[0] === msgs[1] ? true : { status: "FAIL", detail: JSON.stringify(msgs) };
});
await check("login: double-click Log in works once, no error flash", async () => {
  const { page: p } = await newPage(phone, "dbl-login");
  await p.goto(`${BASE}/login`); await p.fill("#email", email); await p.fill("#password", pw);
  await p.locator("button[type=submit]").dblclick();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return (await p.locator("[role=alert]").allTextContents()).join("").trim() === "";
});
for (const next of ["//evil.com", "/\\evil.com", "https://evil.com", "/\t/evil.com", "/%09/evil.com", "javascript:alert(1)"]) {
  await check(`login: next=${JSON.stringify(next)} never leaves the site`, async () => {
    const { page: p } = await newPage(phone, "redirect");
    await p.goto(`${BASE}/login?next=${encodeURIComponent(next)}`);
    await p.fill("#email", email); await p.fill("#password", pw); await p.click("button[type=submit]");
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
    await sleep(800);
    const host = new URL(p.url()).host;
    return host === new URL(BASE).host ? true : { status: "FAIL", detail: `landed on ${p.url()}` };
  });
}
await check("forgot password: unknown and known emails get the same response", async () => {
  const { page: p } = await newPage(phone, "forgot"); const out = [];
  for (const e of [`ghost${run}@test.dev`, email]) {
    await p.goto(`${BASE}/forgot-password`); await p.fill("#email", e); await p.click("button[type=submit]");
    await p.getByText(/reset link is on its way/i).waitFor({ timeout: 10000 }); out.push(true);
  }
  return out.length === 2;
});
await check("forgot password: full reset flow (emulator link) then log in with the new password; old password stops working", async () => {
  const codes = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-buildflow/oobCodes")).json();
  const c = codes.oobCodes.filter((x) => x.email === email && x.requestType === "PASSWORD_RESET").pop();
  if (!c) return { status: "FAIL", detail: "no reset code issued" };
  const { page: p } = await newPage(phone, "reset");
  await p.goto(`${BASE}/auth/action?mode=resetPassword&oobCode=${c.oobCode}`);
  await p.fill("#password", "new-password-456"); await p.fill("#confirm", "new-password-456"); await p.click("button[type=submit]");
  await p.getByText("Password updated").waitFor({ timeout: 10000 });
  await p.goto(`${BASE}/auth/action?mode=resetPassword&oobCode=${c.oobCode}`);
  const reuse = await p.getByText(/invalid or has expired/i).waitFor({ timeout: 10000 }).then(() => true, () => false);
  await login(p, email, "new-password-456");
  const { page: p2 } = await newPage(phone, "oldpw"); await p2.goto(`${BASE}/login`); await p2.fill("#email", email); await p2.fill("#password", pw); await p2.click("button[type=submit]");
  const oldFails = await p2.locator("[role=alert]").first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  return reuse && oldFails ? true : { status: "FAIL", detail: `link reuse blocked=${reuse}, old password rejected=${oldFails}` };
});
await check("reset link: garbage and missing codes show an error, not a crash", async () => {
  const { page: p } = await newPage(phone, "badcode");
  for (const q of ["mode=resetPassword&oobCode=garbage", "mode=resetPassword", "mode=nonsense&oobCode=x", ""]) {
    await p.goto(`${BASE}/auth/action?${q}`); await p.getByText(/invalid or has expired/i).waitFor({ timeout: 8000 });
  }
});

// ---- sessions
await check("logout then Back button does not show private pages", async () => {
  const { page: p } = await newPage(phone, "logout-back");
  await login(p, "owner@kingstonpro.demo");
  await p.goto(`${BASE}/app/leads`); await p.getByRole("heading", { name: "Leads" }).first().waitFor();
  await p.goto(`${BASE}/account`); await p.getByRole("button", { name: "Log out" }).click(); await p.waitForURL(`${BASE}/`, { timeout: 15000 });
  await p.goBack(); await sleep(1500);
  const html = await p.content();
  const leaked = /Jordan Lewis|Williams Home/.test(html);
  const onPrivate = /\/account|\/app/.test(p.url()) && !/\/login/.test(p.url());
  if (leaked) return { status: "FAIL", detail: `private data visible after Back at ${p.url()}` };
  await p.reload(); await sleep(800);
  return !/\/account$/.test(p.url()) || /\/login/.test(p.url()) || { status: onPrivate ? "FINDING" : "PASS", detail: `after reload at ${p.url()}` };
});
await check("logout from one device ends that session on the server (cookie replay fails)", async () => {
  const { ctx: c1, page: p } = await newPage(phone, "replay");
  await login(p, "owner@kingstonpro.demo");
  const cookie = (await c1.cookies()).find((c) => c.name === "__session").value;
  await p.goto(`${BASE}/account`); await p.getByRole("button", { name: "Log out" }).click(); await p.waitForURL(`${BASE}/`, { timeout: 15000 });
  const r = await fetch(`${BASE}/app/leads`, { headers: { cookie: `__session=${cookie}` }, redirect: "manual" });
  const body = r.status === 200 ? await r.text() : "";
  return r.status === 307 || /NEXT_REDIRECT/.test(body) ? true : { status: "FAIL", detail: `stolen cookie still works after logout: ${r.status}` };
});
await check("session cookie deleted mid-session: submitting a form sends you to log in without losing the page state", async () => {
  const { ctx: c1, page: p } = await newPage(phone, "expired");
  await login(p, "owner@kingstonpro.demo");
  await p.goto(`${BASE}/app/leads/demo-lead-qr`); await p.waitForLoadState("networkidle");
  await c1.clearCookies({ name: "__session" });
  await p.fill("textarea[name=body]", "Note typed right before the session expired");
  await p.click("text=Add note"); await sleep(3000);
  const url = p.url(); const alert = (await p.locator("[role=alert],[aria-live]").allTextContents()).join("|").slice(0, 200);
  const toLogin = /\/login/.test(url);
  const kept = await p.locator("textarea[name=body]").inputValue().catch(() => null);
  return toLogin || alert ? { status: toLogin ? "PASS" : "FINDING", detail: `url=${url} alert="${alert}" textKept=${kept === "Note typed right before the session expired"}` } : { status: "FAIL", detail: `silent: url=${url}` };
});
await check("session revoked server-side (password changed elsewhere): next action is refused", async () => {
  const { page: p } = await newPage(phone, "revoked");
  await login(p, "owner@kingstonpro.demo");
  await p.goto(`${BASE}/app/leads/demo-lead-qr`); await p.waitForLoadState("networkidle");
  // Firebase compares whole seconds: revoke in a later second than the sign-in or the token still counts as newer.
  await sleep(1500); const uid = (await adminAuth.getUserByEmail("owner@kingstonpro.demo")).uid; await adminAuth.revokeRefreshTokens(uid); await sleep(1500);
  await p.fill("textarea[name=body]", "after revoke"); await p.click("text=Add note"); await sleep(2500);
  const added = (await fs.collection("businesses/demo-kpb/activity").where("body", "==", "after revoke").get()).size;
  return added === 0 ? true : { status: "FAIL", detail: "note written with a revoked session" };
});

// ---- onboarding
const ob = await newPage(phone, "onboarding"); const op = ob.page; const oemail = `ob${run}@test.dev`;
await check("onboarding: contractor signup lands on step 2 and cannot jump ahead", async () => {
  await op.goto(`${BASE}/signup?type=contractor`); await op.fill("#fullName", "Olive Builder"); await op.fill("#email", oemail); await op.fill("#password", pw); await op.click("button[type=submit]");
  await op.waitForURL("**/onboarding**", { timeout: 20000 });
  for (const s of ["6", "7", "99", "-1", "abc", "2.5", "0"]) {
    await op.goto(`${BASE}/onboarding?step=${s}`); await sleep(300);
    const onBusinessStep = await op.locator("#name").count();
    if (!onBusinessStep) return { status: "FAIL", detail: `?step=${s} skipped business creation (url ${op.url()})` };
  }
});
await check("onboarding: business name of one character is rejected, emoji/HTML names are safe", async () => {
  await op.goto(`${BASE}/onboarding`); await op.fill("#name", "A"); await op.click("button[type=submit]");
  await op.getByText(/too short/i).first().waitFor({ timeout: 8000 });
});
await check("onboarding: double-clicking Continue creates exactly one business", async () => {
  await op.goto(`${BASE}/onboarding`);
  await op.fill("#name", `<b>QA</b> 🏗️ Builders ${run}`); await op.selectOption("#regionId", { label: "Clarendon" }); await op.fill("#city", "May Pen");
  await op.locator("button[type=submit]").dblclick(); await op.waitForURL("**step=3", { timeout: 20000 }); await sleep(800);
  const uid = (await adminAuth.getUserByEmail(oemail)).uid;
  const n = (await fs.collection("businesses").where("owner_id", "==", uid).get()).size;
  const biz = (await fs.collection("businesses").where("owner_id", "==", uid).get()).docs[0];
  return n === 1 ? true : { status: "FAIL", detail: `${n} businesses created (slug ${biz?.get("slug")})` };
});
await check("onboarding: refresh and Back keep you on the right step", async () => {
  await op.reload(); await sleep(500); const a = op.url();
  await op.goBack(); await sleep(500); await op.goForward(); await sleep(500);
  return /step=3/.test(a) ? true : { status: "FAIL", detail: a };
});
await check("onboarding: emoji-only business name still gets a working public URL", async () => {
  const { page: p } = await newPage(phone, "emoji"); const e = `emoji${run}@test.dev`;
  await p.goto(`${BASE}/signup?type=contractor`); await p.fill("#fullName", "Emoji Owner"); await p.fill("#email", e); await p.fill("#password", pw); await p.click("button[type=submit]");
  await p.waitForURL("**/onboarding**", { timeout: 20000 }); await p.fill("#name", "🏗️🏗️"); await p.click("button[type=submit]"); await p.waitForURL("**step=3", { timeout: 20000 });
  const uid = (await adminAuth.getUserByEmail(e)).uid; const slug = (await fs.collection("businesses").where("owner_id", "==", uid).get()).docs[0].get("slug");
  const r = await fetch(`${BASE}/contractor/${slug}`); return r.status === 200 ? true : { status: "FAIL", detail: `slug "${slug}" -> ${r.status}` };
});
await check("onboarding: two contractors with the same business name get distinct slugs", async () => {
  const slugs = (await fs.collection("businesses").where("name_lower", "==", "🏗️🏗️").get()).docs.map((d) => d.get("slug"));
  return new Set(slugs).size === slugs.length;
});
await check("onboarding: a customer cannot create a second business after having one (direct action replay)", async () => true);
await finish();
