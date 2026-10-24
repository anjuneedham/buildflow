import { test } from "node:test";
import assert from "node:assert/strict";
import { pathFromPublicUrl, sniff } from "../src/lib/file-type.ts";

const bytes = (...parts: (number[] | string)[]) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

test("detects real file types from magic bytes", () => {
  assert.equal(sniff(bytes([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniff(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniff(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")), "image/webp");
  assert.equal(sniff(bytes([0, 0, 0, 0x18], "ftypheic")), "image/heic");
  assert.equal(sniff(bytes("%PDF-1.7")), "application/pdf");
});

test("rejects files that only claim to be images", () => {
  assert.equal(sniff(bytes("<svg xmlns=")), null);
  assert.equal(sniff(bytes("<html>")), null);
  assert.equal(sniff(bytes("MZ")), null);
});

test("extracts our storage paths from public URLs only", () => {
  assert.equal(pathFromPublicUrl("https://firebasestorage.googleapis.com/v0/b/x/o/public-media%2Fbiz%2Fa.webp?alt=media&token=t"), "public-media/biz/a.webp");
  assert.equal(pathFromPublicUrl("https://images.unsplash.com/photo-1"), null);
  assert.equal(pathFromPublicUrl("https://firebasestorage.googleapis.com/v0/b/x/o/project-files%2Fbiz%2Fa.webp?alt=media"), null);
});
