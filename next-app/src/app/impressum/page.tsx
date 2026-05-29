import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Anbieterkennzeichnung gemäß § 5 TMG.",
};

export default function Impressum() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 28, marginBottom: 16 }}>Impressum</h1>
          <p style={{ color: "var(--ink-2)", fontSize: 13, marginBottom: 16 }}>
            Angaben gemäß § 5 TMG (Telemediengesetz) und § 18 Abs. 2 MStV (Medienstaatsvertrag).
          </p>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 16 }}>Diensteanbieter</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Jaisak Group AB<br />
            [GATUADRESS / STRASSE]<br />
            [POSTNUMMER UND ORT, z. B. 111 22 Stockholm]<br />
            Schweden / Sverige
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Vertreten durch</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Verkställande direktör (Geschäftsführung): [VOR- UND NACHNAME]
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Kontakt</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Telefon: [+46 …]<br />
            E-Mail: <a href="mailto:hallo@nourmas.de" style={{ color: "var(--green)" }}>hallo@nourmas.de</a>
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Eintragung im Handelsregister</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Eingetragen im schwedischen Unternehmensregister (Bolagsverket).<br />
            Organisationsnummer: [SE-ORG.NR, Format XXXXXX-XXXX]
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Umsatzsteuer-ID</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Umsatzsteuer-Identifikationsnummer gemäß Art. 214 MwStSystRL:<br />
            [SE-USt-IdNr., z. B. SE556677889901]
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Redaktionell verantwortlich</h2>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:<br />
            [VOR- UND NACHNAME], Anschrift wie oben.
          </div>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>EU-Streitschlichtung</h2>
          <p style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" style={{ color: "var(--green)" }} target="_blank" rel="noopener noreferrer">
              https://ec.europa.eu/consumers/odr/
            </a>. Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
          <p style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <h2 className="display" style={{ fontSize: 18, marginBottom: 8, marginTop: 20 }}>Haftungshinweis</h2>
          <p style={{ color: "var(--ink-2)", lineHeight: 1.7 }}>
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links.
            Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
