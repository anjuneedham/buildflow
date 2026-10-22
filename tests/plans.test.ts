import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, formatMoney, seatPriceBreakdown } from "../src/lib/plans.ts";

test("basic plan: $50 base, 1 seat included, $20 per extra seat", () => {
  const totals = [1, 2, 3, 4].map((n) => seatPriceBreakdown(PLANS.basic, n).totalCents);
  assert.deepEqual(totals, [5000, 7000, 9000, 11000]);
});

test("seat counts are clamped to at least 1 and floored", () => {
  assert.equal(seatPriceBreakdown(PLANS.basic, 0).seats, 1);
  assert.equal(seatPriceBreakdown(PLANS.basic, 2.7).extraSeats, 1);
});

test("pricing is driven by plan data, not constants", () => {
  const pro = { basePriceCents: 9900, includedSeats: 3, additionalSeatPriceCents: 1500 };
  assert.equal(seatPriceBreakdown(pro, 5).totalCents, 9900 + 2 * 1500);
});

test("formatMoney", () => {
  assert.equal(formatMoney(5000), "$50");
  assert.equal(formatMoney(1999), "$19.99");
});
