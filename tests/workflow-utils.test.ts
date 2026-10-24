import { test } from "node:test";
import assert from "node:assert/strict";
import { dateInDays, localDate, phoneDigits, relativeDay, whatsappLink } from "../src/lib/utils.ts";

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
