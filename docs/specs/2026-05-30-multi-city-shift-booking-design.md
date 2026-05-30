# Multi-City Shift Booking — Design Spec

**Date:** 2026-05-30
**Status:** Approved (brainstorming) — ready for implementation plan
**Repo:** rider-booking (Next.js static export + Google Apps Script backend + Google Sheet)

## 1. Goal

Turn the current **single-city** rider shift-booking system into a **multi-city** one driven by the
`Target.xlsx` order forecast (9 cities × 5 weeks), where:

- Each rider belongs to **one city** and only sees/books that city's shifts.
- Forecast for all 5 weeks is imported, but only **next week (Week 1: 01–07 Jun 2026)** is bookable.
- Shifts are **2/4/6-hour** blocks, capacity sized to demand (+15% sickness margin, reusing the
  forecast's existing buffer column).
- A redesigned, tabbed **admin** plus a scoped **shift-leader** view let staff manage shift rosters
  and attendance. There is no live GPS/clock-in feed — leaders see who **booked** and mark attendance
  manually.

## 2. Approved decisions

| Topic | Decision |
|---|---|
| Backend approach | Extend the existing `code.gs` + Google Sheet (lowest risk) |
| Per-city login | `City` stored on each rider record; admin assigns; rider auto-scoped to their city |
| Shift lengths | 2 / 4 / 6 hours |
| Capacity formula | `ceil(peak Riders-Needed over the shift's slots)`; the forecast's existing "Riders Needed (with 15% buffer)" column **is** the sickness-adjusted number (one 15%, not stacked) |
| Supply | 500 riders total (NB1–NB500); **demand-driven** (not supply-capped). Config flag reserved for supply-capping later |
| Availability gate | Import all 5 weeks of forecast; generate bookable shifts for **Week 1 only**; later weeks released via admin action |
| Live ops | **Manual** attendance (no live presence). Roster shows who booked; leaders mark attendance |
| Attendance depth | Full: `Attendance` (SCHEDULED/PRESENT/LATE/NO_SHOW/LEFT_EARLY), `Check-in At`, `Ops Notes` + contact + reliability |
| Extra admin tool | Standby / fill-gap list (broadcast / ranking / audit-log deferred) |
| Shift-leader role | `Role` flag on rider record; logs in with NB + email; scoped to **their city**; can view roster + mark attendance + see standby; no shift CRUD, no admin password |
| Cities (9) | Berlin, Osnabrück, Hannover, Kassel, Halle (Saale), Bremen, Oldenburg, Rheine, Hamm |

## 3. Data model (Google Sheet)

Add columns (append to the right; existing code reads by header name so order is safe):

- **Riders**: `+ City`, `+ Role` (RIDER default, LEADER). Backfill existing active riders as `Berlin`/`RIDER`.
- **Shifts**: `+ City`. `ShiftID` becomes **city-prefixed**: `BER-S0001`, `BRE-S0001`, etc. Legacy
  shifts backfilled `City = Berlin` (IDs may stay as-is; new generated IDs use the prefix scheme).
- **Forecast**: `+ City`; contents **replaced** with the reshaped 9-city data:
  `City | Date | Day | Time | Orders | Riders Needed`.
- **Bookings**: `+ Attendance`, `+ Check-in At`, `+ Ops Notes`. (City derivable via the booking's
  ShiftID/rider; store `+ City` too for simple filtering.)
- **Coverage**, **Rider_Hours**: `+ City` so analytics stay per-city.

City display-name normalization map (sheet tab → display): `Osnabruck→Osnabrück`, `kassel→Kassel`,
`Halle saale→Halle (Saale)`; others unchanged.

## 4. Forecast import pipeline (deliverable)

A local Node/Python script (`scripts/build-forecast.mjs` or `.py`) that:

1. Reads `Target.xlsx` (9 sheets, 5-week-wide layout: 48 half-hour rows, Mon–Sun per week block).
2. Emits one **tall CSV** `forecast-import.csv` with columns
   `City,Date,Day,Time,Orders,Riders Needed`.
3. Computes `Riders Needed = ceil(Orders / orders_per_rider_hr * (1 + buffer_pct))` per 30-min slot,
   using `orders_per_rider_hr=2`, `buffer_pct=0.15` (matches existing Config).
4. Covers 01/06/2026–05/07/2026 (all 5 weeks).

The user imports this CSV into the `Forecast` tab (File → Import → Replace current sheet).

## 5. Shift generator (`adminGenerateShifts`)

New backend action. Per `city` + target `week`:

1. Load the city's `Forecast` rows for the week's dates.
2. For each date: find **operating hours** = contiguous spans where `Riders Needed > 0`
   (rounded to whole hours).
3. **Tile** each span back-to-back with shift lengths from `{6,4,2}` using greedy longest-fit
   (e.g. 12h → 6+6; 10h → 6+4; 8h → 6+2 or 4+4 per rule; 2h → 2).
4. Each shift's **Capacity** = `ceil(max Riders-Needed across the 30-min slots it spans)`.
5. Create `Shifts` rows (`City`, prefixed `ShiftID`, Date, Day, Start, End, Hours, Capacity,
   Booked=0, Available=Capacity, Status=`OPEN`, Overnight flag if End ≤ Start, Notes="auto").
6. **Idempotency:** skip dates/cities that already have generated shifts unless `regenerate=true`;
   never delete a shift that has live (BOOKED) bookings.
7. Only **Week 1** is generated at launch. `adminReleaseWeek(n)` runs the same generator for week _n_.

Half-hour boundaries and odd-length spans: round operating window outward to whole hours; if a span's
hour-length isn't expressible as a sum of {2,4,6} exactly, the final tile absorbs the remainder
(min shift 2h). **Generated shifts for 2–3 cities will be reviewed against demand before finalizing.**

## 6. Auth & roles

`validateRider` returns `{ City, Role }` in addition to existing fields.

- **Rider** (Role=RIDER): `getDates`/`getShifts` filtered to `rider.City`. Sees a "📍 City" banner on `/book`.
- **Shift leader** (Role=LEADER): logs in at **`/leader`** with NB + email. New actions:
  - `leaderGetRoster({nb,email})` → validates LEADER, returns that city's shifts + bookings (roster)
    + standby list. No admin password.
  - `setAttendance({nb,email,bookingId,attendance,notes})` → allowed for the booking's-city LEADER or admin.
- **Admin** (password, unchanged): full access across all cities.

## 7. Backend API changes (`code.gs`)

Changed: `validateRider`, `getDates`, `getShifts`, `getMyBookings` (city-aware); `adminGetData`
(+ city/attendance fields, + per-city standby computation or done client-side); `adminAddShift`,
`adminEditShift`, `adminUpdateRider` (+ city/role).

New: `adminGenerateShifts`, `adminReleaseWeek`, `adminBulkAssignCity`, `setAttendance`,
`leaderGetRoster`. Add `'city'`/normalization helper. ShiftID generation becomes per-city.

## 8. Frontend — rider (`/book`)

- City banner ("📍 Berlin") on the identify step, populated from the validate/getMyBookings response.
- No other UX change — shifts arrive pre-filtered to the rider's city.

## 9. Frontend — admin (`/admin`, tabbed, multi-city)

Global **city selector** in the header; every tab respects it.

Tabs:
1. **Roster** (renamed from "Today/Live") — for the selected city, shifts grouped
   *On now · Starting soon · Upcoming today · Ended today* (by clock time, not presence). Each shift
   expands to its **booked-rider roster** with one-tap **call / WhatsApp / email** and an
   **attendance toggle**. Understaffed (booked < capacity) flagged. Top strip: booked-vs-demand,
   no-shows today, gaps. **Standby / fill-gap list**: active riders in the city not booked on that
   shift's time, with contact buttons.
2. **Coverage** — demand-vs-booked grid (day × time) per city.
3. **Shifts** *(enhanced)* — + City column/filter, + **Generate Week N** / **Release next week** buttons.
4. **Riders** *(enhanced "Users")* — + City + Role assignment, + bulk activate/assign-city,
   + reliability (no-show / cancel rate, hours).
5. **Bookings** *(enhanced)* — + City filter, + Attendance column.
6. **Hours** *(enhanced)* — + City filter.
7. **Overview** *(enhanced)* — per-city KPI cards.

## 10. Frontend — shift leader (`/leader`)

NB + email login → scoped **Roster** view (same component as admin Roster, locked to the leader's
city, no shift CRUD). Mark attendance, contact riders, see standby.

## 11. One-time migration steps (documented, run by user)

1. Add the new columns to each tab (headers).
2. Build & import `forecast-import.csv` into `Forecast` (replace contents).
3. Set Config: confirm `orders_per_rider_hr=2`, `buffer_pct=0.15`; add `supply_cap=FALSE`.
4. Assign cities/roles to active riders (incl. a test rider, e.g. NB42 → Berlin; one LEADER for testing).
5. Run `adminGenerateShifts` for Week 1 (all cities) — replaces legacy 01/06 single-city shifts
   (skips any with live bookings).
6. Deploy the updated Apps Script (new web-app version) and the rebuilt Next.js app.

## 12. Consequences & open items

- **Demand-driven capacity** → Berlin capacities exceed the 500-rider workforce; shifts won't all
  fill. Expected. `supply_cap` flag reserved to enable proportional capping later.
- Tiling at half-hour boundaries / odd spans — confirm against real generated output for 2–3 cities.
- City assignment for the existing active rider(s) to be confirmed for testing.

## 13. Verification

- Generator: spot-check 2–3 cities' Week-1 shifts vs forecast (coverage ≥ demand each slot; capacities sane).
- Rider: NB+email in city A sees only city-A shifts; cannot see/book city B.
- Leader: NB+email LEADER sees only their city roster; can mark attendance; cannot CRUD shifts.
- Booking caps (8h/day, 56h/week, 160h total) still enforced per rider across their city.
- Build passes; deployed `/book` and `/admin` work end-to-end (browser-tested).
