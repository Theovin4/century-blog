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
          Century Blog may use cookies and similar technologies to keep the website secure, measure
          traffic, understand reader behaviour, and improve how pages load across devices.
        </p>
        <p>
          Some cookies may be placed by trusted third-party services such as analytics, embedded
          media providers, advertising networks, or newsletter tools. These services may use
          cookies to measure performance, personalise experiences, or support ad delivery.
        </p>
        <p>
          You can manage or disable cookies through your browser settings. Please note that
          disabling certain cookies may affect how some parts of the website function.
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
