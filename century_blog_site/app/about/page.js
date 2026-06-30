import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn about Century Blog, a Nigerian digital publication focused on clear reporting, explainers, and everyday relevance.",
  path: "/about",
  keywords: ["About Century Blog", "Nigeria digital publication", "editorial team", "news mission"]
});

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
          We cover news, business, sports, technology, health, lifestyle, education, entertainment, and
          wider world developments with an emphasis on clarity, context, and clean presentation.
        </p>
        <p>
          Our editorial goal is simple: publish useful stories, avoid clutter, credit sources when
          needed, and make every page easy to read without unnecessary noise.
        </p>
        <h2>What readers can expect</h2>
        <ul>
          <li>Readable stories with clearer context and fewer distractions.</li>
          <li>Updates that aim to explain why a story matters, not only what happened.</li>
          <li>Mobile-friendly pages with easy navigation, policy pages, and relevant related links.</li>
        </ul>
        <h2>Editorial approach</h2>
        <p>
          Century Blog publishes a mix of breaking updates, explainers, lifestyle stories, and
          commentary-driven reporting. We aim for balanced wording, straightforward headlines, and
          source awareness, especially on sensitive issues such as health, politics, conflict, and
          finance.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
