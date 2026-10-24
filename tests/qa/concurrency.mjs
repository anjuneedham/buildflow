// Races: the same action fired many times at once (double taps, two tabs, retries). Counters and records must stay consistent.
import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const fs = getFirestore(initializeApp({ projectId: "demo-buildflow" }, "race"));
const APP = process.env.APP_URL ?? "http://localhost:3000", AUTH = "http://127.0.0.1:9099";
const manifest = JSON.parse(readFileSync(new URL("../../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const byName = Object.fromEntries(Object.entries(manifest).map(([id, v]) => [v.exportedName, { id, workers: Object.keys(v.workers) }]));
async function sessionFor(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "demo-password-123", returnSecureToken: true }) });
  const { idToken } = await r.json();
  const s = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-buildflow:createSessionCookie`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ idToken, validDuration: 3600 }) });
  return `__session=${(await s.json()).sessionCookie}`;
}
const urlFor = (name) => { const w = byName[name].workers; const pick = w.find((x) => !x.startsWith("app/app") && !x.startsWith("app/admin")) ?? w[0]; return "/" + pick.replace(/^app\//, "").replace(/\/page$/, "").split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/").replace("[username]", "kingston-pro-builders").replace("[id]", "demo-proj-1").replace("[token]", "x1"); };
async function call(name, { args = [], fields, cookie }) {
  const headers = { "next-action": byName[name].id, ...(cookie ? { cookie } : {}), accept: "text/x-component" }; let body;
  if (fields) { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(`_1_${k}`, v); fd.append("0", JSON.stringify([...args, {}, "$K1"])); body = fd; } else { headers["content-type"] = "text/plain;charset=UTF-8"; body = JSON.stringify(args); }
  const r = await fetch(APP + urlFor(name), { method: "POST", headers, body, redirect: "manual" }); const text = await r.text();
  return { status: r.status, ok: /"ok":true/.test(text) ? true : /"ok":false/.test(text) ? false : undefined, err: text.match(/"error":"([^"]*)"/)?.[1], full: text };
}
const owner = await sessionFor("owner@kingstonpro.demo"), customer = await sessionFor("customer@buildflow.demo");
const A = "businesses/demo-kpb"; const run = Date.now().toString().slice(-6);
const results = []; const rec = (n, s, d = "") => { results.push({ n, s, d }); console.log(s.padEnd(7), n, d ? "— " + d : ""); };
const par = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
const iso = () => new Date().toISOString();

// Fixture job + tasks
const job = await fs.collection(`${A}/projects`).add({ name: `Race ${run}`, customer_id: null, customer_name: null, status: "in_progress", member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", task_total: 0, task_done: 0, next_task: null, created_at: iso(), updated_at: iso() });

{ const rs = await par(10, (i) => call("createTask", { args: [job.id], fields: { title: `Parallel ${i}` }, cookie: owner }));
  const j = (await job.get()).data(); const n = (await fs.collection(`${A}/tasks`).where("project_id", "==", job.id).get()).size;
  rec("10 parallel createTask: task_total matches the real task count", j.task_total === n && n === 10 ? "PASS" : "FAIL", `task_total=${j.task_total} real=${n} ok=${rs.filter((r) => r.ok).length}`); }
{ const tasks = (await fs.collection(`${A}/tasks`).where("project_id", "==", job.id).get()).docs.slice(0, 3);
  await par(30, (i) => call("setTaskStatus", { args: [tasks[i % 3].id, i % 2 ? "done" : "todo"], cookie: owner }));
  const j = (await job.get()).data(); const done = (await fs.collection(`${A}/tasks`).where("project_id", "==", job.id).where("status", "==", "done").get()).size;
  rec("30 parallel done/todo toggles: task_done matches tasks actually done", j.task_done === done ? "PASS" : "FAIL", `task_done=${j.task_done} real=${done}`); }
{ const nt = (await job.get()).get("next_task"); const open = (await fs.collection(`${A}/tasks`).where("project_id", "==", job.id).where("status", "in", ["todo", "in_progress"]).get()).size;
  rec("next_task still points at an open task after the storm", open === 0 || (nt && (await fs.doc(`${A}/tasks/${nt.id}`).get()).get("status") !== "done") ? "PASS" : "FINDING", JSON.stringify(nt)?.slice(0, 80)); }

{ const before = (await fs.doc(A).get()).get("response") ?? { count: 0 };
  const lead = await fs.collection(`${A}/leads`).add({ name: `Resp ${run}`, name_lower: "resp", status: "new", source: "phone", customer_id: null, created_at: new Date(Date.now() - 600000).toISOString(), updated_at: iso(), status_changed_at: iso(), phone: null, email: null, description: null, location: null, estimated_value: null, assigned_to: null, project_id: null, next_follow_up: null });
  await par(6, () => call("setLeadStatus", { args: [lead.id, "contacted"], cookie: owner }));
  const after = (await fs.doc(A).get()).get("response") ?? { count: 0 };
  rec("6 parallel status changes on one new lead count one reply, not six", after.count - before.count === 1 ? "PASS" : "FAIL", `reply count +${after.count - before.count}`); }

{ const before = (await fs.doc(`${A}/stats/${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7)}`).get()).get("totals.project_completed") ?? 0;
  await par(6, () => call("completeProject", { args: [job.id, true], cookie: owner }));
  const after = (await fs.doc(`${A}/stats/${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7)}`).get()).get("totals.project_completed") ?? 0;
  const hist = (await fs.collection(`${A}/activity`).where("project_id", "==", job.id).where("action", "==", "completed").get()).size;
  rec("6 parallel completeProject: one completion in stats and history", after - before === 1 && hist === 1 ? "PASS" : "FAIL", `stats +${after - before}, history entries ${hist}`); }

{ const rs = await par(8, () => call("createLead", { fields: { name: `Same Phone ${run}`, phone: "876-555-" + run.slice(-4) }, cookie: owner }));
  const custs = (await fs.collection(`${A}/customers`).where("phone_digits", "==", "1876555" + run.slice(-4)).get()).size;
  rec("8 parallel leads with the same phone number share one customer", custs === 1 ? "PASS" : "FAIL", `${custs} customers (ok=${rs.filter((r) => r.ok).length})`); }

{ const lead = await fs.collection(`${A}/leads`).add({ name: `Job race ${run}`, name_lower: "job race", status: "new", source: "phone", customer_id: null, created_at: iso(), updated_at: iso(), status_changed_at: iso(), phone: null, email: null, description: null, location: null, estimated_value: null, assigned_to: null, project_id: null, next_follow_up: null });
  await par(6, () => call("createProject", { fields: { name: `From lead ${run}`, leadId: lead.id }, cookie: owner }));
  const n = (await fs.collection(`${A}/projects`).where("lead_id", "==", lead.id).get()).size;
  rec("6 parallel Start job on one lead create one job", n === 1 ? "PASS" : "FAIL", `${n} jobs`); }

{ // review race on a fresh completed job
  const pj = await fs.collection(`${A}/projects`).add({ name: `Review race ${run}`, customer_id: null, customer_name: "Pat Race", status: "completed", completed_at: iso(), member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", created_at: iso(), updated_at: iso() });
  const rr = await call("requestReview", { args: [pj.id], cookie: owner }); const token = rr.full.match(/review\/([\w-]{20,})/)?.[1];
  const biz0 = (await fs.doc(A).get()).data();
  const rs = await par(8, (i) => call("submitReview", { args: [token], fields: { rating: String(1 + (i % 5)), name: "Pat Race", body: `race ${i}` } }));
  const biz1 = (await fs.doc(A).get()).data(); const rv = (await fs.doc(`${A}/reviews/${pj.id}`).get()).data();
  rec("8 parallel submissions on one review link: exactly one review, rating totals consistent with it", biz1.review_count - biz0.review_count === 1 && biz1.rating_sum - biz0.rating_sum === rv.rating ? "PASS" : "FAIL", `count +${biz1.review_count - biz0.review_count}, sum +${biz1.rating_sum - biz0.rating_sum}, stored rating ${rv.rating}, ok=${rs.filter((r) => r.ok).length}`);
  const tokens = (await fs.collection("review_requests").where("project_id", "==", pj.id).get()).size;
  const rr2 = await par(6, () => call("requestReview", { args: [pj.id], cookie: owner })); const t2 = new Set(rr2.map((r) => r.full.match(/review\/([\w-]{20,})/)?.[1]));
  rec("parallel 'Ask for a review' hands out one link per job", (await fs.collection("review_requests").where("project_id", "==", pj.id).get()).size === 1 ? "PASS" : "FINDING", `${t2.size} distinct links, ${(await fs.collection("review_requests").where("project_id", "==", pj.id).get()).size} request docs (was ${tokens})`); }

{ const post = "demo-post-3"; const before = (await fs.doc(`posts/${post}`).get()).get("save_count") ?? 0;
  await par(11, () => call("toggleSave", { args: [post], cookie: customer }));
  const after = (await fs.doc(`posts/${post}`).get()).get("save_count") ?? 0; const saved = (await fs.doc(`users/demo-customer/saves/${post}`).get()).exists;
  rec("11 parallel Save taps leave save_count consistent with the saved flag", after - before === (saved ? 1 : 0) ? "PASS" : "FAIL", `save_count +${after - before}, saved=${saved}`); }

{ const pj = await fs.collection(`${A}/projects`).add({ name: `Delete race ${run}`, status: "in_progress", member_ids: ["demo-owner-kpb"], responsible_id: "demo-owner-kpb", task_total: 0, task_done: 0, created_at: iso(), updated_at: iso() });
  await Promise.all([call("deleteProject", { args: [pj.id], cookie: owner }), ...Array.from({ length: 5 }, (_, i) => call("createTask", { args: [pj.id], fields: { title: `late ${i}` }, cookie: owner }))]);
  await new Promise((r) => setTimeout(r, 800)); const orphans = (await fs.collection(`${A}/tasks`).where("project_id", "==", pj.id).get()).size;
  rec("tasks added while the job is being deleted do not become orphans", orphans === 0 || !(await pj.get()).exists === false ? (orphans === 0 ? "PASS" : "FINDING") : "FINDING", `${orphans} orphan tasks`); }

{ const rs = await par(6, () => call("submitQuoteRequest", { fields: { businessId: "demo-kpb", name: "Spam Sam", phone: "8765550" + run.slice(-3), description: `burst ${run}` } }));
  const n = (await fs.collection(`${A}/quote_requests`).where("description", "==", `burst ${run}`).get()).size;
  rec("6 simultaneous requests from one phone respect the 5-per-hour guard", n <= 5 ? "PASS" : "FINDING", `${n} stored, ok=${rs.filter((r) => r.ok).length}`); }

const bad = results.filter((r) => r.s !== "PASS"); console.log(`\n${results.length - bad.length}/${results.length} passed`); for (const b of bad) console.log(`${b.s}: ${b.n} — ${b.d}`);
process.exit(bad.some((b) => b.s === "FAIL") ? 1 : 0);
