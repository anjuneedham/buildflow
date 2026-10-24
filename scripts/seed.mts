/**
 * Seeds Firestore/Auth.
 *   npm run seed                 reference data + DEMO data (emulators only)
 *   npm run seed -- --reference  reference data only (services, locations, plans); safe for production
 *
 * DEMO data is fictional and flagged is_demo. All demo accounts use the
 * password: demo-password-123
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const referenceOnly = process.argv.includes("--reference");
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
if (!referenceOnly && (!usingEmulator || appEnv !== "local")) {
  console.error("Refusing to load DEMO data outside the emulators. Use --reference for production.");
  process.exit(1);
}
const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-buildflow",
  ...(key ? { credential: cert(JSON.parse(key.trim().startsWith("{") ? key : Buffer.from(key, "base64").toString())) } : {}),
});
const db = getFirestore();
const auth = getAuth();

const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const day = 864e5;
// Calendar dates in Jamaica time, like the app (src/lib/utils.ts dateInDays).
const date = (days: number) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(Date.parse(today + "T00:00:00Z") + days * day).toISOString().slice(0, 10);
};

const SERVICES = [
  ["general-contractor", "General Contractor", "General Contractors"], ["electrician", "Electrician", "Electricians"],
  ["plumber", "Plumber", "Plumbers"], ["mason", "Mason", "Masons"], ["tiler", "Tiler", "Tilers"], ["carpenter", "Carpenter", "Carpenters"],
  ["painter", "Painter", "Painters"], ["roofer", "Roofer", "Roofers"], ["landscaper", "Landscaper", "Landscapers"],
  ["hvac", "HVAC Technician", "HVAC Professionals"], ["renovation", "Home Renovation", "Home Renovation Contractors"],
  ["construction-company", "Construction Company", "Construction Companies"], ["welder", "Welder / Steel Work", "Welders"], ["other", "Other Trade", "Other Trades"],
] as const;
const PARISHES = ["Kingston", "St Andrew", "St Catherine", "Clarendon", "Manchester", "St Elizabeth", "Westmoreland", "Hanover", "St James", "Trelawny", "St Ann", "St Mary", "Portland", "St Thomas"];
// Monthly insight counters (businesses/{id}/stats/{yyyy-mm}), in Jamaica time like the app.
const jmDate = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
async function stat(biz: FirebaseFirestore.DocumentReference, type: string, isoAt: string, n = 1) {
  const d = jmDate(new Date(isoAt));
  await biz.collection("stats").doc(d.slice(0, 7)).set({ month: d.slice(0, 7), totals: { [type]: FieldValue.increment(n) }, days: { [d.slice(8, 10)]: { [type]: FieldValue.increment(n) } } }, { merge: true });
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

async function reference() {
  const b = db.batch();
  SERVICES.forEach(([id, name, plural], i) => b.set(db.collection("services").doc(id), { slug: id, name, plural_name: plural, is_active: true, sort_order: id === "other" ? 999 : (i + 1) * 10 }));
  // Country → region → city. Jamaica is just the first country, not a special case.
  b.set(db.collection("locations").doc("jm"), { country_code: "JM", level: "country", name: "Jamaica", slug: "jamaica", parent_id: null, region_label: "Parish" });
  PARISHES.forEach((name) => b.set(db.collection("locations").doc(`jm-${slug(name)}`), { country_code: "JM", level: "region", name, slug: slug(name), parent_id: "jm" }));
  b.set(db.collection("plans").doc("basic"), {
    name: "BuildFlow Basic", description: "Everything a small contractor needs to win and run jobs.", currency: "USD", billing_interval: "month",
    base_price_cents: 5000, included_seats: 1, additional_seat_price_cents: 2000, max_seats: null, is_active: true, is_public: true, sort_order: 10,
    stripe_price_id: null, stripe_seat_price_id: null,
    features: ["1 business account, 1 user included", "CRM & lead pipeline", "Customer management", "Project & task management", "Public contractor profile", "Project/work posts", "Dashboard & basic analytics"],
  }, { merge: true });
  await b.commit();
  console.log("✓ reference data");
}

const svc = (id: string) => { const s = SERVICES.find((x) => x[0] === id)!; return { id, name: s[1], slug: id }; };
const region = (name: string) => ({ id: `jm-${slug(name)}`, name });

async function user(uid: string, email: string, fullName: string, extra: Record<string, unknown> = {}) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email, password: "demo-password-123", displayName: fullName, emailVerified: true });
  await db.collection("users").doc(uid).set({
    full_name: fullName, email, avatar_url: null, account_type: "customer", is_platform_admin: false, is_suspended: false,
    business_id: null, business_role: null, created_at: iso(30 * day), ...extra,
  });
}

type Biz = { id: string; owner: string; ownerName: string; name: string; tagline: string; description: string; phone: string; email: string;
  city: string; parish: string; area: string; primary: string; services: string[]; years: number; verified: boolean; cover: string; social?: Record<string, string> };

async function business(b: Biz) {
  const services = b.services.map(svc);
  const ref = db.collection("businesses").doc(b.id);
  const slugValue = slug(b.name.replace("&", ""));
  await ref.set({
    owner_id: b.owner, name: b.name, name_lower: b.name.toLowerCase(), slug: slugValue, tagline: b.tagline, description: b.description,
    phone: b.phone, email: b.email, website: null, social_links: b.social ?? {}, years_in_business: b.years, logo_url: null, cover_url: b.cover,
    country_code: "JM", region_id: region(b.parish).id, region: region(b.parish), city: b.city, service_area: b.area,
    primary_service_id: b.primary, primary_service: svc(b.primary), services, service_ids: services.map((s) => s.id),
    is_public: true, is_verified: b.verified, is_suspended: false, is_demo: true, onboarding_step: 7, onboarding_completed_at: iso(20 * day),
    follower_count: 0, post_count: 0, completed_project_count: 0, created_at: iso(25 * day), updated_at: iso(1 * day),
  });
  await db.collection("slugs").doc(slugValue).set({ business_id: b.id });
  await ref.collection("members").doc(b.owner).set({ role: "owner", full_name: b.ownerName, avatar_url: null, created_at: iso(25 * day) });
  await db.collection("users").doc(b.owner).set({ account_type: "contractor", business_id: b.id, business_role: "owner" }, { merge: true });
  await db.collection("subscriptions").doc(b.id).set({
    business_id: b.id, plan_id: "basic", status: "trialing", seats: 1, trial_ends_at: iso(-10 * day), current_period_end: null,
    cancel_at_period_end: false, stripe_customer_id: null, stripe_subscription_id: null, created_at: iso(25 * day),
  });
  return { ref, slug: slugValue };
}

async function demo() {
  await user("demo-owner-kpb", "owner@kingstonpro.demo", "Marcus Reid (Demo)");
  await user("demo-owner-ies", "owner@islandelectrical.demo", "Andrea Campbell (Demo)");
  await user("demo-owner-ptr", "owner@primetiling.demo", "Devon Thompson (Demo)");
  await user("demo-owner-crs", "owner@caribbeanroofing.demo", "Shanice Brown (Demo)");
  await user("demo-crew-kpb", "crew@kingstonpro.demo", "Ricardo Gayle (Demo)");
  await user("demo-customer", "customer@buildflow.demo", "Jordan Lewis (Demo)");
  await user("demo-admin", "admin@buildflow.demo", "Platform Admin (Demo)", { is_platform_admin: true });

  const U = "https://images.unsplash.com/";
  const kpb = await business({ id: "demo-kpb", owner: "demo-owner-kpb", ownerName: "Marcus Reid (Demo)", name: "Kingston Pro Builders",
    tagline: "Residential builds & renovations done right, on time.",
    description: "DEMO BUSINESS. Kingston Pro Builders is a fictional general contractor used to demonstrate BuildFlow. We handle new homes, extensions, and full renovations across the Corporate Area.",
    phone: "+1 876 555 0101", email: "owner@kingstonpro.demo", city: "Kingston", parish: "Kingston", area: "Kingston, St Andrew & St Catherine",
    primary: "general-contractor", services: ["general-contractor", "renovation", "mason", "carpenter"], years: 12, verified: true,
    cover: `${U}photo-1503387762-592deb58ef4e?w=1600&q=70`, social: { instagram: "https://instagram.com/example" } });
  await business({ id: "demo-ies", owner: "demo-owner-ies", ownerName: "Andrea Campbell (Demo)", name: "Island Electrical Services",
    tagline: "Licensed electrical installs, rewiring and solar-ready upgrades.",
    description: "DEMO BUSINESS. Island Electrical Services is a fictional electrician used to demonstrate BuildFlow.",
    phone: "+1 876 555 0102", email: "owner@islandelectrical.demo", city: "Half Way Tree", parish: "St Andrew", area: "St Andrew & Kingston",
    primary: "electrician", services: ["electrician"], years: 8, verified: false, cover: `${U}photo-1621905251189-08b45d6a269e?w=1600&q=70` });
  await business({ id: "demo-ptr", owner: "demo-owner-ptr", ownerName: "Devon Thompson (Demo)", name: "Prime Tiling & Renovation",
    tagline: "Floors, bathrooms and kitchens with a clean finish.",
    description: "DEMO BUSINESS. Prime Tiling & Renovation is a fictional tiling company used to demonstrate BuildFlow.",
    phone: "+1 876 555 0103", email: "owner@primetiling.demo", city: "May Pen", parish: "Clarendon", area: "Clarendon, Manchester & St Catherine",
    primary: "tiler", services: ["tiler", "renovation"], years: 6, verified: false, cover: `${U}photo-1581858726788-75bc0f6a952d?w=1600&q=70` });
  await business({ id: "demo-crs", owner: "demo-owner-crs", ownerName: "Shanice Brown (Demo)", name: "Caribbean Roofing Solutions",
    tagline: "Hurricane-ready roofing, repairs and waterproofing.",
    description: "DEMO BUSINESS. Caribbean Roofing Solutions is a fictional roofer used to demonstrate BuildFlow.",
    phone: "+1 876 555 0104", email: "owner@caribbeanroofing.demo", city: "Montego Bay", parish: "St James", area: "Island-wide",
    primary: "roofer", services: ["roofer", "carpenter"], years: 15, verified: true, cover: `${U}photo-1632759145351-1d592919f522?w=1600&q=70` });

  // Team member
  await kpb.ref.collection("members").doc("demo-crew-kpb").set({ role: "field", full_name: "Ricardo Gayle (Demo)", avatar_url: null, created_at: iso(10 * day) });
  await db.collection("users").doc("demo-crew-kpb").set({ account_type: "contractor", business_id: "demo-kpb", business_role: "field" }, { merge: true });
  await db.collection("subscriptions").doc("demo-kpb").update({ seats: 2 });

  // CRM for Kingston Pro Builders: every lead belongs to a customer, jobs
  // know their responsible person and next task, and the history (activity)
  // links each entry to its lead, customer and job.
  const digits = (p: string | null) => { const d = (p ?? "").replace(/\D/g, ""); return d.length < 7 ? null : d.length === 10 && d.startsWith("876") ? "1" + d : d; };
  const act = (e: Record<string, unknown>) => kpb.ref.collection("activity").add({
    actor_id: "demo-owner-kpb", actor_name: "Marcus Reid (Demo)", body: null, media: [], customer_id: null, lead_id: null, project_id: null, ...e,
  });
  const c = kpb.ref.collection("customers");
  const customers = [
    ["demo-cust-1", "Tamara Williams (Demo)", "+1 876 555 1001", "tamara@example.com", "12 Hope Road", "Kingston", "Prefers WhatsApp in the evenings.", "active"],
    ["demo-cust-2", "Blue Mountain Cafe Ltd (Demo)", "+1 876 555 1002", "ops@example.com", "4 Lady Musgrave Road", "Kingston", "Commercial client.", "active"],
    ["demo-cust-3", "Paul Henry (Demo)", "+1 876 555 1003", null, "Portmore", "St Catherine", null, "past"],
  ] as const;
  for (const [id, name, phone, email, address, city, notes, status] of customers) {
    await c.doc(id).set({ name, name_lower: name.toLowerCase(), phone, phone_digits: digits(phone), email, email_lower: email?.toLowerCase() ?? null, address, city, notes, status, source_lead_id: null, created_by: "demo-owner-kpb", created_at: iso(40 * day), updated_at: iso(20 * day) });
    await act({ entity_type: "customer", entity_id: id, customer_id: id, action: "created", summary: `Added customer ${name}`, created_at: iso(40 * day) });
  }
  // [name, description, service, status, source, value, responsible, follow-up in days | null]
  const leads = [
    ["Garfield Morris (Demo)", "Perimeter wall, about 60 ft.", "mason", "contacted", "referral", 650000, "demo-owner-kpb", 0],
    ["Nadine Scott (Demo)", "Kitchen remodel with new cabinets.", "renovation", "quote_sent", "social_media", 1800000, "demo-owner-kpb", -2],
    ["Ocean View Apartments (Demo)", "Repaint and repair 12 units.", "painter", "quote_sent", "website", 3100000, null, 3],
    ["Dwayne Clarke (Demo)", "Garage conversion.", null, "lost", "phone", 900000, null, null],
  ] as const;
  for (const [i, [name, description, service, status, source, value, assigned, follow]] of leads.entries()) {
    const phone = `+1 876 555 20${i}0`;
    const cust = c.doc(`demo-cust-l${i}`);
    await cust.set({ name, name_lower: name.toLowerCase(), phone, phone_digits: digits(phone), email: null, email_lower: null, address: "Kingston", city: null, notes: null, status: "prospect", source_lead_id: null, created_by: "demo-owner-kpb", created_at: iso((i + 1) * day), updated_at: iso((i + 1) * day) });
    const lead = await kpb.ref.collection("leads").add({
      name, name_lower: name.toLowerCase(), phone, phone_digits: digits(phone), email: null, location: "Kingston", description, service_id: service, service_name: service ? svc(service).name : null,
      status, source, estimated_value: value, assigned_to: assigned, customer_id: cust.id, customer_name: name, project_id: null, quote_request_id: null, created_by: "demo-owner-kpb",
      next_follow_up: follow === null ? null : date(follow), lost_reason: status === "lost" ? "Too expensive" : null,
      status_changed_at: iso(i * day), created_at: iso((i + 1) * day), updated_at: iso(i * day),
    });
    await act({ entity_type: "lead", entity_id: lead.id, lead_id: lead.id, customer_id: cust.id, action: "created", summary: `Added lead ${name}`, created_at: iso((i + 1) * day) });
    if (status !== "lost") await act({ entity_type: "lead", entity_id: lead.id, lead_id: lead.id, customer_id: cust.id, action: "note", summary: "Added a note", body: "Called, they want a site visit before a price.", created_at: iso(i * day + 3600e3) });
    await stat(kpb.ref, "lead_created", iso((i + 1) * day));
  }
  const projects = [
    ["demo-proj-1", "Williams Home Extension (Demo)", "demo-cust-1", "Tamara Williams (Demo)", "in_progress", -30, 45, 5500000, ["demo-owner-kpb", "demo-crew-kpb"]],
    ["demo-proj-2", "Cafe Fit-out (Demo)", "demo-cust-2", "Blue Mountain Cafe Ltd (Demo)", "upcoming", 3, 40, 2400000, ["demo-owner-kpb"]],
    ["demo-proj-3", "Henry Patio & Driveway (Demo)", "demo-cust-3", "Paul Henry (Demo)", "completed", -90, -40, 1200000, ["demo-owner-kpb"]],
  ] as const;
  for (const [id, name, cid, cname, status, start, end, budget, members] of projects) {
    await kpb.ref.collection("projects").doc(id).set({
      name, customer_id: cid, customer_name: cname, lead_id: null, description: null, location: "Kingston", start_date: date(start), expected_end_date: date(end),
      status, budget, completed_at: status === "completed" ? iso(40 * day) : null, member_ids: members, responsible_id: "demo-owner-kpb",
      task_total: 0, task_done: 0, next_task: null, last_update_at: null, created_by: "demo-owner-kpb", created_at: iso(35 * day), updated_at: iso(2 * day),
    });
    await act({ entity_type: "project", entity_id: id, project_id: id, customer_id: cid, action: "created", summary: `Created job ${name}`, created_at: iso(35 * day) });
  }
  const tasks = [
    ["demo-proj-1", "Pour foundation", "high", "done", -20, "demo-crew-kpb"], ["demo-proj-1", "Block work to belt course", "high", "in_progress", -1, "demo-crew-kpb"],
    ["demo-proj-1", "Order roofing materials", "medium", "todo", 2, "demo-owner-kpb"], ["demo-proj-1", "Confirm tile selection with client", "low", "todo", 12, null],
    ["demo-proj-2", "Site measurement", "medium", "todo", 1, null],
  ] as const;
  for (const [pid, title, priority, status, due, assignee] of tasks) {
    await kpb.ref.collection("tasks").add({ project_id: pid, project_name: projects.find((p) => p[0] === pid)![1], title, description: null, assigned_to: assignee, due_date: date(due), priority, status, completed_at: status === "done" ? iso(20 * day) : null, created_by: "demo-owner-kpb", created_at: iso(25 * day), updated_at: iso(2 * day) });
    await kpb.ref.collection("projects").doc(pid).update({ task_total: FieldValue.increment(1), ...(status === "done" ? { task_done: FieldValue.increment(1) } : {}) });
  }
  // Next task = open task due soonest (same rule as refreshNextTask in the app).
  for (const [pid] of projects) {
    const open = tasks.filter((x) => x[0] === pid && x[3] !== "done").sort((a, b) => a[4] - b[4]);
    const n = open[0];
    if (!n) continue;
    const snap = await kpb.ref.collection("tasks").where("project_id", "==", pid).where("title", "==", n[1]).limit(1).get();
    await kpb.ref.collection("projects").doc(pid).update({ next_task: { id: snap.docs[0].id, title: n[1], due_date: date(n[4]), assigned_to: n[5] } });
  }
  await kpb.ref.update({ completed_project_count: 1 });
  await act({ entity_type: "project", entity_id: "demo-proj-1", project_id: "demo-proj-1", customer_id: "demo-cust-1", action: "note", summary: "Added a note", body: "Client approved the revised window layout.", created_at: iso(3 * day) });
  await act({ entity_type: "project", entity_id: "demo-proj-1", project_id: "demo-proj-1", customer_id: "demo-cust-1", action: "status_changed", summary: "Job is now In progress", created_at: iso(2 * day) });
  await act({ entity_type: "project", entity_id: "demo-proj-3", project_id: "demo-proj-3", customer_id: "demo-cust-3", action: "completed", summary: "Job completed", created_at: iso(40 * day) });

  // Other businesses get a little private data so isolation is testable.
  for (const [bid, name] of [["demo-ies", "Liguanea Plaza Mgmt (Demo)"], ["demo-ptr", "Sandra Bailey (Demo)"], ["demo-crs", "Hillside Villas (Demo)"]]) {
    await db.collection("businesses").doc(bid).collection("customers").add({ name, name_lower: name.toLowerCase(), phone: "+1 876 555 3000", email: null, address: null, city: null, notes: null, status: "active", source_lead_id: null, created_by: null, created_at: iso(5 * day), updated_at: iso(5 * day) });
    await db.collection("businesses").doc(bid).collection("leads").add({ name: `Enquiry for ${name}`, name_lower: "enquiry", phone: "+1 876 555 4000", email: null, location: null, description: null, service_id: null, service_name: null, status: "new", source: "phone", estimated_value: 300000, assigned_to: null, customer_id: null, quote_request_id: null, created_by: null, status_changed_at: iso(day), created_at: iso(day), updated_at: iso(day) });
  }

  // Trust signals, earned the same way the app earns them: one verified
  // review per completed job, and reply times from moving new enquiries on.
  const reviews = [
    ["demo-kpb", "demo-proj-3", 5, "Marcus and the team finished the driveway and patio on schedule and kept the site clean every evening. Would hire again.", "Paul Henry (Demo)", "General Contractor", -40, "Thank you Paul, enjoy the new patio!"],
    ["demo-kpb", "demo-hist-1", 5, "Kitchen extension came out exactly like the drawings. Good communication all the way through.", "Keisha Morgan (Demo)", "Home Renovation", -120, null],
    ["demo-kpb", "demo-hist-2", 4, "Solid block work and fair price. Finished a week later than planned because of rain.", "Andre Clarke (Demo)", "Mason", -200, null],
    ["demo-crs", "demo-crs-hist-1", 5, "Roof held up perfectly through the last storm. Very professional.", "Natalie Wright (Demo)", "Roofer", -60, null],
  ] as const;
  for (const [bid, pid, rating, body, reviewer, serviceName, completed, reply] of reviews) {
    const ref = db.collection("businesses").doc(bid);
    const parts = reviewer.replace(/\(.*?\)/g, "").trim().split(/\s+/);
    await ref.collection("reviews").doc(pid).set({
      project_id: pid, rating, body, reviewer_name: `${parts[0]} ${parts[parts.length - 1][0]}.`, service_name: serviceName, job_completed_on: date(completed),
      status: "published", reply: reply ? { body: reply, at: iso((-completed - 2) * day) } : null, created_at: iso((-completed - 1) * day),
    });
    // Older finished jobs, so every review belongs to a real completed job.
    if (pid !== "demo-proj-3") await ref.collection("projects").doc(pid).set({
      name: `${reviewer.split(" ")[1]} ${serviceName} job (Demo)`, customer_id: null, customer_name: reviewer, lead_id: null, description: null, location: null,
      start_date: date(completed - 30), expected_end_date: date(completed), status: "completed", budget: null, completed_at: iso(-completed * day),
      member_ids: [ref.id === "demo-kpb" ? "demo-owner-kpb" : "demo-owner-crs"], responsible_id: ref.id === "demo-kpb" ? "demo-owner-kpb" : "demo-owner-crs",
      task_total: 0, task_done: 0, next_task: null, last_update_at: null, review_token: null, created_by: null, created_at: iso((-completed + 30) * day), updated_at: iso(-completed * day),
    });
    await ref.update({ review_count: FieldValue.increment(1), rating_sum: FieldValue.increment(rating), completed_project_count: FieldValue.increment(pid === "demo-proj-3" ? 0 : 1) });
    await stat(ref, "review", iso((-completed - 1) * day));
  }
  await kpb.ref.update({ response: { count: 6, total_minutes: 6 * 95 } });
  await db.collection("businesses").doc("demo-crs").update({ response: { count: 3, total_minutes: 3 * 600 } });

  // Public posts
  const posts = [
    ["demo-post-1", "demo-kpb", "completed_project", "Stamped concrete driveway and covered patio finished in Portmore. Six weeks start to finish. (Demo post)", "demo-proj-3", "general-contractor", "Portmore, St Catherine", 3, [[`${U}photo-1600585154340-be6161a56a0c?w=1200&q=70`, null]]],
    ["demo-post-2", "demo-kpb", "work_in_progress", "Foundation poured on the Hope Road extension. Block work starts Monday. (Demo post)", "demo-proj-1", "general-contractor", "Kingston", 1, [[`${U}photo-1541888946425-d81bb19240f5?w=1200&q=70`, null]]],
    ["demo-post-3", "demo-ies", "service_showcase", "Full 200A panel upgrade with surge protection. Ready for solar. (Demo post)", null, "electrician", "Half Way Tree, St Andrew", 2, [[`${U}photo-1621905252507-b35492cc74b4?w=1200&q=70`, null]]],
    ["demo-post-4", "demo-ptr", "before_after", "Bathroom transformation: old ceramic out, large-format porcelain in. (Demo post)", null, "tiler", "May Pen, Clarendon", 5, [[`${U}photo-1584622650111-993a426fbf0a?w=1200&q=70`, "before"], [`${U}photo-1620626011761-996317b8d101?w=1200&q=70`, "after"]]],
    ["demo-post-5", "demo-crs", "completed_project", "New hip roof with hurricane straps, Montego Bay. (Demo post)", null, "roofer", "Montego Bay, St James", 0.25, [[`${U}photo-1632759145351-1d592919f522?w=1200&q=70`, null]]],
  ] as const;
  for (const [id, bid, type, caption, projectId, service, loc, daysAgo, media] of posts) {
    const b = (await db.collection("businesses").doc(bid).get()).data()!;
    await db.collection("posts").doc(id).set({
      business_id: bid, author_id: b.owner_id, type, caption, project_id: projectId, service_id: service, service: { name: svc(service).name, slug: service },
      location_text: loc, media: media.map(([url, label], i) => ({ id: `${id}-m${i}`, url, label, position: i })), is_public: true, is_hidden: false, visible: true,
      region_id: b.region_id,
      business: { id: bid, name: b.name, slug: b.slug, logo_url: null, is_verified: b.is_verified, city: b.city, region_id: b.region_id,
        rating: b.review_count ? { avg: Math.round((b.rating_sum / b.review_count) * 10) / 10, count: b.review_count } : null },
      // A post linked to a finished job is proof the work happened.
      verified_job: projectId === "demo-proj-3", completed_on: projectId === "demo-proj-3" ? date(-40) : null,
      like_count: 0, comment_count: 0, save_count: 0, created_at: iso(daysAgo * day), updated_at: iso(daysAgo * day),
    });
    await db.collection("businesses").doc(bid).update({ post_count: FieldValue.increment(1) });
  }

  // Demo customer: a private shortlist (saved work and saved contractors).
  const me = db.collection("users").doc("demo-customer");
  for (const bid of ["demo-kpb", "demo-crs"]) await me.collection("following").doc(bid).set({ created_at: iso(2 * day) });
  await me.collection("saves").doc("demo-post-1").set({ created_at: iso(day), business_id: "demo-kpb" });
  await db.collection("posts").doc("demo-post-1").update({ save_count: 1 });

  // A quote request → lead, exactly as the app creates them.
  const qr = kpb.ref.collection("quote_requests").doc("demo-qr-1");
  const lead = kpb.ref.collection("leads").doc("demo-lead-qr");
  await qr.set({ requester_id: "demo-customer", name: "Jordan Lewis (Demo)", email: "customer@buildflow.demo", phone: null, service_id: "renovation", location: "Liguanea", description: "Looking to renovate a small bathroom and add a walk-in shower.", budget_range: "500k – 1M", timeline: "1 – 3 months", kind: "quote", lead_id: lead.id, created_at: iso(6 * 3600e3) });
  await lead.set({ name: "Jordan Lewis (Demo)", name_lower: "jordan lewis (demo)", phone: null, email: "customer@buildflow.demo", location: "Liguanea", description: "Looking to renovate a small bathroom and add a walk-in shower.\nBudget: 500k – 1M\nTimeline: 1 – 3 months", service_id: "renovation", service_name: "Home Renovation", status: "new", source: "buildflow", estimated_value: null, assigned_to: null, customer_id: "demo-cust-qr", customer_name: "Jordan Lewis (Demo)", project_id: null, next_follow_up: null, phone_digits: null, quote_request_id: qr.id, quote: { budget_range: "500k – 1M", timeline: "1 – 3 months" }, created_by: null, status_changed_at: iso(6 * 3600e3), created_at: iso(6 * 3600e3), updated_at: iso(6 * 3600e3) });
  await me.collection("quote_requests").doc(qr.id).set({ business_id: "demo-kpb", business_name: "Kingston Pro Builders", business_slug: kpb.slug, kind: "quote", description: "Looking to renovate a small bathroom and add a walk-in shower.", created_at: iso(6 * 3600e3) });
  await stat(kpb.ref, "quote_request", iso(6 * 3600e3));
  await kpb.ref.collection("customers").doc("demo-cust-qr").set({ name: "Jordan Lewis (Demo)", name_lower: "jordan lewis (demo)", phone: null, phone_digits: null, email: "customer@buildflow.demo", email_lower: "customer@buildflow.demo", address: "Liguanea", city: null, notes: null, status: "prospect", source_lead_id: null, created_by: null, created_at: iso(6 * 3600e3), updated_at: iso(6 * 3600e3) });
  await kpb.ref.collection("activity").add({ actor_id: "demo-customer", actor_name: "Jordan Lewis (Demo)", entity_type: "lead", entity_id: lead.id, lead_id: lead.id, customer_id: "demo-cust-qr", project_id: null, action: "created", summary: "Quote request received from Jordan Lewis (Demo)", body: null, media: [], created_at: iso(6 * 3600e3) });
  await db.collection("users").doc("demo-owner-kpb").collection("notifications").add({ business_id: "demo-kpb", type: "quote_request", title: "New quote request from Jordan Lewis (Demo)", body: "Looking to renovate a small bathroom…", link: `/app/leads/${lead.id}`, read_at: null, created_at: iso(6 * 3600e3) });
  for (let h = 1; h <= 48; h++) await stat(kpb.ref, "profile_view", iso(h * 3600e3));
  console.log("✓ demo data (password for all demo accounts: demo-password-123)");
}

await reference();
if (!referenceOnly) await demo();
process.exit(0);
