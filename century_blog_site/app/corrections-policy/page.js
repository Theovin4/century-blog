import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Corrections Policy",
  description:
    "Read how Century Blog reviews factual issues, updates published stories, and handles reader correction requests.",
  path: "/corrections-policy",
  keywords: ["Century Blog corrections policy", "story updates", "editorial fixes", "report an error"]
});

export default function CorrectionsPolicyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Corrections Policy</span>
        <h1>How corrections and updates are handled</h1>
        <p>
          Century Blog takes factual accuracy seriously. If a story contains an error, lacks
          important context, or needs clarification, we review the issue and update the article
          where appropriate.
        </p>
        <h2>How to report an issue</h2>
        <ul>
          <li>Send the article link.</li>
          <li>Describe the issue clearly and briefly.</li>
          <li>Include supporting evidence or an authoritative source where possible.</li>
        </ul>
        <h2>What happens next</h2>
        <p>
          We review correction requests as quickly as possible. If a change is made, the story may
          be updated directly, and major factual changes may be reflected in the updated timestamp.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
