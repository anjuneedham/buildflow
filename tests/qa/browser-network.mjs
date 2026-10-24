// Bad networks: offline, aborted requests, slow responses, refreshes mid-submit, missing images, slow 3G.
import { BASE, check, finish, fs, newPage, login, run, sleep, until, phone, android, browser } from "./lib.mjs";

const A = "businesses/demo-kpb";
const leadsNamed = async (name) => (await fs.collection(`${A}/leads`).where("name", "==", name).get()).size;
const isAction = (r) => r.method() === "POST" && Boolean(r.headers()["next-action"]);
const alerts = (p) => p.locator("[role=alert]").allTextContents().then((a) => a.join(" ").trim());

const { ctx, page: p } = await newPage(android, "owner-android");
await login(p, "owner@kingstonpro.demo");

await check("offline: Add lead shows an offline message, keeps every typed field, creates nothing", async () => {
  const name = `Offline ${run}`;
  await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle");
  await p.fill("#name", name); await p.fill("#phone", "8765550000"); await p.fill("#description", "typed before the signal dropped");
  await ctx.setOffline(true); await p.click("button[type=submit]"); await sleep(2500);
  const msg = await alerts(p); const kept = [await p.inputValue("#name"), await p.inputValue("#description")];
  const stuck = await p.locator("button[type=submit][disabled]").count();
  await ctx.setOffline(false);
  const ok = /offline|connection|wrong/i.test(msg) && kept[0] === name && kept[1].startsWith("typed") && !stuck && (await leadsNamed(name)) === 0;
  return ok ? true : { status: "FAIL", detail: `message="${msg}" kept=${JSON.stringify(kept)} buttonStuck=${stuck}` };
});
await check("back online: pressing the same button now works, once", async () => {
  const name = `Offline ${run}`; await p.click("button[type=submit]"); await p.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/, { timeout: 20000 }); return (await leadsNamed(name)) === 1;
});
await check("aborted request (connection reset mid-send): inline error, form kept, retry works", async () => {
  const name = `Aborted ${run}`; await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", name); await p.fill("#description", "keep me");
  await p.route("**/*", (r) => (isAction(r.request()) ? r.abort("connectionreset") : r.continue()));
  await p.click("button[type=submit]"); await sleep(2500); const msg = await alerts(p); const kept = await p.inputValue("#description");
  await p.unroute("**/*");
  if (!(msg && kept === "keep me")) return { status: "FAIL", detail: `message="${msg}" kept="${kept}"` };
  await p.click("button[type=submit]"); await p.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/, { timeout: 20000 }); return (await leadsNamed(name)) === 1;
});
await check("slow server (8 s): button shows progress, is disabled, double-tap makes one lead", async () => {
  const name = `Slow ${run}`; await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", name);
  await p.route("**/*", async (r) => { if (isAction(r.request())) await sleep(8000); await r.continue().catch(() => {}); });
  await p.click("button[type=submit]"); await sleep(400);
  const state = await p.locator("button[type=submit]").first().evaluate((b) => ({ disabled: b.disabled, text: b.textContent.trim() }));
  await p.locator("button[type=submit]").first().click({ force: true, timeout: 1000 }).catch(() => {});
  await p.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/, { timeout: 30000 }); await p.unroute("**/*");
  const n = await leadsNamed(name);
  return n === 1 && state.disabled ? true : { status: "FAIL", detail: `leads=${n} buttonDisabledWhilePending=${state.disabled} text="${state.text}"` };
});
await check("refresh while the request is in flight: no duplicate, app still loads", async () => {
  const name = `Refresh ${run}`; await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", name);
  await p.route("**/*", async (r) => { if (isAction(r.request())) await sleep(1500); await r.continue().catch(() => {}); });
  await p.click("button[type=submit]"); await sleep(300); await p.reload().catch(() => {}); await p.unroute("**/*"); await sleep(3500);
  const n = await leadsNamed(name); const healthy = (await p.locator("body").innerText()).length > 20;
  return n <= 1 && healthy ? { status: "PASS", detail: `${n} created` } : { status: "FAIL", detail: `leads=${n}` };
});

// ---- the customer-facing money path
const { ctx: cctx, page: c } = await newPage(android, "customer-android");
await check("customer offline: the quote request keeps the whole message and tells them to retry", async () => {
  await c.goto(`${BASE}/contractor/kingston-pro-builders?request=1`); await c.waitForLoadState("networkidle");
  const dlg = c.locator("dialog[open]"); const text = `Need a boundary wall rebuilt, about 60 ft, ${run}`;
  await dlg.locator("#quote-desc").fill(text); await dlg.locator("#quote-name").fill("Offline Olive"); await dlg.locator("#quote-phone").fill("8765550" + run.slice(-3));
  await cctx.setOffline(true); await dlg.getByRole("button", { name: "Send request" }).click(); await sleep(2500);
  const msg = await alerts(c); const kept = await dlg.locator("#quote-desc").inputValue().catch(() => "<gone>"); const stillOpen = await dlg.count();
  await cctx.setOffline(false);
  return /offline|connection|wrong/i.test(msg) && kept === text && stillOpen ? true : { status: "FAIL", detail: `message="${msg}" description kept="${kept.slice(0, 30)}" dialogOpen=${stillOpen}` };
});
await check("customer: server rejects (missing phone and email) -> message, and the description is not wiped", async () => {
  const dlg = c.locator("dialog[open]"); await dlg.locator("#quote-phone").fill(""); await dlg.locator("#quote-email").fill("");
  await dlg.getByRole("button", { name: "Send request" }).click(); await sleep(2500);
  const kept = await dlg.locator("#quote-desc").inputValue(); const msg = await dlg.innerText();
  return /email or phone/i.test(msg) && kept.startsWith("Need a boundary wall") ? true : { status: "FAIL", detail: `kept="${kept.slice(0, 30)}" msg=${msg.slice(0, 120)}` };
});
await check("customer: retry after reconnecting sends exactly one request", async () => {
  const dlg = c.locator("dialog[open]"); await dlg.locator("#quote-phone").fill("8765550" + run.slice(-3));
  await dlg.getByRole("button", { name: "Send request" }).dblclick(); await dlg.getByText("Request sent").waitFor({ timeout: 20000 }); await sleep(1500);
  const n = (await fs.collection(`${A}/quote_requests`).where("name", "==", "Offline Olive").get()).size; return n === 1 ? true : { status: "FAIL", detail: `${n} requests from one double-tap` };
});
await check("review form: offline submit keeps stars and text", async () => {
  const pj = await fs.collection(`${A}/projects`).add({ name: `Net review ${run}`, customer_name: "Pat Net", status: "completed", completed_at: new Date().toISOString(), member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await p.goto(`${BASE}/app/jobs/${pj.id}`); await p.waitForLoadState("networkidle"); await p.getByRole("button", { name: /ask for a review/i }).click();
  const link = (await p.locator("dialog[open] [data-testid=review-link]").textContent()).trim();
  await c.goto(link); await c.waitForLoadState("networkidle");
  await c.getByRole("radio", { name: /4 stars/ }).check({ force: true }); await c.fill("#review-body", "Good work, kept me updated"); await c.fill("#review-name", "Pat Net");
  await cctx.setOffline(true); await c.getByRole("button", { name: "Post review" }).click(); await sleep(2500);
  const msg = await alerts(c); const body = await c.inputValue("#review-body"); const checked = await c.getByRole("radio", { name: /4 stars/ }).isChecked();
  await cctx.setOffline(false);
  return /offline|connection|wrong/i.test(msg) && body.startsWith("Good work") && checked ? true : { status: "FAIL", detail: `message="${msg}" body="${body}" stars kept=${checked}` };
});

// ---- logout with no network
await check("logout while offline says so instead of silently doing nothing", async () => {
  await p.goto(`${BASE}/account`); await p.waitForLoadState("networkidle"); await ctx.setOffline(true);
  await p.getByRole("button", { name: "Log out" }).click(); await sleep(2500);
  const toast = await p.locator("[aria-live=polite]").innerText(); const url = p.url(); await ctx.setOffline(false);
  return /couldn.t log out|connection/i.test(toast) && url.includes("/account") ? true : { status: "FAIL", detail: `toast="${toast}" url=${url}` };
});

// ---- missing images
await check("broken cover, logo and post images do not break the layout", async () => {
  const bid = "demo-ies"; const before = (await fs.doc(`businesses/${bid}`).get()).data();
  await fs.doc(`businesses/${bid}`).update({ cover_url: "https://localhost:9/missing-cover.jpg", logo_url: "https://localhost:9/missing-logo.png" });
  await fs.doc("posts/demo-post-3").update({ media: [{ id: "m", url: "https://localhost:9/missing.webp", label: null, position: 0 }] });
  const { page: q } = await newPage(phone, "missing-img");
  const res = [];
  for (const u of ["/contractor/island-electrical-services", "/explore", "/post/demo-post-3"]) { await q.goto(`${BASE}${u}`); await q.waitForLoadState("load"); await sleep(600); res.push(`${u}:${await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)}`); }
  await fs.doc(`businesses/${bid}`).update({ cover_url: before.cover_url ?? null, logo_url: before.logo_url ?? null });
  return res.every((r) => r.endsWith("false")) ? true : { status: "FAIL", detail: res.join(" ") };
});

await finish();
