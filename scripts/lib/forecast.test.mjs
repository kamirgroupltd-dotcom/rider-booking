// scripts/lib/forecast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ridersNeeded, reshapeCitySheet, findOperatingSpans, tileDay } from "./forecast.mjs";

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

test("findOperatingSpans: returns whole-hour, even-length [startHour,endHour) spans where demand>0", () => {
  // 48 slots; put demand in slots 20-23 (10:00-12:00) and 34-39 (17:00-20:00)
  const r = new Array(48).fill(0);
  for (let i = 20; i <= 23; i++) r[i] = 5; // 10:00..11:30 -> 10..12 (2h, even)
  for (let i = 34; i <= 39; i++) r[i] = 8; // 17:00..19:30 -> 17..20 (3h, odd) -> bumped to 21 (4h)
  const spans = findOperatingSpans(r);
  assert.deepEqual(spans, [
    { startHour: 10, endHour: 12 },
    { startHour: 17, endHour: 21 },
  ]);
});

test("findOperatingSpans: rounds odd-length span up to even", () => {
  const r = new Array(48).fill(0);
  for (let i = 0; i <= 4; i++) r[i] = 3; // slots 0..4 => 00:00..02:30 demand
  const spans = findOperatingSpans(r);
  // active [0,5) => startHour 0, endHour ceil(5/2)=3 (odd) -> bumped to 4
  assert.deepEqual(spans, [{ startHour: 0, endHour: 4 }]);
});

test("tileDay: greedy longest-fit 6/4/2, capacity = peak ridersNeeded in tile", () => {
  const r = new Array(48).fill(0);
  // 10:00-22:00 (slots 20..43): midday peak 8, evening 5
  for (let i = 20; i <= 31; i++) r[i] = 8; // 10:00..15:30
  for (let i = 32; i <= 43; i++) r[i] = 5; // 16:00..21:30
  const shifts = tileDay(r);
  // span = 10..22 (12h) -> 6+6
  assert.deepEqual(shifts, [
    { start: "10:00", end: "16:00", hours: 6, capacity: 8, overnight: false },
    { start: "16:00", end: "22:00", hours: 6, capacity: 5, overnight: false },
  ]);
});

test("tileDay: 8h span tiles as 6+2", () => {
  const r = new Array(48).fill(0);
  for (let i = 18; i <= 33; i++) r[i] = 4; // 09:00..16:30 -> hours 9..17 (8h)
  const shifts = tileDay(r);
  assert.deepEqual(shifts.map((s) => s.hours), [6, 2]);
  assert.equal(shifts[0].start, "09:00");
  assert.equal(shifts[1].end, "17:00");
});

test("tileDay: empty demand -> no shifts", () => {
  assert.deepEqual(tileDay(new Array(48).fill(0)), []);
});
