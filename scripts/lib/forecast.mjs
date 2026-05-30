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

export function ridersNeeded(orders, ordersPerRiderHr = ORDERS_PER_RIDER_HR, bufferPct = BUFFER_PCT) {
  const o = Number(orders) || 0;
  if (o <= 0) return 0;
  return Math.ceil((o / ordersPerRiderHr) * (1 + bufferPct));
}

const WEEK_BLOCK_COLS = [2, 12, 22, 32, 42]; // "Tot" column index of each of the 5 week blocks (Time=+1, Mon..Sun=+2..+8)
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

export function timeToSlot(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

// Active mask that bridges a single isolated 30-min zero-dip (active on both sides)
// so a momentary lull doesn't fragment a day into spurious overlapping spans.
// Capacity is still computed from the real per-slot demand later, so bridged
// slots contribute 0 to a tile's peak — they only preserve span continuity.
function bridgedMask(ridersBySlot) {
  const n = ridersBySlot.length;
  const active = ridersBySlot.map((v) => (Number(v) || 0) > 0);
  const out = active.slice();
  for (let i = 1; i < n - 1; i++) {
    if (!active[i] && active[i - 1] && active[i + 1]) out[i] = true;
  }
  return out;
}

const MERGE_GAP_HOURS = 1; // demand spans separated by <= 1h are merged into one window

export function findOperatingSpans(ridersBySlot) {
  const active = bridgedMask(ridersBySlot);
  const n = active.length;

  // 1) Raw contiguous active slot-runs -> whole-hour [startHour, endHour) windows.
  const raw = [];
  let i = 0;
  while (i < n) {
    if (!active[i]) { i++; continue; }
    let j = i;
    while (j < n && active[j]) j++;
    raw.push({ startHour: Math.floor(i / 2), endHour: Math.min(24, Math.ceil(j / 2)) });
    i = j;
  }

  // 2) Merge windows within MERGE_GAP_HOURS of each other. This folds tiny tail
  //    blips into the adjacent shift and removes the near-midnight fragments that
  //    used to round into overlapping shifts. Genuine split-service gaps (a dead
  //    afternoon between lunch and dinner) are wider than 1h and stay separate.
  const merged = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.startHour - last.endHour <= MERGE_GAP_HOURS) {
      last.endHour = Math.max(last.endHour, s.endHour);
    } else {
      merged.push({ ...s });
    }
  }

  // 3) Even-length rounding so 2/4/6 tile exactly: prefer extending the end
  //    forward, but at the midnight boundary extend the start backward instead
  //    so a shift never overshoots 24:00.
  for (const s of merged) {
    if ((s.endHour - s.startHour) % 2 === 1) {
      if (s.endHour < 24) s.endHour += 1;
      else s.startHour = Math.max(0, s.startHour - 1);
    }
  }

  // 4) Final guard: clamp each start to the previous end so rounding can never
  //    produce overlapping windows.
  for (let k = 1; k < merged.length; k++) {
    if (merged[k].startHour < merged[k - 1].endHour) merged[k].startHour = merged[k - 1].endHour;
  }

  return merged.filter((s) => s.endHour - s.startHour >= 2);
}

function hhmm(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

// peak ridersNeeded across the slots covering [startHour, endHour)
export function peakOverHours(ridersBySlot, startHour, endHour) {
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

// Consistent shift windows for a whole week. The union of demand across all days
// (per slot, the busiest day) defines the operating envelope, so every day gets the
// SAME window boundaries — then capacity is sized per day. daySlotArrays: 48-slot
// arrays. Returns numeric [{startHour, endHour, hours, overnight}].
export function weeklyWindows(daySlotArrays) {
  const union = new Array(SLOTS_PER_DAY).fill(0);
  for (const arr of daySlotArrays) {
    for (let i = 0; i < SLOTS_PER_DAY; i++) union[i] = Math.max(union[i], arr[i] || 0);
  }
  const windows = [];
  for (const { startHour, endHour } of findOperatingSpans(union)) {
    let h = startHour;
    let remaining = endHour - startHour;
    while (remaining > 0) {
      const len = SHIFT_LENGTHS.find((L) => L <= remaining) ?? 2;
      windows.push({ startHour: h, endHour: h + len, hours: len, overnight: h + len >= 24 });
      h += len;
      remaining -= len;
    }
  }
  return windows;
}

// Generate a city's whole-week shifts: consistent windows (from weeklyWindows),
// capacity = THAT day's peak ridersNeeded in the window. Windows with no demand on
// a given day are skipped (no empty shifts). days: [{date, day, slots:48-array}].
export function weekShifts(days) {
  const windows = weeklyWindows(days.map((d) => d.slots));
  const out = [];
  for (const d of days) {
    for (const w of windows) {
      const capacity = peakOverHours(d.slots, w.startHour, w.endHour);
      if (capacity <= 0) continue;
      out.push({
        date: d.date, day: d.day,
        start: hhmm(w.startHour), end: hhmm(w.endHour),
        hours: w.hours, capacity, overnight: w.overnight,
      });
    }
  }
  return out;
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
