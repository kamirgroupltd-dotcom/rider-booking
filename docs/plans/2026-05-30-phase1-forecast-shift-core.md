# Phase 1 — Forecast Pipeline & Shift-Generation Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and locally test the pure logic that converts `Target.xlsx` order forecasts into (a) a tall `forecast-import.csv` for the Google Sheet and (b) generated 2/4/6h shifts with demand-driven capacity — so Phase 2 (Apps Script) can transcribe proven logic.

**Architecture:** A dependency-free pure-logic module (`scripts/lib/forecast.mjs`) holds all math: orders→riders-needed, workbook-matrix→tall-records, and demand→shift tiling. Tests feed plain arrays (no Excel needed) via Node's built-in `node:test`. A thin CLI (`scripts/build-forecast.mjs`) wires Excel I/O (SheetJS) to the pure logic and emits the CSV. The same pure functions are the reference implementation for the Apps Script generator in Phase 2.

**Tech Stack:** Node 24 (built-in `node --test`), SheetJS (`xlsx`) for reading the workbook, ES modules.

---

## File Structure

- Create `scripts/lib/forecast.mjs` — pure functions (no I/O): `ridersNeeded`, `reshapeCitySheet`, `findOperatingSpans`, `tileDay`, `NORMALIZE_CITY`.
- Create `scripts/lib/forecast.test.mjs` — `node:test` unit tests for the above.
- Create `scripts/build-forecast.mjs` — CLI: read `Target.xlsx` → reshape all sheets → write `forecast-import.csv`.
- Modify `package.json` (repo root — new, minimal, for scripts only) — add `xlsx` devDep + `test`/`build:forecast` scripts.

> Note: this lives at the **repo root** `scripts/`, separate from `next-app/`. The forecast tooling is build-time, not part of the shipped Next app.

**Constants (used across tasks — define once in `forecast.mjs`):**
- `ORDERS_PER_RIDER_HR = 2`, `BUFFER_PCT = 0.15` (match Sheet `Config`).
- `SHIFT_LENGTHS = [6, 4, 2]` (greedy longest-fit order).
- `SLOTS_PER_DAY = 48` (30-min slots; slot `i` = `i*30` minutes from 00:00).
- `NORMALIZE_CITY = { Osnabruck: "Osnabrück", kassel: "Kassel", "Halle saale": "Halle (Saale)" }` (others pass through unchanged).

---

## Task 0: Scaffold scripts package + test runner

**Files:**
- Create: `package.json` (repo root)
- Create: `scripts/lib/forecast.mjs` (empty exports stub)

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "rider-booking-scripts",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test scripts/",
    "build:forecast": "node scripts/build-forecast.mjs"
  },
  "devDependencies": {
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 2: Install the xlsx dependency**

Run: `npm install`
Expected: `added 1 package` (or similar); creates root `node_modules/` + `package-lock.json`.

- [ ] **Step 3: Create the module stub so tests can import it**

```js
// scripts/lib/forecast.mjs
export const ORDERS_PER_RIDER_HR = 2;
export const BUFFER_PCT = 0.15;
export const SHIFT_LENGTHS = [6, 4, 2];
export const SLOTS_PER_DAY = 48;
export const NORMALIZE_CITY = {
  Osnabruck: "Osnabrück",
  kassel: "Kassel",
  "Halle saale": "Halle (Saale)",
};
export function normalizeCity(name) {
  return NORMALIZE_CITY[name] ?? name;
}
```

- [ ] **Step 4: Verify the test runner runs (no tests yet)**

Run: `npm test`
Expected: exits 0, "tests 0" (no test files match yet — acceptable).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/lib/forecast.mjs
git commit -m "chore: scaffold forecast scripts package with node:test"
```

---

## Task 1: `ridersNeeded(orders)` — orders → buffered riders per slot

**Files:**
- Modify: `scripts/lib/forecast.mjs`
- Test: `scripts/lib/forecast.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/lib/forecast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ridersNeeded } from "./forecast.mjs";

test("ridersNeeded: ceil(orders / 2 * 1.15)", () => {
  // Matches the existing sheet: 21 orders/slot -> 25 (21/2=10.5*1.15=12.075 -> 13)? No:
  // the sheet's column is per-slot demand already; spec formula is ceil(orders/ophr*(1+buf)).
  assert.equal(ridersNeeded(0), 0);
  assert.equal(ridersNeeded(2), 2);   // 2/2=1 *1.15=1.15 -> ceil 2
  assert.equal(ridersNeeded(10), 6);  // 10/2=5 *1.15=5.75 -> ceil 6
  assert.equal(ridersNeeded(20), 12); // 20/2=10 *1.15=11.5 -> ceil 12
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ridersNeeded is not a function`.

- [ ] **Step 3: Implement**

```js
// add to scripts/lib/forecast.mjs
export function ridersNeeded(orders, ordersPerRiderHr = ORDERS_PER_RIDER_HR, bufferPct = BUFFER_PCT) {
  const o = Number(orders) || 0;
  if (o <= 0) return 0;
  return Math.ceil((o / ordersPerRiderHr) * (1 + bufferPct));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/forecast.mjs scripts/lib/forecast.test.mjs
git commit -m "feat: ridersNeeded order->rider conversion with 15% buffer"
```

---

## Task 2: `reshapeCitySheet(rows, cityName)` — wide matrix → tall records

The workbook layout per city sheet (0-indexed rows):
- row 1 = labels (`Tot`,`Time`,`Monday`..`Sunday` repeated per week block, separated by a blank col)
- row 2 = dates (`dd/mm/yy`) under each weekday column, per week block
- rows 4+ = data; col 3 = `Time` (e.g. `0:00`), cols 4..10 = Mon..Sun orders; blank col; next block at col 12, etc.

Week blocks start at columns `[2, 13, 24, 35, 46]` (the `Tot` col); the `Time` col is block+1, day cols are block+2..block+8.

**Files:**
- Modify: `scripts/lib/forecast.mjs`
- Test: `scripts/lib/forecast.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// append to scripts/lib/forecast.test.mjs
import { reshapeCitySheet } from "./forecast.mjs";

test("reshapeCitySheet: emits one record per (date,time) with orders+ridersNeeded", () => {
  // Minimal 1-week fixture: row1 labels, row2 dates, row3 blank, row4-5 data.
  const blank = null;
  const rows = [
    ["Grand", blank, blank, blank, "Forecasted Nr Orders"],                       // r0
    ["Total", blank, "Tot", "Time", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], // r1
    ["100", blank, "15", blank, "01/06/26","02/06/26","03/06/26","04/06/26","05/06/26","06/06/26","07/06/26"], // r2
    [],                                                                            // r3
    [10, blank, 5, "0:00", 10, 0, 0, 0, 0, 0, 20],                                 // r4 (Mon=10, Sun=20)
    [4,  blank, 2, "0:30", 2,  0, 0, 0, 0, 0, 0],                                  // r5 (Mon=2)
  ];
  const recs = reshapeCitySheet(rows, "Berlin");
  // 2 time rows * 7 days = 14 records
  assert.equal(recs.length, 14);
  const monMidnight = recs.find(r => r.Date === "2026-06-01" && r.Time === "00:00");
  assert.deepEqual(monMidnight, {
    City: "Berlin", Date: "2026-06-01", Day: "Monday", Time: "00:00",
    Orders: 10, RidersNeeded: 6, slot: 0,
  });
  const sunMidnight = recs.find(r => r.Date === "2026-06-07" && r.Time === "00:00");
  assert.equal(sunMidnight.Orders, 20);
  assert.equal(sunMidnight.RidersNeeded, 12); // 20/2*1.15=11.5 -> 12
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `reshapeCitySheet is not a function`.

- [ ] **Step 3: Implement**

```js
// add to scripts/lib/forecast.mjs
const WEEK_BLOCK_COLS = [2, 13, 24, 35, 46]; // "Tot" column index of each of the 5 week blocks
const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function ddmmyyToISO(s) {
  // "01/06/26" -> "2026-06-01"
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return `20${m[3]}-${m[2]}-${m[1]}`;
}

function normalizeTime(t) {
  // "0:00" -> "00:00", "9:30" -> "09:30"
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function reshapeCitySheet(rows, cityRaw) {
  const City = normalizeCity(cityRaw);
  const dateRow = rows[2] || [];
  const out = [];
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r] || [];
    for (const block of WEEK_BLOCK_COLS) {
      const timeCol = block + 1;
      const time = normalizeTime(row[timeCol]);
      if (!time) continue; // skip blank/non-data rows for this block
      const slot = timeToSlot(time);
      for (let d = 0; d < 7; d++) {
        const iso = ddmmyyToISO(dateRow[block + 2 + d]);
        if (!iso) continue;
        const orders = Number(row[block + 2 + d]) || 0;
        out.push({
          City, Date: iso, Day: DAY_NAMES[d], Time: time,
          Orders: orders, RidersNeeded: ridersNeeded(orders), slot,
        });
      }
    }
  }
  return out;
}

export function timeToSlot(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/forecast.mjs scripts/lib/forecast.test.mjs
git commit -m "feat: reshape wide city sheet into tall forecast records"
```

---

## Task 3: `findOperatingSpans(ridersBySlot)` — contiguous demand spans

**Files:**
- Modify: `scripts/lib/forecast.mjs`
- Test: `scripts/lib/forecast.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// append to scripts/lib/forecast.test.mjs
import { findOperatingSpans } from "./forecast.mjs";

test("findOperatingSpans: returns whole-hour [startHour,endHour) spans where demand>0", () => {
  // 48 slots; put demand in slots 20-23 (10:00-12:00) and 34-39 (17:00-20:00)
  const r = new Array(48).fill(0);
  for (let i = 20; i <= 23; i++) r[i] = 5;   // 10:00..11:30
  for (let i = 34; i <= 39; i++) r[i] = 8;   // 17:00..19:30
  const spans = findOperatingSpans(r);
  assert.deepEqual(spans, [
    { startHour: 10, endHour: 12 },
    { startHour: 17, endHour: 20 },
  ]);
});

test("findOperatingSpans: rounds odd-length span up to even", () => {
  const r = new Array(48).fill(0);
  for (let i = 0; i <= 4; i++) r[i] = 3;     // 00:00..02:00 inclusive -> hours 0..2.5 -> round to 0..4? test below
  const spans = findOperatingSpans(r);
  // slots 0..4 => minutes 0..150 => hours floor(0)=0 .. ceil(5/2)=3 => 3h (odd) -> bump to 4
  assert.deepEqual(spans, [{ startHour: 0, endHour: 4 }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `findOperatingSpans is not a function`.

- [ ] **Step 3: Implement**

```js
// add to scripts/lib/forecast.mjs
export function findOperatingSpans(ridersBySlot) {
  const spans = [];
  let i = 0;
  const n = ridersBySlot.length;
  while (i < n) {
    if ((ridersBySlot[i] || 0) <= 0) { i++; continue; }
    let j = i;
    while (j < n && (ridersBySlot[j] || 0) > 0) j++;
    // slots [i, j) are active. Convert to whole hours.
    let startHour = Math.floor(i / 2);
    let endHour = Math.ceil(j / 2);
    if ((endHour - startHour) % 2 === 1) endHour += 1; // keep spans even so 2/4/6 tile exactly
    if (endHour > 24) endHour = 24;
    spans.push({ startHour, endHour });
    i = j;
  }
  return spans;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/forecast.mjs scripts/lib/forecast.test.mjs
git commit -m "feat: findOperatingSpans with even-length rounding"
```

---

## Task 4: `tileDay(ridersBySlot)` — spans → 2/4/6h shifts with capacity

**Files:**
- Modify: `scripts/lib/forecast.mjs`
- Test: `scripts/lib/forecast.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// append to scripts/lib/forecast.test.mjs
import { tileDay } from "./forecast.mjs";

test("tileDay: greedy longest-fit 6/4/2, capacity = peak ridersNeeded in tile", () => {
  const r = new Array(48).fill(0);
  // 10:00-22:00 (slots 20..43): midday peak 8, evening 5
  for (let i = 20; i <= 31; i++) r[i] = 8;   // 10:00..15:30
  for (let i = 32; i <= 43; i++) r[i] = 5;   // 16:00..21:30
  const shifts = tileDay(r);
  // span = 10..22 (12h) -> 6+6
  assert.deepEqual(shifts, [
    { start: "10:00", end: "16:00", hours: 6, capacity: 8, overnight: false },
    { start: "16:00", end: "22:00", hours: 6, capacity: 5, overnight: false },
  ]);
});

test("tileDay: 8h span tiles as 6+2", () => {
  const r = new Array(48).fill(0);
  for (let i = 18; i <= 33; i++) r[i] = 4;   // 09:00..16:30 -> hours 9..17 (8h)
  const shifts = tileDay(r);
  assert.deepEqual(shifts.map(s => s.hours), [6, 2]);
  assert.equal(shifts[0].start, "09:00");
  assert.equal(shifts[1].end, "17:00");
});

test("tileDay: empty demand -> no shifts", () => {
  assert.deepEqual(tileDay(new Array(48).fill(0)), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `tileDay is not a function`.

- [ ] **Step 3: Implement**

```js
// add to scripts/lib/forecast.mjs
function hhmm(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

// peak ridersNeeded across the slots covering [startHour, endHour)
function peakOverHours(ridersBySlot, startHour, endHour) {
  let peak = 0;
  for (let slot = startHour * 2; slot < endHour * 2 && slot < ridersBySlot.length; slot++) {
    peak = Math.max(peak, ridersBySlot[slot] || 0);
  }
  return peak;
}

export function tileDay(ridersBySlot) {
  const shifts = [];
  for (const { startHour, endHour } of findOperatingSpans(ridersBySlot)) {
    let h = startHour;
    let remaining = endHour - startHour;
    while (remaining > 0) {
      const len = SHIFT_LENGTHS.find((L) => L <= remaining) ?? 2; // even spans guarantee a fit
      const segEnd = h + len;
      shifts.push({
        start: hhmm(h),
        end: hhmm(segEnd),
        hours: len,
        capacity: peakOverHours(ridersBySlot, h, segEnd),
        overnight: segEnd >= 24,
      });
      h = segEnd;
      remaining -= len;
    }
  }
  return shifts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/forecast.mjs scripts/lib/forecast.test.mjs
git commit -m "feat: tileDay generates 2/4/6h shifts with demand-driven capacity"
```

---

## Task 5: `build-forecast.mjs` CLI — Target.xlsx → forecast-import.csv

**Files:**
- Create: `scripts/build-forecast.mjs`

- [ ] **Step 1: Implement the CLI**

```js
// scripts/build-forecast.mjs
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { reshapeCitySheet } from "./lib/forecast.mjs";

const INPUT = process.argv[2] || "C:/Users/Kamran/Downloads/Target .xlsx";
const OUTPUT = process.argv[3] || "scripts/out/forecast-import.csv";

const wb = XLSX.readFile(INPUT, { cellDates: false, raw: true });
const all = [];
for (const sheetName of wb.SheetNames) {
  // header:1 => array-of-arrays, matching our reshape expectations
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
  const recs = reshapeCitySheet(rows, sheetName);
  all.push(...recs);
}

// CSV (formula-injection safe), columns match the Forecast tab + leading City
const headers = ["City", "Date", "Day", "Time", "Orders", "Riders Needed"];
const esc = (v) => {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const lines = [headers.join(",")];
for (const r of all) {
  lines.push([r.City, r.Date, r.Day, r.Time, r.Orders, r.RidersNeeded].map(esc).join(","));
}
import { mkdirSync } from "node:fs";
mkdirSync("scripts/out", { recursive: true });
writeFileSync(OUTPUT, lines.join("\n"), "utf8");

// Summary to stdout for sanity-checking
const byCity = {};
for (const r of all) byCity[r.City] = (byCity[r.City] || 0) + r.Orders;
console.log(`Wrote ${all.length} rows to ${OUTPUT}`);
console.log("Total forecast orders per city:");
for (const [c, o] of Object.entries(byCity)) console.log(`  ${c}: ${Math.round(o).toLocaleString()}`);
```

- [ ] **Step 2: Run the CLI**

Run: `npm run build:forecast`
Expected: prints `Wrote N rows to scripts/out/forecast-import.csv` and a per-city order total. Sanity check: 9 cities listed; Berlin total ≈ 66,000 (matches the workbook Grand Total cell); row count ≈ 9 cities × 48 slots × 7 days × 5 weeks = 15,120 (minus any blank slots).

- [ ] **Step 3: Spot-check the generated shifts for 2–3 cities (manual verification gate from spec §12)**

Run:
```bash
node -e "import('./scripts/lib/forecast.mjs').then(async m => { const X=await import('xlsx'); const wb=X.readFile('C:/Users/Kamran/Downloads/Target .xlsx',{raw:true}); for (const c of ['Berlin','Bremen','Osnabruck']) { const rows=X.utils.sheet_to_json(wb.Sheets[c],{header:1,raw:true,defval:null}); const recs=m.reshapeCitySheet(rows,c); const day=recs.filter(r=>r.Date==='2026-06-01'); const arr=new Array(48).fill(0); day.forEach(r=>arr[r.slot]=r.RidersNeeded); console.log('\n'+c+' Mon 01/06 shifts:'); console.table(m.tileDay(arr)); } });"
```
Expected: each city prints its Monday 01/06 shifts (start/end/hours/capacity). **Confirm with the product owner that capacities and windows look sane before Phase 2.**

- [ ] **Step 4: Commit (code only — the generated CSV/out dir is build output)**

```bash
echo "scripts/out/" >> .gitignore
git add scripts/build-forecast.mjs .gitignore
git commit -m "feat: build-forecast CLI reshapes Target.xlsx into importable CSV"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Phase-1 covers spec §2 (capacity formula), §4 (import pipeline), and §5 (shift-generation algorithm) as reference logic. §3/§6–§11 are explicitly deferred to Phases 2–4.
- **Placeholder scan:** none — all steps contain runnable code/commands.
- **Type consistency:** record shape `{City,Date,Day,Time,Orders,RidersNeeded,slot}` and shift shape `{start,end,hours,capacity,overnight}` used consistently across Tasks 2–5.
- **Open item:** Task 5 Step 3 is the spec's required "review generated shifts against demand" gate.

## Done when

`npm test` passes (7 tests), `npm run build:forecast` produces `scripts/out/forecast-import.csv` with ~15k rows across 9 cities, and the per-city shift spot-check has been eyeballed and approved.
