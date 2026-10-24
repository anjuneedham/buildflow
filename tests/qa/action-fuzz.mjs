// Calls every server action directly over HTTP as different actors and checks that
// unauthorised calls change nothing. Action ids come from the production build's manifest.
import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const fs = getFirestore(initializeApp({ projectId: "demo-buildflow" }, "fuzz"));
const APP = "http://localhost:3000", AUTH = "http://127.0.0.1:9099";
const manifest = JSON.parse(readFileSync("/home/user/buildflow/.next/server/server-reference-manifest.json", "utf8")).node;
const byName = Object.fromEntries(Object.entries(manifest).map(([id, v]) => [v.exportedName, { id, workers: Object.keys(v.workers) }]));

async function sessionFor(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "demo-password-123", returnSecureToken: true }) });
  const { idToken } = await r.json();
  const s = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-buildflow:createSessionCookie`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ idToken, validDuration: 3600 }) });
  return `__session=${(await s.json()).sessionCookie}`;
}
const actors = { anon: undefined, customer: await sessionFor("customer@buildflow.demo"), crew: await sessionFor("crew@kingstonpro.demo"), ownerB: await sessionFor("owner@islandelectrical.demo"), ownerA: await sessionFor("owner@kingstonpro.demo"), admin: await sessionFor("admin@buildflow.demo") };

const urlFor = (name) => {
  const w = byName[name].workers;
  const pick = w.find((x) => !x.startsWith("app/app") && !x.startsWith("app/admin")) ?? w[0];
  return "/" + pick.replace(/^app\//, "").replace(/\/page$/, "").split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/").replace("[username]", "kingston-pro-builders").replace("[id]", "demo-proj-1").replace("[token]", "x1");
};
async function call(name, { args = [], fields, cookie, path }) {
  const a = byName[name]; if (!a) throw new Error("no action " + name);
  const headers = { "next-action": a.id, ...(cookie ? { cookie } : {}), accept: "text/x-component" };
  let body;
  if (fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(`_1_${k}`, v);
    fd.append("0", JSON.stringify([...args, {}, "$K1"])); // the root must come after the form entries it references
    body = fd;
  } else { headers["content-type"] = "text/plain;charset=UTF-8"; body = JSON.stringify(args); }
  const r = await fetch(APP + (path ?? urlFor(name)), { method: "POST", headers, body, redirect: "manual" });
  const text = await r.text();
  const ok = /"ok":true/.test(text) ? true : /"ok":false/.test(text) ? false : undefined;
  const err = text.match(/"error":"([^"]*)"/)?.[1];
  return { status: r.status, ok, err, redirect: r.headers.get("x-action-redirect") ?? r.headers.get("location"), text: text.slice(0, 200), full: text };
}
const results = []; const rec = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(pass ? "PASS" : "FAIL", name, detail); };
const A = "businesses/demo-kpb";
const snap = async () => {
  const g = async (p) => (await fs.doc(p).get());
  const [lead, cust, p1, p2, p3, crew, post, kpb, owner, ies, o1] = await Promise.all([g(`${A}/leads/demo-lead-qr`), g(`${A}/customers/demo-cust-1`), g(`${A}/projects/demo-proj-1`), g(`${A}/projects/demo-proj-2`), g(`${A}/projects/demo-proj-3`), g(`${A}/members/demo-crew-kpb`), g("posts/demo-post-1"), g(A), g("users/demo-owner-kpb"), g("businesses/demo-ies"), g("plans/basic")]);
  const tasks = (await fs.collection(`${A}/tasks`).get()).size;
  const leads = (await fs.collection(`${A}/leads`).get()).size;
  const custs = (await fs.collection(`${A}/customers`).get()).size;
  return JSON.stringify({ lead: lead.exists && [lead.get("status"), lead.get("next_follow_up")], cust: cust.exists && cust.get("name"), p1: p1.exists && p1.get("status"), p2: p2.exists && [p2.get("status"), p2.get("name")], p3: p3.exists && p3.get("status"), crew: crew.exists && crew.get("role"), post: post.exists && post.get("visible"), kpb: [kpb.get("name"), kpb.get("is_suspended"), kpb.get("is_verified"), kpb.get("phone")], owner: owner.get("is_suspended"), ies: [ies.get("is_suspended"), ies.get("is_verified")], tasks, leads, custs });
};

const before = await snap();
// Positive control: the harness really can invoke actions as a legit actor.
{ const r = await call("createLead", { fields: { name: "Fuzz Control Lead", phone: "8765559911" }, cookie: actors.ownerA }); rec("CONTROL ownerA createLead works via harness", r.ok === true, JSON.stringify(r)); }
{ const r = await call("toggleSave", { args: ["demo-post-3"], cookie: actors.customer }); rec("CONTROL customer toggleSave works", r.ok === true, JSON.stringify(r)); await call("toggleSave", { args: ["demo-post-3"], cookie: actors.customer }); }
const after0 = await snap(); // control changed leads/custs only

// Action id sent to a page that doesn't use it
{ const r = await call("createProject", { fields: { name: "Throwaway" }, cookie: actors.ownerA }); const id = r.full.match(/jobs\/([A-Za-z0-9]{20})/)?.[1]; rec("CONTROL ownerA createProject works", r.ok === true && Boolean(id), r.text.slice(0, 100)); if (id) { const del = await fetch(APP + "/explore", { method: "POST", headers: { "next-action": byName.deleteProject.id, cookie: actors.ownerA, "content-type": "text/plain" }, body: JSON.stringify([id]) }); const gone = !(await fs.doc(`${A}/projects/${id}`).get()).exists; console.log("INFO action ids are global: an id POSTed to an unrelated page still ran (authz lives in the action):", gone, del.status); } }

const attacks = {
  // [action, args, fields]
  deleteLead: [["demo-lead-qr"]], setLeadStatus: [["demo-lead-qr", "lost"]], setFollowUp: [["demo-lead-qr", "2030-01-01"]], linkLeadCustomer: [["demo-lead-qr"]],
  deleteCustomer: [["demo-cust-1"]], deleteNote: [["demo-nonexistent"]],
  addNote: [[], { entityType: "lead", entityId: "demo-lead-qr", body: "pwned" }],
  updateLead: [["demo-lead-qr"], { name: "Pwned", status: "lost" }], updateCustomer: [["demo-cust-1"], { name: "Pwned" }],
  deleteProject: [["demo-proj-3"]], setProjectStatus: [["demo-proj-1", "on_hold"]], completeProject: [["demo-proj-1", true]],
  updateProject: [["demo-proj-1"], { name: "Pwned", status: "cancelled" }],
  createTask: [["demo-proj-2"], { title: "pwn task" }], setTaskStatus: [["nonexistent", "done"]], deleteTask: [["nonexistent"]],
  postUpdate: [["demo-proj-2"], { body: "pwn update" }], deleteMedia: [["nonexistent"]],
  removeMember: [["demo-crew-kpb"]], setMemberRole: [["demo-crew-kpb", "admin"]], inviteMember: [[], { email: "evil@x.com", role: "admin" }], revokeInvite: [["x"]],
  updateBusinessProfile: [[], { name: "Pwned Builders", phone: "000" }],
  deletePost: [["demo-post-1"]], createPost: [[], { type: "completed_project", caption: "pwn" }],
  requestReview: [["demo-proj-3"]], replyToReview: [["demo-proj-3"], { body: "pwn" }],
  setUserSuspended: [["demo-owner-kpb", true]], setBusinessFlag: [["demo-kpb", "is_suspended", true]], resolveReport: [["nonexistent", "hide"]],
  updatePlan: [["basic"], { name: "Pwned", basePrice: "0", includedSeats: "1", seatPrice: "0" }], toggleService: [["mason", false]],
  createBusiness: [[], { name: "Sneaky Biz" }], finishOnboarding: [[]], saveServices: [[], { primaryServiceId: "mason" }],
};
// who must NOT succeed per action
const blocked = (name) => {
  const adminOnly = ["setUserSuspended", "setBusinessFlag", "resolveReport", "updatePlan", "toggleService"].includes(name);
  if (adminOnly) return ["anon", "customer", "crew", "ownerA", "ownerB"];
  if (["createBusiness", "finishOnboarding", "saveServices"].includes(name)) return ["anon", "crew"]; // owners/customers legitimately onboard
  if (["createPost", "updateBusinessProfile", "inviteMember", "requestReview", "replyToReview", "createLead"].includes(name)) return ["anon", "customer", "crew"];
  if (["setTaskStatus", "deleteMedia", "deleteNote"].includes(name)) return ["anon", "customer", "ownerB"];
  return ["anon", "customer", "crew", "ownerB"];
};
for (const [name, [args, fields]] of Object.entries(attacks)) {
  for (const who of blocked(name)) {
    const r = await call(name, { args, fields, cookie: actors[who] });
    // Tenant-scoped deletes of ids that don't exist in the caller's own tenant are a harmless ok:true no-op; state is checked below.
    const noop = who === "ownerB" && ["deleteLead", "deleteCustomer", "deleteNote", "deleteProject", "deleteTask", "revokeInvite"].includes(name);
    rec(`${who} -> ${name} is not accepted`, r.ok !== true || noop, `${r.status} ok=${r.ok} ${r.err ?? ""} ${r.redirect ?? ""}`);
    if (r.status >= 500) rec(`${who} -> ${name} no 5xx`, false, r.text);
  }
}
const after = await snap();
rec("no protected data changed by any blocked call", after === after0, after === after0 ? "" : `\nbefore ${after0}\nafter  ${after}`);

// Crew own-job actions work only on assigned job
{ const r = await call("createTask", { args: ["demo-proj-2"], fields: { title: "crew on unassigned" }, cookie: actors.crew }); rec("crew createTask on unassigned job rejected", r.ok !== true, `${r.ok} ${r.err}`); }
{ const r = await call("createTask", { args: ["demo-proj-1"], fields: { title: "crew on assigned" }, cookie: actors.crew }); rec("CONTROL crew createTask on assigned job works", r.ok === true, `${r.ok} ${r.err}`); }
// Cross-tenant: ownerB actions only touch B
{ const r = await call("createLead", { fields: { name: "B only lead" }, cookie: actors.ownerB }); const inA = (await fs.collection(`${A}/leads`).where("name", "==", "B only lead").get()).size; rec("ownerB createLead lands in B, not A", r.ok === true && inA === 0); }
{ const r = await call("createProject", { fields: { name: "B job", leadId: "demo-lead-qr" }, cookie: actors.ownerB }); rec("ownerB createProject with A's leadId rejected", r.ok !== true, `${r.ok} ${r.err}`); }
{ const r = await call("createProject", { fields: { name: "B job", customerId: "demo-cust-1" }, cookie: actors.ownerB }); rec("ownerB createProject with A's customerId rejected", r.ok !== true, `${r.ok} ${r.err}`); }
// Mass-assignment style extras
{ const r = await call("updateBusinessProfile", { fields: { name: "Legit Edit", isPublic: "on", is_verified: "true", is_suspended: "false", review_count: "999", rating_sum: "4995", owner_id: "demo-crew-kpb" }, cookie: actors.ownerB }); const b = (await fs.doc("businesses/demo-ies").get()); rec("profile update ignores is_verified/review_count/owner_id", b.get("is_verified") === false && !(b.get("review_count") > 100) && b.get("owner_id") === "demo-owner-ies", `${r.ok}`); }
// Impossible calendar days are refused, real ones accepted
for (const [d, expect] of [["2026-13-45", false], ["2026-02-31", false], ["2026-00-10", false], ["2026-02-28", true]]) {
  const r = await call("createLead", { fields: { name: `Date probe ${d}`, nextFollowUp: d }, cookie: actors.ownerA }); rec(`createLead nextFollowUp ${d} ${expect ? "accepted" : "refused"}`, (r.ok === true) === expect, `ok=${r.ok}`);
}
// Hostile ids must not crash anything
for (const id of ["__proto__", "__x__", "a/b", "..", "x".repeat(300)]) {
  const r = await call("setLeadStatus", { args: [id, "lost"], cookie: actors.ownerA }); rec(`setLeadStatus with id ${JSON.stringify(id.slice(0, 12))} is refused cleanly`, r.ok !== true && r.status < 500, `${r.status} ok=${r.ok}`);
  const r2 = await call("revokeInvite", { args: [id], cookie: actors.ownerA }); rec(`revokeInvite with id ${JSON.stringify(id.slice(0, 12))} is refused cleanly`, r2.ok !== true && r2.status < 500, `${r2.status} ok=${r2.ok}`);
}
// Suspended accounts: a suspended user's existing session must stop working for actions
{ const crewUid = (await (await import("firebase-admin/auth")).getAuth(initializeApp({ projectId: "demo-buildflow" }, "fuzz-auth")).getUserByEmail("crew@kingstonpro.demo")).uid;
  await fs.doc(`users/${crewUid}`).update({ is_suspended: true });
  const r1 = await call("createTask", { args: ["demo-proj-1"], fields: { title: "from suspended crew" }, cookie: actors.crew });
  const r2 = await call("toggleSave", { args: ["demo-post-3"], cookie: actors.crew });
  const made = (await fs.collection(`${A}/tasks`).where("title", "==", "from suspended crew").get()).size;
  await fs.doc(`users/${crewUid}`).update({ is_suspended: false });
  rec("suspended crew member's session cannot create tasks", made === 0 && r1.ok !== true, `ok=${r1.ok} created=${made}`);
  rec("suspended user cannot save posts", r2.ok !== true, `ok=${r2.ok}`); }
const fails = results.filter((x) => !x.pass); console.log(`\n${results.length - fails.length}/${results.length} passed`); for (const f of fails) console.log("FAIL:", f.name, f.detail);
process.exit();
