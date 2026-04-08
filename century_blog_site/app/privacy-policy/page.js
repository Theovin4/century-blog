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
          This policy should be updated whenever you add new third-party services, mailing lists,
          contact forms, analytics providers, or external newsletter tools such as Substack.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
