// scripts/lib/forecast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ridersNeeded } from "./forecast.mjs";

test("ridersNeeded: ceil(orders / 2 * 1.15)", () => {
  assert.equal(ridersNeeded(0), 0);
  assert.equal(ridersNeeded(2), 2); // 2/2=1 *1.15=1.15 -> ceil 2
  assert.equal(ridersNeeded(10), 6); // 10/2=5 *1.15=5.75 -> ceil 6
  assert.equal(ridersNeeded(20), 12); // 20/2=10 *1.15=11.5 -> ceil 12
});
