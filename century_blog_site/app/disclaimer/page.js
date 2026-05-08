import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Disclaimer",
  description:
    "Read the Century Blog disclaimer about general information, developing stories, and non-personalised health or financial content.",
  path: "/disclaimer",
  keywords: ["Century Blog disclaimer", "general information", "health disclaimer", "financial disclaimer"]
});

export default function DisclaimerPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Disclaimer</span>
        <h1>Important reading disclaimer</h1>
        <p>
          Century Blog publishes general news, analysis, explainers, and commentary. Content on the
          site is intended for information and reading purposes only.
        </p>
        <h2>Health and finance topics</h2>
        <p>
          Articles about health, finance, or public safety should not be treated as personal
          medical, legal, or financial advice. Readers should consult qualified professionals or
          official agencies when making important decisions.
        </p>
        <h2>Developing news stories</h2>
        <p>
          Some stories change as events unfold. Details may be updated when better information,
          official statements, or verified reporting becomes available.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
