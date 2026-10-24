// First-load weight and time of the pages customers open on a phone, with a throttled connection (slow 3G-ish).
import { BASE, check, finish, newPage, android } from "./lib.mjs";
const pages = ["/", "/explore", "/contractor/kingston-pro-builders", "/post/demo-post-1", "/login"];
for (const throttled of [false, true]) for (const u of pages) {
  await check(`${throttled ? "slow 3G" : "no throttling"} first load ${u}`, async () => {
    const { ctx, page } = await newPage(android, "weight"); const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (throttled) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (150 * 1024) / 8 });
    let bytes = 0, js = 0, img = 0; const types = new Map();
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
    cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; const t = types.get(e.requestId); if (t === "Script") js += e.encodedDataLength; if (t === "Image") img += e.encodedDataLength; });
    const t0 = Date.now(); await page.goto(`${BASE}${u}`, { waitUntil: "load", timeout: 120000 }); await page.locator("h1").first().waitFor({ timeout: 120000 }); const ms = Date.now() - t0;
    await ctx.close();
    const d = `${(ms / 1000).toFixed(1)}s, ${Math.round(bytes / 1024)} KB total (${Math.round(js / 1024)} KB scripts, ${Math.round(img / 1024)} KB images)`;
    return throttled && ms > 15000 ? { status: "FINDING", detail: d } : { status: "PASS", detail: d };
  });
}
await finish();
