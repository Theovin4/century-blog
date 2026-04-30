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
        <h1>Contact the Century Blog team</h1>
        <p>
          Use this page for editorial feedback, corrections, partnership enquiries, advertising
          enquiries, or general questions about Century Blog.
        </p>
        <h2>Email</h2>
        <p>
          <strong>1todoyou2@gmail.com</strong>
        </p>
        <h2>What to include</h2>
        <ul>
          <li>Your name and a working email address.</li>
          <li>The article link if your message is about a published story.</li>
          <li>A clear description of the correction, request, or enquiry.</li>
        </ul>
        <p>
          We review messages as soon as possible and use submitted details only to respond to your
          enquiry.
        </p>
        <ContactForm />
      </section>
      <SiteFooter />
    </main>
  );
}
