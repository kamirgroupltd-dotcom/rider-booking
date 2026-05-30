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
      case 'getDates':          result = getDates(); break;
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

function getDates() {
  const { rows } = sheetToObjects(ss().getSheetByName('Shifts'));
  const dates = {};
  rows.forEach(r => {
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
    .filter(r => !p.date || fmtDate(r.Date) === p.date)
    .filter(r => r.Status === 'OPEN' || r.Status === 'FULL' || !p.openOnly)
    .map(r => ({
      ShiftID: r.ShiftID,
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
  return { ok: true, name: rider.Name, bookings: mine, hoursByWeek, hoursByDate, totalHours, caps };
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
    ShiftID: r.ShiftID, Date: fmtDate(r.Date), Day: r.Day,
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
    ShiftID: r.ShiftID, Date: fmtDate(r.Date), Day: r.Day,
    Start: fmtTime(r.Start), End: fmtTime(r.End),
    Hours: Number(r.Hours), NB: r['NB Number'],
    Name: r.Name, Email: r.Email, Status: r.Status,
    CancelledAt: r['Cancelled At'] ? Utilities.formatDate(new Date(r['Cancelled At']), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
    CancelReason: r['Cancel Reason'] || ''
  }));
  const riders = sheetToObjects(ss().getSheetByName('Riders')).rows.map(r => ({
    NB: r['NB Number'], Name: r.Name, Email: r.Email,
    Phone: r['Phone (optional)'], Active: r.Active
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
  const { date, start, end, hours, capacity, notes } = p;
  if (!date || !start || !end || !hours || !capacity) return { ok: false, error: 'Missing fields' };
  const sh = ss().getSheetByName('Shifts');
  const { rows } = sheetToObjects(sh);
  const maxNum = rows.reduce((m, r) => {
    const n = parseInt(String(r.ShiftID).replace('S',''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const newId = 'S' + String(maxNum + 1).padStart(4, '0');
  const day = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
  sh.appendRow([newId, date, day, start, end, hours, capacity, 0, 'OPEN', 'NO', notes || '']);
  return { ok: true, shiftId: newId };
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
  const { nb, name, email, phone, active } = p;
  const sh = ss().getSheetByName('Riders');
  const { rows } = sheetToObjects(sh);
  const r = rows.find(x => x['NB Number'] === nb);
  if (!r) return { ok: false, error: 'NB not found' };
  if (name !== undefined) sh.getRange(r._row, headerCol(sh, 'Name')).setValue(name);
  if (email !== undefined) sh.getRange(r._row, headerCol(sh, 'Email')).setValue(email);
  if (phone !== undefined) sh.getRange(r._row, headerCol(sh, 'Phone (optional)')).setValue(phone);
  if (active !== undefined) sh.getRange(r._row, headerCol(sh, 'Active')).setValue(active);
  return { ok: true };
}
