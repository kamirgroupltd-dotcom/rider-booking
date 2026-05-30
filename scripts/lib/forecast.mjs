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

const WEEK_BLOCK_COLS = [2, 13, 24, 35, 46]; // "Tot" column index of each of the 5 week blocks
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
