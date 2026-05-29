import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AdUnit from "@/components/AdUnit";

const CITIES = ["Berlin", "München", "Hamburg", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Bremen", "Hannover", "Nürnberg"];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 38, lineHeight: 1.05, marginBottom: 12 }}>
            Food delivery shifts that fit around your life.
          </h1>
          <p className="lede" style={{ fontSize: 17, marginBottom: 20 }}>
            We connect couriers across Germany with delivery work in Berlin, München, Hamburg, Köln, Frankfurt and beyond.
            Pick the shifts you want up to five weeks ahead, ride or drive your own vehicle, and manage everything from your phone.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/book" className="btn btn-primary">Book your shift →</Link>
            <Link href="/how-it-works" className="btn btn-ghost">How it works</Link>
          </div>
        </section>

        <AdUnit slot="1111111111" className="my-4" />

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>How we work</h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: "var(--green)" }}>Flexibility</h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                Book the shifts you want, cancel within the published policy window. No minimum hours required.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: "var(--green)" }}>Monthly payroll</h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                Pay is processed on the standard German monthly payroll cycle to your German bank account (SEPA).
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: "var(--green)" }}>Hour limits</h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                4-, 6-, and 8-hour shifts. The booking system enforces daily, weekly, and rolling-window limits in line with Arbeitszeitgesetz.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: "var(--green)" }}>Your vehicle</h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                Bicycle, e-bike, Roller, or car — your vehicle, your route preferences.
              </p>
            </div>
          </div>
        </section>

        <AdUnit slot="2222222222" className="my-4" />

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>What you need to apply</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7, color: "var(--ink-2)" }}>
            <li>Right to work in Germany (EU passport, Aufenthaltstitel with work permission, or equivalent)</li>
            <li>Steuer-ID and a German bank account (IBAN starting with DE) for monthly payroll</li>
            <li>Krankenversicherung — gesetzlich (statutory) or privat (private)</li>
            <li>A smartphone running iOS 15+ or Android 10+</li>
            <li>A vehicle in good condition — bicycle, e-bike, motor scooter, or car</li>
            <li>For Roller or car couriers: valid Führerschein and KFZ-Versicherung that covers entgeltliche Lieferdienste</li>
          </ul>
          <div style={{ marginTop: 20 }}>
            <Link href="/apply" className="btn btn-primary">Start application →</Link>
          </div>
        </section>

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>Cities we operate in</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CITIES.map((c) => (
              <span key={c} style={{ padding: "6px 12px", background: "var(--mint)", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                {c}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--ink-3)" }}>
            Not in your Stadt? <Link href="/apply" style={{ color: "var(--green)" }}>Apply anyway</Link> — we&apos;ll let you know when we open in your area.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
