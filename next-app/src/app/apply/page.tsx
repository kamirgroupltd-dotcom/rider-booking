import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ApplyForm from "./ApplyForm";

export const metadata: Metadata = {
  title: "Apply now — Nourmas courier jobs Germany",
  description: "Apply to become a Nourmas courier in two minutes. Berlin, München, Hamburg, Köln, Frankfurt and 7 more cities. Monthly payroll, your hours.",
};

export default function ApplyPage() {
  return (
    <>
      <SiteNav />
      <main className="container-x" style={{ paddingTop: 32 }}>
        <section className="panel">
          <h1 className="display" style={{ fontSize: 30, marginBottom: 8 }}>Apply to ride with us.</h1>
          <p className="lede">
            Two minutes. We review every application by hand within 48 hours and email you a right-to-work check link.
            No CV required.
          </p>
        </section>
        <ApplyForm />
        <section className="panel" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          <strong>Datenschutz:</strong> We use your details only to assess your application and contact you about courier opportunities.
          Stored on our German-hosted database, deleted after 12 months if you don&apos;t join. Full details in our Datenschutzerklärung.
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
