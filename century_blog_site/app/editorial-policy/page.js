import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Editorial Policy",
  description:
    "Read Century Blog's editorial policy for sourcing standards, tone, corrections, and reader-first publishing principles.",
  path: "/editorial-policy",
  keywords: ["Century Blog editorial policy", "publishing standards", "sourcing rules", "reader trust"]
});

export default function EditorialPolicyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Editorial Policy</span>
        <h1>How Century Blog approaches editorial trust</h1>
        <p>
          Century Blog aims to publish useful, readable, and responsibly framed stories for readers
          in Nigeria and beyond. We prioritise clarity, context, and user experience over noisy
          formatting or sensational presentation.
        </p>
        <h2>What guides our coverage</h2>
        <ul>
          <li>Clear headlines that reflect the actual story.</li>
          <li>Practical context that explains why a story matters.</li>
          <li>Source awareness, especially on health, finance, politics, and conflict stories.</li>
          <li>Reader-first formatting designed for mobile and desktop use.</li>
        </ul>
        <h2>Standards for sensitive topics</h2>
        <p>
          On health, war, politics, public safety, and financial stories, we aim to use neutral
          wording, avoid unsupported claims, and point readers toward official guidance or verified
          reporting where available.
        </p>
        <h2>Originality and usefulness</h2>
        <p>
          Century Blog aims to avoid thin, copied, or generic content. We prefer stories that add
          explanation, local relevance, or practical value instead of simply repeating headlines.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
