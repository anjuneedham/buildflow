import { test } from "node:test";
import assert from "node:assert/strict";
import { dateInDays, excerpt, localDate, phoneDigits, relativeDay, whatsappLink } from "../src/lib/utils.ts";

test("'today' is the Jamaica calendar day, not UTC", () => {
  // 03:00 UTC is still the previous evening in Kingston (UTC-5).
  assert.equal(localDate(new Date("2026-10-24T03:00:00Z")), "2026-10-23");
  assert.equal(localDate(new Date("2026-10-24T06:00:00Z")), "2026-10-24");
});

test("dateInDays counts calendar days from the local today", () => {
  const today = dateInDays(0);
  assert.equal(Date.parse(dateInDays(7) + "T00:00:00Z") - Date.parse(today + "T00:00:00Z"), 7 * 864e5);
});

test("relativeDay labels schedule dates", () => {
  assert.equal(relativeDay("2026-10-23", "2026-10-23"), "Today");
  assert.equal(relativeDay("2026-10-24", "2026-10-23"), "Tomorrow");
  assert.equal(relativeDay("2026-10-22", "2026-10-23"), "Yesterday");
  assert.equal(relativeDay("2026-10-26", "2026-10-23"), "Monday");
  assert.equal(relativeDay("2026-11-30", "2026-10-23"), "Nov 30");
});

test("phone numbers match across formats (find-or-create customer)", () => {
  const same = ["876-555-1234", "+1 (876) 555 1234", "18765551234", "876 555 1234"].map(phoneDigits);
  assert.ok(same.every((d) => d === "18765551234"), JSON.stringify(same));
  assert.equal(phoneDigits("555"), null);
  assert.equal(phoneDigits(null), null);
});

test("WhatsApp links use the normalised number", () => {
  assert.equal(whatsappLink("876-555-1234", "Hi"), "https://wa.me/18765551234?text=Hi");
  assert.equal(whatsappLink(""), null);
});

test("excerpt keeps the first line and cuts at a word with an ellipsis", () => {
  assert.equal(excerpt("Short caption\nsecond line"), "Short caption");
  assert.equal(excerpt("Stamped concrete driveway and covered patio finished in Portmore. Six weeks start to finish."), "Stamped concrete driveway and covered patio finished in Portmore. Six weeks…");
  assert.equal(excerpt("   "), null);
  assert.equal(excerpt(null), null);
});

test("safeNext only allows same-site paths, including after browsers strip control characters", async () => {
  const { safeNext } = await import("../src/lib/utils.ts");
  assert.equal(safeNext("/app/leads?x=1"), "/app/leads?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/\t/evil.com", "/\n/evil.com", "/ /evil.com", "", null, undefined]) assert.equal(safeNext(bad as string), "/app", String(bad));
});

test("ids shaped like __x__ are rejected (Firestore refuses them)", async () => {
  const { ID_RE } = await import("../src/lib/ids.ts");
  for (const ok of ["abc", "demo-proj-1", "A1_b-2", "a".repeat(64)]) assert.ok(ID_RE.test(ok), ok);
  for (const bad of ["__proto__", "__a__", "", "a/b", "..", ".", "a".repeat(65), "a b"]) assert.ok(!ID_RE.test(bad), bad);
});

test("isRealDay accepts only real calendar days", async () => {
  const { isRealDay } = await import("../src/lib/dates.ts");
  for (const ok of ["2026-02-28", "2028-02-29", "2026-12-31"]) assert.ok(isRealDay(ok), ok);
  for (const bad of ["2026-13-45", "2026-02-31", "2026-00-10", "2027-02-29", "2026-1-5", "", "tomorrow", "2026-02-28T00:00"]) assert.ok(!isRealDay(bad), bad);
});

test("firstParams keeps the first value of a repeated query key", async () => {
  const { firstParams } = await import("../src/lib/params.ts");
  assert.deepEqual(firstParams({ q: ["a", "b"], tab: "work", x: undefined }), { q: "a", tab: "work", x: undefined });
});
