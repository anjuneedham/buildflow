// Upload abuse: oversize, decompression bombs, fake and damaged files, many files, odd names, failures mid-way.
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE, check, finish, fs, newPage, login, run, sleep, until, phone, serverRssMb } from "./lib.mjs";

const dir = join(tmpdir(), `qa-uploads-${run}`); mkdirSync(dir, { recursive: true });
const F = (n) => join(dir, n);
const solid = (w, h, fmt = "png") => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } } })[fmt]();
writeFileSync(F("ok.jpg"), await sharp({ create: { width: 1600, height: 1200, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } } }).jpeg().toBuffer());
writeFileSync(F("noise-12mb.png"), await sharp(Buffer.alloc(3000 * 1400 * 3).map(() => Math.floor(Math.random() * 256)), { raw: { width: 3000, height: 1400, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer());
writeFileSync(F("noise-26mb.png"), await sharp(Buffer.alloc(4600 * 1950 * 3).map(() => Math.floor(Math.random() * 256)), { raw: { width: 4600, height: 1950, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer());
writeFileSync(F("big.pdf"), Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024, 32)]));
writeFileSync(F("bomb-16k.png"), await solid(16000, 16000).toBuffer());
writeFileSync(F("bomb-20k.png"), await solid(20000, 20000).toBuffer().catch(() => Buffer.from("")));
writeFileSync(F("tall.png"), await solid(10, 20000).toBuffer());
writeFileSync(F("one-px.png"), await solid(1, 1).toBuffer());
const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#456" } }).jpeg().toBuffer();
writeFileSync(F("truncated.jpg"), jpg.subarray(0, Math.floor(jpg.length / 3)));
writeFileSync(F("text-as.jpg"), "this is not an image at all, just text pretending\n".repeat(20));
writeFileSync(F("polyglot.jpg"), Buffer.concat([jpg, Buffer.from("<script>alert(1)</script>")]));
writeFileSync(F("x.svg"), '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');
writeFileSync(F("x.gif"), Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
writeFileSync(F("rotated.jpg"), await sharp({ create: { width: 800, height: 200, channels: 3, background: "#a33" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer());
writeFileSync(F("cmyk.jpg"), await sharp({ create: { width: 400, height: 300, channels: 3, background: "#3a3" } }).toColourspace("cmyk").jpeg().toBuffer());
writeFileSync(F("gps.jpg"), await sharp({ create: { width: 400, height: 300, channels: 3, background: "#33a" } }).withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "17/1 59/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "76/1 47/1 0/1" } }).jpeg().toBuffer());
writeFileSync(F("fake.pdf"), "%PDF-1.4\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\n");
writeFileSync(F("zero.jpg"), "");
writeFileSync(F("a very long file name ".repeat(10) + ".jpg"), jpg);
writeFileSync(F("evil';--<img src=x>.jpg"), jpg);
for (let i = 0; i < 12; i++) writeFileSync(F(`multi-${i}.jpg`), jpg);
// Realistic phone photos: a 12 MP camera JPEG is 3-6 MB; people attach several at once.
for (let i = 0; i < 4; i++) writeFileSync(F(`phone-${i}.jpg`), await sharp({ create: { width: 4000, height: 3000, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 70 } } }).jpeg({ quality: 92 }).toBuffer());

const { page: p } = await newPage(phone, "uploads");
await login(p, "owner@kingstonpro.demo");
const mediaCount = async () => (await fs.collection("businesses/demo-kpb/media").where("project_id", "==", "demo-proj-1").get()).size;

let maxBody = 0;
await p.route("**/*", async (route) => { const r = route.request(); if (r.method() === "POST" && r.headers()["next-action"]) maxBody = Math.max(maxBody, r.postDataBuffer()?.length ?? 0); await route.continue(); });
async function uploadPhotos(files, { note = "" } = {}) {
  maxBody = 0;
  await p.goto(`${BASE}/app/jobs/demo-proj-1`); await p.waitForLoadState("networkidle");
  const before = await mediaCount();
  if (note) await p.fill("textarea[name=body]", note);
  await p.setInputFiles("input[name=photos]", files);
  const t0 = Date.now(); let peak = serverRssMb(); let done = false;
  const sampler = (async () => { while (!done) { peak = Math.max(peak, serverRssMb()); await sleep(150); } })();
  await p.getByRole("button", { name: "Post update" }).click();
  // Done when a photo lands in the gallery, an error shows, or 60 s pass.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if ((await mediaCount()) > before || (await p.locator("form [role=alert]").allTextContents()).join("").trim()) break;
    await sleep(200);
  }
  done = true; await sampler; await sleep(500);
  const alert = (await p.locator("form [role=alert]").allTextContents()).join(" ").trim();
  return { added: (await mediaCount()) - before, alert, ms: Date.now() - t0, peak, body: maxBody };
}

await check("valid JPEG uploads, shows in gallery", async () => { const r = await uploadPhotos(F("ok.jpg")); return r.added === 1 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("four realistic 12-megapixel phone photos (about 20 MB in total) upload in one update, and the request stays under Vercel's 4.5 MB body limit", async () => { const r = await uploadPhotos(["phone-0.jpg", "phone-1.jpg", "phone-2.jpg", "phone-3.jpg"].map(F)); return r.added === 4 && r.body > 0 && r.body < 4.5 * 1024 * 1024 ? { status: "PASS", detail: `${r.ms}ms, request ${(r.body / 1048576).toFixed(2)} MB (from about 20 MB of originals)` } : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("a 12 MB photo is shrunk in the browser and accepted, under the 4.5 MB request limit", async () => { const r = await uploadPhotos(F("noise-12mb.png")); return r.added === 1 && r.body < 4.5 * 1024 * 1024 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("a 26 MB photo is refused with a clear size message before it is sent (nothing stored)", async () => { const r = await uploadPhotos(F("noise-26mb.png")); return r.added === 0 && /under 25 MB|lower quality/i.test(r.alert) ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("a 5 MB PDF is refused with a clear message (host request limit) and nothing is stored", async () => {
  await p.goto(`${BASE}/app/jobs/demo-proj-1`); await p.waitForLoadState("networkidle"); const before = await mediaCount();
  await p.setInputFiles("input[name=files]", F("big.pdf")); await p.getByRole("button", { name: /upload|add file/i }).first().click().catch(() => {}); await sleep(2500);
  const msg = (await p.locator("form [role=alert]").allTextContents()).join(" "); return /4 MB or smaller|smaller PDF/i.test(msg) && (await mediaCount()) === before ? true : { status: "FAIL", detail: msg };
});
await check("text file renamed .jpg is refused", async () => { const r = await uploadPhotos(F("text-as.jpg")); return r.added === 0 && r.alert ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("SVG (script-capable) and GIF are refused", async () => { for (const f of ["x.svg", "x.gif"]) { const r = await uploadPhotos(F(f)); if (r.added !== 0) return { status: "FAIL", detail: `${f} accepted` }; } });
await check("truncated JPEG is refused or repaired without crashing", async () => { const r = await uploadPhotos(F("truncated.jpg")); return r.alert || r.added === 1 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("JPEG with HTML appended is re-encoded (appended script gone)", async () => { const before = await mediaCount(); const r = await uploadPhotos(F("polyglot.jpg")); if (r.added !== 1) return { status: "FAIL", detail: JSON.stringify(r) }; const m = (await fs.collection("businesses/demo-kpb/media").orderBy("created_at", "desc").limit(1).get()).docs[0]; const res = await fetch(`${BASE}/media/${m.get("path")}`, { headers: { cookie: (await p.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } }); const buf = Buffer.from(await res.arrayBuffer()); return !buf.includes("<script>") && res.headers.get("content-type") === "image/webp" ? true : { status: "FAIL", detail: "script bytes survived" }; });
await check("EXIF GPS location is stripped from stored photos", async () => { const r = await uploadPhotos(F("gps.jpg")); const m = (await fs.collection("businesses/demo-kpb/media").orderBy("created_at", "desc").limit(1).get()).docs[0]; const res = await fetch(`${BASE}/media/${m.get("path")}`, { headers: { cookie: (await p.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } }); const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata(); return !meta.exif && r.added === 1 ? true : { status: "FAIL", detail: "EXIF still present" }; });
await check("EXIF-rotated phone photo is stored upright", async () => { const r = await uploadPhotos(F("rotated.jpg")); const m = (await fs.collection("businesses/demo-kpb/media").orderBy("created_at", "desc").limit(1).get()).docs[0]; const res = await fetch(`${BASE}/media/${m.get("path")}`, { headers: { cookie: (await p.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } }); const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata(); return meta.height > meta.width ? true : { status: "FAIL", detail: `${meta.width}x${meta.height}` }; });
await check("CMYK, 1x1 and 10x20000 images are handled", async () => { for (const f of ["cmyk.jpg", "one-px.png", "tall.png"]) { const r = await uploadPhotos(F(f)); if (!(r.added === 1 || r.alert)) return { status: "FAIL", detail: `${f}: ${JSON.stringify(r)}` }; } });
await check("fake PDF is refused as a photo", async () => { const r = await uploadPhotos(F("fake.pdf")); return r.added === 0 && r.alert ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("hostile file names (very long, quotes, tags) do not break the upload or the page", async () => { const r = await uploadPhotos([F("a very long file name ".repeat(10) + ".jpg"), F("evil';--<img src=x>.jpg")]); const imgs = await p.locator("img[src=x]").count(); return r.added === 2 && imgs === 0 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("12 photos at once: capped at the per-update limit, no crash", async () => { const r = await uploadPhotos(Array.from({ length: 12 }, (_, i) => F(`multi-${i}.jpg`))); return r.added <= 10 && r.added >= 1 ? { status: r.added === 10 ? "PASS" : "FINDING", detail: `${r.added} stored, ${r.ms}ms, ${r.alert}` } : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("update with only a note (no photos) works and zero-byte file is ignored", async () => { const r = await uploadPhotos(F("zero.jpg"), { note: "note with an empty file attached" }); const n = (await fs.collection("businesses/demo-kpb/activity").where("body", "==", "note with an empty file attached").get()).size; return n === 1 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("16000x16000 PNG (small file, 256 megapixels): server survives, time and memory stay sane", async () => {
  const before = serverRssMb(); const r = await uploadPhotos(F("bomb-16k.png")); const alive = (await fetch(`${BASE}/explore`)).status === 200;
  const d = `rss before ${before}MB, peak ${r.peak}MB, ${r.ms}ms, stored=${r.added}, alert="${r.alert}"`;
  if (!alive) return { status: "FAIL", detail: "server down after upload. " + d };
  return r.peak - before > 700 || r.ms > 20000 ? { status: "FAIL", detail: "decompression bomb is expensive: " + d } : { status: "PASS", detail: d };
});
await check("20000x20000 PNG is refused (over the pixel limit) without crashing", async () => { const r = await uploadPhotos(F("bomb-20k.png")); const alive = (await fetch(`${BASE}/explore`)).status === 200; return alive && r.added === 0 ? true : { status: "FAIL", detail: JSON.stringify(r) }; });
await check("private files: another business cannot fetch this job's photo even with the exact URL", async () => { const m = (await fs.collection("businesses/demo-kpb/media").limit(1).get()).docs[0]; const { page: q } = await newPage(phone, "other"); await login(q, "owner@islandelectrical.demo"); const res = await q.context().request.get(`${BASE}/media/${m.get("path")}`); return res.status() === 404 ? true : { status: "FAIL", detail: String(res.status()) }; });
await check("profile logo: oversize / fake / GIF are refused with a message and the profile keeps working", async () => {
  await p.goto(`${BASE}/app/profile`); await p.waitForLoadState("networkidle");
  for (const f of ["noise-26mb.png", "text-as.jpg", "x.gif"]) {
    await p.setInputFiles("input[name=logo]", F(f)); await p.getByRole("button", { name: /save/i }).first().click(); await sleep(2500);
    const msg = (await p.locator("form [role=alert]").allTextContents()).join(" ").trim();
    if (!msg) return { status: "FAIL", detail: `${f}: no error shown` };
    await p.reload(); await p.waitForLoadState("networkidle");
  }
});
rmSync(dir, { recursive: true, force: true });
await finish();
