import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Advertise",
  description:
    "Learn how Century Blog approaches future advertising placements, brand safety, and reader-first monetisation.",
  path: "/advertise",
  keywords: ["Advertise on Century Blog", "brand safety", "reader-first ads", "Nigeria news advertising"]
});

export default function AdvertisePage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Advertise</span>
        <h1>Reader-first advertising on Century Blog</h1>
        <p>
          Century Blog is building a clean advertising environment designed to support publishing
          without overwhelming readers. Future ad placements are intended to stay clearly labelled,
          lightweight, and respectful of the reading experience.
        </p>
        <h2>Advertising principles</h2>
        <ul>
          <li>Ad placements should never confuse readers or imitate editorial content.</li>
          <li>Important content areas should remain readable on mobile and desktop.</li>
          <li>Monetisation should support the site, not clutter it.</li>
        </ul>
        <p>
          For brand or partnership discussions, please contact Century Blog through the contact
          page and include the type of campaign or placement you are interested in.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
