import Link from "next/link";
import CookieSettingsLink from "@/components/CookieSettingsLink";

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--rule)", padding: "32px 16px", marginTop: 48, color: "var(--ink-2)" }}>
      <div className="container-x" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div>
          <div className="display" style={{ fontSize: 20, marginBottom: 6 }}>Nourmas Shift Booking</div>
          <p style={{ fontSize: 13 }}>Flexible food delivery work in Germany&apos;s busiest cities. Monthly payroll, your hours, your bike or car.</p>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Get started</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <Link href="/apply">Apply now</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/about">About</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Existing couriers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <Link href="/book">Book shifts</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Rechtliches</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutzerklärung</Link>
            <CookieSettingsLink />
          </div>
        </div>
      </div>
      <div className="container-x" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--rule)", fontSize: 12, color: "var(--ink-3)" }}>
        © {new Date().getFullYear()} Jaisak Group AB. Alle Rechte vorbehalten.
      </div>
    </footer>
  );
}
