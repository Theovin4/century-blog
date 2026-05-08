import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Contact",
  description: "Contact Century Blog for editorial enquiries, partnerships, corrections, advertising, and reader feedback.",
  path: "/contact",
  keywords: ["Contact Century Blog", "editorial enquiries", "corrections", "advertising contact"]
});

export default function ContactPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <Link href="/" className="back-home-button">
          Back to Home
        </Link>
        <span className="eyebrow">Contact</span>
        <h1>Reach Century Blog</h1>
        <p>
          Contact Century Blog for corrections, editorial feedback, business enquiries, or general
          support. We read submissions from readers, brands, and partners through the contact form
          below.
        </p>
        <h2>Primary contact</h2>
        <p>
          <strong>1todoyou2@gmail.com</strong>
        </p>
        <p>
          If you are reporting an error in a published story, include the article link and the
          correction you want us to review so we can respond more quickly.
        </p>
        <h2>Best reasons to contact us</h2>
        <ul>
          <li>Corrections or clarifications on a published article.</li>
          <li>Advertising and brand collaboration enquiries.</li>
          <li>Reader feedback about navigation, trust, or user experience.</li>
          <li>Editorial tips or partnership opportunities relevant to Century Blog.</li>
        </ul>
        <ContactForm />
      </section>
      <SiteFooter />
    </main>
  );
}
