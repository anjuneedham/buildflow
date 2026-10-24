// Core contractor workflow, end to end:
//   lead → customer → job → tasks & deadlines → schedule → updates/photos/files
//   → crew work → completion → history.
// Checks the questions a contractor must be able to answer at each step:
// who is the customer, what work, which job, what's next, who's responsible,
// what already happened, what needs attention.
// Needs: emulators, npm run seed, app on :3000. Run: node tests/e2e/workflow.mjs
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const FIX = new URL("./fixtures/", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const errors = [];
const step = (m) => console.log("✓", m);

// Dates the way the app computes them (Jamaica time).
const jm = (days = 0) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(Date.parse(today + "T00:00:00Z") + days * 864e5).toISOString().slice(0, 10);
};

async function login(email) {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${email}: ${m.text().slice(0, 300)}`));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "demo-password-123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/app", { timeout: 30000 });
  return page;
}
const main = (p) => p.locator("main");
const toast = (p, text) => p.locator("[aria-live=polite]").getByText(text).first().waitFor();

const run = Date.now().toString().slice(-6);
const NAME = `Shanelle Brooks ${run}`;
const PHONE = `876-555-${run.slice(-4)}`;
const owner = await login("owner@kingstonpro.demo");

// ---------- 1. Lead creation (from the Create sheet) ----------
await owner.getByRole("button", { name: "Create" }).click();
await owner.locator("dialog[open]").getByRole("link", { name: /New lead/ }).click();
await owner.waitForURL("**/app/leads/new");
await owner.fill("#name", NAME);
await owner.fill("#phone", PHONE);
await owner.fill("#description", "Retaining wall at the back, about 40 ft, plus drainage.");
await owner.selectOption("#serviceId", { label: "Mason" });
await owner.fill("#location", "Red Hills, St Andrew");
await owner.fill("#estimatedValue", "850000");
await owner.selectOption("#assignedTo", { label: "Marcus Reid (Demo)" });
await owner.click("button[type=submit]");
await owner.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/);
const leadUrl = owner.url();
await main(owner).getByText("What they need").waitFor();
// Who is this customer? Linked automatically, as a prospect.
const customerCard = main(owner).locator("a[href^='/app/customers/']").first();
assert.match(await customerCard.innerText(), new RegExp(NAME));
assert.match(await customerCard.innerText(), /Prospect/);
const customerUrl = BASE + (await customerCard.getAttribute("href"));
// Who is responsible?
await main(owner).getByText("Responsible").first().waitFor();
assert.ok(await main(owner).getByText("Marcus Reid (Demo)").count());
await main(owner).getByText(`Added lead ${NAME}`).waitFor();
step("lead created from the Create sheet; customer record created and linked; responsible shown; history started");

// ---------- 2. Lead status + follow-up ----------
await main(owner).getByRole("radio", { name: "Contacted" }).click();
await toast(owner, "Moved to Contacted");
await main(owner).getByRole("button", { name: "Tomorrow" }).click();
await toast(owner, "Follow up tomorrow");
await owner.reload();
await main(owner).getByText("Tomorrow", { exact: true }).first().waitFor();
await main(owner).locator("textarea[name=body]").fill("Site visit booked for Thursday 9am. Gate code 4411.");
await main(owner).getByRole("button", { name: "Add note" }).click();
await main(owner).getByText("Gate code 4411").waitFor();
await main(owner).getByText("Moved to Contacted").waitFor();
await main(owner).getByText(`Follow-up set for ${jm(1)}`).waitFor();
step("lead moved to Contacted, follow-up set for tomorrow, note added; all in the lead's history");

// ---------- 3. Schedule shows the follow-up ----------
await owner.goto(`${BASE}/app`);
const week = owner.locator("section", { has: owner.getByRole("heading", { name: /Tomorrow/ }) });
await week.getByText(`Follow up with ${NAME}`).waitFor();
step("Today › This week lists the follow-up under Tomorrow");

// ---------- 4. Same person again → same customer; lost with reason ----------
await owner.goto(`${BASE}/app/leads/new`);
await owner.fill("#name", NAME);
await owner.fill("#phone", `+1 (876) 555 ${run.slice(-4)}`); // same number, different format
await owner.fill("#description", "Also asked about a carport.");
await owner.click("button[type=submit]");
await owner.waitForURL(/\/app\/leads\/[A-Za-z0-9]{20}$/);
assert.notEqual(owner.url(), leadUrl);
assert.equal(BASE + (await main(owner).locator("a[href^='/app/customers/']").first().getAttribute("href")), customerUrl, "second enquiry should join the same customer");
await main(owner).getByRole("radio", { name: "Lost" }).click();
await owner.locator("dialog[open]").getByRole("button", { name: "Too expensive" }).click();
await toast(owner, "Moved to Lost");
await owner.reload();
await main(owner).getByText("Reason: Too expensive").waitFor();
step("second enquiry with the same phone (other format) joins the same customer; marked Lost with a reason");

// ---------- 5. Lead conversion: Start job ----------
await owner.goto(leadUrl);
await main(owner).getByRole("link", { name: "Start job" }).click();
await owner.waitForURL("**/app/jobs/new?leadId=**");
assert.equal(await owner.inputValue("#name"), `Mason for ${NAME}`);
assert.equal(await owner.locator("#customerId option:checked").innerText(), NAME);
await owner.fill("#startDate", jm(0));
await owner.fill("#expectedEndDate", jm(14));
await owner.selectOption("#status", "in_progress");
await owner.selectOption("#responsibleId", { label: "Marcus Reid (Demo)" });
await owner.locator("label", { hasText: "Ricardo Gayle (Demo)" }).click();
await owner.click("button[type=submit]");
await owner.waitForURL(/\/app\/jobs\/(from-)?[A-Za-z0-9]{20}$/);
const jobUrl = owner.url();
const jobName = `Mason for ${NAME}`;
await main(owner).getByRole("heading", { name: jobName }).waitFor();
assert.ok(await main(owner).getByRole("link", { name: NAME }).count(), "job shows its customer");
assert.ok(await main(owner).getByRole("link", { name: "From enquiry" }).count(), "job links back to the enquiry");
await main(owner).getByText("No open tasks").waitFor();
step("Start job: form prefilled from the lead; job created with customer, responsible person, crew and enquiry link");

await owner.goto(leadUrl);
await main(owner).getByText("Job started").waitFor();
assert.ok(await main(owner).getByRole("radio", { name: "Won", checked: true }).count(), "lead is Won");
await owner.goto(customerUrl);
await main(owner).getByText("Active", { exact: true }).first().waitFor();
step("lead now Won and points at the job; customer moved Prospect → Active");

// ---------- 6. Tasks & deadlines; what's next ----------
await owner.goto(jobUrl);
const addTask = async (title, due, who) => {
  if (!(await owner.locator("#t-new-title").count())) await main(owner).getByRole("button", { name: "Add task" }).click();
  await owner.fill("#t-new-title", title);
  if (due) await owner.fill("#t-new-due", due);
  if (who) await owner.selectOption("#t-new-assignee", { label: who });
  await main(owner).getByRole("button", { name: "Add task" }).click();
  await main(owner).locator("li").getByText(title, { exact: true }).waitFor({ timeout: 20000 });
};
await addTask("Order blocks and steel", jm(0), "Ricardo Gayle (Demo)");
await addTask("Dig footing", jm(2), "Ricardo Gayle (Demo)");
await addTask("Final walkthrough with client", null, null);
await owner.reload();
const next = owner.locator("text=What's next").locator("..");
await next.getByText("Order blocks and steel").waitFor();
assert.match(await next.innerText(), /Due Today · Ricardo Gayle/);
step("3 tasks with deadlines and owners; What's next = the task due soonest, with who's doing it");

// Edit a deadline into the past → overdue everywhere.
await main(owner).getByRole("button", { name: "Edit Dig footing" }).click();
const dlg = owner.locator("dialog[open]");
await dlg.locator("input[type=date]").fill(jm(-1));
await dlg.getByRole("button", { name: "Save task" }).click();
await toast(owner, "Task updated");
await owner.reload();
await next.getByText("Dig footing").waitFor();
assert.match(await next.innerText(), /Overdue · Yesterday/);
await owner.goto(`${BASE}/app/jobs`);
const card = main(owner).locator(`a[href='${new URL(jobUrl).pathname}']`);
assert.match(await card.innerText(), /Next\s+Dig footing/);
assert.match(await card.innerText(), /Overdue/);
await owner.goto(`${BASE}/app`);
const attention = owner.getByRole("list", { name: "Needs attention" });
await attention.getByText("Dig footing").waitFor();
await owner.locator("section", { has: owner.getByRole("heading", { name: /Today/ }) }).getByText("Order blocks and steel").waitFor();
step("deadline moved to yesterday: overdue on the job, first on the Jobs list, and in Today › Needs attention; today's task in the schedule");

// ---------- 7. Updates, photos and files ----------
await owner.goto(jobUrl);
await main(owner).locator("textarea[aria-label=Update]").fill("Footing marked out, blocks delivered.");
await main(owner).locator("input[name=photos]").setInputFiles(`${FIX}wall.png`);
await main(owner).getByRole("button", { name: "Post update" }).click();
await toast(owner, "Update posted");
await owner.reload();
await main(owner).getByText("Footing marked out, blocks delivered.").waitFor();
assert.equal(await main(owner).locator("img[alt='Site photo']").count() >= 2, true, "photo in the update and in the gallery");
const photoSrc = await main(owner).locator("img[alt='Site photo']").first().getAttribute("src");
const photoRes = await owner.request.get(BASE + photoSrc);
assert.equal(photoRes.status(), 200);
assert.equal(photoRes.headers()["content-type"], "image/webp");
step("site update with a photo: on the job's history and gallery, served as a re-encoded WebP");

await main(owner).locator("input[name=files]").setInputFiles(`${FIX}permit.pdf`);
await main(owner).getByRole("button", { name: "Upload" }).click();
await toast(owner, "File added");
await owner.reload();
const fileLink = main(owner).getByRole("link", { name: "permit.pdf" });
await fileLink.waitFor();
const pdf = await owner.request.get(BASE + (await fileLink.getAttribute("href")));
assert.equal(pdf.status(), 200);
assert.equal(pdf.headers()["content-type"], "application/pdf");
assert.match(pdf.headers()["content-disposition"] ?? "", /attachment; filename="permit.pdf"/);
await main(owner).locator("input[name=files]").setInputFiles(`${FIX}fake.jpg`);
await main(owner).getByRole("button", { name: "Upload" }).click();
await main(owner).getByText("Only photos (JPG, PNG, WEBP) and PDFs are allowed.").waitFor();
step("PDF uploaded and downloadable; a text file renamed .jpg is rejected by its real contents");

// ---------- 8. Crew do the work ----------
const crew = await login("crew@kingstonpro.demo");
await crew.getByText("Order blocks and steel").first().waitFor(); // on their Today
await crew.goto(jobUrl);
assert.equal(await main(crew).getByRole("link", { name: "Edit" }).count(), 0, "crew can't edit the job");
assert.equal(await main(crew).getByRole("radiogroup", { name: "Job status" }).count(), 0, "crew can't change job status");
await main(crew).locator("li", { hasText: "Order blocks and steel" }).getByRole("button", { name: "Mark done" }).click();
await main(crew).locator("li", { hasText: "Order blocks and steel" }).getByRole("button", { name: "Mark not done" }).waitFor({ timeout: 15000 });
await main(crew).locator("textarea[aria-label=Update]").fill("Steel tied, ready for inspection.");
await main(crew).getByRole("button", { name: "Post update" }).click();
await toast(crew, "Update posted");
step("crew see the job on their Today, tick their task and post an update; no edit or status controls");

// ---------- 9. Completion ----------
await owner.goto(jobUrl);
await main(owner).getByText('Completed "Order blocks and steel"').waitFor();
await main(owner).getByText("Ricardo Gayle (Demo)").first().waitFor();
await main(owner).getByRole("radio", { name: "Completed" }).click();
const done = owner.locator("dialog[open]");
await done.getByText("2 tasks are still open.").waitFor();
await done.getByRole("button", { name: "Mark them done and complete" }).click();
await toast(owner, "Job completed");
await owner.reload();
await main(owner).getByText("Job done! Turn it into your next customer.").waitFor();
await main(owner).getByText("3 of 3 done").waitFor();
await main(owner).getByText("Job completed (2 open tasks closed)").waitFor();
assert.equal(await main(owner).getByText("What's next").count(), 0);
step("complete job: dialog offers to close the 2 open tasks; job Completed, 3/3 tasks, showcase prompt");

await owner.goto(customerUrl);
await main(owner).getByText("Past client").first().waitFor();
const history = main(owner).getByRole("list", { name: "History" });
for (const text of [`Added lead ${NAME}`, "Gate code 4411", "Started job", "Footing marked out", "Added file permit.pdf", "Steel tied", "Job completed", "Moved to Lost (Too expensive)"]) {
  await history.getByText(text, { exact: false }).first().waitFor();
}
assert.ok(await history.getByRole("link", { name: jobName }).count(), "history entries link to the job");
step("customer is now a past client; their history shows every step across both enquiries and the job, linked");

await owner.goto(`${BASE}/app`);
assert.equal(await owner.getByRole("list", { name: "Needs attention" }).getByText("Dig footing").count(), 0, "finished work leaves Needs attention");
step("Today no longer flags the job's tasks");

// ---------- 10. Clean-up paths ----------
await owner.goto(jobUrl);
const photos = main(owner).getByRole("button", { name: "Delete photo" });
await photos.first().waitFor();
const before = await photos.count();
await photos.first().click();
await assert.doesNotReject(owner.waitForFunction((n) => document.querySelectorAll("button[aria-label='Delete photo']").length < n, before, { timeout: 15000 }),
  `photo still shown after delete (had ${before})`);
step("photo deleted from the gallery (and its update)");

console.log(errors.length ? "\nBrowser errors:\n" + [...new Set(errors)].join("\n") : "\nNo browser errors");
if (errors.length) process.exitCode = 1;
await browser.close();
