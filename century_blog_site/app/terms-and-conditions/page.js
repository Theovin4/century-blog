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
          By using Century Blog, you agree to use the website lawfully and responsibly. The site is
          provided for news, information, and general reading.
        </p>
        <h2>What you can do</h2>
        <ul>
          <li>Read and share links to our stories for personal use.</li>
          <li>Browse the website on mobile or desktop for news and updates.</li>
          <li>Contact us if you notice a correction, issue, or business enquiry.</li>
        </ul>
        <h2>What you should not do</h2>
        <ul>
          <li>Copy or republish full articles without permission.</li>
          <li>Use the site for unlawful activity or abusive behaviour.</li>
          <li>Attempt to damage, disrupt, or misuse the website.</li>
        </ul>
        <h2>Content and links</h2>
        <p>
          Century Blog owns its original branding, layout, and editorial content unless a different
          owner is clearly credited. Third-party links, embedded content, and outside services may
          appear on the site, but their content and policies are managed by those providers.
        </p>
        <p>
          We may edit, update, correct, or remove content at any time to improve accuracy and
          reader experience. While we aim to keep the site available and accurate, we cannot
          promise that every page will always be uninterrupted or error free.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
