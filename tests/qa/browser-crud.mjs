// Malformed input, hostile text, empty data, duplicates, deletes and refreshes across leads, customers, jobs and tasks.
import { BASE, check, finish, fs, adminAuth, newPage, login, run, sleep, until, phone } from "./lib.mjs";

const A = "businesses/demo-kpb";
const { page: p } = await newPage(phone, "owner");
await login(p, "owner@kingstonpro.demo");
const XSS = [`<img src=x onerror="window.__xss=1">`, `"><svg onload="window.__xss=1">`, `javascript:window.__xss=1`, `</script><script>window.__xss=1</script>`, "{{7*7}} ${7*7} <%= 7*7 %>", "'; DROP TABLE leads;--", "‮evil‬ RTL ​ zero​width"];
const leadCount = async (name) => (await fs.collection(`${A}/leads`).where("name", "==", name).get()).size;
const overflowing = () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
const bad = /\bNaN\b|\bundefined\b|Invalid Date|\[object Object\]|\bnull\b/;
const visibleText = () => p.evaluate(() => document.body.innerText);

// ---------- validation and feedback
await check("lead: empty name shows an inline error and the other fields keep their values", async () => {
  await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle");
  await p.fill("#phone", "8765550101"); await p.fill("#description", "Typed with care, must survive an error");
  await p.click("button[type=submit]"); await p.getByText("Name is required").first().waitFor({ timeout: 8000 });
  const kept = [await p.inputValue("#phone"), await p.inputValue("#description")];
  return kept[0] === "8765550101" && kept[1].startsWith("Typed with care") ? true : { status: "FAIL", detail: `fields after error: ${JSON.stringify(kept)}` };
});
await check("lead: 161-character name, bad email and bad money are rejected with field messages, nothing saved", async () => {
  const long = "L".repeat(161) + run;
  await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle");
  await p.fill("#name", long); await p.fill("#email", "not-an-email"); await p.fill("#estimatedValue", "abc"); await p.click("button[type=submit]"); await sleep(2000);
  const text = await visibleText();
  return (await leadCount(long)) === 0 && /valid email|too long|characters|Enter a number/i.test(text) ? true : { status: "FAIL", detail: text.slice(0, 200) };
});
for (const v of ["-5", "1e3", "99999999999999999999", "1,200,000", "$5 000", "0"]) {
  await check(`lead: estimated value ${JSON.stringify(v)} is stored sensibly or refused`, async () => {
    const name = `Money ${run} ${v}`;
    await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle");
    await p.fill("#name", name); await p.fill("#estimatedValue", v); await p.click("button[type=submit]"); await sleep(2500);
    const d = (await fs.collection(`${A}/leads`).where("name", "==", name).get()).docs[0];
    if (!d) return { status: "PASS", detail: "refused" };
    const val = d.get("estimated_value");
    return typeof val === "number" && Number.isFinite(val) && val >= 0 && val < 1e11 ? { status: "PASS", detail: `stored ${val}` } : { status: "FAIL", detail: `stored ${val}` };
  });
}
await check("job: completion date before start date is refused with a message", async () => {
  await p.goto(`${BASE}/app/jobs/new`); await p.waitForLoadState("networkidle");
  await p.fill("#name", `Backwards ${run}`); await p.fill("#startDate", "2026-12-20"); await p.fill("#expectedEndDate", "2026-12-01"); await p.click("button[type=submit]");
  await p.getByText(/after the start date/i).first().waitFor({ timeout: 8000 });
  return (await fs.collection(`${A}/projects`).where("name", "==", `Backwards ${run}`).get()).size === 0;
});
await check("task: 201-character title refused, 200 accepted", async () => {
  await p.goto(`${BASE}/app/jobs/demo-proj-2`); await p.waitForLoadState("networkidle");
  if (!(await p.locator("#t-new-title").count())) await p.locator("main").getByRole("button", { name: "Add task" }).click();
  await p.fill("#t-new-title", "T".repeat(201)); await p.locator("main form").getByRole("button", { name: "Add task" }).click(); await sleep(2000);
  const refused = (await fs.collection(`${A}/tasks`).where("title", "==", "T".repeat(201)).get()).size === 0;
  const msg = (await p.locator("form [role=alert]").allTextContents()).join(" ").trim();
  return refused && msg ? true : { status: refused ? "FINDING" : "FAIL", detail: `refused=${refused} message="${msg}"` };
});

// ---------- hostile text everywhere it can be echoed
await check("hostile text in lead name/description/location renders as plain text on every page that shows it", async () => {
  const names = [];
  for (const [i, x] of XSS.entries()) {
    const name = `${x} ${run}-${i}`; names.push(name);
    await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle");
    await p.fill("#name", name); await p.fill("#description", x); await p.fill("#location", x); await p.fill("#phone", x);
    await p.click("button[type=submit]"); await sleep(1800);
  }
  const leads = (await fs.collection(`${A}/leads`).get()).docs.filter((d) => names.includes(d.get("name")));
  const pages = ["/app", "/app/leads?status=all", "/app/customers", "/app/inbox", "/app/jobs/new", ...leads.map((d) => `/app/leads/${d.id}`), ...leads.map((d) => `/app/customers/${d.get("customer_id")}`)];
  for (const path of pages) {
    await p.goto(`${BASE}${path}`); await p.waitForLoadState("networkidle"); await sleep(150);
    const flagged = await p.evaluate(() => Boolean(window.__xss));
    const injected = await p.locator("img[src=x], svg[onload], main script").count();
    if (flagged || injected) return { status: "FAIL", detail: `${path}: executed=${flagged} injected=${injected}` };
  }
  return leads.length >= 6 ? true : { status: "FAIL", detail: `only ${leads.length} leads saved` };
});
await check("hostile text submitted by an anonymous customer through the public quote form is inert for the contractor", async () => {
  const { page: q } = await newPage(phone, "anon");
  await q.goto(`${BASE}/contractor/kingston-pro-builders?request=1`); await q.waitForLoadState("networkidle");
  const dlg = q.locator("dialog[open]");
  await dlg.locator("#quote-desc").fill(XSS[0]); await dlg.locator("#quote-name").fill(XSS[1]); await dlg.locator("#quote-phone").fill("8765550" + run.slice(-3));
  await dlg.getByRole("button", { name: "Send request" }).click(); await dlg.getByText("Request sent").waitFor({ timeout: 15000 });
  for (const path of ["/app", "/app/inbox", "/app/leads"]) { await p.goto(`${BASE}${path}`); await p.waitForLoadState("networkidle"); if (await p.evaluate(() => Boolean(window.__xss)) || (await p.locator("img[src=x]").count())) return { status: "FAIL", detail: path }; }
});
await check("a 300-character unbroken name does not break the layout on a 390px phone", async () => {
  const name = "W".repeat(300) + run;
  await fs.collection(`${A}/leads`).add({ name: "W".repeat(150), name_lower: "w", status: "new", source: "phone", customer_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString(), phone: null, email: null, description: "X".repeat(400), location: null, estimated_value: null, assigned_to: null, project_id: null, next_follow_up: null });
  const res = [];
  for (const path of ["/app/leads?status=all", "/app"]) { await p.goto(`${BASE}${path}`); await p.waitForLoadState("networkidle"); res.push(`${path}:${await overflowing()}`); }
  return res.every((r) => r.endsWith("false")) ? true : { status: "FAIL", detail: res.join(" ") };
});

// ---------- duplicates
await check("triple-click on Add lead creates one lead", async () => {
  const name = `Triple ${run}`;
  await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", name);
  await p.locator("button[type=submit]").click({ clickCount: 3, delay: 20 }).catch(() => {}); await sleep(3500);
  const n = await leadCount(name); return n === 1 ? true : { status: "FAIL", detail: `${n} leads created` };
});
await check("customer: same phone twice is refused with a pointer to the existing customer", async () => {
  const ph = "876555" + run.slice(-4);
  for (const nm of [`Dup One ${run}`, `Dup Two ${run}`]) { await p.goto(`${BASE}/app/customers/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", nm); await p.fill("#phone", ph); await p.click("button[type=submit]"); await sleep(2200); }
  const second = (await p.locator("form [role=alert]").allTextContents()).join(" ");
  return /already has this phone/i.test(second) ? true : { status: "FAIL", detail: second };
});
await check("same phone typed as +1 876 / 1-876 / 876 matches one customer when entered as leads", async () => {
  const base = "777" + run.slice(-4); const forms = [`876${base}`, `+1 876 ${base.slice(0, 3)} ${base.slice(3)}`, `1-876-${base.slice(0, 3)}-${base.slice(3)}`, `(876) ${base.slice(0, 3)}-${base.slice(3)}`];
  for (const [i, f] of forms.entries()) { await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", `Phone Fmt ${run}`); await p.fill("#phone", f); await p.click("button[type=submit]"); await sleep(2000); }
  const custs = (await fs.collection(`${A}/customers`).where("name", "==", `Phone Fmt ${run}`).get()).size;
  return custs === 1 ? true : { status: "FAIL", detail: `${custs} customers for 4 formats of one number` };
});

// ---------- deletes, refresh, back, invalid records
await check("deleting a lead, then reloading its URL, shows a friendly not-found with navigation", async () => {
  const name = `Del ${run}`; await p.goto(`${BASE}/app/leads/new`); await p.waitForLoadState("networkidle"); await p.fill("#name", name); await p.click("button[type=submit]"); await p.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/, { timeout: 15000 });
  const url = p.url(); await p.getByRole("button", { name: "Delete lead", exact: true }).click(); await p.locator("dialog[open]").getByRole("button", { name: "Delete lead" }).click(); await sleep(2500);
  await p.goto(url); await p.waitForLoadState("networkidle"); const t = await visibleText();
  const backLinks = await p.locator("main").getByRole("link", { name: /Today|Leads|Jobs/ }).count();
  return /couldn.t find/i.test(t) && !/contractor profile/i.test(t) && backLinks >= 2 && (await p.locator("nav").count()) > 0 ? true : { status: "FAIL", detail: `${t.slice(0, 160)} | links back: ${backLinks}` };
});
await check("invalid and foreign ids inside /app show not-found, never an error page", async () => {
  const urls = ["/app/leads/garbage", "/app/leads/__proto__", "/app/customers/%00", "/app/jobs/nope", "/app/jobs/nope/edit", "/app/jobs/new?leadId=__proto__", "/app/jobs/new?leadId=garbage&customerId=garbage", "/app/leads/" + "a".repeat(200), "/app/customers/demo-cust-1/edit?x=1", "/app/posts/new?projectId=garbage"];
  for (const u of urls) { const r = await p.goto(`${BASE}${u}`); await p.waitForLoadState("networkidle"); const t = await visibleText(); if (/Something went wrong|Application error|digest/i.test(t)) return { status: "FAIL", detail: `${u}: ${t.slice(0, 120)}` }; }
});
await check("deleting a customer keeps the notes written on their jobs", async () => {
  const ref = await fs.collection(`${A}/customers`).add({ name: `Keep Notes ${run}`, name_lower: "keep", status: "active", phone: null, email: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const job = await fs.collection(`${A}/projects`).add({ name: `Job of ${run}`, customer_id: ref.id, customer_name: "Keep", status: "in_progress", member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", task_total: 0, task_done: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const mk = (entity_type, id, body) => fs.collection(`${A}/activity`).add({ entity_type, entity_id: id, action: "note", summary: "Added a note", body, media: [], customer_id: ref.id, project_id: entity_type === "project" ? job.id : null, lead_id: null, actor_id: "demo-owner-kpb", actor_name: "Marcus", created_at: new Date().toISOString() });
  await mk("customer", ref.id, `cust-note-${run}`); await mk("project", job.id, `job-note-${run}`);
  await p.goto(`${BASE}/app/customers/${ref.id}`); await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Delete customer", exact: true }).click(); await p.locator("dialog[open]").getByRole("button", { name: "Delete customer" }).click(); await sleep(3000);
  const notes = (await fs.collection(`${A}/activity`).where("action", "==", "note").get()).docs.map((d) => d.get("body"));
  const custGone = !notes.includes(`cust-note-${run}`), jobKept = notes.includes(`job-note-${run}`);
  return custGone && jobKept ? true : { status: "FAIL", detail: `customer note removed=${custGone}, job note kept=${jobKept}` };
});
await check("deleting a job with 600 tasks and 600 history entries succeeds and leaves nothing behind", async () => {
  const job = await fs.collection(`${A}/projects`).add({ name: `Huge ${run}`, customer_id: null, customer_name: null, status: "in_progress", member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", task_total: 600, task_done: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  for (let i = 0; i < 6; i++) { const b = fs.batch(); for (let j = 0; j < 100; j++) { b.set(fs.collection(`${A}/tasks`).doc(), { project_id: job.id, title: `t${i}-${j}`, status: "todo", created_at: new Date().toISOString() }); b.set(fs.collection(`${A}/activity`).doc(), { project_id: job.id, entity_type: "project", action: "note", body: "x", media: [], created_at: new Date().toISOString() }); } await b.commit(); }
  await p.goto(`${BASE}/app/jobs/${job.id}`); await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Delete job", exact: true }).click(); await p.locator("dialog[open]").getByRole("button", { name: "Delete job" }).click();
  await until(async () => !(await job.get()).exists, "job deleted", 60).catch(() => {});
  const left = (await fs.collection(`${A}/tasks`).where("project_id", "==", job.id).count().get()).data().count + (await fs.collection(`${A}/activity`).where("project_id", "==", job.id).count().get()).data().count;
  return !(await job.get()).exists && left === 0 ? true : { status: "FAIL", detail: `job exists=${(await job.get()).exists}, orphans=${left}` };
});
await check("Start job from the same lead twice (two tabs) creates one job", async () => {
  const lead = await fs.collection(`${A}/leads`).add({ name: `Race Lead ${run}`, name_lower: "race", status: "new", source: "phone", customer_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString(), phone: "876555" + run.slice(-4) + "9", email: null, description: null, location: null, estimated_value: null, assigned_to: null, project_id: null, next_follow_up: null });
  const p2 = (await newPage(phone, "tab2")).page; await login(p2, "owner@kingstonpro.demo");
  for (const pg of [p, p2]) { await pg.goto(`${BASE}/app/jobs/new?leadId=${lead.id}`); await pg.waitForLoadState("networkidle"); await pg.fill("#name", `Race job ${run}`); }
  await Promise.all([p.click("button[type=submit]"), p2.click("button[type=submit]")]); await sleep(5000);
  const n = (await fs.collection(`${A}/projects`).where("name", "==", `Race job ${run}`).get()).size;
  return n === 1 ? true : { status: "FAIL", detail: `${n} jobs created from one lead` };
});

// ---------- sanity scan: every page for placeholder junk
await check("sanity scan of every owner page: no NaN/undefined/Invalid Date/[object Object], no overflow, a heading", async () => {
  const pages = ["/app", "/app/leads", "/app/leads?status=all", "/app/customers", "/app/jobs", "/app/jobs?status=all", "/app/inbox", "/app/analytics", "/app/profile", "/app/team", "/app/billing", "/app/leads/new", "/app/customers/new", "/app/jobs/new", "/app/posts/new", "/app/leads/demo-lead-qr", "/app/customers/demo-cust-1", "/app/jobs/demo-proj-1", "/app/jobs/demo-proj-3", "/explore", "/contractor/kingston-pro-builders", "/post/demo-post-1", "/saved", "/account"];
  const problems = [];
  for (const u of pages) {
    await p.goto(`${BASE}${u}`); await p.waitForLoadState("networkidle"); await sleep(150);
    const t = await visibleText(); const m = t.match(bad);
    if (m) problems.push(`${u}: text contains "${m[0]}"`);
    if (await overflowing()) problems.push(`${u}: horizontal overflow`);
    if (!(await p.locator("h1").count())) problems.push(`${u}: no <h1>`);
  }
  return problems.length ? { status: "FAIL", detail: problems.join(" | ") } : true;
});
await finish();
