import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AdUnit from "@/components/AdUnit";

export const metadata: Metadata = {
  title: "FAQ — Nourmas courier jobs Germany",
  description: "Questions and answers about applying as a courier with Nourmas in Germany.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much will I earn?",
    a: "Earnings depend on hours booked, city, time of day, and tips. You'll see the applicable hourly rate for your city during onboarding before you commit to any shifts. We don't advertise representative figures here because they vary too much to be meaningful.",
  },
  {
    q: "Am I employed, freelance, or a Minijobber?",
    a: "Contract details are confirmed during onboarding once your right to work and documents are verified. We discuss the available options with you and you choose what fits.",
  },
  {
    q: "How does tax work?",
    a: "Standard German payroll deductions apply where you're employed (Lohnsteuer, Sozialversicherungsbeiträge). Your annual Lohnsteuerbescheinigung is provided via the app. If you need help with a Steuererklärung we can recommend a tax adviser.",
  },
  {
    q: "Do I need my own bike or vehicle?",
    a: "Yes. We don't rent or lease vehicles. Most new couriers start on a regular bicycle and upgrade once they know which Stadtteile they prefer.",
  },
  {
    q: "What insurance do I need?",
    a: "Bicycle couriers don't need vehicle insurance, but a private liability policy (Privathaftpflicht) is sensible. Roller and car couriers must hold KFZ-Versicherung that covers entgeltliche Lieferdienste — standard private motor insurance does not cover commercial delivery work and any claim would be denied. We verify documents during onboarding.",
  },
  {
    q: "Can I work for other delivery platforms at the same time?",
    a: "Outside of a Nourmas shift you can ride for anyone you like. During a booked Nourmas shift you should not be accepting work from other platforms — full terms are set out in the contract you sign.",
  },
  {
    q: "What hours can I book?",
    a: "Shifts come in 4-, 6-, and 8-hour blocks. The system caps your daily, weekly, and rolling-window hours in line with Arbeitszeitgesetz limits and enforces the Ruhezeit between shifts. You can book up to 5 weeks ahead.",
  },
  {
    q: "What happens if I get injured during a shift?",
    a: "Stop riding immediately, call 112 if it's serious, and report it via the app as soon as you can. Workplace accident reporting and the support process are explained in onboarding.",
  },
  {
    q: "Do you provide any equipment?",
    a: "We provide branded equipment that ships to you when you start. Items, eligibility, and timing are confirmed during onboarding.",
  },
  {
    q: "Is this halal-certified?",
    a: "Many of our restaurant partners hold halal certification from recognised certifiers. The in-app preferences panel lets you opt to be matched preferentially to halal-only orders.",
  },
  {
    q: "What cities are you in?",
    a: "We operate in Berlin, München, Hamburg, Köln, Frankfurt am Main, Stuttgart, Düsseldorf, Leipzig, Dortmund, Bremen, Hannover, and Nürnberg. Apply anyway if you're nearby — we let waiting-list applicants know first when we open a new city.",
  },
  {
    q: "Can I refer a friend?",
    a: "Yes. Share your NB number with them when they apply; referral terms are confirmed during onboarding.",
  },
];

export default function FAQ() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 32, marginBottom: 12 }}>Frequently asked questions</h1>
          <p className="lede">If your question isn&apos;t here, email <a href="mailto:hallo@nourmas.de" style={{ color: "var(--green)" }}>hallo@nourmas.de</a>.</p>
        </section>

        {FAQS.map((f, i) => (
          <section key={i} className="panel">
            <h2 className="display" style={{ fontSize: 19, marginBottom: 10 }}>{f.q}</h2>
            <p style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{f.a}</p>
            {(i === 3 || i === 8) && <div style={{ marginTop: 16 }}><AdUnit slot={i === 3 ? "4444444444" : "5555555555"} /></div>}
          </section>
        ))}

        <section className="panel" style={{ textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: 24, marginBottom: 8 }}>Still got questions?</h2>
          <p style={{ color: "var(--ink-2)", marginBottom: 16 }}>Easiest is to apply — we&apos;ll answer everything during onboarding.</p>
          <Link href="/apply" className="btn btn-primary">Apply now →</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
