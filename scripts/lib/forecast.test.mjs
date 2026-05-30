// scripts/lib/forecast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ridersNeeded, reshapeCitySheet } from "./forecast.mjs";

test("ridersNeeded: ceil(orders / 2 * 1.15)", () => {
  assert.equal(ridersNeeded(0), 0);
  assert.equal(ridersNeeded(2), 2); // 2/2=1 *1.15=1.15 -> ceil 2
  assert.equal(ridersNeeded(10), 6); // 10/2=5 *1.15=5.75 -> ceil 6
  assert.equal(ridersNeeded(20), 12); // 20/2=10 *1.15=11.5 -> ceil 12
});

test("reshapeCitySheet: emits one record per (date,time) with orders+ridersNeeded", () => {
  // Minimal 1-week fixture: row1 labels, row2 dates, row3 blank, row4-5 data.
  const blank = null;
  const rows = [
    ["Grand", blank, blank, blank, "Forecasted Nr Orders"], // r0
    ["Total", blank, "Tot", "Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], // r1
    ["100", blank, "15", blank, "01/06/26", "02/06/26", "03/06/26", "04/06/26", "05/06/26", "06/06/26", "07/06/26"], // r2
    [], // r3
    [10, blank, 5, "0:00", 10, 0, 0, 0, 0, 0, 20], // r4 (Mon=10, Sun=20)
    [4, blank, 2, "0:30", 2, 0, 0, 0, 0, 0, 0], // r5 (Mon=2)
  ];
  const recs = reshapeCitySheet(rows, "Berlin");
  // 2 time rows * 7 days = 14 records
  assert.equal(recs.length, 14);
  const monMidnight = recs.find((r) => r.Date === "2026-06-01" && r.Time === "00:00");
  assert.deepEqual(monMidnight, {
    City: "Berlin", Date: "2026-06-01", Day: "Monday", Time: "00:00",
    Orders: 10, RidersNeeded: 6, slot: 0,
  });
  const sunMidnight = recs.find((r) => r.Date === "2026-06-07" && r.Time === "00:00");
  assert.equal(sunMidnight.Orders, 20);
  assert.equal(sunMidnight.RidersNeeded, 12); // 20/2*1.15=11.5 -> 12
});
