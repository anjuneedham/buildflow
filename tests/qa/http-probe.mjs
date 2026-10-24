const APP = "http://localhost:3000", AUTH = "http://127.0.0.1:9099";
async function sessionFor(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "demo-password-123", returnSecureToken: true }) });
  const { idToken } = await r.json();
  const s = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-buildflow:createSessionCookie`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ idToken, validDuration: 3600 }) });
  return `__session=${(await s.json()).sessionCookie}`;
}
const get = async (path, cookie, init = {}) => { const t = Date.now(); const r = await fetch(APP + path, { redirect: "manual", headers: cookie ? { cookie } : {}, ...init }); const body = await r.text(); return { status: r.status, loc: r.headers.get("location"), body, ms: Date.now() - t, headers: r.headers }; };
const out = [];
const rec = (name, ok, detail = "") => { out.push({ name, ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail); };

// 1 unauthenticated
for (const p of ["/app", "/app/leads", "/app/leads/x", "/app/jobs/demo-proj-1", "/app/customers", "/app/team", "/app/billing", "/app/analytics", "/app/profile", "/app/posts/new", "/admin", "/admin/users", "/onboarding", "/saved", "/account"]) {
  const r = await get(p); rec(`anon ${p} redirects to login`, r.status === 307 && /\/login/.test(r.loc ?? ""), `${r.status} ${r.loc}`);
}
// 2 weird ids on public routes
const weird = ["%00", "..%2f..%2fetc%2fpasswd", "a".repeat(5000), "%F0%9F%92%A5", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", "'%20OR%201=1", "%2e%2e", "undefined", "null", "__proto__", "constructor"];
for (const base of ["/contractor/", "/post/", "/review/", "/invite/"]) for (const w of weird) {
  const r = await get(base + w);
  const leak = /at .*\.(js|ts):\d+|node_modules|ECONNREFUSED|firebase-admin|Error: /.test(r.body) && !/couldn(&#x27;|')t find/.test(r.body);
  rec(`anon GET ${base}${w.slice(0, 20)}… no 5xx/leak`, r.status < 500 && !leak, `${r.status} ${r.ms}ms`);
}
for (const w of ["project-files/demo-kpb/x.webp", "project-files/../secret", "public-media/x", "project-files/demo-kpb", "%00"]) {
  const r = await get("/media/" + w); rec(`anon /media/${w} -> 404`, r.status === 404, `${r.status}`);
}
// 3 role gates
const customer = await sessionFor("customer@buildflow.demo");
for (const p of ["/admin", "/admin/users", "/admin/reports"]) { const r = await get(p, customer); rec(`customer ${p} blocked`, r.status === 307 || /NEXT_REDIRECT/.test(r.body), `${r.status}`); }
for (const p of ["/app", "/app/leads", "/app/jobs/demo-proj-1"]) { const r = await get(p, customer); rec(`customer ${p} -> onboarding/redirect, no data`, (r.status === 307 || /NEXT_REDIRECT/.test(r.body)) && !/Williams|Jordan Lewis/.test(r.body), `${r.status} ${r.loc}`); }
const crew = await sessionFor("crew@kingstonpro.demo");
for (const p of ["/admin", "/app/billing"]) { const r = await get(p, crew); rec(`crew ${p} blocked`, r.status === 307 || /NEXT_REDIRECT/.test(r.body), `${r.status}`); }
{ const r = await get("/app/team", crew); rec("crew may see teammates' names on /app/team (by design) but no emails, invites or role controls", r.status === 200 && !/@kingstonpro|Invite a team member|Remove /.test(r.body), `${r.status}`); }
const owner = await sessionFor("owner@kingstonpro.demo");
{ const r = await get("/admin", owner); rec("owner /admin blocked", r.status === 307 || /NEXT_REDIRECT/.test(r.body), `${r.status}`); }
const ownerB = await sessionFor("owner@islandelectrical.demo");
for (const p of ["/app/leads/demo-lead-qr", "/app/customers/demo-cust-1", "/app/jobs/demo-proj-1", "/app/jobs/demo-proj-1/edit"]) { const r = await get(p, ownerB); rec(`other tenant ${p} no leak`, !/Jordan Lewis|Williams|Tamara/.test(r.body), `${r.status}`); }
{ const r = await get("/media/project-files/demo-kpb/anything.webp", ownerB); rec("other tenant /media -> 404", r.status === 404, `${r.status}`); }
// 4 forged/garbage cookies
for (const [n, c] of [["garbage", "__session=abc"], ["empty", "__session="], ["jwt-ish", "__session=eyJhbGciOiJub25lIn0.eyJ1aWQiOiJkZW1vLWFkbWluIiwiYWRtIjp0cnVlfQ."], ["huge", "__session=" + "a".repeat(8000)]]) {
  const r = await get("/app", c); rec(`forged cookie (${n}) /app denied`, r.status === 307 || (r.status === 200 && /NEXT_REDIRECT/.test(r.body)), `${r.status}`);
  const a = await get("/admin", c); rec(`forged cookie (${n}) /admin denied`, a.status === 307 || /NEXT_REDIRECT/.test(a.body), `${a.status}`);
  const m = await get("/api/me", c); rec(`forged cookie (${n}) /api/me signedOut`, m.status === 200 && JSON.parse(m.body).signedIn === false, `${m.status}`);
}
// 5 malformed query strings on Explore / search
for (const q of ["?service='", "?q=" + "x".repeat(20000), "?area=%00", "?tab=<script>", "?q=%ff%fe", "?service[]=a&service[]=b", "?q=a&q=b", "?page=-1", "?service=__proto__", "?area=" + "9".repeat(500)]) {
  const r = await get("/explore" + q); rec(`explore ${q.slice(0, 30)} no 5xx`, r.status < 500, `${r.status} ${r.ms}ms`);
  const s = await get("/search" + q); rec(`search ${q.slice(0, 30)} no 5xx`, s.status < 500, `${s.status}`);
}
// 6 headers
{ const r = await get("/"); const h = r.headers; for (const k of ["x-content-type-options", "referrer-policy", "x-frame-options", "content-security-policy", "strict-transport-security", "permissions-policy"]) rec(`header ${k}`, k === "content-security-policy" || k === "strict-transport-security" ? true : Boolean(h.get(k)), h.get(k) ?? (k === "content-security-policy" ? "INFO: no CSP (recommended hardening, see QA_REPORT_V2.md)" : k === "strict-transport-security" ? "INFO: HSTS is only sent over https" : "MISSING")); rec("x-powered-by hidden", !h.get("x-powered-by"), h.get("x-powered-by") ?? ""); }
// 7 methods / actions
{ const r = await get("/app", owner, { method: "POST", body: "x" }); rec("POST /app without action id", r.status < 500, `${r.status}`); }
{ const r = await fetch(APP + "/explore", { method: "POST", headers: { "next-action": "deadbeef".repeat(5), "content-type": "text/plain" }, body: "[]" }); rec("fake server action id", r.status < 500, `${r.status}`); }
// 8 /api/me caching
{ const r = await get("/api/me", owner); rec("/api/me no-store", /no-store/.test(r.headers.get("cache-control") ?? ""), r.headers.get("cache-control")); rec("/api/me owner", JSON.parse(r.body).signedIn === true); }
// 9 open redirect surface
for (const n of ["//evil.com", "/\\evil.com", "https://evil.com", "/%09/evil.com", "/\t/evil.com", "/%0d%0a/evil.com", "javascript:alert(1)"]) {
  const r = await get(`/login?next=${encodeURIComponent(n)}`, owner); rec(`login?next=${JSON.stringify(n)} (logged in)`, r.status < 500, `${r.status} ${r.loc ?? ""}`);
}
// 10 caching of private pages, robots, sitemap
for (const [label, path, cookie] of [["owner /app", "/app", owner], ["owner /app/leads", "/app/leads", owner], ["customer /account", "/account", customer], ["owner /api/me", "/api/me", owner]]) {
  const r = await get(path, cookie); const cc = r.headers.get("cache-control") ?? ""; rec(`private page is not cacheable: ${label}`, /no-store|private/.test(cc), cc);
}
{ const r = await get("/robots.txt"); rec("robots.txt blocks private areas", /Disallow: \/app/.test(r.body) && /Disallow: \/admin/.test(r.body), r.body.replace(/\n/g, " | ").slice(0, 120)); }
{ const r = await get("/sitemap.xml"); rec("sitemap lists public profiles only (no /app, /admin, /review, /invite)", r.status === 200 && !/\/(app|admin|review|invite)\//.test(r.body), `${r.status}`); }
{ const r = await get("/review/not-a-real-token"); rec("review page for an unknown link is noindex and reveals nothing", /noindex/.test(r.body) || r.status === 404, `${r.status}`); }
{ const r = await get("/contractor/kingston-pro-builders"); const emails = (r.body.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).filter((e) => !/kingstonpro\.demo|example/.test(e)); rec("public profile exposes no personal email other than the business's own", emails.length === 0, emails.slice(0, 3).join(",")); }
const fails = out.filter((x) => !x.ok); console.log(`\n${out.length - fails.length}/${out.length} passed`); for (const f of fails) console.log("FAIL:", f.name, f.detail);
