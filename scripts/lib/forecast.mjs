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
