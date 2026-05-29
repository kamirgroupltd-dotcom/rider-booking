import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO.",
};

const H2: React.CSSProperties = { fontSize: 19, marginBottom: 10, marginTop: 24 };
const H3: React.CSSProperties = { fontSize: 15, marginBottom: 6, marginTop: 16, color: "var(--green)" };
const P: React.CSSProperties = { color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 10 };

export default function Datenschutz() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 28, marginBottom: 8 }}>Datenschutzerklärung</h1>
          <p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 16 }}>
            Stand: {new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          <h2 className="display" style={H2}>1. Verantwortlicher</h2>
          <p style={P}>
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
          </p>
          <p style={P}>
            Jaisak Group AB<br />
            [GATUADRESS / STRASSE]<br />
            [POSTNUMMER UND ORT], Schweden<br />
            Organisationsnummer: [SE-ORG.NR]<br />
            E-Mail: <a href="mailto:datenschutz@nourmas.de" style={{ color: "var(--green)" }}>datenschutz@nourmas.de</a>
          </p>
          <p style={P}>
            Weitere Angaben zum Verantwortlichen finden Sie im <Link href="/impressum" style={{ color: "var(--green)" }}>Impressum</Link>.
          </p>

          <h2 className="display" style={H2}>2. Allgemeines zur Datenverarbeitung</h2>
          <p style={P}>
            Wir verarbeiten personenbezogene Daten unserer Nutzerinnen und Nutzer grundsätzlich nur, soweit dies zur Bereitstellung einer
            funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist. Die Verarbeitung erfolgt regelmäßig nur nach
            Einwilligung der Nutzer (Art. 6 Abs. 1 lit. a DSGVO), zur Vertragserfüllung (lit. b), zur Erfüllung rechtlicher Verpflichtungen
            (lit. c) oder zur Wahrung berechtigter Interessen (lit. f).
          </p>

          <h2 className="display" style={H2}>3. Bereitstellung der Website und Server-Logfiles</h2>
          <p style={P}>
            Bei jedem Aufruf unserer Website erfasst unser Hosting-Provider automatisch technische Informationen wie IP-Adresse, Datum und
            Uhrzeit des Zugriffs, übertragene Datenmenge, anfragender Provider, Browsertyp und Betriebssystem. Diese Daten werden in den
            Server-Logfiles gespeichert.
          </p>
          <p style={P}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer technisch fehlerfreien Darstellung und Sicherheit).
            Speicherdauer: in der Regel 14 Tage, danach automatische Löschung oder Anonymisierung.
          </p>

          <h2 className="display" style={H2}>4. Cookies und vergleichbare Technologien</h2>
          <p style={P}>
            Wir setzen Cookies und vergleichbare Technologien (z. B. localStorage) ein. Notwendige Cookies werden ohne Einwilligung gesetzt
            (§ 25 Abs. 2 Nr. 2 TTDSG). Alle nicht notwendigen Cookies — insbesondere für personalisierte Werbung — werden ausschließlich nach
            Ihrer ausdrücklichen Einwilligung gesetzt (§ 25 Abs. 1 TTDSG, Art. 6 Abs. 1 lit. a DSGVO).
          </p>
          <p style={P}>
            Sie können Ihre Einwilligung über das Cookie-Banner jederzeit anpassen oder widerrufen.
          </p>

          <h3 style={H3}>Funktional notwendig</h3>
          <p style={P}>
            <strong>localStorage „courier_id&ldquo;</strong> — speichert auf der Buchungsseite Ihre NB-Nummer, Name und E-Mail-Adresse, damit
            Sie sich beim erneuten Besuch nicht neu identifizieren müssen. Wird nur nach Ihrer Eingabe erstellt und kann jederzeit über die
            Browser-Einstellungen gelöscht werden.
          </p>

          <h2 className="display" style={H2}>5. Bewerbungsformular</h2>
          <p style={P}>
            Wenn Sie das Bewerbungsformular unter <Link href="/apply" style={{ color: "var(--green)" }}>/apply</Link> nutzen, verarbeiten wir
            die von Ihnen eingegebenen Daten (Name, E-Mail, Telefon, Stadt, Fahrzeug, Verfügbarkeit, optionale Empfehlungs-NB, optionale
            Anmerkungen) zur Prüfung Ihrer Bewerbung und Kontaktaufnahme.
          </p>
          <p style={P}>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen auf Ihre Anfrage).
          </p>
          <p style={P}>
            <strong>Datenverarbeiter:</strong> Die Bewerbungsdaten werden über Google Apps Script (Google Ireland Limited, Gordon House,
            Barrow Street, Dublin 4, Irland) in einer von uns betriebenen Google-Tabelle gespeichert. Es bestehen ein Auftragsverarbeitungs­vertrag
            sowie EU-Standardvertragsklauseln gemäß Art. 46 DSGVO. Daten können dabei in die USA übermittelt werden; Google LLC ist nach dem
            EU-US Data Privacy Framework zertifiziert.
          </p>
          <p style={P}>
            <strong>Speicherdauer:</strong> Bei erfolgreicher Bewerbung werden die Daten in das Beschäftigungsverhältnis überführt und nach
            den gesetzlichen Fristen aufbewahrt. Andernfalls werden die Daten spätestens nach 12 Monaten gelöscht.
          </p>

          <h2 className="display" style={H2}>6. Google AdSense</h2>
          <p style={P}>
            Wir nutzen Google AdSense, einen Dienst der Google Ireland Limited, zur Einbindung von Werbeanzeigen. Google AdSense verwendet
            Cookies und vergleichbare Technologien, um Werbung anzuzeigen, die für Sie relevant ist, sowie zur Reichweitenmessung.
          </p>
          <p style={P}>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), § 25 Abs. 1 TTDSG. Die Einwilligung erfassen wir
            über unser Consent-Management-Banner. Ohne Einwilligung werden ausschließlich nicht-personalisierte Anzeigen ausgespielt
            (Google Consent Mode v2, Default „denied&ldquo;).
          </p>
          <p style={P}>
            <strong>Datenübermittlung in Drittländer:</strong> Möglich an Google LLC, USA. Google LLC ist nach dem EU-US Data Privacy
            Framework zertifiziert.
          </p>
          <p style={P}>
            Weitere Informationen: <a href="https://policies.google.com/technologies/ads" style={{ color: "var(--green)" }} target="_blank" rel="noopener noreferrer">policies.google.com/technologies/ads</a>.
          </p>

          <h2 className="display" style={H2}>7. Schriftarten</h2>
          <p style={P}>
            Wir nutzen Google Fonts (Sora, DM Mono, Anton). Die Schriftarten werden über das self-hosting-Feature von Next.js
            <em> next/font/google</em> zur Build-Zeit lokal in unsere Anwendung integriert und beim Seitenaufruf von unserem eigenen Server
            ausgeliefert. Es findet keine Verbindung zwischen Ihrem Browser und Google-Servern zum Laden der Schriftarten statt.
          </p>

          <h2 className="display" style={H2}>8. Ihre Rechte</h2>
          <p style={P}>
            Sie haben jederzeit das Recht auf:
          </p>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7, color: "var(--ink-2)" }}>
            <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung („Recht auf Vergessenwerden&ldquo;, Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            <li>Widerruf einer erteilten Einwilligung jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
          </ul>
          <p style={P}>
            Bitte richten Sie Ihr Anliegen an: <a href="mailto:datenschutz@nourmas.de" style={{ color: "var(--green)" }}>datenschutz@nourmas.de</a>.
          </p>

          <h2 className="display" style={H2}>9. Beschwerderecht</h2>
          <p style={P}>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Zuständig ist die
            Aufsichtsbehörde des Bundeslandes Ihres gewöhnlichen Aufenthaltsorts oder unseres Unternehmenssitzes.
          </p>

          <h2 className="display" style={H2}>10. Änderungen dieser Datenschutzerklärung</h2>
          <p style={P}>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht
            oder Änderungen unserer Leistungen umgesetzt werden können. Die jeweils aktuelle Version ist unter dieser URL abrufbar.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
