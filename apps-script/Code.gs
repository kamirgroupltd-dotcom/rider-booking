/**
 * RIDER SHIFT BOOKING — Apps Script Backend
 *
 * SETUP STEPS (one-time):
 *  1. Upload RiderShiftBooking.xlsx to Google Drive, open with Google Sheets.
 *     This converts it to a Google Sheet. Copy the Sheet ID from the URL
 *     (the long string between /d/ and /edit) and paste into SHEET_ID below.
 *  2. In the Sheet: Extensions → Apps Script → delete any default code →
 *     paste this entire file → save (name it e.g. "RiderShiftBackend").
 *  3. Click "Deploy" → "New deployment" → type "Web app".
 *       Description: rider-shift-v1
 *       Execute as:  Me  (your account)
 *       Who has access: Anyone
 *     Click Deploy, authorize the prompts, copy the Web app URL.
 *  4. Paste that URL into the rider page (index.html) and admin page
 *     (admin.html) into the API_URL constant near the top.
 *  5. Optional override of admin password: in Apps Script editor →
 *     Project Settings (gear) → Script Properties → add property
 *     ADMIN_PASSWORD = your-strong-password. This overrides the Config sheet value.
 */

const SHEET_ID = '1VCnAbN49yuzuS37HswDmYLQxE5aA5JX6oN1rAvyygmE';

// ============== MULTI-CITY CONFIG ==============

// Sheet-tab name -> display name. Other names pass through unchanged.
const NORMALIZE_CITY = {
  'Osnabruck': 'Osnabrück',
  'kassel': 'Kassel',
  'Halle saale': 'Halle (Saale)'
};
// Display name -> ShiftID prefix (BER-S0001 etc). Distinct 3-letter codes.
const CITY_PREFIX = {
  'Berlin': 'BER', 'Osnabrück': 'OSN', 'Hannover': 'HAN', 'Kassel': 'KAS',
  'Halle (Saale)': 'HAL', 'Bremen': 'BRE', 'Oldenburg': 'OLD', 'Rheine': 'RHE', 'Hamm': 'HAM'
};
// Shift generation (mirrors Phase 1 scripts/lib/forecast.mjs — keep in sync).
const SHIFT_LENGTHS = [6, 4, 2];   // greedy longest-fit order
const MERGE_GAP_HOURS = 1;         // merge demand windows separated by <= 1h
// Week 1 (next week) Monday. adminReleaseWeek(n) offsets from here.
const WEEK1_MONDAY = '2026-06-01';

function normalizeCity(name) { return NORMALIZE_CITY[name] || name; }
function cityPrefix(city) {
  const c = normalizeCity(city);
  return CITY_PREFIX[c] || c.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

// ============== HTTP ENTRY POINTS ==============

function doGet(e) { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    let p = {};
    if (e && e.postData && e.postData.contents) {
      try { p = JSON.parse(e.postData.contents); }
      catch (err) { p = e.parameter || {}; }
    } else {
      p = (e && e.parameter) || {};
    }
    const action = p.action;
    let result;
    switch (action) {
      case 'ping':              result = { ok: true, msg: 'pong' }; break;
      case 'getShifts':         result = getShifts(p); break;
      case 'getDates':          result = getDates(p); break;
      case 'getMyBookings':     result = getMyBookings(p); break;
      case 'book':              result = bookShift(p); break;
      case 'cancel':            result = cancelBooking(p); break;
      case 'adminLogin':        result = adminLogin(p); break;
      case 'adminGetData':      result = adminGetData(p); break;
      case 'adminCancel':       result = adminCancel(p); break;
      case 'adminAddShift':     result = adminAddShift(p); break;
      case 'adminEditShift':    result = adminEditShift(p); break;
      case 'adminDeleteShift':  result = adminDeleteShift(p); break;
      case 'adminUpdateRider':  result = adminUpdateRider(p); break;
      // --- Phase 2: multi-city ---
      case 'adminGenerateShifts': result = adminGenerateShifts(p); break;
      case 'adminReleaseWeek':    result = adminReleaseWeek(p); break;
      case 'adminBulkAssignCity': result = adminBulkAssignCity(p); break;
      case 'adminWipeBookings':   result = adminWipeBookings(p); break;
      case 'setAttendance':       result = setAttendance(p); break;
      case 'leaderGetRoster':     result = leaderGetRoster(p); break;
      default: result = { ok: false, error: 'Unknown action: ' + action };
    }
    return out(result);
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============== HELPERS ==============

function ss() { return SpreadsheetApp.openById(SHEET_ID); }

function getConfig() {
  const sh = ss().getSheetByName('Config');
  const data = sh.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) cfg[data[i][0]] = data[i][1];
  }
  return cfg;
}

function adminPassword() {
  const override = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (override) return override;
  return getConfig().admin_password || '';
}

function fmtDate(d) {
  if (d instanceof Date) {
    // Use UTC components to avoid timezone drift. Google Sheets stores
    // date/time cells with their displayed value anchored to UTC.
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dy;
  }
  return String(d);
}

function fmtTime(t) {
  if (t instanceof Date) {
    // UTC formatting — see fmtDate note. Without this, script timezone
    // drift (e.g. Asia/Singapore default on some Gmail accounts) shifts
    // 17:00 to 01:00 next day.
    const hh = String(t.getUTCHours()).padStart(2, '0');
    const mm = String(t.getUTCMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  return String(t);
}

function getWeekStart(dateStr) {
  // Mon-Sun weeks. Returns the Monday of the week containing dateStr (YYYY-MM-DD).
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function getWeekEnd(dateStr) {
  const d = new Date(getWeekStart(dateStr) + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function parseShiftDateTime(dateStr, timeStr) {
  return new Date(fmtDate(dateStr) + 'T' + fmtTime(timeStr) + ':00');
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { rows: [], headers: data[0] || [] };
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const o = { _row: i + 1 };
    headers.forEach((h, j) => o[h] = data[i][j]);
    rows.push(o);
  }
  return { rows, headers };
}

// ============== PUBLIC ACTIONS ==============

// True when a row matches the requested city. Lenient: if no city was requested,
// or the row has no City value (pre-migration data), it matches.
function cityMatch(row, wantCity) {
  if (!wantCity) return true;
  if (row.City === undefined || row.City === null || row.City === '') return true;
  return normalizeCity(row.City) === normalizeCity(wantCity);
}

function getDates(p) {
  p = p || {};
  const { rows } = sheetToObjects(ss().getSheetByName('Shifts'));
  const dates = {};
  rows.filter(r => cityMatch(r, p.city)).forEach(r => {
    const d = fmtDate(r.Date);
    if (!dates[d]) dates[d] = { date: d, day: r.Day, shifts: 0, capacity: 0, booked: 0 };
    dates[d].shifts += 1;
    dates[d].capacity += Number(r.Capacity) || 0;
    dates[d].booked += Number(r.Booked) || 0;
  });
  return { ok: true, dates: Object.values(dates).sort((a,b) => a.date.localeCompare(b.date)) };
}

function getShifts(p) {
  const { rows } = sheetToObjects(ss().getSheetByName('Shifts'));
  const filtered = rows
    .filter(r => cityMatch(r, p.city))
    .filter(r => !p.date || fmtDate(r.Date) === p.date)
    .filter(r => r.Status === 'OPEN' || r.Status === 'FULL' || !p.openOnly)
    .map(r => ({
      ShiftID: r.ShiftID,
      City: r.City || '',
      Date: fmtDate(r.Date),
      Day: r.Day,
      Start: fmtTime(r.Start),
      End: fmtTime(r.End),
      Hours: Number(r.Hours),
      Capacity: Number(r.Capacity),
      Booked: Number(r.Booked) || 0,
      Available: Math.max(0, Number(r.Capacity) - (Number(r.Booked) || 0)),
      Status: r.Status,
      Overnight: r.Overnight
    }))
    .sort((a,b) => a.Date.localeCompare(b.Date) || a.Start.localeCompare(b.Start));
  return { ok: true, shifts: filtered };
}

function getMyBookings(p) {
  const { nb, email } = p;
  if (!nb || !email) return { ok: false, error: 'NB and email required' };
  // validate rider
  const { rows: riders } = sheetToObjects(ss().getSheetByName('Riders'));
  const rider = riders.find(r => r['NB Number'] === nb);
  if (!rider) return { ok: false, error: 'NB number not found' };
  if (!rider.Email || String(rider.Email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
    return { ok: false, error: 'Email does not match NB number on file' };
  }
  const { rows: bks } = sheetToObjects(ss().getSheetByName('Bookings'));
  const mine = bks
    .filter(b => b['NB Number'] === nb && b.Status === 'BOOKED')
    .map(b => ({
      BookingID: b.BookingID,
      ShiftID: b.ShiftID,
      Date: fmtDate(b.Date),
      Day: b.Day,
      Start: fmtTime(b.Start),
      End: fmtTime(b.End),
      Hours: Number(b.Hours)
    }))
    .sort((a,b) => a.Date.localeCompare(b.Date) || a.Start.localeCompare(b.Start));
  // Hours rollups for client-side cap enforcement
  const hoursByWeek = {};
  const hoursByDate = {};
  let totalHours = 0;
  mine.forEach(b => {
    const ws = getWeekStart(b.Date);
    hoursByWeek[ws] = (hoursByWeek[ws] || 0) + b.Hours;
    hoursByDate[b.Date] = (hoursByDate[b.Date] || 0) + b.Hours;
    totalHours += b.Hours;
  });
  // Caps (from Config, with defaults)
  const cfg = getConfig();
  const caps = {
    maxDay: Number(cfg.max_hours_per_day) || 8,
    maxWeek: Number(cfg.max_hours_per_week) || 56,
    maxTotal: Number(cfg.max_hours_total) || 160
  };
  return {
    ok: true, name: rider.Name, bookings: mine, hoursByWeek, hoursByDate, totalHours, caps,
    city: normalizeCity(rider.City || ''), role: String(rider.Role || 'RIDER').toUpperCase()
  };
}

function bookShift(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const { shiftId, nb, name, email } = p;
    if (!shiftId || !nb || !name || !email) return { ok: false, error: 'Missing fields' };

    const cfg = getConfig();
    const ridersSh = ss().getSheetByName('Riders');
    const { rows: riders } = sheetToObjects(ridersSh);
    const rider = riders.find(r => r['NB Number'] === nb);
    if (!rider) return { ok: false, error: 'NB number not on register' };
    if (String(rider.Active).toUpperCase() !== 'YES') return { ok: false, error: 'Rider marked inactive' };
    if (!rider.Email) return { ok: false, error: 'No email on file for this NB — contact admin' };
    if (String(rider.Email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      return { ok: false, error: 'Email does not match the NB number on file' };
    }

    const shiftsSh = ss().getSheetByName('Shifts');
    const { rows: shifts } = sheetToObjects(shiftsSh);
    const shift = shifts.find(s => s.ShiftID === shiftId);
    if (!shift) return { ok: false, error: 'Shift not found' };
    if (shift.Status !== 'OPEN') return { ok: false, error: 'Shift is ' + shift.Status };
    const booked = Number(shift.Booked) || 0;
    const cap = Number(shift.Capacity);
    if (booked >= cap) return { ok: false, error: 'Shift is full' };

    // close-time check
    const closeHrs = Number(cfg.booking_close_hours_before) || 0;
    if (closeHrs > 0) {
      const start = parseShiftDateTime(shift.Date, shift.Start);
      const cutoff = new Date(start.getTime() - closeHrs * 3600 * 1000);
      if (new Date() > cutoff) {
        return { ok: false, error: 'Booking closed for this shift (within ' + closeHrs + 'h of start)' };
      }
    }

    // existing bookings → enforce 8h/day, 56h/week, 160h/total, no duplicate of same shift
    const bookingsSh = ss().getSheetByName('Bookings');
    const { rows: bookings } = sheetToObjects(bookingsSh);
    const shiftDateStr = fmtDate(shift.Date);
    const wkStart = getWeekStart(shiftDateStr);
    const wkEnd = getWeekEnd(shiftDateStr);
    let dayH = 0, weekH = 0, totalH = 0;
    for (const b of bookings) {
      if (b['NB Number'] !== nb || b.Status !== 'BOOKED') continue;
      if (b.ShiftID === shiftId) return { ok: false, error: 'You have already booked this shift' };
      const bd = fmtDate(b.Date);
      const bh = Number(b.Hours) || 0;
      totalH += bh;
      if (bd === shiftDateStr) dayH += bh;
      if (bd >= wkStart && bd <= wkEnd) weekH += bh;
    }
    const maxDay = Number(cfg.max_hours_per_day) || 8;
    const maxWeek = Number(cfg.max_hours_per_week) || 56;
    const maxTotal = Number(cfg.max_hours_total) || 160;
    const h = Number(shift.Hours);
    if (dayH + h > maxDay) return { ok: false, error: 'Daily cap exceeded — you already have ' + dayH + 'h on ' + shiftDateStr + ', +' + h + 'h would breach ' + maxDay + 'h' };
    if (weekH + h > maxWeek) return { ok: false, error: 'Weekly cap exceeded — you already have ' + weekH + 'h in this week, +' + h + 'h would breach ' + maxWeek + 'h' };
    if (totalH + h > maxTotal) return { ok: false, error: 'Total cap exceeded — you already have ' + totalH + 'h booked overall, +' + h + 'h would breach ' + maxTotal + 'h cap' };

    // write booking
    const ts = new Date();
    const bookingId = 'B' + Utilities.formatDate(ts, 'GMT', 'yyyyMMddHHmmss') + '-' + nb.replace('NB','');
    bookingsSh.appendRow([
      bookingId, ts, shiftId, shiftDateStr, shift.Day,
      fmtTime(shift.Start), fmtTime(shift.End), h,
      nb, rider.Name || name, rider.Email, 'BOOKED', '', ''
    ]);
    // City + initial attendance live in columns appended to the right (migration);
    // set them by header so the positional append above stays valid.
    const bRow = bookingsSh.getLastRow();
    setCellByHeader(bookingsSh, bRow, 'City', normalizeCity(shift.City || rider.City || ''));
    setCellByHeader(bookingsSh, bRow, 'Attendance', 'SCHEDULED');
    shiftsSh.getRange(shift._row, headerCol(shiftsSh, 'Booked')).setValue(booked + 1);
    if (booked + 1 >= cap) {
      shiftsSh.getRange(shift._row, headerCol(shiftsSh, 'Status')).setValue('FULL');
    }

    if (String(cfg.email_confirmations).toUpperCase() === 'TRUE') {
      try {
        MailApp.sendEmail({
          to: rider.Email,
          subject: `Shift booked — ${shiftDateStr} ${fmtTime(shift.Start)}–${fmtTime(shift.End)}`,
          body: `Hi ${rider.Name || name},\n\nYour shift is confirmed.\n\nDate: ${shiftDateStr} (${shift.Day})\nTime: ${fmtTime(shift.Start)}–${fmtTime(shift.End)}\nHours: ${h}\nBooking ID: ${bookingId}\n\nTo cancel: visit the booking page and use "My bookings".`
        });
      } catch (e) { /* swallow */ }
    }

    return { ok: true, bookingId, message: 'Shift booked' };
  } finally {
    lock.releaseLock();
  }
}

function headerCol(sheet, header) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(header) + 1;
}

function cancelBooking(p) {
  const cfg = getConfig();
  if (String(cfg.allow_self_cancel).toUpperCase() !== 'TRUE') {
    return { ok: false, error: 'Self-cancellation disabled — contact admin' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const { bookingId, nb, email } = p;
    if (!bookingId || !nb || !email) return { ok: false, error: 'Missing fields' };
    const { rows: riders } = sheetToObjects(ss().getSheetByName('Riders'));
    const rider = riders.find(r => r['NB Number'] === nb);
    if (!rider || String(rider.Email || '').trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      return { ok: false, error: 'NB / email mismatch' };
    }
    const bookingsSh = ss().getSheetByName('Bookings');
    const { rows: bookings } = sheetToObjects(bookingsSh);
    const b = bookings.find(x => x.BookingID === bookingId);
    if (!b) return { ok: false, error: 'Booking not found' };
    if (b['NB Number'] !== nb) return { ok: false, error: 'Booking does not belong to this NB' };
    if (b.Status !== 'BOOKED') return { ok: false, error: 'Booking already ' + b.Status };
    // cancel-close-time check — independent of booking close time. Default 24h.
    let cancelHrs = Number(cfg.cancel_close_hours_before);
    if (isNaN(cancelHrs)) cancelHrs = 24;
    if (cancelHrs > 0) {
      const start = parseShiftDateTime(b.Date, b.Start);
      const cutoff = new Date(start.getTime() - cancelHrs * 3600 * 1000);
      if (new Date() > cutoff) return { ok: false, error: 'Cancellation closed — too close to shift start (within ' + cancelHrs + 'h). Contact admin if you genuinely cannot work this shift.' };
    }
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Status')).setValue('CANCELLED');
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Cancelled At')).setValue(new Date());
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Cancel Reason')).setValue('rider self-cancel');
    // decrement shift
    const shiftsSh = ss().getSheetByName('Shifts');
    const { rows: shifts } = sheetToObjects(shiftsSh);
    const sh = shifts.find(x => x.ShiftID === b.ShiftID);
    if (sh) {
      shiftsSh.getRange(sh._row, headerCol(shiftsSh, 'Booked')).setValue(Math.max(0, Number(sh.Booked) - 1));
      shiftsSh.getRange(sh._row, headerCol(shiftsSh, 'Status')).setValue('OPEN');
    }
    return { ok: true, message: 'Booking cancelled' };
  } finally {
    lock.releaseLock();
  }
}

// ============== ADMIN ACTIONS ==============

function adminLogin(p) {
  const pw = adminPassword();
  if (!pw) return { ok: false, error: 'No admin password configured' };
  if (p.password === pw) return { ok: true, token: Utilities.getUuid() };
  return { ok: false, error: 'Wrong password' };
}

function requireAdmin(p) {
  if (p.password !== adminPassword()) throw new Error('Admin password required');
}

function adminGetData(p) {
  requireAdmin(p);
  const shifts = sheetToObjects(ss().getSheetByName('Shifts')).rows.map(r => ({
    _row: r._row,
    ShiftID: r.ShiftID, City: normalizeCity(r.City || ''), Date: fmtDate(r.Date), Day: r.Day,
    Start: fmtTime(r.Start), End: fmtTime(r.End),
    Hours: Number(r.Hours), Capacity: Number(r.Capacity),
    Booked: Number(r.Booked) || 0,
    Available: Math.max(0, Number(r.Capacity) - (Number(r.Booked) || 0)),
    Status: r.Status, Overnight: r.Overnight, Notes: r.Notes || ''
  }));
  const bookings = sheetToObjects(ss().getSheetByName('Bookings')).rows.map(r => ({
    _row: r._row,
    BookingID: r.BookingID,
    Timestamp: r.Timestamp ? Utilities.formatDate(new Date(r.Timestamp), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
    ShiftID: r.ShiftID, City: normalizeCity(r.City || ''), Date: fmtDate(r.Date), Day: r.Day,
    Start: fmtTime(r.Start), End: fmtTime(r.End),
    Hours: Number(r.Hours), NB: r['NB Number'],
    Name: r.Name, Email: r.Email, Status: r.Status,
    Attendance: r.Attendance || (r.Status === 'BOOKED' ? 'SCHEDULED' : ''),
    CheckInAt: r['Check-in At'] ? Utilities.formatDate(new Date(r['Check-in At']), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
    OpsNotes: r['Ops Notes'] || '',
    CancelledAt: r['Cancelled At'] ? Utilities.formatDate(new Date(r['Cancelled At']), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
    CancelReason: r['Cancel Reason'] || ''
  }));
  const riders = sheetToObjects(ss().getSheetByName('Riders')).rows.map(r => ({
    NB: r['NB Number'], Name: r.Name, Email: r.Email,
    Phone: r['Phone (optional)'], Active: r.Active,
    City: normalizeCity(r.City || ''), Role: String(r.Role || 'RIDER').toUpperCase()
  }));
  return { ok: true, shifts, bookings, riders };
}

function adminCancel(p) {
  requireAdmin(p);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const { bookingId, reason } = p;
    const bookingsSh = ss().getSheetByName('Bookings');
    const { rows: bookings } = sheetToObjects(bookingsSh);
    const b = bookings.find(x => x.BookingID === bookingId);
    if (!b) return { ok: false, error: 'Booking not found' };
    if (b.Status !== 'BOOKED') return { ok: false, error: 'Already ' + b.Status };
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Status')).setValue('CANCELLED');
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Cancelled At')).setValue(new Date());
    bookingsSh.getRange(b._row, headerCol(bookingsSh, 'Cancel Reason')).setValue(reason || 'admin');
    const shiftsSh = ss().getSheetByName('Shifts');
    const { rows: shifts } = sheetToObjects(shiftsSh);
    const sh = shifts.find(x => x.ShiftID === b.ShiftID);
    if (sh) {
      shiftsSh.getRange(sh._row, headerCol(shiftsSh, 'Booked')).setValue(Math.max(0, Number(sh.Booked) - 1));
      shiftsSh.getRange(sh._row, headerCol(shiftsSh, 'Status')).setValue('OPEN');
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function adminAddShift(p) {
  requireAdmin(p);
  const { date, start, end, hours, capacity, notes, city } = p;
  if (!date || !start || !end || !hours || !capacity) return { ok: false, error: 'Missing fields' };
  const sh = ss().getSheetByName('Shifts');
  const { rows } = sheetToObjects(sh);
  const newId = nextShiftId(rows, city);
  const day = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
  appendRowByHeaders(sh, {
    ShiftID: newId, City: normalizeCity(city || ''), Date: date, Day: day,
    Start: start, End: end, Hours: hours, Capacity: capacity,
    Booked: 0, Available: capacity, Status: 'OPEN',
    Overnight: (fmtTime(end) <= fmtTime(start)) ? 'YES' : 'NO', Notes: notes || ''
  });
  return { ok: true, shiftId: newId };
}

// Next ShiftID. City-prefixed (BER-S0001) when a city is given, else legacy S0001.
// Sequence is per-prefix so each city has its own counter.
function nextShiftId(shiftRows, city) {
  const prefix = city ? cityPrefix(city) + '-S' : 'S';
  const re = new RegExp('^' + prefix.replace('-', '\\-') + '(\\d+)$');
  const maxNum = shiftRows.reduce((m, r) => {
    const mm = String(r.ShiftID || '').match(re);
    return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
  }, 0);
  return prefix + String(maxNum + 1).padStart(4, '0');
}

// Append a row mapping object keys to the sheet's header names (order-independent,
// survives newly-added columns). Returns the new row number.
function appendRowByHeaders(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function adminEditShift(p) {
  requireAdmin(p);
  const { shiftId, capacity, status, notes } = p;
  const sh = ss().getSheetByName('Shifts');
  const { rows } = sheetToObjects(sh);
  const s = rows.find(r => r.ShiftID === shiftId);
  if (!s) return { ok: false, error: 'Shift not found' };
  if (capacity !== undefined) {
    if (capacity < Number(s.Booked)) return { ok: false, error: `Capacity (${capacity}) cannot be less than current bookings (${s.Booked})` };
    sh.getRange(s._row, headerCol(sh, 'Capacity')).setValue(capacity);
    sh.getRange(s._row, headerCol(sh, 'Status')).setValue(Number(s.Booked) >= capacity ? 'FULL' : 'OPEN');
  }
  if (status) sh.getRange(s._row, headerCol(sh, 'Status')).setValue(status);
  if (notes !== undefined) sh.getRange(s._row, headerCol(sh, 'Notes')).setValue(notes);
  return { ok: true };
}

function adminDeleteShift(p) {
  requireAdmin(p);
  const { shiftId } = p;
  const sh = ss().getSheetByName('Shifts');
  const { rows } = sheetToObjects(sh);
  const s = rows.find(r => r.ShiftID === shiftId);
  if (!s) return { ok: false, error: 'Shift not found' };
  if (Number(s.Booked) > 0) return { ok: false, error: 'Cannot delete a shift with existing bookings — cancel those first' };
  sh.deleteRow(s._row);
  return { ok: true };
}

function adminUpdateRider(p) {
  requireAdmin(p);
  const { nb, name, email, phone, active, city, role } = p;
  const sh = ss().getSheetByName('Riders');
  const { rows } = sheetToObjects(sh);
  const r = rows.find(x => x['NB Number'] === nb);
  if (!r) return { ok: false, error: 'NB not found' };
  if (name !== undefined) sh.getRange(r._row, headerCol(sh, 'Name')).setValue(name);
  if (email !== undefined) sh.getRange(r._row, headerCol(sh, 'Email')).setValue(email);
  if (phone !== undefined) sh.getRange(r._row, headerCol(sh, 'Phone (optional)')).setValue(phone);
  if (active !== undefined) sh.getRange(r._row, headerCol(sh, 'Active')).setValue(active);
  if (city !== undefined) setCellByHeader(sh, r._row, 'City', normalizeCity(city));
  if (role !== undefined) setCellByHeader(sh, r._row, 'Role', String(role).toUpperCase());
  return { ok: true };
}

// Set a cell by header name; no-op if the column doesn't exist yet (pre-migration safe).
function setCellByHeader(sheet, row, header, value) {
  const col = headerCol(sheet, header);
  if (col > 0) sheet.getRange(row, col).setValue(value);
  return col > 0;
}

// ============== PHASE 2: SHIFT GENERATION ==============
// These three functions are a direct port of the unit-tested Phase 1 logic in
// scripts/lib/forecast.mjs. Keep them in sync if either side changes.

// Bridge a single isolated 30-min zero-dip so a momentary lull doesn't fragment
// a day into spurious overlapping spans. Bridged slots still contribute 0 demand.
function bridgedMask(ridersBySlot) {
  const n = ridersBySlot.length;
  const active = ridersBySlot.map(v => (Number(v) || 0) > 0);
  const out = active.slice();
  for (let i = 1; i < n - 1; i++) {
    if (!active[i] && active[i - 1] && active[i + 1]) out[i] = true;
  }
  return out;
}

function findOperatingSpans(ridersBySlot) {
  const active = bridgedMask(ridersBySlot);
  const n = active.length;
  const raw = [];
  let i = 0;
  while (i < n) {
    if (!active[i]) { i++; continue; }
    let j = i;
    while (j < n && active[j]) j++;
    raw.push({ startHour: Math.floor(i / 2), endHour: Math.min(24, Math.ceil(j / 2)) });
    i = j;
  }
  // Merge windows within MERGE_GAP_HOURS (folds tail blips, kills midnight fragments).
  const merged = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.startHour - last.endHour <= MERGE_GAP_HOURS) {
      last.endHour = Math.max(last.endHour, s.endHour);
    } else { merged.push({ startHour: s.startHour, endHour: s.endHour }); }
  }
  // Even-length rounding: extend end forward, but at midnight extend start back.
  for (const s of merged) {
    if ((s.endHour - s.startHour) % 2 === 1) {
      if (s.endHour < 24) s.endHour += 1; else s.startHour = Math.max(0, s.startHour - 1);
    }
  }
  // Guard: clamp starts so rounding can never overlap.
  for (let k = 1; k < merged.length; k++) {
    if (merged[k].startHour < merged[k - 1].endHour) merged[k].startHour = merged[k - 1].endHour;
  }
  return merged.filter(s => s.endHour - s.startHour >= 2);
}

function tileDay(ridersBySlot) {
  const hhmm = (hour) => { const h = ((hour % 24) + 24) % 24; return String(h).padStart(2, '0') + ':00'; };
  const peak = (start, end) => {
    let pk = 0;
    for (let slot = start * 2; slot < end * 2 && slot < ridersBySlot.length; slot++) pk = Math.max(pk, ridersBySlot[slot] || 0);
    return pk;
  };
  const shifts = [];
  for (const span of findOperatingSpans(ridersBySlot)) {
    let h = span.startHour;
    let remaining = span.endHour - span.startHour;
    while (remaining > 0) {
      let len = SHIFT_LENGTHS.find(L => L <= remaining); if (!len) len = 2;
      const segEnd = h + len;
      shifts.push({ start: hhmm(h), end: hhmm(segEnd), hours: len, capacity: peak(h, segEnd), overnight: segEnd >= 24 });
      h = segEnd; remaining -= len;
    }
  }
  return shifts;
}

// Consistent shift windows for a whole week: the union of demand across all 7 days
// (per slot, the busiest day) defines one operating envelope, tiled into 2/4/6h.
// Every day then gets the SAME window boundaries; capacity is sized per day below.
function weeklyWindows(daySlotArrays) {
  const union = new Array(48).fill(0);
  daySlotArrays.forEach(arr => { for (let i = 0; i < 48; i++) union[i] = Math.max(union[i], arr[i] || 0); });
  const windows = [];
  findOperatingSpans(union).forEach(span => {
    let h = span.startHour, remaining = span.endHour - span.startHour;
    while (remaining > 0) {
      let len = SHIFT_LENGTHS.find(L => L <= remaining); if (!len) len = 2;
      windows.push({ startHour: h, endHour: h + len, hours: len, overnight: (h + len) >= 24 });
      h += len; remaining -= len;
    }
  });
  return windows;
}
function peakOverHours(ridersBySlot, startHour, endHour) {
  let pk = 0;
  for (let slot = startHour * 2; slot < endHour * 2 && slot < ridersBySlot.length; slot++) pk = Math.max(pk, ridersBySlot[slot] || 0);
  return pk;
}
function hhmmHour(hour) { const h = ((hour % 24) + 24) % 24; return String(h).padStart(2, '0') + ':00'; }

// Build a 48-slot riders-needed array from this date's Forecast rows.
function buildRidersBySlot(forecastRows) {
  const arr = new Array(48).fill(0);
  forecastRows.forEach(r => {
    // Prefer the numeric Slot column (0-47): Google Sheets imports "00:00" as a
    // *time value*, and re-parsing it through fmtTime() shifts every slot by the
    // spreadsheet timezone (the 2am-shift bug). Slot is timezone-proof.
    let slot;
    if (r.Slot !== undefined && r.Slot !== null && r.Slot !== '') {
      slot = Number(r.Slot);
    } else {
      const m = String(fmtTime(r.Time)).match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return;
      slot = Number(m[1]) * 2 + (Number(m[2]) >= 30 ? 1 : 0);
    }
    if (slot >= 0 && slot < 48) {
      arr[slot] = Math.max(arr[slot], Number(r['Riders Needed']) || 0);
    }
  });
  return arr;
}

// 7 ISO dates Mon..Sun for the week starting at mondayISO.
function weekDates(mondayISO) {
  const out = [];
  const base = new Date(mondayISO + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    out.push(Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd'));
  }
  return out;
}
function isoDayName(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'GMT' });
}
function maxShiftSeq(rows, city) {
  const prefix = cityPrefix(city) + '-S';
  const re = new RegExp('^' + prefix.replace('-', '\\-') + '(\\d+)$');
  return rows.reduce((m, r) => { const mm = String(r.ShiftID || '').match(re); return mm ? Math.max(m, parseInt(mm[1], 10)) : m; }, 0);
}

// Generate bookable 2/4/6h shifts for one city + one week from the imported Forecast.
// Idempotent: skips a city+date that already has generated shifts unless regenerate=true,
// and never deletes a shift that has live (BOOKED) bookings.
function adminGenerateShifts(p) {
  requireAdmin(p);
  if (!p.city) return { ok: false, error: 'city required' };
  const city = normalizeCity(p.city);
  const weekStart = p.weekStart || WEEK1_MONDAY;
  const regenerate = (String(p.regenerate) === 'true' || p.regenerate === true);
  const dates = weekDates(weekStart);
  const dateSet = {}; dates.forEach(d => dateSet[d] = true);

  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const shiftsSh = ss().getSheetByName('Shifts');
    const forecast = sheetToObjects(ss().getSheetByName('Forecast')).rows
      .filter(r => normalizeCity(r.City) === city && dateSet[fmtDate(r.Date)]);
    if (!forecast.length) return { ok: false, error: 'No forecast rows for ' + city + ' in week of ' + weekStart + ' — import the forecast CSV first.' };

    // Per-day demand arrays, then ONE consistent set of windows from the week's union.
    const dayArr = {};
    dates.forEach(iso => { dayArr[iso] = buildRidersBySlot(forecast.filter(r => fmtDate(r.Date) === iso)); });
    const windows = weeklyWindows(dates.map(iso => dayArr[iso]));

    // Which shifts (with live bookings) already exist, per city+date.
    let shiftRows = sheetToObjects(shiftsSh).rows;
    const bookedShiftIds = {};
    sheetToObjects(ss().getSheetByName('Bookings')).rows
      .filter(b => b.Status === 'BOOKED').forEach(b => bookedShiftIds[b.ShiftID] = true);

    let seq = maxShiftSeq(shiftRows, city);
    let created = 0; const skipped = []; const deleted = [];

    dates.forEach(iso => {
      const existing = shiftRows.filter(r => normalizeCity(r.City) === city && fmtDate(r.Date) === iso);
      if (existing.length && !regenerate) { skipped.push(iso); return; }
      if (existing.length && regenerate) {
        // delete existing OPEN/empty shifts (bottom-up); keep any with live bookings.
        existing.filter(r => !bookedShiftIds[r.ShiftID]).sort((a, b) => b._row - a._row)
          .forEach(r => { shiftsSh.deleteRow(r._row); deleted.push(r.ShiftID); });
        shiftRows = sheetToObjects(shiftsSh).rows; // refresh after deletions
        seq = maxShiftSeq(shiftRows, city);
      }
      const arr = dayArr[iso];
      const day = isoDayName(iso);
      // Consistent windows; capacity = THIS day's peak in each window; skip empty windows.
      windows.forEach(w => {
        const capacity = peakOverHours(arr, w.startHour, w.endHour);
        if (capacity <= 0) return;
        const id = cityPrefix(city) + '-S' + String(++seq).padStart(4, '0');
        appendRowByHeaders(shiftsSh, {
          ShiftID: id, City: city, Date: iso, Day: day,
          Start: hhmmHour(w.startHour), End: hhmmHour(w.endHour), Hours: w.hours, Capacity: capacity,
          Booked: 0, Available: capacity, Status: 'OPEN',
          Overnight: w.overnight ? 'YES' : 'NO', Notes: 'auto'
        });
        created++;
      });
    });
    return { ok: true, city, weekStart, created, skipped, deleted, windows: windows.map(w => hhmmHour(w.startHour) + '-' + hhmmHour(w.endHour)) };
  } finally { lock.releaseLock(); }
}

// Release week N (1=next week). Runs the generator for the offset week.
function adminReleaseWeek(p) {
  requireAdmin(p);
  const n = Math.max(1, parseInt(p.week, 10) || 1);
  const base = new Date(WEEK1_MONDAY + 'T00:00:00Z');
  const weekStart = Utilities.formatDate(new Date(base.getTime() + (n - 1) * 7 * 86400000), 'GMT', 'yyyy-MM-dd');
  return adminGenerateShifts({ password: p.password, city: p.city, weekStart, regenerate: p.regenerate });
}

// ============== PHASE 2: RIDERS / ATTENDANCE / LEADER ==============

// Assign city/role/active to a list of NB numbers in one call.
function adminBulkAssignCity(p) {
  requireAdmin(p);
  let nbs = p.nbs;
  if (typeof nbs === 'string') nbs = nbs.split(',').map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(nbs) || !nbs.length) return { ok: false, error: 'nbs (array or comma list) required' };
  const sh = ss().getSheetByName('Riders');
  const { rows } = sheetToObjects(sh);
  const byNb = {}; rows.forEach(r => byNb[r['NB Number']] = r);
  let updated = 0; const missing = [];
  nbs.forEach(nb => {
    const r = byNb[nb];
    if (!r) { missing.push(nb); return; }
    if (p.city !== undefined) setCellByHeader(sh, r._row, 'City', normalizeCity(p.city));
    if (p.role !== undefined) setCellByHeader(sh, r._row, 'Role', String(p.role).toUpperCase());
    if (p.active !== undefined) sh.getRange(r._row, headerCol(sh, 'Active')).setValue(p.active);
    updated++;
  });
  return { ok: true, updated, missing };
}

const ATTENDANCE_VALUES = ['SCHEDULED', 'PRESENT', 'LATE', 'NO_SHOW', 'LEFT_EARLY'];

// Mark attendance on a booking. Allowed for admin, or the LEADER of the booking's city.
function setAttendance(p) {
  const bookingsSh = ss().getSheetByName('Bookings');
  const { rows } = sheetToObjects(bookingsSh);
  const b = rows.find(x => x.BookingID === p.bookingId);
  if (!b) return { ok: false, error: 'Booking not found' };

  const isAdmin = (p.password && p.password === adminPassword());
  if (!isAdmin) {
    const lead = validateLeader(p);
    if (!lead.ok) return lead;
    if (lead.city !== normalizeCity(b.City || '')) return { ok: false, error: 'Booking is outside your city' };
  }
  const att = String(p.attendance || '').toUpperCase();
  if (ATTENDANCE_VALUES.indexOf(att) < 0) return { ok: false, error: 'Invalid attendance: ' + att };

  setCellByHeader(bookingsSh, b._row, 'Attendance', att);
  if (p.notes !== undefined) setCellByHeader(bookingsSh, b._row, 'Ops Notes', p.notes);
  if (att === 'PRESENT' || att === 'LATE') setCellByHeader(bookingsSh, b._row, 'Check-in At', new Date());
  return { ok: true, bookingId: p.bookingId, attendance: att };
}

function validateLeader(p) {
  if (!p.nb || !p.email) return { ok: false, error: 'NB and email required' };
  const { rows } = sheetToObjects(ss().getSheetByName('Riders'));
  const r = rows.find(x => x['NB Number'] === p.nb);
  if (!r) return { ok: false, error: 'NB number not found' };
  if (String(r.Email || '').trim().toLowerCase() !== String(p.email).trim().toLowerCase()) {
    return { ok: false, error: 'Email does not match NB number on file' };
  }
  if (String(r.Role || 'RIDER').toUpperCase() !== 'LEADER') return { ok: false, error: 'This NB is not a shift leader' };
  return { ok: true, city: normalizeCity(r.City || ''), name: r.Name };
}

// Shift-leader roster: that city's shifts + BOOKED bookings + standby pool.
function leaderGetRoster(p) {
  const lead = validateLeader(p);
  if (!lead.ok) return lead;
  const city = lead.city;
  const shifts = sheetToObjects(ss().getSheetByName('Shifts')).rows
    .filter(r => normalizeCity(r.City) === city && (!p.date || fmtDate(r.Date) === p.date))
    .map(r => ({
      ShiftID: r.ShiftID, City: city, Date: fmtDate(r.Date), Day: r.Day,
      Start: fmtTime(r.Start), End: fmtTime(r.End), Hours: Number(r.Hours),
      Capacity: Number(r.Capacity), Booked: Number(r.Booked) || 0, Status: r.Status
    }));
  const bookings = sheetToObjects(ss().getSheetByName('Bookings')).rows
    .filter(b => normalizeCity(b.City || '') === city && b.Status === 'BOOKED' && (!p.date || fmtDate(b.Date) === p.date))
    .map(b => ({
      BookingID: b.BookingID, ShiftID: b.ShiftID, Date: fmtDate(b.Date),
      Start: fmtTime(b.Start), End: fmtTime(b.End), NB: b['NB Number'], Name: b.Name,
      Email: b.Email, Attendance: b.Attendance || 'SCHEDULED', OpsNotes: b['Ops Notes'] || ''
    }));
  // Standby: active riders in the city, with contact details, for filling gaps.
  const standby = sheetToObjects(ss().getSheetByName('Riders')).rows
    .filter(r => normalizeCity(r.City || '') === city && String(r.Active).toUpperCase() === 'YES')
    .map(r => ({ NB: r['NB Number'], Name: r.Name, Email: r.Email, Phone: r['Phone (optional)'] || '' }));
  return { ok: true, city, leader: lead.name, shifts, bookings, standby };
}

// ============== PHASE 2: WIPE BOOKINGS (fresh start for next week) ==============

// Admin HTTP action — wipe-clean reset (deletes all booking rows, resets shift counts).
function adminWipeBookings(p) {
  requireAdmin(p);
  return wipeBookingsCore();
}

// One-time reset you can RUN DIRECTLY from the Apps Script editor (Run ▸ resetForNextWeek).
// No password needed when run in the editor. Wipes ALL bookings and resets every shift
// to Booked=0 / Available=Capacity / Status=OPEN, and zeroes Rider_Hours week columns.
function resetForNextWeek() {
  const r = wipeBookingsCore();
  Logger.log(JSON.stringify(r));
  return r;
}

function wipeBookingsCore() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    // 1) Delete all Bookings data rows (keep header row 1).
    //    Google Sheets refuses to delete EVERY non-frozen row, so when the header
    //    row is frozen (the usual case) we temporarily drop the freeze, delete the
    //    data rows, then restore the freeze.
    const bk = ss().getSheetByName('Bookings');
    const bkLast = bk.getLastRow();
    let deletedBookings = 0;
    if (bkLast > 1) {
      const frozen = bk.getFrozenRows();
      if (frozen > 0) bk.setFrozenRows(0);
      bk.deleteRows(2, bkLast - 1);
      if (frozen > 0) bk.setFrozenRows(frozen);
      deletedBookings = bkLast - 1;
    }

    // 2) Reset every shift: Booked=0, Available=Capacity, Status=OPEN (skip CLOSED).
    const shSh = ss().getSheetByName('Shifts');
    const { rows: shifts } = sheetToObjects(shSh);
    const bookedCol = headerCol(shSh, 'Booked');
    const availCol = headerCol(shSh, 'Available');
    const statusCol = headerCol(shSh, 'Status');
    let resetShifts = 0;
    shifts.forEach(s => {
      shSh.getRange(s._row, bookedCol).setValue(0);
      if (availCol > 0) shSh.getRange(s._row, availCol).setValue(Number(s.Capacity) || 0);
      if (statusCol > 0 && s.Status !== 'CLOSED') shSh.getRange(s._row, statusCol).setValue('OPEN');
      resetShifts++;
    });

    // 3) Zero the Rider_Hours week/total columns if that tab exists.
    let zeroedHours = 0;
    const rh = ss().getSheetByName('Rider_Hours');
    if (rh && rh.getLastRow() > 1) {
      const headers = rh.getRange(1, 1, 1, rh.getLastColumn()).getValues()[0];
      const numCols = [];
      headers.forEach((h, j) => { if (/^Week\s*\d+$/i.test(String(h)) || /^Total$/i.test(String(h))) numCols.push(j + 1); });
      numCols.forEach(c => {
        const n = rh.getLastRow() - 1;
        rh.getRange(2, c, n, 1).setValue(0);
      });
      zeroedHours = numCols.length;
    }
    return { ok: true, deletedBookings, resetShifts, zeroedHoursColumns: zeroedHours };
  } finally { lock.releaseLock(); }
}
