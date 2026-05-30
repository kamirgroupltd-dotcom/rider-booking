// scripts/build-forecast.mjs
import XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
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
const headers = ["City", "Date", "Day", "Time", "Orders", "Riders Needed", "Slot"];
const esc = (v) => {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const lines = [headers.join(",")];
for (const r of all) {
  lines.push([r.City, r.Date, r.Day, r.Time, r.Orders, r.RidersNeeded, r.slot].map(esc).join(","));
}
mkdirSync("scripts/out", { recursive: true });
writeFileSync(OUTPUT, lines.join("\n"), "utf8");

// Summary to stdout for sanity-checking
const byCity = {};
for (const r of all) byCity[r.City] = (byCity[r.City] || 0) + r.Orders;
console.log(`Wrote ${all.length} rows to ${OUTPUT}`);
console.log("Total forecast orders per city:");
for (const [c, o] of Object.entries(byCity)) console.log(`  ${c}: ${Math.round(o).toLocaleString()}`);
