export const metadata = {
  title: "Contact",
  description: "Contact Century Blog for editorial enquiries, partnerships, and feedback."
};

export default function ContactPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <span className="eyebrow">Contact</span>
        <h1>Reach Century Blog</h1>
        <p>
          For editorial feedback, partnerships, corrections, or advertising enquiries, you can
          contact the Century Blog team through the dashboard owner account or your official
          business inbox.
        </p>
        <p>
          Recommended contact email: <strong>hello@centuryblogg.vercel.app</strong>
        </p>
        <p>
          If you later connect a custom domain, update this page with your preferred public email
          address and social media handles.
        </p>
      </section>
    </main>
  );
}
