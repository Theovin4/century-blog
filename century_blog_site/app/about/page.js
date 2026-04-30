import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "About",
  description:
    "Learn about Century Blog, a Nigerian digital publication focused on clear reporting, explainers, and everyday relevance.",
  alternates: {
    canonical: "/about"
  }
};

export default function AboutPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">About Century Blog</span>
        <h1>Clear reporting built for everyday readers</h1>
        <p>
          Century Blog is an independent digital publication focused on Nigeria-first reporting,
          timely explainers, and practical stories that readers can quickly understand on mobile or
          desktop.
        </p>
        <p>
          We cover news, business, technology, health, lifestyle, education, entertainment, and
          wider world developments with an emphasis on clarity, context, and clean presentation.
        </p>
        <p>
          Our editorial goal is simple: publish useful stories, avoid clutter, credit sources when
          needed, and make every page easy to read without unnecessary noise.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
