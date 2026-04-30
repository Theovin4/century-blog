import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "About",
  description:
    "Learn about Century Blog, a Nigerian digital publication covering news, lifestyle, health, education, business, technology, sports, and daily gist.",
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
        <h1>Clear news and useful stories for everyday readers</h1>
        <p>
          Century Blog is an independent digital publication created for readers who want clear,
          timely, and easy-to-read stories from Nigeria and around the world.
        </p>
        <h2>What we cover</h2>
        <ul>
          <li>Nigerian news, public updates, and daily conversations.</li>
          <li>World stories that affect readers locally and globally.</li>
          <li>Business, technology, education, health, lifestyle, sports, and entertainment.</li>
        </ul>
        <h2>Our editorial approach</h2>
        <p>
          We aim to publish information in simple language, with clear headlines, useful context,
          and a reading experience that works well on mobile and desktop. When a story needs an
          update or correction, we review it and improve the page as quickly as possible.
        </p>
        <h2>Who we serve</h2>
        <p>
          Century Blog is for students, families, professionals, business owners, and curious
          readers who want news and explainers without clutter or confusing presentation.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
