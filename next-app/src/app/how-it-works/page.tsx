import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AdUnit from "@/components/AdUnit";

export const metadata: Metadata = {
  title: "How it works",
  description: "From application to your first food delivery shift in Germany: apply, verify, onboard, book, ride.",
};

export default function HowItWorks() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 32, marginBottom: 12 }}>From application to first shift.</h1>
          <p className="lede">
            We try to keep courier onboarding straightforward — no recruiter calls, no group inductions, no commitment until
            you take your first shift. Here&apos;s what to expect when you apply.
          </p>
        </section>

        {[
          {
            n: "1",
            t: "Apply online",
            b: "Fill in your name, email, phone, and which city you want to ride in. If a friend already rides with us, mention their NB number — referral terms are confirmed during onboarding.",
          },
          {
            n: "2",
            t: "Right-to-work and vehicle check",
            b: "We email you a secure link to upload your Personalausweis or Aufenthaltstitel, Führerschein (Roller/car only), and KFZ-Versicherung documents. Reviewed by a person, not an algorithm.",
          },
          {
            n: "3",
            t: "Onboarding video and quiz",
            b: "A short film covering Lebensmittelhygiene basics, allergen handling, Straßenverkehrsordnung for couriers, and how the booking system works. A few questions at the end. Watch on your phone, whenever you want.",
          },
          {
            n: "4",
            t: "Get your NB number and book your first shift",
            b: "You receive a unique NB number (your courier ID) and access to the shift booking system. Browse five weeks of available shifts, pick what fits, hit Book. You'll get a confirmation email and a calendar invite.",
          },
          {
            n: "5",
            t: "Ride, deliver, monthly payroll",
            b: "Turn up at the Übergabepunkt at the start time, follow your in-app route, and complete the shift. Pay is processed on the standard German monthly payroll cycle to your German bank account (SEPA). Tips remain yours.",
          },
        ].map((step, i) => (
          <section key={step.n} className="panel">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div className="display" style={{ fontSize: 48, color: "var(--mint-2)", minWidth: 56 }}>{step.n}</div>
              <div>
                <h2 className="display" style={{ fontSize: 22, marginBottom: 8 }}>{step.t}</h2>
                <p style={{ color: "var(--ink-2)" }}>{step.b}</p>
              </div>
            </div>
            {i === 1 && <div style={{ marginTop: 16 }}><AdUnit slot="3333333333" /></div>}
          </section>
        ))}

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>What if I can&apos;t make a shift I&apos;ve booked?</h2>
          <p style={{ color: "var(--ink-2)", marginBottom: 10 }}>
            You can cancel shifts up to the published cut-off, which is shown in the booking system. There&apos;s a limit on
            self-cancellations per week to keep shift coverage reliable; the system will tell you if you&apos;re close to it.
          </p>
          <p style={{ color: "var(--ink-2)" }}>
            Inside the cancellation cut-off, contact your Hub-Koordinator. No-shows are handled per the agreement you sign during
            onboarding.
          </p>
        </section>

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>Ready?</h2>
          <Link href="/apply" className="btn btn-primary">Apply now →</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
