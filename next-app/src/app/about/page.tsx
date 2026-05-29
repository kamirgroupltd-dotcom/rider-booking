import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AdUnit from "@/components/AdUnit";

export const metadata: Metadata = {
  title: "About us",
  description: "About Nourmas — a German shift-booking platform connecting couriers with delivery work.",
};

export default function About() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 32, marginBottom: 12 }}>About Nourmas.</h1>
          <p className="lede">
            Nourmas is a German shift-booking platform that connects couriers with delivery work. We&apos;re focused on a clear,
            predictable way to plan your week, and on letting people speak to people when something needs sorting.
          </p>
        </section>

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>What we focus on</h2>
          <p style={{ color: "var(--ink-2)", marginBottom: 10 }}>
            <strong>Predictability.</strong> A booking window you can plan around, rather than reacting to demand by the hour.
          </p>
          <p style={{ color: "var(--ink-2)", marginBottom: 10 }}>
            <strong>People answer the phone.</strong> If something goes wrong with your account or a shift, a person handles it.
          </p>
          <p style={{ color: "var(--ink-2)" }}>
            <strong>Clear terms.</strong> We try to make pay, scheduling, and cancellation rules legible before you commit.
          </p>
        </section>

        <AdUnit slot="6666666666" className="my-4" />

        <section className="panel">
          <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>Contact</h2>
          <div style={{ display: "grid", gap: 8, color: "var(--ink-2)", fontSize: 14 }}>
            <div><strong>Allgemein:</strong> <a href="mailto:hallo@nourmas.de">hallo@nourmas.de</a></div>
            <div><strong>Presse:</strong> presse@nourmas.de</div>
            <div><strong>Kurier-Support:</strong> support@nourmas.de</div>
          </div>
        </section>

        <section className="panel" style={{ textAlign: "center" }}>
          <Link href="/apply" className="btn btn-primary">Apply now →</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
