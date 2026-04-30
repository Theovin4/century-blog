import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: "Contact",
  description: "Contact Century Blog for editorial enquiries, partnerships, and feedback.",
  alternates: {
    canonical: "/contact"
  }
};

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
        <p>
          <strong>1todoyou2@gmail.com</strong>
        </p>
        <p>
          If you are reporting an error in a published story, include the article link and the
          correction you want us to review so we can respond more quickly.
        </p>
        <ContactForm />
      </section>
      <SiteFooter />
    </main>
  );
}
