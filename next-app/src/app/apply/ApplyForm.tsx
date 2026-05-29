"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const CITIES = [
  "Berlin", "München", "Hamburg", "Köln", "Frankfurt am Main", "Stuttgart",
  "Düsseldorf", "Leipzig", "Dortmund", "Bremen", "Hannover", "Nürnberg", "Other / not listed",
];
const VEHICLES = ["Bicycle", "E-bike", "Roller / motor scooter", "Car"];
const AVAILABILITY = ["Weekday mornings", "Weekday evenings", "Weekend daytime", "Weekend evenings", "Anytime"];

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "ok"; ref: string } | { kind: "err"; msg: string };

export default function ApplyForm() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", city: "Berlin", vehicle: "Bicycle",
    availability: "Weekday evenings", referral: "", why: "",
  });
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) return setStatus({ kind: "err", msg: "Please enter your full name." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setStatus({ kind: "err", msg: "Please enter a valid email." });
    if (form.phone.replace(/\D/g, "").length < 7) return setStatus({ kind: "err", msg: "Please enter a valid phone number." });

    setStatus({ kind: "submitting" });
    try {
      const res = await api<{ ref?: string }>("applyRider", form);
      if (!res.ok) throw new Error(res.error || "Submission failed");
      setStatus({ kind: "ok", ref: res.ref ?? "" });
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof Error ? err.message : "Network error" });
    }
  }

  if (status.kind === "ok") {
    return (
      <section className="panel">
        <div className="confirmation">
          <div className="check" />
          <h2>Application received.</h2>
          <p className="lede">
            Thanks, {form.name.split(" ")[0]}. We&apos;ll review your application and email{" "}
            <strong>{form.email}</strong> within 48 hours with the right-to-work check link.
          </p>
          {status.ref && (
            <div className="conf-detail">
              <div className="row"><span className="k">Reference</span><span className="v">{status.ref}</span></div>
              <div className="row"><span className="k">City</span><span className="v">{form.city}</span></div>
              <div className="row"><span className="k">Vehicle</span><span className="v">{form.vehicle}</span></div>
            </div>
          )}
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 12 }}>
            Check your spam folder if you don&apos;t see us by Wednesday.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      {status.kind === "err" && <div className="alert err">{status.msg}</div>}

      <div className="field">
        <label htmlFor="a_name">Full name</label>
        <input id="a_name" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="a_email">Email</label>
        <input id="a_email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="a_phone">Phone (German mobile preferred)</label>
        <input id="a_phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+49 …" autoComplete="tel" required />
      </div>
      <div className="field">
        <label htmlFor="a_city">City you want to ride in</label>
        <select id="a_city" value={form.city} onChange={(e) => update("city", e.target.value)}>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="a_vehicle">Vehicle</label>
        <select id="a_vehicle" value={form.vehicle} onChange={(e) => update("vehicle", e.target.value)}>
          {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="hint">Roller / car requires KFZ-Versicherung covering gewerbliche Lieferdienste — we&apos;ll check at onboarding.</div>
      </div>
      <div className="field">
        <label htmlFor="a_avail">When can you usually work?</label>
        <select id="a_avail" value={form.availability} onChange={(e) => update("availability", e.target.value)}>
          {AVAILABILITY.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="a_ref">Referral NB number (optional)</label>
        <input id="a_ref" value={form.referral} onChange={(e) => update("referral", e.target.value.toUpperCase())} placeholder="e.g. NB42" />
      </div>
      <div className="field">
        <label htmlFor="a_why">Anything we should know? (optional)</label>
        <textarea id="a_why" rows={3} value={form.why} onChange={(e) => update("why", e.target.value)} placeholder="Previous delivery experience, languages, schedule notes…" />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" disabled={status.kind === "submitting"}>
          {status.kind === "submitting" ? <><span className="loader" /> Submitting…</> : "Submit application →"}
        </button>
      </div>
    </form>
  );
}
