import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Read the Century Blog privacy policy for information about cookies, analytics, ads, and user data.",
  alternates: {
    canonical: "/privacy-policy"
  }
};

export default function PrivacyPolicyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Privacy Policy</span>
        <h1>How Century Blog handles data</h1>
        <p>
          Century Blog may use cookies, basic analytics, advertising tools such as Google AdSense,
          and newsletter integrations to improve site performance and support publishing.
        </p>
        <p>
          We do not ask readers to create public accounts on the site. Limited technical data such
          as browser type, device information, and page activity may be processed by hosting,
          analytics, and advertising services to deliver content securely and improve performance.
        </p>
        <p>
          If you contact Century Blog directly, any information you share with us will only be used
          to respond to your message, maintain editorial communication, or manage business
          enquiries.
        </p>
        <p>
          We do not sell personal contact details submitted through our forms. Where third-party
          services such as hosting, analytics, newsletter tools, or advertising providers process
          data, they do so under their own policies and technical safeguards.
        </p>
        <p>
          Century Blog may update this privacy policy as the website changes. The latest version on
          this page is the one that applies to current visitors.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
