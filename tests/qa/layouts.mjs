// Android phones, small phones, landscape and tablets: overflow, content hidden behind the bottom nav, tiny tap targets.
import { mkdirSync } from "node:fs";
import { BASE, check, finish, login, newPage, sleep, android } from "./lib.mjs";
import { devices as pw } from "playwright-core";

const SHOTS = process.env.QA_SHOTS; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const viewports = {
  "pixel7-412x915": android,
  "small-android-360x640": { ...pw["Pixel 5"], viewport: { width: 360, height: 640 } },
  "tiny-320x568": { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "pixel7-landscape-915x412": { ...android, viewport: { width: 915, height: 412 } },
  "tablet-portrait-768x1024": { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "tablet-landscape-1024x768": { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "galaxy-tab-800x1280": { viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const publicPages = ["/", "/faq", "/support", "/delete-account", "/privacy", "/terms", "/explore", "/explore?tab=contractors", "/contractor/kingston-pro-builders", "/post/demo-post-1", "/login", "/signup", "/pricing", "/for-contractors"];
const ownerPages = ["/app", "/app/leads", "/app/leads/demo-lead-qr", "/app/customers", "/app/jobs", "/app/jobs/demo-proj-1", "/app/posts/new", "/app/profile", "/app/analytics", "/app/team"];

async function audit(p, url, name) {
  await p.goto(`${BASE}${url}`); await p.waitForLoadState("networkidle"); await sleep(250);
  const r = await p.evaluate(() => {
    const vw = window.innerWidth;
    const overflow = document.documentElement.scrollWidth > vw + 1;
    const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !e.closest("[aria-hidden=true], .sr-only"); };
    const small = [...document.querySelectorAll("a[href], button, select, summary, [role=button], input:not([type=hidden]):not([type=file])")].filter(vis).filter((e) => { const b = e.getBoundingClientRect(); return (b.height < 32 || b.width < 32) && !(e.tagName === "A" && e.closest("p, li, span, h1, h2, h3, footer") && b.height >= 18 && e.textContent.trim().length > 8); }).map((e) => `${e.tagName.toLowerCase()}:${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("name") || "").trim().slice(0, 24)}(${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`);
    window.scrollTo(0, document.documentElement.scrollHeight);
    const fixedBottom = [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.position === "fixed" && b.bottom >= window.innerHeight - 2 && b.height > 30 && b.width > vw * 0.5 && vis(e); });
    const navTop = fixedBottom.length ? Math.min(...fixedBottom.map((e) => e.getBoundingClientRect().top)) : window.innerHeight;
    const content = [...document.querySelectorAll("main *")].filter((e) => vis(e) && !fixedBottom.some((f) => f.contains(e)) && getComputedStyle(e).position !== "fixed" && e.getBoundingClientRect().height > 0);
    const lastBottom = content.length ? Math.max(...content.map((e) => e.getBoundingClientRect().bottom)) : 0;
    const tiny = [...document.querySelectorAll("main p, main span, main li, main a, main label, main td, main dd")].filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim().length > 1 && parseFloat(getComputedStyle(e).fontSize) < 11).length;
    return { overflow, small, hiddenByNav: lastBottom > navTop + 2, navTop: Math.round(navTop), lastBottom: Math.round(lastBottom), tiny, vw };
  });
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}-${url.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: false });
  return r;
}
const summary = { overflow: [], hidden: [], small: new Map(), tiny: [] };
for (const [vname, opts] of Object.entries(viewports)) {
  const { page: p } = await newPage(opts, vname);
  await login(p, "owner@kingstonpro.demo");
  for (const url of [...publicPages, ...ownerPages]) {
    await check(`${vname} ${url}: no sideways scroll, nothing hidden under the bottom bar`, async () => {
      const r = await audit(p, url, vname);
      for (const s of r.small) summary.small.set(s, (summary.small.get(s) ?? 0) + 1);
      if (r.tiny) summary.tiny.push(`${vname} ${url}: ${r.tiny} text nodes under 11px`);
      if (r.overflow) summary.overflow.push(`${vname} ${url}`);
      if (r.hiddenByNav) summary.hidden.push(`${vname} ${url} (content ends ${r.lastBottom}, bar starts ${r.navTop})`);
      return !r.overflow && !r.hiddenByNav ? true : { status: "FAIL", detail: `${r.overflow ? "sideways scroll; " : ""}${r.hiddenByNav ? `last content at ${r.lastBottom}px but bar starts at ${r.navTop}px` : ""}` };
    });
  }
}
const top = [...summary.small.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log("\nSmall tap targets (<32px) seen most often:\n" + top.map(([k, n]) => `  ${n}x ${k}`).join("\n"));
if (summary.tiny.length) console.log("\nTiny text:\n  " + summary.tiny.slice(0, 10).join("\n  "));
await finish();
