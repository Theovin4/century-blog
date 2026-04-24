import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "Cookies Policy",
  description:
    "Read the Century Blog cookies policy to understand how cookies support analytics, ads, and site performance.",
  alternates: {
    canonical: "/cookies-policy"
  }
};

export default function CookiesPolicyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Cookies Policy</span>
        <h1>How cookies are used on Century Blog</h1>
        <p>
          Century Blog uses cookies and similar technologies to keep the site working properly,
          measure traffic, and improve the reading experience.
        </p>
        <h2>Why cookies may be used</h2>
        <ul>
          <li>To help pages load correctly and keep the site secure.</li>
          <li>To understand visits, page views, and reader behaviour.</li>
          <li>To support analytics, advertising, or embedded media tools.</li>
        </ul>
        <h2>Third-party tools</h2>
        <p>
          Some cookies may be placed by trusted third-party services such as analytics, embedded
          media providers, advertising networks, or newsletter tools. These services may use
          cookies to measure performance, personalise experiences, or support ad delivery.
        </p>
        <h2>Your choice</h2>
        <p>
          You can control or disable cookies in your browser settings. If you disable some cookies,
          parts of the website may not work as smoothly.
        </p>
        <p>
          Century Blog may update this cookies policy whenever new services, advertising tools, or
          measurement features are added to the site.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
