// The browser bundle must not contain server secrets or the Firestore/Admin SDK.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const root = new URL("../../.next/static", import.meta.url).pathname;
const files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(js|css|map)$/.test(p) && files.push(p); } })(root);
const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const secrets = [...env.matchAll(/^(?!NEXT_PUBLIC_)([A-Z_]*(?:KEY|SECRET|TOKEN|PRIVATE|PASSWORD)[A-Z_]*)=(.+)$/gm)].map((m) => m[2].trim()).filter((v) => v.length > 8);
const patterns = [["private key block", /-----BEGIN (?:RSA )?PRIVATE KEY-----/], ["service account", /"type":\s*"service_account"/], ["firebase-admin", /firebase-admin/], ["Firestore client SDK endpoint", /firestore\.googleapis\.com\/google\.firestore/], ["Stripe secret", /sk_(live|test)_[A-Za-z0-9]{10,}/]];
let bad = 0; let total = 0;
for (const f of files) { const t = readFileSync(f, "utf8"); total += t.length;
  for (const [n, re] of patterns) if (re.test(t)) { bad++; console.log("FAIL", n, f.replace(root, "")); }
  for (const v of secrets) if (t.includes(v)) { bad++; console.log("FAIL secret value from .env.local in", f.replace(root, "")); } }
console.log(`${bad ? "FAIL" : "PASS"} scanned ${files.length} client files (${Math.round(total / 1024)} KB), ${secrets.length} server secret values checked`);
process.exit(bad ? 1 : 0);
