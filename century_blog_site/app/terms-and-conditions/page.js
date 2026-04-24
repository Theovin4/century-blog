import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "Terms and Conditions",
  description:
    "Read the Century Blog terms and conditions for site usage, content rules, and publishing disclaimers.",
  alternates: {
    canonical: "/terms-and-conditions"
  }
};

export default function TermsAndConditionsPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Terms and Conditions</span>
        <h1>Rules for using Century Blog</h1>
        <p>
          By using Century Blog, you agree to access the website responsibly and to use its
          content for lawful, personal, and informational purposes only.
        </p>
        <p>
          All articles, headlines, graphics, branding, and editorial materials published on Century
          Blog remain the property of the site or their respective credited owners unless stated
          otherwise. Content may not be copied, republished, or redistributed in bulk without
          permission.
        </p>
        <p>
          Century Blog may update, edit, remove, or correct published content at any time in order
          to improve accuracy, clarity, or reader experience. We do not guarantee that every page
          will always be uninterrupted or error free.
        </p>
        <p>
          External links, embedded media, and third-party services may appear on the website for
          reference, sharing, analytics, advertising, or sourcing. Century Blog is not responsible
          for the policies or content of third-party websites.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
