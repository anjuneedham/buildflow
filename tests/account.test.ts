import { test } from "node:test";
import assert from "node:assert/strict";
import { recentlySignedIn } from "../src/lib/account.ts";

test("account deletion needs a sign-in from the last 10 minutes", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const secs = (minutesAgo: number) => now / 1000 - minutesAgo * 60;
  assert.ok(recentlySignedIn(secs(0), now));
  assert.ok(recentlySignedIn(secs(9), now));
  assert.ok(!recentlySignedIn(secs(11), now));
  assert.ok(!recentlySignedIn(secs(60 * 24 * 10), now), "a 10-day-old session is refused");
});
