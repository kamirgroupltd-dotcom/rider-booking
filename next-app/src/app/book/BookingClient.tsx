"use client";
import { useEffect, useState } from "react";
import { api, weekStartOf } from "@/lib/api";

type DateRow = { date: string; day: string; shifts: number; capacity: number; booked: number; availableShifts?: number };
type Shift = { ShiftID: string; Date: string; Day: string; Start: string; End: string; Hours: number; Capacity: number; Booked: number; Available: number; Status: string; Overnight: string };
type Booking = { BookingID: string; ShiftID: string; Date: string; Day: string; Start: string; End: string; Hours: number };
type Caps = { maxDay: number; maxWeek: number; maxTotal: number; maxCancellationsPerWeek?: number };
type MyResp = { name?: string; bookings?: Booking[]; hoursByWeek?: Record<string, number>; hoursByDate?: Record<string, number>; totalHours?: number; caps?: Caps };

type Step = 1 | 2 | 3 | 4 | "Mine";
type Alert = { type: "ok" | "err" | "info" | "warn"; msg: string } | null;

const NB_RE = /^NB\d{1,3}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function BookingClient() {
  const [step, setStep] = useState<Step>(1);
  const [nb, setNb] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [alert1, setAlert1] = useState<Alert>(null);

  const [riderName, setRiderName] = useState("");
  const [dates, setDates] = useState<DateRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [booking, setBooking] = useState<(Shift & { BookingID: string }) | null>(null);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [hoursByWeek, setHoursByWeek] = useState<Record<string, number>>({});
  const [hoursByDate, setHoursByDate] = useState<Record<string, number>>({});
  const [totalHours, setTotalHours] = useState(0);
  const [caps, setCaps] = useState<Caps>({ maxDay: 8, maxWeek: 56, maxTotal: 160 });

  const [alert2, setAlert2] = useState<Alert>(null);
  const [alert3, setAlert3] = useState<Alert>(null);
  const [alertMine, setAlertMine] = useState<Alert>(null);

  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [activeWeek, setActiveWeek] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("courier_id");
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored?.nb && stored?.email) {
          setNb(stored.nb);
          setName(stored.name || "");
          setEmail(stored.email);
        }
      }
    } catch { /* ignore */ }
  }, []);

  async function goStep2() {
    setAlert1(null);
    const nbN = nb.trim().toUpperCase();
    if (!NB_RE.test(nbN)) return setAlert1({ type: "err", msg: "NB number must look like NB42 (NB followed by 1–500)." });
    const n = +nbN.replace("NB", "");
    if (n < 1 || n > 500) return setAlert1({ type: "err", msg: "NB number out of range (NB1–NB500)." });
    if (name.trim().length < 2) return setAlert1({ type: "err", msg: "Please enter your name." });
    if (!EMAIL_RE.test(email.trim())) return setAlert1({ type: "err", msg: "Please enter a valid email." });

    setVerifying(true);
    try {
      const res = await api<MyResp>("getMyBookings", { nb: nbN, email });
      if (!res.ok) throw new Error(res.error || "Validation failed");
      setNb(nbN);
      setRiderName(res.name || name);
      setMyBookings(res.bookings ?? []);
      setHoursByWeek(res.hoursByWeek ?? {});
      setHoursByDate(res.hoursByDate ?? {});
      setTotalHours(res.totalHours ?? 0);
      if (res.caps) setCaps(res.caps);
      try { localStorage.setItem("courier_id", JSON.stringify({ nb: nbN, name, email })); } catch {/* */}
      void loadDates(nbN, email);
    } catch (e) {
      setAlert1({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setVerifying(false);
    }
  }

  async function loadDates(nbV = nb, emailV = email) {
    setStep(2); setAlert2(null); setLoadingDates(true);
    try {
      const res = await api<{ dates: DateRow[] }>("getDates", { nb: nbV, email: emailV });
      if (!res.ok) throw new Error(res.error || "Failed to load dates");
      setDates(res.dates ?? []);
      const wks = groupByWeek(res.dates ?? []);
      const wkKeys = Object.keys(wks).sort();
      if (wkKeys.length) setActiveWeek(wkKeys[0]);
    } catch (e) {
      setAlert2({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setLoadingDates(false);
    }
  }

  async function loadShifts(date: string) {
    setSelectedDate(date); setSelectedShift(null); setStep(3); setAlert3(null); setLoadingShifts(true);
    try {
      const res = await api<{ shifts: Shift[] }>("getShifts", { date, nb, email });
      if (!res.ok) throw new Error(res.error || "Failed");
      setShifts(res.shifts ?? []);
    } catch (e) {
      setAlert3({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setLoadingShifts(false);
    }
  }

  async function confirmBooking() {
    if (!selectedShift) return;
    setBookingLoading(true); setAlert3(null);
    try {
      const res = await api<{ bookingId: string }>("book", { shiftId: selectedShift.ShiftID, nb, name: riderName || name, email });
      if (!res.ok) throw new Error(res.error || "Booking failed");
      const s = selectedShift;
      setBooking({ ...s, BookingID: res.bookingId });
      setMyBookings((m) => [...m, { BookingID: res.bookingId, ShiftID: s.ShiftID, Date: s.Date, Day: s.Day, Start: s.Start, End: s.End, Hours: s.Hours }]);
      const ws = weekStartOf(s.Date);
      setHoursByDate((h) => ({ ...h, [s.Date]: (h[s.Date] || 0) + s.Hours }));
      setHoursByWeek((h) => ({ ...h, [ws]: (h[ws] || 0) + s.Hours }));
      setTotalHours((t) => t + s.Hours);
      setStep(4);
    } catch (e) {
      setAlert3({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBookingLoading(false);
    }
  }

  function bookAnother() {
    setSelectedShift(null); setSelectedDate(null);
    void loadDates();
  }

  async function goMyBookings() {
    if (!nb || !email) { setStep(1); setAlert1({ type: "info", msg: "Identify yourself first to see your bookings." }); return; }
    setStep("Mine"); setAlertMine(null);
    try {
      const res = await api<MyResp>("getMyBookings", { nb, email });
      if (!res.ok) throw new Error(res.error);
      setMyBookings(res.bookings ?? []);
      setHoursByWeek(res.hoursByWeek ?? {});
      setHoursByDate(res.hoursByDate ?? {});
      setTotalHours(res.totalHours ?? 0);
      if (res.caps) setCaps(res.caps);
    } catch (e) {
      setAlertMine({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function cancelMine(bookingId: string) {
    if (!confirm("Cancel this booking? This frees the slot for someone else.")) return;
    try {
      const res = await api("cancel", { bookingId, nb, email });
      if (!res.ok) throw new Error(res.error);
      setAlertMine({ type: "ok", msg: "Booking cancelled." });
      void goMyBookings();
    } catch (e) {
      setAlertMine({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="container-x">
          <div>
            <div className="brand">Shift Booking</div>
            <div className="brand-sub">Pick your shifts · 5 weeks open</div>
          </div>
          <button className="nav-link" onClick={(e) => { e.preventDefault(); void goMyBookings(); }}>My bookings</button>
        </div>
      </header>

      <main className="container-x">
        {step !== "Mine" && (
          <div className="steps">
            {[1, 2, 3, 4].map((s, i) => (
              <span key={s} style={{ display: "contents" }}>
                <div className={`step ${step === s ? "active" : Number(step) > s ? "done" : ""}`}>
                  <span className="dot">{s}</span>
                  <span>{["Identify", "Date", "Shift", "Confirm"][i]}</span>
                </div>
                {i < 3 && <div className="step-sep" />}
              </span>
            ))}
          </div>
        )}

        {step === 1 && <Step1 nb={nb} setNb={setNb} name={name} setName={setName} email={email} setEmail={setEmail}
          alert={alert1} verifying={verifying} onContinue={goStep2} />}

        {step === 2 && <Step2 dates={dates} loading={loadingDates} alert={alert2}
          activeWeek={activeWeek} setActiveWeek={setActiveWeek} onPickDate={loadShifts} onBack={() => setStep(1)} />}

        {step === 3 && selectedDate && (
          <Step3 date={selectedDate} shifts={shifts} loading={loadingShifts} alert={alert3}
            myBookings={myBookings} hoursByDate={hoursByDate} hoursByWeek={hoursByWeek} totalHours={totalHours} caps={caps}
            selected={selectedShift} setSelected={setSelectedShift} booking={bookingLoading} onConfirm={confirmBooking}
            onBack={() => setStep(2)} />
        )}

        {step === 4 && booking && nb && (
          <Step4 booking={booking} totalHours={totalHours} caps={caps} nb={nb}
            onAnother={bookAnother} onMine={goMyBookings} />
        )}

        {step === "Mine" && (
          <StepMine alert={alertMine} bookings={myBookings} hoursByWeek={hoursByWeek} totalHours={totalHours}
            caps={caps} onCancel={cancelMine} onBack={() => setStep(1)} />
        )}
      </main>
    </>
  );
}

function groupByWeek(rows: DateRow[]): Record<string, DateRow[]> {
  const out: Record<string, DateRow[]> = {};
  rows.forEach((d) => {
    const ws = weekStartOf(d.date);
    (out[ws] = out[ws] || []).push(d);
  });
  return out;
}

function AlertView({ a }: { a: Alert }) {
  if (!a) return null;
  return <div className={`alert ${a.type}`}>{a.msg}</div>;
}

function Step1({ nb, setNb, name, setName, email, setEmail, alert, verifying, onContinue }: {
  nb: string; setNb: (v: string) => void;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  alert: Alert; verifying: boolean; onContinue: () => void;
}) {
  return (
    <section className="panel">
      <h1>Who&apos;s booking?</h1>
      <p className="lede">Enter your NB number and the email on file. We use this to validate you and apply weekly limits.</p>
      <AlertView a={alert} />
      <div className="field">
        <label htmlFor="nb">NB number</label>
        <input id="nb" type="text" placeholder="e.g. NB42" autoComplete="off" value={nb}
          onChange={(e) => setNb(e.target.value.toUpperCase())} />
        <div className="hint">Format: NB followed by 1–500</div>
      </div>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" type="text" placeholder="As it appears on file" autoComplete="name"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" placeholder="you@example.com" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="hint">Must match the email registered against your NB number.</div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onContinue} disabled={verifying}>
          {verifying ? <><span className="loader" /> Verifying…</> : "Continue →"}
        </button>
      </div>
    </section>
  );
}

function Step2({ dates, loading, alert, activeWeek, setActiveWeek, onPickDate, onBack }: {
  dates: DateRow[]; loading: boolean; alert: Alert;
  activeWeek: string; setActiveWeek: (w: string) => void;
  onPickDate: (d: string) => void; onBack: () => void;
}) {
  const byWeek = groupByWeek(dates);
  const weekKeys = Object.keys(byWeek).sort();
  const days = activeWeek && byWeek[activeWeek] ? byWeek[activeWeek] : (weekKeys[0] ? byWeek[weekKeys[0]] : []);

  return (
    <section className="panel">
      <h1>Pick a date</h1>
      <p className="lede">All 5 weeks are open. Numbers below show available shift slots per day.</p>
      <AlertView a={alert} />
      <div className="week-tabs">
        {weekKeys.map((wk, i) => {
          const wkDays = byWeek[wk];
          const last = wkDays[wkDays.length - 1].date;
          const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          return (
            <button key={wk} className={`week-tab ${activeWeek === wk ? "active" : ""}`}
              onClick={() => setActiveWeek(wk)}>
              Week {i + 1} · {fmt(wk)}–{fmt(last)}
            </button>
          );
        })}
      </div>
      {loading && <div className="center-loader"><span className="loader" /></div>}
      <div className="date-grid">
        {days.map((d) => {
          const dt = new Date(d.date + "T00:00:00");
          const slots = typeof d.availableShifts === "number" ? d.availableShifts : Math.max(0, d.capacity - d.booked);
          const cls = slots <= 0 ? " full" : slots <= 3 ? " low" : "";
          const availText = slots <= 0 ? "Full" : slots <= 3 ? `Only ${slots} left` : `${slots} time slots`;
          return (
            <div key={d.date} className={`date-card${cls}`} onClick={() => onPickDate(d.date)}>
              <div className="day">{dt.toLocaleDateString("en-GB", { weekday: "short" })}</div>
              <div className="num">{dt.getDate()}</div>
              <div className="mon">{dt.toLocaleDateString("en-GB", { month: "short" })}</div>
              <div className="avail">{availText}</div>
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </section>
  );
}

function Step3({ date, shifts, loading, alert, myBookings, hoursByDate, hoursByWeek, totalHours, caps, selected, setSelected, booking, onConfirm, onBack }: {
  date: string; shifts: Shift[]; loading: boolean; alert: Alert;
  myBookings: Booking[]; hoursByDate: Record<string, number>; hoursByWeek: Record<string, number>; totalHours: number; caps: Caps;
  selected: Shift | null; setSelected: (s: Shift) => void;
  booking: boolean; onConfirm: () => void; onBack: () => void;
}) {
  const wkStart = weekStartOf(date);
  const dayH = hoursByDate[date] || 0;
  const weekH = hoursByWeek[wkStart] || 0;
  const dayLeft = caps.maxDay - dayH;
  const weekLeft = caps.maxWeek - weekH;
  const totalLeft = caps.maxTotal - totalHours;
  const maxFittable = Math.min(dayLeft, weekLeft, totalLeft);

  const bookedIds = new Set(myBookings.map((b) => b.ShiftID));
  const visibleShifts: Shift[] = [];
  let hiddenCount = 0;
  for (const s of shifts) {
    if (bookedIds.has(s.ShiftID)) continue;
    if (s.Hours > maxFittable) { hiddenCount++; continue; }
    visibleShifts.push(s);
  }
  const dt = new Date(date + "T00:00:00");
  const bookedOnDate = myBookings.filter((b) => b.Date === date).length;

  const emptyMsg =
    maxFittable < 4
      ? totalLeft < 4 ? `You've reached your ${caps.maxTotal}h total cap. No more shifts can be booked.`
      : weekLeft < 4 ? `You've reached your ${caps.maxWeek}h weekly cap for this week. Pick a different week.`
      : dayLeft < 4 ? `You've reached your ${caps.maxDay}h daily cap for this day. Pick a different day.`
      : "No shifts available within your remaining cap."
      : `No shifts on this date fit within your remaining caps (${maxFittable}h max). Try a different date.`;

  return (
    <section className="panel">
      <h1>{dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h1>
      <p className="lede">Pick a 4h, 6h, or 8h shift. Numbers on the right are slots left.</p>
      <AlertView a={alert} />

      <div className="hours-banner">
        <div className="hb-row">
          <div className="hb-cell"><div className="hb-lbl">Today</div><div className="hb-val">{dayH}/{caps.maxDay}h</div></div>
          <div className="hb-cell"><div className="hb-lbl">This week</div><div className="hb-val">{weekH}/{caps.maxWeek}h</div></div>
          <div className="hb-cell"><div className="hb-lbl">Total booked</div><div className="hb-val">{totalHours}/{caps.maxTotal}h</div></div>
        </div>
      </div>

      {loading && <div className="center-loader"><span className="loader" /></div>}

      {!loading && shifts.length === 0 && <div className="alert info">No shifts on this date.</div>}

      {visibleShifts.map((s) => {
        const ratio = s.Capacity > 0 ? s.Available / s.Capacity : 0;
        const availCls = s.Available <= 0 ? " full" : ratio < 0.2 ? " low" : "";
        const disabled = s.Available <= 0 || s.Status !== "OPEN";
        const isSelected = selected?.ShiftID === s.ShiftID;
        return (
          <div key={s.ShiftID} className={`shift-card${disabled ? " disabled" : ""}${isSelected ? " selected" : ""}`}
            onClick={() => !disabled && setSelected(s)}>
            <div>
              <span className="shift-time">{s.Start}–{s.End}</span>
              <span className="shift-len">{s.Hours}h{s.Overnight === "YES" ? " · overnight" : ""}</span>
              <div className="shift-meta mono">{s.ShiftID}</div>
            </div>
            <div />
            <div className={`shift-avail${availCls}`}>
              <div className="n">{s.Available}</div>
              <div className="lbl">left</div>
            </div>
          </div>
        );
      })}

      {!loading && shifts.length > 0 && visibleShifts.length === 0 && <div className="alert warn">{emptyMsg}</div>}

      {visibleShifts.length > 0 && hiddenCount > 0 && (
        <div className="filter-note">{hiddenCount} shift{hiddenCount === 1 ? "" : "s"} hidden — would exceed your caps. Showing only shifts ≤ {maxFittable}h.</div>
      )}
      {bookedOnDate > 0 && (
        <div className="filter-note">You&apos;ve already booked {bookedOnDate} shift{bookedOnDate === 1 ? "" : "s"} on this date.</div>
      )}

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onBack}>← Change date</button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={!selected || booking}>
          {booking ? <><span className="loader" /> Booking…</> : "Book this shift"}
        </button>
      </div>
    </section>
  );
}

function Step4({ booking, totalHours, caps, nb, onAnother, onMine }: {
  booking: Shift & { BookingID: string }; totalHours: number; caps: Caps; nb: string;
  onAnother: () => void; onMine: () => void;
}) {
  const dt = new Date(booking.Date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <section className="panel">
      <div className="confirmation">
        <div className="check" />
        <h2>Shift booked.</h2>
        <p className="lede">You&apos;ll see this in &ldquo;My bookings&rdquo; — and in the operations sheet.</p>
        <div className="conf-detail">
          <div className="row"><span className="k">Booking ID</span><span className="v">{booking.BookingID}</span></div>
          <div className="row"><span className="k">Date</span><span className="v">{dt}</span></div>
          <div className="row"><span className="k">Time</span><span className="v">{booking.Start}–{booking.End}</span></div>
          <div className="row"><span className="k">Hours</span><span className="v">{booking.Hours}h</span></div>
          <div className="row"><span className="k">Total this cycle</span><span className="v">{totalHours}/{caps.maxTotal}h</span></div>
          <div className="row"><span className="k">Courier</span><span className="v">{nb}</span></div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={onAnother}>Book another shift</button>
          <button className="btn btn-ghost" onClick={onMine}>View my bookings</button>
        </div>
      </div>
    </section>
  );
}

function StepMine({ alert, bookings, hoursByWeek, totalHours, caps, onCancel, onBack }: {
  alert: Alert; bookings: Booking[]; hoursByWeek: Record<string, number>; totalHours: number; caps: Caps;
  onCancel: (id: string) => void; onBack: () => void;
}) {
  const wks = Object.keys(hoursByWeek).sort();
  return (
    <section className="panel">
      <h1>My bookings</h1>
      <p className="lede">Hours booked per week, plus all upcoming shifts.</p>
      <AlertView a={alert} />

      <div className="mine-summary">
        <div className="mine-total">
          <div className="mine-total-lbl">Total booked</div>
          <div className="mine-total-val">{totalHours}<span className="mine-total-cap">/{caps.maxTotal}h</span></div>
        </div>
        {wks.length > 0 && (
          <div className="mine-weeks">
            {wks.map((wk) => {
              const h = hoursByWeek[wk];
              const over = h > caps.maxWeek;
              const lbl = new Date(wk + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              return <div key={wk} className={`mine-week-chip${over ? " over" : ""}`}>Wk {lbl}: {h}h{over ? " ⚠" : ""}</div>;
            })}
          </div>
        )}
      </div>

      {bookings.length === 0 && <div className="alert info">No bookings yet. Use &quot;Back to booking&quot; to add one.</div>}
      {bookings.map((b) => {
        const dt = new Date(b.Date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
        return (
          <div key={b.BookingID} className="booking-row">
            <div>
              <span className="when">{b.Start}–{b.End}</span>
              <div className="meta">{dt} · {b.Hours}h shift</div>
              <div className="bid">{b.BookingID}</div>
            </div>
            <button className="btn btn-danger" onClick={() => onCancel(b.BookingID)}>Cancel</button>
          </div>
        );
      })}

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onBack}>← Back to booking</button>
      </div>
    </section>
  );
}
