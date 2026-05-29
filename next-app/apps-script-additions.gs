/**
 * ADDITIONS to your existing code.gs
 *
 * Paste this block into your Apps Script project (after the existing code).
 * Then, in your `handle()` function, add this case to the switch:
 *
 *     case 'applyRider':  result = applyRider(p); break;
 *
 * Also create a new sheet tab named `Applicants` with these headers (row 1):
 *   Timestamp | Reference | Name | Email | Phone | City | Vehicle | Availability | Referral NB | Notes | IP | Status
 */

function applyRider(p) {
  try {
    const name = String(p.name || '').trim();
    const email = String(p.email || '').trim();
    const phone = String(p.phone || '').trim();
    const city = String(p.city || '').trim();
    const vehicle = String(p.vehicle || '').trim();
    const availability = String(p.availability || '').trim();
    const referral = String(p.referral || '').trim().toUpperCase();
    const why = String(p.why || '').trim();

    if (!name || name.length < 2) return { ok: false, error: 'Name required' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Valid email required' };
    if (phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Valid phone required' };
    if (!city) return { ok: false, error: 'City required' };

    const sheet = ss().getSheetByName('Applicants') || ss().insertSheet('Applicants');
    // Ensure headers exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp','Reference','Name','Email','Phone','City','Vehicle','Availability','Referral NB','Notes','Status']);
      sheet.setFrozenRows(1);
    }

    const ts = new Date();
    const ref = 'A' + Utilities.formatDate(ts, 'GMT', 'yyMMddHHmmss') +
                '-' + Math.floor(Math.random() * 900 + 100);

    // Dedupe: reject if same email applied in the last 30 days with status not REJECTED
    const data = sheet.getDataRange().getValues();
    const cutoff = new Date(ts.getTime() - 30 * 24 * 3600 * 1000);
    for (let i = 1; i < data.length; i++) {
      const rowTs = data[i][0];
      const rowEmail = String(data[i][3] || '').trim().toLowerCase();
      const rowStatus = String(data[i][10] || '').trim().toUpperCase();
      if (rowEmail === email.toLowerCase() && rowTs instanceof Date && rowTs > cutoff && rowStatus !== 'REJECTED') {
        return { ok: false, error: 'You have already applied with this email in the last 30 days. Check your inbox for our reply.' };
      }
    }

    sheet.appendRow([ts, ref, name, email, phone, city, vehicle, availability, referral, why, 'NEW']);

    // Optional: send confirmation email if MailApp quota allows
    try {
      MailApp.sendEmail({
        to: email,
        subject: 'We received your courier application — ' + ref,
        body: 'Hi ' + name.split(' ')[0] + ',\n\n' +
              'Thanks for applying to ride with us. Your reference is ' + ref + '.\n\n' +
              'We review every application by hand within 48 hours and email you a right-to-work check link to ' + email + '.\n\n' +
              'City: ' + city + '\nVehicle: ' + vehicle + '\n\n' +
              'If you have questions, reply to this email.\n\n— Halal Couriers DE'
      });
    } catch (e) { /* swallow; mail not critical */ }

    return { ok: true, ref: ref, message: 'Application received' };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}
