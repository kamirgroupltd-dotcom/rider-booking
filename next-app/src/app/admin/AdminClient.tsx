"use client";
import { useEffect, useState } from "react";
import { api, weekStartOf, addDays } from "@/lib/api";

type Shift = { _row?: number; ShiftID: string; Date: string; Day: string; Start: string; End: string; Hours: number; Capacity: number; Booked: number; Available: number; Status: string; Overnight: string; Notes?: string };
type Booking = { _row?: number; BookingID: string; Timestamp: string; ShiftID: string; Date: string; Day: string; Start: string; End: string; Hours: number; NB: string; Name: string; Email: string; Status: string; CancelledAt?: string; CancelReason?: string };
type Rider = { NB: string; Name?: string; Email?: string; Phone?: string; Active?: string };

type Tab = "overview" | "bookings" | "shifts" | "users" | "hours";
type Alert = { type: "ok" | "err" | "info"; msg: string } | null;

export default function AdminClient() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [data, setData] = useState<{ shifts: Shift[]; bookings: Booking[]; riders: Rider[] }>({ shifts: [], bookings: [], riders: [] });
  const [tab, setTab] = useState<Tab>("overview");
  const [alert, setAlert] = useState<Alert>(null);
  const [modal, setModal] = useState<React.ReactNode>(null);

  // body theme class
  useEffect(() => {
    document.body.classList.add("theme-admin");
    return () => document.body.classList.remove("theme-admin");
  }, []);

  // auto-dismiss alerts
  useEffect(() => {
    if (alert) { const t = setTimeout(() => setAlert(null), 4000); return () => clearTimeout(t); }
  }, [alert]);

  async function login() {
    if (!pw) return;
    setLoggingIn(true); setLoginErr("");
    try {
      const res = await api("adminLogin", { password: pw });
      if (!res.ok) throw new Error(res.error || "Login failed");
      setAuthed(true);
      await loadAll(pw);
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() { setPw(""); setAuthed(false); setData({ shifts: [], bookings: [], riders: [] }); }

  async function loadAll(password = pw) {
    setAlert({ type: "info", msg: "Loading…" });
    try {
      const res = await api<{ shifts: Shift[]; bookings: Booking[]; riders: Rider[] }>("adminGetData", { password });
      if (!res.ok) throw new Error(res.error);
      setData({ shifts: res.shifts, bookings: res.bookings, riders: res.riders });
      setAlert(null);
    } catch (e) {
      setAlert({ type: "err", msg: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function adminCancel(bookingId: string) {
    const reason = prompt("Reason for cancellation? (optional)") || "admin";
    try {
      const res = await api("adminCancel", { password: pw, bookingId, reason });
      if (!res.ok) throw new Error(res.error);
      await loadAll(); setAlert({ type: "ok", msg: "Booking cancelled." });
    } catch (e) { setAlert({ type: "err", msg: e instanceof Error ? e.message : "Failed" }); }
  }

  async function deleteShift(shiftId: string, booked: number) {
    if (booked > 0) return setAlert({ type: "err", msg: `Shift ${shiftId} has ${booked} active bookings — cancel them first.` });
    if (!confirm("Delete " + shiftId + "? This cannot be undone.")) return;
    try {
      const res = await api("adminDeleteShift", { password: pw, shiftId });
      if (!res.ok) throw new Error(res.error);
      await loadAll(); setAlert({ type: "ok", msg: "Shift deleted." });
    } catch (e) { setAlert({ type: "err", msg: e instanceof Error ? e.message : "Failed" }); }
  }

  async function enforceCaps() {
    const totals: Record<string, number> = {};
    data.bookings.filter((b) => b.Status === "BOOKED").forEach((b) => { totals[b.NB] = (totals[b.NB] || 0) + b.Hours; });
    const over = Object.entries(totals).filter(([, h]) => h > 160);
    if (!over.length) { setAlert({ type: "info", msg: "No users over 160h. Nothing to enforce." }); return; }
    const preview = over.map(([nb, h]) => `  • ${nb}: ${h}h (excess ${h - 160}h)`).join("\n");
    if (!confirm(`Enforce 160h cap?\n\n${over.length} user(s) over the cap:\n${preview}\n\nMost recently booked shifts will be cancelled. Bookings remain in the Bookings tab as CANCELLED for audit.`)) return;
    setAlert({ type: "info", msg: "Enforcing — up to a minute…" });
    try {
      const res = await api<{ summary?: { nb: string; previousHours: number; newHours: number; cancelledCount: number }[] }>("adminEnforceCaps", { password: pw });
      if (!res.ok) throw new Error(res.error || "Failed");
      const summary = res.summary || [];
      const total = summary.reduce((a, s) => a + s.cancelledCount, 0);
      await loadAll();
      if (summary.length) {
        const lines = summary.map((s) => `${s.nb}: ${s.previousHours}h → ${s.newHours}h (${s.cancelledCount} cancelled)`).join("\n");
        window.alert(`Done. ${total} booking(s) cancelled across ${summary.length} user(s):\n\n${lines}`);
      } else { setAlert({ type: "info", msg: "Already within cap — no changes." }); }
    } catch (e) { setAlert({ type: "err", msg: e instanceof Error ? e.message : "Failed" }); }
  }

  if (!authed) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Admin access</h1>
          <p>Enter the admin password to manage shifts, bookings, and users.</p>
          {loginErr && <div className="alert err">{loginErr}</div>}
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password"
              value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void login(); }} />
          </div>
          <button className="btn btn-primary btn-block" onClick={login} disabled={loggingIn}>
            {loggingIn ? <><span className="loader" /> Verifying…</> : "Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <div><span className="admin-logo">Shift Booking <span className="sub">Admin</span></span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadAll()}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="admin-main">
        <div className="tabs">
          {(["overview", "bookings", "shifts", "users", "hours"] as Tab[]).map((t) => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "users" ? "Users" : t === "hours" ? "Hours" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

        {tab === "overview" && <Overview data={data} />}
        {tab === "bookings" && <BookingsTab data={data} onCancel={adminCancel} />}
        {tab === "shifts" && <ShiftsTab data={data} pw={pw} setModal={setModal} reload={loadAll} setAlert={setAlert} onDelete={deleteShift} />}
        {tab === "users" && <UsersTab data={data} pw={pw} setModal={setModal} reload={loadAll} setAlert={setAlert} />}
        {tab === "hours" && <HoursTab data={data} onEnforce={enforceCaps} />}
      </main>

      {modal && <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="modal">{modal}</div>
      </div>}
    </>
  );
}

// ===== Tabs =====

function Overview({ data }: { data: { shifts: Shift[]; bookings: Booking[]; riders: Rider[] } }) {
  const totalShifts = data.shifts.length;
  const totalCap = data.shifts.reduce((a, s) => a + s.Capacity, 0);
  const totalBooked = data.shifts.reduce((a, s) => a + s.Booked, 0);
  const totalRiders = data.riders.filter((r) => r.Name || r.Email).length;
  const activeBookings = data.bookings.filter((b) => b.Status === "BOOKED").length;
  const cancelled = data.bookings.filter((b) => b.Status === "CANCELLED").length;
  const totalHours = data.bookings.filter((b) => b.Status === "BOOKED").reduce((a, b) => a + b.Hours, 0);

  const byDate = new Map<string, { Date: string; Day: string; Shifts: number; Capacity: number; Booked: number }>();
  data.shifts.forEach((s) => {
    const row = byDate.get(s.Date) || { Date: s.Date, Day: s.Day, Shifts: 0, Capacity: 0, Booked: 0 };
    row.Shifts++; row.Capacity += s.Capacity; row.Booked += s.Booked;
    byDate.set(s.Date, row);
  });
  const rows = Array.from(byDate.values()).sort((a, b) => a.Date.localeCompare(b.Date));

  return (
    <>
      <div className="stat-row">
        <Stat lbl="Shifts created" val={totalShifts} sub="5 weeks total" />
        <Stat lbl="Capacity" val={totalCap.toLocaleString()} sub={`${totalBooked.toLocaleString()} booked · ${(totalCap - totalBooked).toLocaleString()} open`} />
        <Stat lbl="Bookings" val={activeBookings} sub={`${cancelled} cancelled`} />
        <Stat lbl="Hours booked" val={totalHours.toLocaleString()} />
        <Stat lbl="Users registered" val={totalRiders} sub="of 500 NB numbers" />
        <Stat lbl="Fill rate" val={`${totalCap ? Math.round(totalBooked / totalCap * 100) : 0}%`} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Day</th><th>Shifts</th><th>Capacity</th><th>Booked</th><th>Available</th><th>Fill %</th></tr></thead>
          <tbody>
            {rows.map((d) => {
              const fill = d.Capacity ? Math.round(d.Booked / d.Capacity * 100) : 0;
              return <tr key={d.Date}>
                <td className="mono">{d.Date}</td><td>{d.Day}</td>
                <td className="mono">{d.Shifts}</td><td className="mono">{d.Capacity}</td>
                <td className="mono">{d.Booked}</td><td className="mono">{d.Capacity - d.Booked}</td>
                <td className="mono">{fill}%</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ lbl, val, sub }: { lbl: string; val: string | number; sub?: string }) {
  return <div className="stat"><div className="lbl">{lbl}</div><div className="val">{val}</div>{sub && <div className="sub">{sub}</div>}</div>;
}

function BookingsTab({ data, onCancel }: { data: { bookings: Booking[]; shifts: Shift[] }; onCancel: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dt, setDt] = useState("");
  const dates = Array.from(new Set(data.shifts.map((s) => s.Date))).sort();

  const rows = data.bookings
    .filter((b) => !q || (b.NB + b.Name + b.Email + b.ShiftID).toLowerCase().includes(q.toLowerCase()))
    .filter((b) => !status || b.Status === status)
    .filter((b) => !dt || b.Date === dt)
    .sort((a, b) => (b.Timestamp || "").localeCompare(a.Timestamp || ""));

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search NB, name, email, ShiftID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="BOOKED">Booked</option><option value="CANCELLED">Cancelled</option>
        </select>
        <select value={dt} onChange={(e) => setDt(e.target.value)}>
          <option value="">All dates</option>{dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => exportCsv("bookings.csv",
          ["BookingID", "NB", "Name", "Email", "Date", "Day", "Start", "End", "Hours", "Status", "Timestamp", "CancelledAt", "CancelReason"],
          rows.map((b) => [b.BookingID, b.NB, b.Name, b.Email, b.Date, b.Day, b.Start, b.End, b.Hours, b.Status, b.Timestamp, b.CancelledAt, b.CancelReason]))}>
          Export CSV
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Booking ID</th><th>NB</th><th>Name</th><th>Email</th><th>Date</th><th>Time</th><th>Hrs</th><th>Status</th><th>Timestamp</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "var(--ink-3)" }}>No bookings match.</td></tr>}
            {rows.map((b) => (
              <tr key={b.BookingID}>
                <td className="mono" style={{ fontSize: 11 }}>{b.BookingID}</td>
                <td className="mono">{b.NB}</td>
                <td>{b.Name}</td>
                <td style={{ fontSize: 12 }}>{b.Email}</td>
                <td className="mono">{b.Date}</td>
                <td className="mono">{b.Start}–{b.End}</td>
                <td className="mono">{b.Hours}</td>
                <td><span className={`pill ${b.Status === "BOOKED" ? "pill-booked" : "pill-cancelled"}`}>{b.Status}</span></td>
                <td className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{b.Timestamp}</td>
                <td>{b.Status === "BOOKED" && <button className="btn btn-danger btn-sm" onClick={() => onCancel(b.BookingID)}>Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ShiftsTab({ data, pw, setModal, reload, setAlert, onDelete }: {
  data: { shifts: Shift[] }; pw: string; setModal: (n: React.ReactNode) => void; reload: () => void;
  setAlert: (a: Alert) => void; onDelete: (id: string, booked: number) => void;
}) {
  const [q, setQ] = useState("");
  const [dt, setDt] = useState("");
  const [status, setStatus] = useState("");
  const dates = Array.from(new Set(data.shifts.map((s) => s.Date))).sort();
  const rows = data.shifts
    .filter((s) => !q || (s.ShiftID + s.Date).toLowerCase().includes(q.toLowerCase()))
    .filter((s) => !dt || s.Date === dt)
    .filter((s) => !status || s.Status === status)
    .sort((a, b) => a.Date.localeCompare(b.Date) || a.Start.localeCompare(b.Start));

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search ShiftID, date…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={dt} onChange={(e) => setDt(e.target.value)}>
          <option value="">All dates</option>{dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="OPEN">Open</option><option value="FULL">Full</option><option value="CLOSED">Closed</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => setModal(<AddShiftModal pw={pw} close={() => setModal(null)} reload={reload} setAlert={setAlert} />)}>+ Add shift</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ShiftID</th><th>Date</th><th>Day</th><th>Start</th><th>End</th><th>Hrs</th><th>Cap</th><th>Booked</th><th>Avail</th><th>Status</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: 30, color: "var(--ink-3)" }}>No shifts match.</td></tr>}
            {rows.map((s) => (
              <tr key={s.ShiftID}>
                <td className="mono">{s.ShiftID}</td><td className="mono">{s.Date}</td><td>{s.Day}</td>
                <td className="mono">{s.Start}</td><td className="mono">{s.End}</td><td className="mono">{s.Hours}</td>
                <td className="mono">{s.Capacity}</td><td className="mono">{s.Booked}</td><td className="mono">{s.Available}</td>
                <td><span className={`pill ${s.Status === "OPEN" ? "pill-open" : s.Status === "FULL" ? "pill-full" : "pill-cancelled"}`}>{s.Status}</span></td>
                <td style={{ fontSize: 12, color: "var(--ink-2)" }}>{s.Notes}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(<EditShiftModal pw={pw} shift={s} close={() => setModal(null)} reload={reload} setAlert={setAlert} />)}>Edit</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(s.ShiftID, s.Booked)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AddShiftModal({ pw, close, reload, setAlert }: { pw: string; close: () => void; reload: () => void; setAlert: (a: Alert) => void }) {
  const [date, setDate] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [hours, setHours] = useState(4); const [capacity, setCapacity] = useState(5); const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  async function submit() {
    if (!date || !start || !end || !hours || !capacity) return setErr("Fill all required fields.");
    try {
      const res = await api<{ shiftId: string }>("adminAddShift", { password: pw, date, start, end, hours, capacity, notes });
      if (!res.ok) throw new Error(res.error);
      close(); reload(); setAlert({ type: "ok", msg: `Shift ${res.shiftId} added.` });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <>
      <h2>Add a new shift</h2>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Start (HH:MM)</label><input value={start} onChange={(e) => setStart(e.target.value)} placeholder="e.g. 17:00" /></div>
      <div className="field"><label>End (HH:MM)</label><input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="e.g. 21:00" /></div>
      <div className="field"><label>Hours</label><input type="number" min={1} max={8} value={hours} onChange={(e) => setHours(+e.target.value)} /></div>
      <div className="field"><label>Capacity (slots)</label><input type="number" min={1} value={capacity} onChange={(e) => setCapacity(+e.target.value)} /></div>
      <div className="field"><label>Notes (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {err && <div className="alert err">{err}</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Add shift</button>
      </div>
    </>
  );
}

function EditShiftModal({ pw, shift, close, reload, setAlert }: { pw: string; shift: Shift; close: () => void; reload: () => void; setAlert: (a: Alert) => void }) {
  const [capacity, setCapacity] = useState(shift.Capacity);
  const [status, setStatus] = useState(shift.Status);
  const [notes, setNotes] = useState(shift.Notes || "");
  const [err, setErr] = useState("");
  async function submit() {
    try {
      const res = await api("adminEditShift", { password: pw, shiftId: shift.ShiftID, capacity, status, notes });
      if (!res.ok) throw new Error(res.error);
      close(); reload(); setAlert({ type: "ok", msg: `Shift ${shift.ShiftID} updated.` });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <>
      <h2>Edit shift {shift.ShiftID}</h2>
      <p style={{ color: "var(--ink-2)", fontSize: 13, marginBottom: 12 }}>{shift.Date} ({shift.Day}) · {shift.Start}–{shift.End} · {shift.Hours}h</p>
      <div className="field"><label>Capacity</label><input type="number" min={shift.Booked} value={capacity} onChange={(e) => setCapacity(+e.target.value)} />
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Currently {shift.Booked} booked — can&apos;t reduce below this.</div>
      </div>
      <div className="field"><label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN">OPEN</option><option value="FULL">FULL</option><option value="CLOSED">CLOSED</option>
        </select>
      </div>
      <div className="field"><label>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {err && <div className="alert err">{err}</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Save</button>
      </div>
    </>
  );
}

function UsersTab({ data, pw, setModal, reload, setAlert }: {
  data: { riders: Rider[] }; pw: string; setModal: (n: React.ReactNode) => void; reload: () => void; setAlert: (a: Alert) => void;
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("");
  const rows = data.riders
    .filter((r) => !q || (r.NB + (r.Name || "") + (r.Email || "")).toLowerCase().includes(q.toLowerCase()))
    .filter((r) => {
      if (f === "YES") return r.Active === "YES";
      if (f === "NO") return r.Active === "NO";
      if (f === "EMPTY") return !r.Name && !r.Email;
      return true;
    });
  return (
    <>
      <div className="toolbar">
        <input placeholder="Search NB, name, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={f} onChange={(e) => setF(e.target.value)}>
          <option value="">All</option><option value="YES">Active only</option><option value="NO">Inactive only</option><option value="EMPTY">No data yet</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => exportCsv("users.csv", ["NB","Name","Email","Phone","Active"], rows.map((r) => [r.NB, r.Name, r.Email, r.Phone, r.Active]))}>Export CSV</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>NB</th><th>Name</th><th>Email</th><th>Phone</th><th>Active</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.NB}>
                <td className="mono">{r.NB}</td><td>{r.Name}</td>
                <td style={{ fontSize: 12 }}>{r.Email}</td><td style={{ fontSize: 12 }}>{r.Phone}</td>
                <td><span className={`pill ${r.Active === "YES" ? "pill-yes" : "pill-no"}`}>{r.Active}</span></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setModal(<EditUserModal pw={pw} rider={r} close={() => setModal(null)} reload={reload} setAlert={setAlert} />)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EditUserModal({ pw, rider, close, reload, setAlert }: { pw: string; rider: Rider; close: () => void; reload: () => void; setAlert: (a: Alert) => void }) {
  const [name, setName] = useState(rider.Name || "");
  const [email, setEmail] = useState(rider.Email || "");
  const [phone, setPhone] = useState(rider.Phone || "");
  const [active, setActive] = useState(rider.Active === "YES" ? "YES" : "NO");
  const [err, setErr] = useState("");
  async function submit() {
    try {
      const res = await api("adminUpdateRider", { password: pw, nb: rider.NB, name, email, phone, active });
      if (!res.ok) throw new Error(res.error);
      close(); reload(); setAlert({ type: "ok", msg: `User ${rider.NB} updated.` });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <>
      <h2>Edit user {rider.NB}</h2>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label>Phone (optional)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="field"><label>Active</label>
        <select value={active} onChange={(e) => setActive(e.target.value)}><option value="YES">YES</option><option value="NO">NO</option></select>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Save</button>
      </div>
    </>
  );
}

function HoursTab({ data, onEnforce }: { data: { bookings: Booking[]; riders: Rider[]; shifts: Shift[] }; onEnforce: () => void }) {
  const [q, setQ] = useState("");
  const [wk, setWk] = useState("all");
  const [sort, setSort] = useState("hours-desc");
  const dates = Array.from(new Set(data.shifts.map((s) => s.Date))).sort();
  const weeks = Array.from(new Set(dates.map((d) => weekStartOf(d)))).sort();

  const wkRange = wk === "all" ? null : { start: wk, end: addDays(wk, 6) };
  const filteredMap: Record<string, number> = {};
  const totalMap: Record<string, number> = {};
  data.bookings.filter((b) => b.Status === "BOOKED").forEach((b) => {
    totalMap[b.NB] = (totalMap[b.NB] || 0) + b.Hours;
    if (wkRange && (b.Date < wkRange.start || b.Date > wkRange.end)) return;
    filteredMap[b.NB] = (filteredMap[b.NB] || 0) + b.Hours;
  });
  let rows = data.riders
    .filter((r) => r.Name || r.Email || totalMap[r.NB])
    .map((r) => ({ NB: r.NB, Name: r.Name || "", h: filteredMap[r.NB] || 0, total: totalMap[r.NB] || 0 }))
    .filter((r) => !q || (r.NB + r.Name).toLowerCase().includes(q.toLowerCase()));
  if (sort === "hours-desc") rows.sort((a, b) => b.h - a.h);
  if (sort === "hours-asc") rows.sort((a, b) => a.h - b.h);
  if (sort === "nb-asc") rows.sort((a, b) => parseInt(a.NB.replace("NB", "")) - parseInt(b.NB.replace("NB", "")));
  if (sort === "over-week") rows = rows.filter((r) => r.h > 56).sort((a, b) => b.h - a.h);
  if (sort === "over-total") rows = rows.filter((r) => r.total > 160).sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search NB or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={wk} onChange={(e) => setWk(e.target.value)}>
          <option value="all">All weeks</option>
          {weeks.map((w, i) => <option key={w} value={w}>Week {i + 1} ({w})</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="hours-desc">Most hours first</option><option value="hours-asc">Least hours first</option>
          <option value="nb-asc">NB number ↑</option><option value="over-week">Over 56h/week</option><option value="over-total">Over 160h total</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-danger btn-sm" onClick={onEnforce} title="Cancel each over-cap user's most recent shifts until they're at or under 160h total">Enforce 160h cap</button>
      </div>
      {rows.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--ink-3)" }}>No users match.</div>}
      <div className="hours-grid">
        {rows.map((r) => {
          const overTotal = r.total > 160;
          const overWeek = r.h > 56 && wk !== "all";
          const cls = overTotal || overWeek ? "over" : "";
          return (
            <div key={r.NB} className={`hours-card ${cls}`}>
              <div className="nb">{r.NB}</div>
              <div className="nm">{r.Name || "—"}</div>
              <div className="h">{r.h}h{overWeek ? " ⚠" : ""}</div>
              {wk !== "all" && <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4, fontFamily: "var(--font-mono-dm), monospace" }}>Total: {r.total}/160h{overTotal ? " ⚠" : ""}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===== CSV helper (formula-injection safe) =====
function exportCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const sanitize = (v: unknown): string => {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(sanitize).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
