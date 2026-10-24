// Draws the Android launcher icon and splash source images from the BuildFlow mark. Run from the repo root: node scripts/make-android-assets.mjs
import sharp from "sharp";
const logo = (size, pad) => { const inner = Math.round(size * (1 - pad * 2)); return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="7 7 18 18"><rect x="7" y="7" width="12" height="5" rx="1" fill="#f26b1d"/><rect x="7" y="13.5" width="16" height="5" rx="1" fill="#ff8a3d"/><rect x="7" y="20" width="18" height="5" rx="1" fill="#efede8"/></svg>`)).resize(inner, inner).png().toBuffer(); };
const bg = "#1c2127";
const canvas = (w, h, color) => sharp({ create: { width: w, height: h, channels: 4, background: color } });
const place = async (base, w, h, pad) => base.composite([{ input: await logo(Math.min(w, h), pad), gravity: "center" }]).png().toBuffer();
await sharp(await place(canvas(1024, 1024, bg), 1024, 1024, 0.22)).toFile("mobile/assets/icon-only.png");
await sharp(await place(canvas(1024, 1024, { r: 0, g: 0, b: 0, alpha: 0 }), 1024, 1024, 0.3)).toFile("mobile/assets/icon-foreground.png");
await canvas(1024, 1024, bg).png().toFile("mobile/assets/icon-background.png");
await sharp(await place(canvas(2732, 2732, bg), 2732, 2732, 0.38)).toFile("mobile/assets/splash.png");
await sharp(await place(canvas(2732, 2732, bg), 2732, 2732, 0.38)).toFile("mobile/assets/splash-dark.png");
console.log("assets written");
