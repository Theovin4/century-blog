import Link from "next/link";

export const metadata = {
  title: "Contact",
  description: "Contact Century Blog for editorial enquiries, partnerships, and feedback."
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
          For editorial feedback, partnerships, corrections, or advertising enquiries, you can
          contact the Century Blog team through this email.
        </p>
        <p>
          <strong>1todoyou2@gmail.com</strong>
        </p>
      </section>
    </main>
  );
}
