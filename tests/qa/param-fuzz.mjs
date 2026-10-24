// Every page must survive hostile query strings: repeated params (arrays), empty, huge, control characters.
// A crash shows up as an "unhandled_error" line in the server log (the HTTP status can still be 200 when streaming).
import { readFileSync } from "node:fs";
const APP = process.env.APP_URL ?? "http://localhost:3000", AUTH = "http://127.0.0.1:9099";
const LOG = process.env.SERVER_LOG;
if (!LOG) { console.log("Set SERVER_LOG to the app's stdout log file"); process.exit(2); }
async function sessionFor(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "demo-password-123", returnSecureToken: true }) });
  const { idToken } = await r.json();
  const s = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-buildflow:createSessionCookie`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ idToken, validDuration: 3600 }) });
  return `__session=${(await s.json()).sessionCookie}`;
}
const owner = await sessionFor("owner@kingstonpro.demo"), admin = await sessionFor("admin@buildflow.demo"), customer = await sessionFor("customer@buildflow.demo");
const errorCount = () => (readFileSync(LOG, "utf8").match(/"event":"unhandled_error"/g) ?? []).length;
const pages = [
  ["", "/", ["q"]], ["", "/explore", ["q", "service", "area", "tab"]], ["", "/search", ["q", "service", "area"]],
  ["", "/contractor/kingston-pro-builders", ["request", "post"]], ["", "/post/demo-post-1", ["published"]], ["", "/invite/x", ["error"]], ["", "/auth/action", ["mode", "oobCode"]], ["", "/login", ["next"]], ["", "/signup", ["type", "next"]],
  [customer, "/saved", ["tab"]], [customer, "/account", ["x"]],
  [owner, "/app", ["welcome"]], [owner, "/app/leads", ["status", "q"]], [owner, "/app/customers", ["q"]], [owner, "/app/jobs", ["status"]], [owner, "/app/jobs/new", ["leadId", "customerId"]], [owner, "/app/posts/new", ["projectId"]],
  [owner, "/app/customers/demo-cust-1", ["converted"]], [owner, "/onboarding", ["step"]], [owner, "/app/inbox", ["x"]], [owner, "/app/leads/new", ["customerId", "name"]],
  [admin, "/admin/users", ["q"]], [admin, "/admin/reports", ["status"]], [admin, "/admin/businesses", ["q"]],
];
const values = ["a&%K=b", "", "x".repeat(3000), "%00", "%ff%fe", "[]", "[object Object]", "-1", "NaN", "__proto__", "<script>alert(1)</script>", "../../etc/passwd"];
let bad = 0, total = 0;
for (const [cookie, path, params] of pages) for (const p of params) for (const v of ["__DUP__", ...values]) {
  const qs = v === "__DUP__" ? `${p}=one&${p}=two` : `${p}=${v.replace("%K", p)}`;
  const before = errorCount();
  const r = await fetch(`${APP}${path}?${qs}`, { headers: cookie ? { cookie } : {}, redirect: "manual" }).then(async (r) => { await r.text(); return r; }).catch((e) => ({ status: `fetch-error ${e.message}` }));
  await new Promise((r) => setTimeout(r, 15));
  total++;
  if (errorCount() > before || (typeof r.status === "number" && r.status >= 500)) { bad++; console.log("CRASH", `${path}?${qs.slice(0, 60)}`, r.status); }
}
console.log(`\n${total - bad}/${total} hostile query strings handled`); process.exit(bad ? 1 : 0);
