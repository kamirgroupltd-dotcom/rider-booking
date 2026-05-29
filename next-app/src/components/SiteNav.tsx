import Link from "next/link";

export default function SiteNav() {
  return (
    <header className="topbar">
      <div className="container-x">
        <div>
          <Link href="/" className="brand" style={{ color: "#fff", textDecoration: "none" }}>
            Nourmas Shift Booking
          </Link>
          <div className="brand-sub">Flexible delivery shifts · monthly payroll</div>
        </div>
        <nav style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/how-it-works" className="nav-link">How it works</Link>
          <Link href="/faq" className="nav-link">FAQ</Link>
          <Link href="/book" className="nav-link">Book shifts</Link>
          <Link href="/apply" className="nav-link" style={{ background: "var(--mint)", color: "var(--green)" }}>
            Apply now
          </Link>
        </nav>
      </div>
    </header>
  );
}
